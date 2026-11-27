import { expect, test } from './tower-browser';

test.describe('WP-Q1b 순위표 기록 공유 1회 동의 모달', () => {
  test('첫 새 게임 클릭 시 1회 동의 모달을 띄우고, 선택 후에는 다시 묻지 않고 새 게임 창으로 이어진다', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('vocabulary-td');
      localStorage.clear();
    });
    await page.reload();

    await page.getByRole('textbox', { name: '닉네임' }).fill('수호자테스트');
    await page.getByRole('button', { name: '새 게임', exact: true }).click();

    const consent = page.getByRole('dialog', { name: '순위표에 기록을 올릴까요?' });
    await expect(consent).toBeVisible();
    await expect(consent).toContainText('닉네임');
    await expect(consent).toContainText('학년');
    await expect(consent).toContainText('난이도');
    await expect(consent).toContainText('점수');
    await expect(consent).toContainText('웨이브');
    await expect(consent).not.toContainText('학교');

    const agreeBtn = consent.getByRole('button', { name: '순위표에 올리기' });
    const localBtn = consent.getByRole('button', { name: '이 기기에만 저장' });
    const agreeBox = await agreeBtn.boundingBox();
    const localBox = await localBtn.boundingBox();
    expect(agreeBox!.height).toBeGreaterThanOrEqual(44);
    expect(localBox!.height).toBeGreaterThanOrEqual(44);

    await agreeBtn.click();
    await expect(consent).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: '새 게임' })).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary-td.settings') ?? '{}'));
    expect(stored.shareRecords).toBe(true);
    expect(stored.shareRecordsAsked).toBe(true);

    // 새 게임 창 닫고 다시 눌러도 동의 모달은 재등장하지 않는다.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '새 게임' })).toHaveCount(0);
    await page.getByRole('button', { name: '새 게임', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '순위표에 기록을 올릴까요?' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: '새 게임' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
