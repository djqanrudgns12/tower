/**
 * NEIS(교육부 나이스) 오픈 API 학교 정보 연동 서비스.
 * 학교 와이파이 방화벽에서 open.neis.go.kr 직접 접근이 차단되거나 지연될 때를 대비해
 * 기록·랭킹 서버의 24시간 엣지 캐시 프록시(/v1/schools)를 먼저 조회하고, 실패 시 NEIS 직접 호출로 폴백한다.
 */

export interface NeisSchool {
  schoolCode: string;
  schoolName: string;
  officeCode: string;
  officeName: string;
  locationName: string;
  schoolKind: string;
  roadAddress: string;
}

export interface SearchOptions {
  apiKey?: string;
  pSize?: number;
  signal?: AbortSignal;
  proxyBase?: string;
}

const NEIS_TIMEOUT_MS = 5000;

function withTimeoutSignal(external?: AbortSignal): { signal: AbortSignal; cleanup(): void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NEIS_TIMEOUT_MS);
  const onExternalAbort = () => ctrl.abort();
  if (external) {
    if (external.aborted) ctrl.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cleanup() {
      clearTimeout(timer);
      if (external) external.removeEventListener('abort', onExternalAbort);
    },
  };
}

function dedupeAndSortSchools(items: readonly NeisSchool[], limit: number): NeisSchool[] {
  const seen = new Set<string>();
  const out: NeisSchool[] = [];
  for (const item of items) {
    if (!item.schoolCode || !item.schoolName || seen.has(item.schoolCode)) continue;
    seen.add(item.schoolCode);
    out.push(item);
  }
  out.sort((a, b) => {
    const aElem = a.schoolKind.includes('초등학교') ? 0 : 1;
    const bElem = b.schoolKind.includes('초등학교') ? 0 : 1;
    return aElem - bElem;
  });
  return out.slice(0, limit);
}

function readProxyBase(options?: SearchOptions): string {
  if (typeof options?.proxyBase === 'string') {
    return options.proxyBase.trim().replace(/\/+$/, '');
  }
  if (typeof import.meta === 'undefined' || import.meta.env?.MODE === 'test') return '';
  const raw = import.meta.env?.VITE_API_BASE;
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
}

async function fetchViaProxy(base: string, trimmed: string, limit: number, externalSignal?: AbortSignal): Promise<NeisSchool[] | null> {
  const { signal, cleanup } = withTimeoutSignal(externalSignal);
  try {
    const res = await fetch(`${base}/v1/schools?q=${encodeURIComponent(trimmed)}`, { signal });
    if (!res.ok) return null;
    if (res.headers?.get?.('Content-Type')?.toLowerCase().includes('text/html')) return null;
    const data = (await res.json()) as { schools?: unknown };
    if (!Array.isArray(data?.schools)) return null;
    const list: NeisSchool[] = [];
    for (const raw of data.schools) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      list.push({
        schoolCode: String(r.schoolCode ?? '').trim(),
        schoolName: String(r.schoolName ?? '').trim(),
        officeCode: String(r.officeCode ?? '').trim(),
        officeName: String(r.officeName ?? '').trim(),
        locationName: String(r.locationName ?? '').trim(),
        schoolKind: String(r.schoolKind ?? '').trim(),
        roadAddress: String(r.roadAddress ?? '').trim(),
      });
    }
    return dedupeAndSortSchools(list, limit);
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/**
 * NEIS OpenAPI(및 서버 캐시 프록시)를 통해 학교명을 검색한다.
 * @param query 검색할 학교명 (최소 2자 이상)
 * @param options 인증키, 페이지 크기, 취소 시그널 등
 */
export async function searchNeisSchools(
  query: string,
  options?: SearchOptions,
): Promise<NeisSchool[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }
  if (options?.signal?.aborted) {
    return [];
  }

  const limit = Math.max(1, Math.min(30, options?.pSize ?? 10));
  const proxyBase = readProxyBase(options);
  if (proxyBase && !options?.apiKey) {
    const proxied = await fetchViaProxy(proxyBase, trimmed, limit, options?.signal);
    if (proxied !== null) return proxied;
    if (options?.signal?.aborted) return [];
  }

  const key =
    options?.apiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEIS_API_KEY
      ? String(import.meta.env.VITE_NEIS_API_KEY)
      : '');

  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: String(limit),
    SCHUL_NM: trimmed,
  });

  if (key) {
    params.set('KEY', key);
  }

  const { signal, cleanup } = withTimeoutSignal(options?.signal);
  try {
    const res = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`, { signal });
    if (!res.ok) {
      return [];
    }
    if (res.headers?.get?.('Content-Type')?.toLowerCase().includes('text/html')) {
      return [];
    }

    const data = (await res.json()) as {
      schoolInfo?: [
        { head: unknown[] },
        { row: Array<Record<string, unknown>> },
      ];
      RESULT?: { CODE: string; MESSAGE: string };
    };

    if (!data.schoolInfo || !Array.isArray(data.schoolInfo) || data.schoolInfo.length < 2) {
      return [];
    }

    const rows = data.schoolInfo[1]?.row;
    if (!Array.isArray(rows)) {
      return [];
    }

    const mapped = rows.map(r => ({
      schoolCode: String(r.SD_SCHUL_CODE ?? '').trim(),
      schoolName: String(r.SCHUL_NM ?? '').trim(),
      officeCode: String(r.ATPT_OFCDC_SC_CODE ?? '').trim(),
      officeName: String(r.ATPT_OFCDC_SC_NM ?? '').trim(),
      locationName: String(r.LCTN_SC_NM ?? '').trim(),
      schoolKind: String(r.SCHUL_KND_SC_NM ?? '').trim(),
      roadAddress: String(r.ORG_RDNMA ?? '').trim(),
    }));
    return dedupeAndSortSchools(mapped, limit);
  } catch {
    return [];
  } finally {
    cleanup();
  }
}
