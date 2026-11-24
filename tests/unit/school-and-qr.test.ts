import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildClassroomShareUrl, detectInAppBrowser, parseEntrySearchParams } from '../../src/application/entryUrl';
import { searchNeisSchools } from '../../src/application/neis';
import { cleanPublicSchoolCode, cleanPublicSchoolName } from '../../src/contracts/lobby';
import { addRecord, clearLocalHistory, listPendingRunSyncs, resetDbConnection, type RunRecord } from '../../src/persistence/db';
import { buildLocalRanking, fetchRanking, queueAndFlushCompletedRun } from '../../src/persistence/lobbyClient';
import { loadSettings, saveSettings } from '../../src/persistence/settings';
import { ClassroomQrModal } from '../../src/ui/screens/home/ClassroomQrModal';
import { canEncodeQr, encodeQrMatrix, qrMatrixToSvgPath } from '../../src/ui/utils/qr';

const API = 'https://api.example';
const DEVICE = '459d7cbc-0b34-4e94-82a5-26fe45038796';
const TOKEN = `v1.${DEVICE}.${'A'.repeat(43)}`;

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

function sampleRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: '11111111-2222-4333-8444-555555555555',
    nickname: '참나무파수꾼',
    grade: 3,
    difficulty: 'Normal',
    mapId: 'garden_u',
    pt: 4200,
    completedWave: 6,
    endedAtWave: 7,
    correct: 14,
    wrong: 1,
    skipped: 0,
    endedAt: '2026-11-16T00:00:00.000Z',
    endReason: 'DEFEAT',
    contentMode: 'published',
    balanceVersion: '1.0.0',
    bankVersion: 'pub-3',
    answers: [{ encounterId: 1, questionId: 'Q50-G3-001', revision: 1, choice: 'a', phase: 'prep', wave: 1 }],
    activeTicks: 3600,
    ...overrides,
  };
}

