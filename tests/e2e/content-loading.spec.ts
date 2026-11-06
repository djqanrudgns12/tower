import { expect, test } from './tower-browser';

test('선택한 학년만 적재하고 로딩 중에는 시작을 막으며 창을 닫아도 게임을 자동으로 열지 않는다', async ({ page }) => {
  const requests: number[] = [];
  page.on('request', request => {
    const match = /\/questions\/grade([3-6])\.json(?:\?|$)/.exec(request.url());
    if (match) requests.push(Number(match[1]));
  });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/questions\/grade5\.json(?:\?|$)/, async route => { await held; await route.continue(); });
  await page.goto('/');
  await expect(page.getByRole('region', { name: '오늘의 낱말' })).not.toContainText('불러오는 중');
  expect(requests).toEqual([3]);
  await page.getByRole('textbox', { name: '닉네임' }).fill('학년적재시험');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 게임' });
  await dialog.getByRole('radio', { name: '5학년', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('문제를 불러오는 중이에요.');
  await expect(dialog.getByRole('button', { name: '시작', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(dialog.getByRole('radio', { name: '6학년', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '닫기' }).click();
  release();
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await dialog.getByRole('radio', { name: '5학년', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '시작', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  expect(requests).toEqual([3, 5]);
  await dialog.getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
  expect(requests).toEqual([3, 5]);
});

test('학년 파일 전송 실패를 알리고 다시 불러오면 게임을 시작할 수 있다', async ({ page }) => {
  let attempts = 0;
  await page.route(/\/questions\/grade6\.json(?:\?|$)/, async route => {
    attempts++;
    if (attempts === 1) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: '닉네임' }).fill('학년재시도');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 게임' });
  await dialog.getByRole('radio', { name: '6학년', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('문제를 불러오지 못했어요.');
  await dialog.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(dialog.getByRole('button', { name: '시작', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  expect(attempts).toBe(2);
  await dialog.getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
});
