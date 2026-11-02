import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchNeisSchools } from '../../src/application/neis';

describe('NEIS Open API 학교 정보 연동 모듈', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('검색어가 2자 미만이면 네트워크 요청 없이 빈 배열을 즉시 반환한다', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const resultShort = await searchNeisSchools('서');
    const resultEmpty = await searchNeisSchools('   ');

    expect(resultShort).toEqual([]);
    expect(resultEmpty).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('정상적인 NEIS 응답 데이터를 NeisSchool 형태로 알맞게 정제한다', async () => {
    const mockResponse = {
      schoolInfo: [
        {
          head: [
            { list_total_count: 1 },
            { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } },
          ],
        },
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
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const schools = await searchNeisSchools('가락초');
    expect(schools).toHaveLength(1);
    expect(schools[0]).toEqual({
      schoolCode: '7010057',
      schoolName: '서울가락초등학교',
      officeCode: 'B10',
      officeName: '서울특별시교육청',
      locationName: '서울특별시',
      schoolKind: '초등학교',
      roadAddress: '서울특별시 송파구 송이로 42',
    });
  });

  it('해당하는 데이터가 없는 응답(INFO-200)을 받으면 빈 배열을 반환한다', async () => {
    const mockEmpty = {
      RESULT: {
        CODE: 'INFO-200',
        MESSAGE: '해당하는 데이터가 없습니다.',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEmpty,
    });

    const schools = await searchNeisSchools('존재하지않는학교명');
    expect(schools).toEqual([]);
  });

  it('네트워크 오류(fetch reject) 또는 HTTP 오류 시 빈 배열을 반환하고 예외를 던지지 않는다', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const schools = await searchNeisSchools('서울초');
    expect(schools).toEqual([]);
  });

  it('apiKey 옵션이 전달되면 URL 쿼리 파라미터에 KEY가 포함된다', async () => {
    let requestedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({}),
      };
    });

    await searchNeisSchools('서울초', { apiKey: 'TEST_API_KEY_123' });
    expect(requestedUrl).toContain('KEY=TEST_API_KEY_123');
    expect(requestedUrl).toContain(`SCHUL_NM=${encodeURIComponent('서울초')}`);
  });
});