describe('교실 QR·공유 URL·학교 와이파이 내성 단위 검증', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('학교 이름·코드 정제기가 제어문자와 형식을 엄격히 검증한다', () => {
    expect(cleanPublicSchoolName('  서울가락초등학교  ')).toBe('서울가락초등학교');
    expect(cleanPublicSchoolName('가')).toBe('');
    expect(cleanPublicSchoolCode('7010057')).toBe('7010057');
    expect(cleanPublicSchoolCode('DROP TABLE;--')).toBe('');
  });

  it('QR·공유 쿼리 파서가 학년·학교 설정을 읽고 추적 파라미터만 치우며 점검 쿼리는 보존한다', () => {
    const parsed = parseEntrySearchParams(
      '?grade=3&school=%EC%84%9C%EC%9A%B8%EA%B0%80%EB%9D%BD%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90&sc=7010057&utm_source=kakao&previewMap=garden_u',
    );
    expect(parsed.patch).toEqual({
      lastGrade: 3,
      lastSchoolName: '서울가락초등학교',
      lastSchoolCode: '7010057',
    });
    expect(parsed.changed).toBe(true);
    expect(parsed.cleanedSearch).toBe('?previewMap=garden_u');

    const built = buildClassroomShareUrl({
      origin: 'https://voca.ssamuniverse.com/',
      pathname: '/',
      grade: 4,
      schoolName: '서울가락초등학교',
      schoolCode: '7010057',
    });
    expect(built).toBe(
      'https://voca.ssamuniverse.com/?grade=4&school=%EC%84%9C%EC%9A%B8%EA%B0%80%EB%9D%BD%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90&sc=7010057',
    );
  });

  it('대표 메신저·알림장 인앱 브라우저 UA를 정확히 식별한다', () => {
    expect(detectInAppBrowser('Mozilla/5.0 ... KAKAOTALK 10.5.0')).toBe('카카오톡');
    expect(detectInAppBrowser('Mozilla/5.0 ... Classting/8.2')).toBe('클래스팅');
    expect(detectInAppBrowser('Mozilla/5.0 ... NAVER(inapp; search; 1000)')).toBe('네이버 앱');
    expect(detectInAppBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130.0')).toBeNull();
  });

  it.each(['7010057', ''])('30자 한글 학교 이름(학교 코드=%j)이 길어도 전체 입장 주소와 복사 버튼을 그린다', schoolCode => {
    const schoolName = '가'.repeat(30);
    const url = buildClassroomShareUrl({ grade: 3, schoolName, schoolCode });
    expect(canEncodeQr(url)).toBe(false);
    const html = renderToStaticMarkup(createElement(ClassroomQrModal, { defaultGrade: 3, schoolName, schoolCode, onClose: vi.fn() }));
    expect(html).toContain(url.replaceAll('&', '&amp;'));
    expect(html).toContain('주소 복사');
    expect(html).toContain('주소가 길어 QR을 만들 수 없어요.');
    expect(html).not.toContain('aria-label="교실 입장 QR 코드"');
  });

  it('짧은 학교 이름과 코드로 입장 QR과 복사 버튼을 함께 그린다', () => {
    const url = buildClassroomShareUrl({ grade: 3, schoolName: '가락초등학교', schoolCode: '7010057' });
    expect(canEncodeQr(url)).toBe(true);
    const html = renderToStaticMarkup(createElement(ClassroomQrModal, {
      defaultGrade: 3, schoolName: '가락초등학교', schoolCode: '7010057', onClose: vi.fn(),
    }));
    expect(html).toContain('aria-label="교실 입장 QR 코드"');
    expect(html).toContain('주소 복사');
  });

  it('QR은 UTF-8 데이터 213바이트까지 담는다', () => {
    expect(canEncodeQr('가'.repeat(71))).toBe(true);
    expect(canEncodeQr(`${'가'.repeat(71)}a`)).toBe(false);
  });

  it('QR을 생성할 수 없는 환경에서도 주소 복사 버튼을 그린다', () => {
    vi.stubGlobal('TextEncoder', undefined);
    const html = renderToStaticMarkup(createElement(ClassroomQrModal, {
      defaultGrade: 3, schoolName: '가락초등학교', schoolCode: '7010057', onClose: vi.fn(),
    }));
    expect(html).toContain('QR을 만들 수 없어요. 주소를 복사해 나눠 주세요.');
    expect(html).toContain('주소 복사');
  });

  it('순수 QR 생성기가 한글 학교 URL에서도 정방 행렬·탐지 패턴·유효 BCH 포맷 비트를 생성한다', () => {
    const url = buildClassroomShareUrl({
      origin: 'https://voca.ssamuniverse.com',
      pathname: '/',
      grade: 3,
      schoolName: '서울가락초등학교',
      schoolCode: '7010057',
    });
    const matrix = encodeQrMatrix(url);
    const size = matrix.length;
    expect((size - 17) % 4).toBe(0);
    expect(matrix.every(row => row.length === size)).toBe(true);

    // 3곳 위치 탐지 패턴 중심(3,3), (size-4,3), (3,size-4)과 고정 암 모듈(x=8, y=size-8) 검증
    expect(matrix[3]![3]).toBe(true);
    expect(matrix[3]![size - 4]).toBe(true);
    expect(matrix[size - 4]![3]).toBe(true);
    expect(matrix[size - 8]![8]).toBe(true);

    // 좌상단 15비트 포맷 문자열 복원 후 BCH(15,5) 신드롬 = 0 검증
    const readBit = (x: number, y: number) => (matrix[y]![x] ? 1 : 0);
    let formatBits = 0;
    for (let i = 0; i <= 5; i++) formatBits |= readBit(8, i) << i;
    formatBits |= readBit(8, 7) << 6;
    formatBits |= readBit(8, 8) << 7;
    formatBits |= readBit(7, 8) << 8;
    for (let i = 9; i < 15; i++) formatBits |= readBit(14 - i, 8) << i;
    const unmasked = formatBits ^ 0x5412;
    expect(unmasked >>> 13).toBe(0b00); // EC Level M
    let rem = unmasked;
    for (let i = 14; i >= 10; i--) {
      if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    }
    expect(rem & 0x3ff).toBe(0);

    const svg = qrMatrixToSvgPath(matrix, 4);
    expect(svg.viewBoxSize).toBe(size + 8);
    expect(svg.path.startsWith('M')).toBe(true);
  });

  it('localStorage가 완전히 차단된 교실 웹뷰에서도 메모리 폴백으로 설정이 유지된다', () => {
    const blockedStorage = {
      getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      removeItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      key: () => null,
      length: 0,
    };
    vi.stubGlobal('localStorage', blockedStorage);
    const first = loadSettings();
    saveSettings({ ...first, lastNickname: '교실태블릿', lastSchoolName: '서울가락초등학교', lastSchoolCode: '7010057' });
    const reloaded = loadSettings();
    expect(reloaded.lastNickname).toBe('교실태블릿');
    expect(reloaded.lastSchoolName).toBe('서울가락초등학교');
    expect(reloaded.lastSchoolCode).toBe('7010057');
    expect(reloaded.playerId).toBe(first.playerId);
  });

  it('캡티브 포털 text/html 응답 시 제출 큐를 버리지 않고 보존한 뒤 정상 복구 때 학교 정보와 함께 제출한다', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true }));
    localStorage.setItem(`vocabulary-td.device:${API}`, JSON.stringify({ deviceId: DEVICE, token: TOKEN }));
    vi.stubEnv('VITE_API_BASE', API);
    await resetDbConnection();
    await clearLocalHistory();

    const record = sampleRecord({ schoolName: '서울가락초등학교', schoolCode: '7010057' });
    await addRecord(record);

    // 1차 시도: 학교 공유기 캡티브 포털이 200 text/html 로그인 페이지를 반환
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html><body>Wi-Fi Login</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })),
    );
    await queueAndFlushCompletedRun(record, 'player-1');
    const pendingAfterPortal = await listPendingRunSyncs();
    expect(pendingAfterPortal).toHaveLength(1);
    expect(pendingAfterPortal[0]!.runId).toBe(record.runId);

    // 로컬 폴백 랭킹에서도 학교 필터가 동작한다
    const localSchoolRank = await buildLocalRanking(
      { tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0, schoolCode: '7010057' },
      '참나무파수꾼',
    );
    expect(localSchoolRank.entries).toHaveLength(1);
    expect(localSchoolRank.entries[0]!.schoolName).toBe('서울가락초등학교');

    const otherSchoolRank = await buildLocalRanking(
      { tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0, schoolCode: '9999999' },
      '참나무파수꾼',
    );
    expect(otherSchoolRank.entries).toHaveLength(0);

    // 2차 시도: 와이파이 복구 뒤 새 판은 유예된 이전 항목에 가로막히지 않고 학교 코드·이름과 함께 즉시 전송된다
    const okFetch = vi.fn(async (url: string, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ ok: true, entries: [], totalCount: 0, myEntry: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', okFetch);
    const nextRecord = { ...record, runId: '22222222-3333-4444-8555-666666666666' };
    await addRecord(nextRecord);
    await queueAndFlushCompletedRun(nextRecord, 'player-1');

    const submitCall = okFetch.mock.calls.find(([u]) => String(u).endsWith('/v1/runs/submit'));
    expect(submitCall).toBeDefined();
    const submittedBody = JSON.parse(String(submitCall![1]?.body)) as Record<string, unknown>;
    expect(submittedBody.p_school_name).toBe('서울가락초등학교');
    expect(submittedBody.p_school_code).toBe('7010057');

    await fetchRanking(
      { tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0, schoolCode: '7010057', schoolName: '서울가락초등학교' },
      'player-1',
      '참나무파수꾼',
    );
    const rankCalls = okFetch.mock.calls.filter(([u]) => String(u).includes('/v1/leaderboard'));
    const codeParams = Object.fromEntries(new URL(String(rankCalls[0]![0])).searchParams);
    expect(codeParams.p_school_code).toBe('7010057');
    expect(codeParams.p_school_name).toBeUndefined();

    await fetchRanking(
      { tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0, schoolName: '우리마을분교' },
      'player-1',
      '참나무파수꾼',
    );
    const rankCallsAfter = okFetch.mock.calls.filter(([u]) => String(u).includes('/v1/leaderboard'));
    const nameParams = Object.fromEntries(new URL(String(rankCallsAfter[1]![0])).searchParams);
    expect(nameParams.p_school_code).toBeUndefined();
    expect(nameParams.p_school_name).toBe('우리마을분교');
  });

  it('NEIS 학교 검색이 서버 프록시(/v1/schools)를 우선 조회하고 실패 시 NEIS 직접 조회로 폴백한다', async () => {
    const fetchProxyOk = vi.fn(async (url: string) => {
      expect(url).toBe('https://voca-api.example/v1/schools?q=%EA%B0%80%EB%9D%BD%EC%B4%88');
      return new Response(
        JSON.stringify({
          schools: [
            { schoolCode: '7001', schoolName: '가락중학교', officeCode: 'B10', officeName: '서울특별시교육청', locationName: '서울', schoolKind: '중학교', roadAddress: '송파구' },
            { schoolCode: '7010057', schoolName: '서울가락초등학교', officeCode: 'B10', officeName: '서울특별시교육청', locationName: '서울', schoolKind: '초등학교', roadAddress: '송파구 송이로 42' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchProxyOk);
    const fromProxy = await searchNeisSchools('가락초', { proxyBase: 'https://voca-api.example/' });
    expect(fromProxy.map(s => s.schoolName)).toEqual(['서울가락초등학교', '가락중학교']);
    expect(fetchProxyOk).toHaveBeenCalledTimes(1);

    const fetchFallback = vi.fn(async (url: string) => {
      if (url.startsWith('https://voca-api.example/')) {
        return new Response('<html>portal</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return new Response(
        JSON.stringify({
          schoolInfo: [
            { head: [] },
            {
              row: [
                {
                  SD_SCHUL_CODE: '7010057',
                  SCHUL_NM: '서울가락초등학교',
                  ATPT_OFCDC_SC_CODE: 'B10',
                  ATPT_OFCDC_SC_NM: '서울특별시교육청',
                  LCTN_SC_NM: '서울특별시',
                  SCHUL_KND_SC_NM: '초등학교',
                  ORG_RDNMA: '서울특별시 송파구 송이로 42',
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchFallback);
    const fromDirect = await searchNeisSchools('가락초', { proxyBase: 'https://voca-api.example' });
    expect(fromDirect).toHaveLength(1);
    expect(fromDirect[0]!.schoolCode).toBe('7010057');
    expect(fetchFallback).toHaveBeenCalledTimes(2);
  });
});
