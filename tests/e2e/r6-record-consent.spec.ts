import { expect, test } from './tower-browser';

test.describe('WP-Q1b 순위표 기록 공유 1회 동의 모달', () => {
  test('첫 새 게임 클릭 시 1회 동의 모달을 띄우고, 선택 후 즉시 전투로 진입하며 다시 묻지 않는다', async ({ page }) => {
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
    await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary-td.settings') ?? '{}'));
    expect(stored.shareRecords).toBe(true);
    expect(stored.shareRecordsAsked).toBe(true);

    // 홈으로 돌아온 뒤 다시 새 게임을 눌러도 동의 모달은 재등장하지 않고 바로 전투로 진입한다.
    await page.getByRole('button', { name: '일시정지' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: '이번 판 끝내기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '끝내기', exact: true }).click();
    await page.getByRole('button', { name: '홈', exact: true }).click();
    await expect(page.getByRole('button', { name: '새 게임', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '새 게임', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '순위표에 기록을 올릴까요?' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
