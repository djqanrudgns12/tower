/**
 * NEIS(교육부 나이스) 오픈 API 학교 정보 연동 서비스.
 * 학교 기본정보 API(schoolInfo)를 호출하여 초·중·고 학교명 및 코드를 조회한다.
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
}

/**
 * NEIS OpenAPI를 통해 학교명을 검색한다.
 * @param query 검색할 학교명 (최소 2자 이상)
 * @param options 인증키, 페이지 크기, 취소 시그널 등
 */
export async function searchNeisSchools(
  query: string,
  options?: SearchOptions
): Promise<NeisSchool[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const key =
    options?.apiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEIS_API_KEY
      ? String(import.meta.env.VITE_NEIS_API_KEY)
      : '');

  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: String(options?.pSize ?? 10),
    SCHUL_NM: trimmed,
  });

  if (key) {
    params.set('KEY', key);
  }

  try {
    const fetchInit: RequestInit = {};
    if (options?.signal) {
      fetchInit.signal = options.signal;
    }
    const res = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`, fetchInit);
    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as {
      schoolInfo?: [
        { head: unknown[] },
        { row: Array<Record<string, unknown>> }
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

    return rows.map(r => ({
      schoolCode: String(r.SD_SCHUL_CODE ?? '').trim(),
      schoolName: String(r.SCHUL_NM ?? '').trim(),
      officeCode: String(r.ATPT_OFCDC_SC_CODE ?? '').trim(),
      officeName: String(r.ATPT_OFCDC_SC_NM ?? '').trim(),
      locationName: String(r.LCTN_SC_NM ?? '').trim(),
      schoolKind: String(r.SCHUL_KND_SC_NM ?? '').trim(),
      roadAddress: String(r.ORG_RDNMA ?? '').trim(),
    }));
  } catch {
    return [];
  }
}
