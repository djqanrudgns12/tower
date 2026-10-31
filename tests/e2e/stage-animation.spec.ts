import { expect, test } from '@playwright/test';

test.describe('왕국 초원 · 성문 수비전 전장 미리보기 애니메이션 검증', () => {
  test('OS reduced-motion 및 기존 minimal 저장본은 정지하고 직접 전체 선택 시 재생한다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 과거 저장본의 minimal 선택도 유지한다(PRD §16).
    await page.evaluate(() => {
      localStorage.setItem('vocabulary-td.settings', JSON.stringify({
        lastNickname: '따뜻한학자',
        lastGrade: 5,
        reducedMotion: true,
        motionMode: 'minimal',
      }));
    });
    await page.reload();

    const captureStageCanvas = () =>
      page.getByRole('img', { name: '왕국 성문 수비 전장 미리보기' }).locator('canvas').evaluate(
        async (el: HTMLCanvasElement) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(el.toDataURL())))].map(b => b.toString(16).padStart(2, '0')).join(''),
      );

    // 연속 프레임의 픽셀 해시가 같아야 한다.
    await page.waitForTimeout(250);
    const frame1 = await captureStageCanvas();
    await page.waitForTimeout(250);
    const frame2 = await captureStageCanvas();
    expect(frame2).toBe(frame1);

    // 사용자가 직접 전체 연출을 선택하면 새로고침 후에도 재생한다.
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await settingsDialog.getByRole('tab', { name: '화면 · 글자 크기' }).click();
    await settingsDialog.getByRole('radiogroup', { name: '배경 움직임 단계' }).getByRole('radio', { name: '전체 연출' }).click();
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    await page.reload();
    await page.waitForTimeout(250);
    const pausedFrame1 = await captureStageCanvas();
    await page.waitForTimeout(250);
    const pausedFrame2 = await captureStageCanvas();
    expect(pausedFrame2).not.toBe(pausedFrame1);
  });
});

test('설정 라디오는 방향키로 선택하고 하나의 Tab 진입점을 유지한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '환경설정' });
  await dialog.getByRole('tab', { name: '전투 보조 · 기록' }).click();
  const group = dialog.getByRole('radiogroup', { name: '공개 기록 나누기' });
  const off = group.getByRole('radio', { name: '꺼짐' });
  const on = group.getByRole('radio', { name: '켜짐' });
  await expect(off).toHaveAttribute('tabindex', '0');
  await off.focus(); await page.keyboard.press('ArrowLeft');
  await expect(on).toBeFocused(); await expect(on).toHaveAttribute('aria-checked', 'true');
  await expect(on).toHaveAttribute('tabindex', '0'); await expect(off).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowRight');
  await expect(off).toBeFocused(); await expect(off).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary-td.settings')!).shareRecords)).toBe(false);
});
