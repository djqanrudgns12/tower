import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { loadSettings, normalizeSettings } from '../../../src/persistence/settings';
import { RecordConsentModal } from '../../../src/ui/screens/RecordConsentModal';

describe('순위표 기록 공유 1회 동의(WP-Q1b)', () => {
  it('이전 저장본 하위 호환: shareRecords가 true면 재질문하지 않고, 기본은 미질문+비공유다', () => {
    const base = loadSettings();
    expect(base.shareRecords).toBe(false);
    expect(base.shareRecordsAsked).toBe(false);

    const legacyOptedIn = normalizeSettings(base, { shareRecords: true });
    expect(legacyOptedIn.shareRecords).toBe(true);
    expect(legacyOptedIn.shareRecordsAsked).toBe(true);

    const declinedOnce = normalizeSettings(base, { shareRecords: false, shareRecordsAsked: true });
    expect(declinedOnce.shareRecords).toBe(false);
    expect(declinedOnce.shareRecordsAsked).toBe(true);
  });

  it('동의 모달은 학교명을 언급하지 않고 5가지 공유 항목과 등가 버튼 2개를 표시한다', () => {
    const html = renderToStaticMarkup(createElement(RecordConsentModal, {
      onDecide: vi.fn(),
      onClose: vi.fn(),
    }));
    expect(html).toContain('순위표에 기록을 올릴까요?');
    for (const field of ['닉네임', '학년', '난이도', '점수', '웨이브']) {
      expect(html).toContain(field);
    }
    expect(html).not.toContain('학교');
    expect(html).toContain('순위표에 올리기');
    expect(html).toContain('이 기기에만 저장');
  });
});
