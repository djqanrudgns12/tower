import { expect, test } from './tower-browser';

const schoolName = '서울초등학교';
const schoolCode = '7010057';
const entryUrl = `/?${new URLSearchParams({ grade: '4', school: schoolName, sc: schoolCode })}`;

test('학교 입장 주소의 학교 이름과 학년이 화면에 채워진다', async ({ page }) => {
  await page.goto(entryUrl);
  await expect(page.getByRole('textbox', { name: '학교 이름', exact: true })).toHaveValue(schoolName);

  await page.getByRole('textbox', { name: '닉네임' }).fill('학교검수');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 게임' });
  await expect(dialog.getByRole('radio', { name: '4학년', exact: true })).toBeChecked();
});

// Vite를 시작할 때 VITE_API_BASE를 지정한 서버에서 실행한다. 모든 API 응답은 브라우저에서 대체한다.
const apiBase = process.env.VITE_API_BASE?.trim().replace(/\/+$/, '');

test('홈의 우리 학교 토글이 입장 주소의 학교 코드로 랭킹을 요청한다', async ({ page }) => {
  test.skip(!apiBase, 'Vite에 VITE_API_BASE를 지정할 때만 원격 랭킹 요청이 생긴다');

  await page.addInitScript(() => localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true })));
  const deviceId = '00000000-0000-4000-8000-000000000004';
  const leaderboardUrl = `${apiBase}/v1/leaderboard`;
  const rankQueries: URLSearchParams[] = [];
  await page.route(`${apiBase}/v1/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v1/device') {
      await route.fulfill({ json: { deviceId, token: `v1.${deviceId}.${'a'.repeat(43)}` } });
    } else if (url.pathname === '/v1/leaderboard' && route.request().method() === 'GET') {
      rankQueries.push(url.searchParams);
      await route.fulfill({ json: { entries: [], totalCount: 0, myEntry: null } });
    } else {
      await route.fulfill({ json: {} });
    }
  });

  const initialResponse = page.waitForResponse(response => response.url().startsWith(`${leaderboardUrl}?`));
  await page.goto(entryUrl);
  const initial = new URL((await initialResponse).url()).searchParams;
  expect(initial.get('p_grade')).toBe('4');
  expect(initial.has('p_school_code')).toBe(false);
  expect(initial.has('p_school_name')).toBe(false);

  const schoolToggle = page.getByRole('button', { name: '우리 학교', exact: true });
  await expect(schoolToggle).toHaveAttribute('aria-pressed', 'false');
  await schoolToggle.click();
  await expect(schoolToggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => rankQueries.at(-1)?.get('p_school_code')).toBe(schoolCode);
  const filtered = rankQueries.at(-1)!;
  expect(filtered.get('p_grade')).toBe('4');
  expect(filtered.has('p_school_name')).toBe(false);
});
