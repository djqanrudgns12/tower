import { expect, test } from './tower-browser';

const schoolName = '서울초등학교';
const schoolCode = '7010057';
const entryUrl = `/?${new URLSearchParams({ grade: '4', school: schoolName, sc: schoolCode })}`;

test('옛 학교 입장 주소로 접속해도 학년만 반영되고 학교 입력·필터 UI는 표시되지 않는다', async ({ page }) => {
  await page.goto(entryUrl);
  await expect(page.getByRole('combobox', { name: '학년', exact: true })).toHaveValue('4');
  await expect(page.getByRole('textbox', { name: '학교 이름' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '학교 검색' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '우리 학교' })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
});

// Vite를 시작할 때 VITE_API_BASE를 지정한 서버에서 실행한다. 모든 API 응답은 브라우저에서 대체한다.
const apiBase = process.env.VITE_API_BASE?.trim().replace(/\/+$/, '');

test('원격 랭킹 요청 시 학교 파라미터 없이 100위까지 조회한다', async ({ page }) => {
  test.skip(!apiBase, 'Vite에 VITE_API_BASE를 지정할 때만 원격 랭킹 요청이 생긴다');

  await page.addInitScript(() => localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true })));
  const deviceId = '00000000-0000-4000-8000-000000000004';
  const leaderboardUrl = `${apiBase}/v1/leaderboard`;
  await page.route(`${apiBase}/v1/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v1/device') {
      await route.fulfill({ json: { deviceId, token: `v1.${deviceId}.${'a'.repeat(43)}` } });
    } else if (url.pathname === '/v1/leaderboard' && route.request().method() === 'GET') {
      await route.fulfill({ json: { entries: [], totalCount: 0, myEntry: null } });
    } else {
      await route.fulfill({ json: {} });
    }
  });

  const initialResponse = page.waitForResponse(response => response.url().startsWith(`${leaderboardUrl}?`));
  await page.goto(entryUrl);
  const initial = new URL((await initialResponse).url()).searchParams;
  expect(initial.get('p_grade')).toBe('4');
  expect(initial.get('p_limit')).toBe('100');
  expect(initial.has('p_school_code')).toBe(false);
  expect(initial.has('p_school_name')).toBe(false);
});
