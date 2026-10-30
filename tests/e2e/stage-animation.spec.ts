import { expect, test } from '@playwright/test';

test.describe('왕국 초원 · 성문 수비전 전장 미리보기 애니메이션 검증', () => {
  test('OS reduced-motion 및 기존 자동 minimal 저장본에서도 애니메이션이 재생되고 직접 정지 선택 시 멈춘다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 과거 OS prefers-reduced-motion 오탐으로 사용자 선택 없이 minimal이 저장된 상태를 재현
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
        (el: HTMLCanvasElement) => el.toDataURL(),
      );

    // 스프라이트 로드가 끝난 뒤 연속 프레임 간 캔버스 픽셀이 실제로 변하는지 확인
    await page.waitForTimeout(250);
    const frame1 = await captureStageCanvas();
    await page.waitForTimeout(250);
    const frame2 = await captureStageCanvas();
    expect(frame2).not.toBe(frame1);

    // 환경설정에서 사용자가 직접 '정지'를 선택하면 애니메이션이 멈추고 새로고침 후에도 유지된다
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await settingsDialog.getByRole('tab', { name: '화면 · 글자 크기' }).click();
    await settingsDialog.getByRole('radiogroup', { name: '배경 움직임 단계' }).getByRole('radio', { name: '정지' }).click();
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    await page.reload();
    await page.waitForTimeout(250);
    const pausedFrame1 = await captureStageCanvas();
    await page.waitForTimeout(250);
    const pausedFrame2 = await captureStageCanvas();
    expect(pausedFrame2).toBe(pausedFrame1);
  });
});
