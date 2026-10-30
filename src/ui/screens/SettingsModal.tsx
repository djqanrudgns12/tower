import { useEffect, useRef, useState } from 'react';
import {
  BGM_STEPS,
  clearLocalHistory,
  SFX_STEPS,
  type FontScale,
  type MotionMode,
  type Settings,
  type VolumeStepBgm,
  type VolumeStepSfx,
} from '../../application/session';
import { DEFAULTS } from '../../content';
import { SoundDirector } from '../audio/sound';
import { ModalShell } from './home/ModalShell';
import css from './home/home.module.css';

type SettingsTab = 'audio' | 'display' | 'assist';

const SETTINGS_TABS: readonly { id: SettingsTab; label: string }[] = [
  { id: 'audio', label: '소리 조절' },
  { id: 'display', label: '화면 · 글자 크기' },
  { id: 'assist', label: '전투 보조 · 기록' },
];

interface Props {
  settings: Settings;
  onUpdate(patch: Partial<Settings>): void;
  onHistoryCleared(): void;
  onClose(): void;
}

/**
 * 게임 환경설정 모달(랜딩 PRD §2.7).
 * 별명 설정 및 대원 전환 기능은 랜딩 출정 데크에서 직접 다루므로 이 모달에 두지 않는다.
 */
export function SettingsModal({ settings, onUpdate, onHistoryCleared, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>('audio');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [previewSound] = useState(() => new SoundDirector(DEFAULTS.audio, 5));

  useEffect(() => {
    previewSound.setEnabled(settings.soundOn);
    previewSound.setVolumes(settings.bgmVolume, settings.sfxVolume);
  }, [previewSound, settings.soundOn, settings.bgmVolume, settings.sfxVolume]);

  useEffect(() => () => previewSound.dispose(), [previewSound]);

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % SETTINGS_TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    if (nextIdx >= 0) {
      e.preventDefault();
      setTab(SETTINGS_TABS[nextIdx]!.id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <ModalShell titleId="settingsModalTitle" title="환경설정" onClose={onClose}>
      <div className={css.settingsTabs} role="tablist" aria-label="환경설정 분류">
        {SETTINGS_TABS.map((item, i) => (
          <button
            key={item.id}
            ref={el => { tabRefs.current[i] = el; }}
            id={`settings-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="settings-tabpanel"
            tabIndex={tab === item.id ? 0 : -1}
            className={css.tabBtn}
            onClick={() => setTab(item.id)}
            onKeyDown={e => onTabKeyDown(e, i)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} style={{ display: 'grid', gap: 12 }}>
        {tab === 'audio' && (
          <>
            <section className={css.settingSection}>
              <div className={css.settingRow}>
                <div>
                  <strong className={css.nickLabel}>전체 소리</strong>
                  <p className={css.rankSub}>전투 효과음과 배경 선율을 한 번에 켜거나 꺼요.</p>
                </div>
                <div className={css.segmentedRow} role="radiogroup" aria-label="전체 소리">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.soundOn}
                    className={css.segBtn}
                    onClick={() => onUpdate({ soundOn: true })}
                  >
                    켜짐
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!settings.soundOn}
                    className={css.segBtn}
                    onClick={() => onUpdate({ soundOn: false })}
                  >
                    꺼짐
                  </button>
                </div>
              </div>
            </section>

            <section className={css.settingSection}>
              <strong className={css.nickLabel}>배경 음악 크기</strong>
              <div className={css.segmentedRow} role="radiogroup" aria-label="배경 음악 크기">
                {BGM_STEPS.map(step => (
                  <button
                    key={step}
                    type="button"
                    role="radio"
                    aria-checked={settings.bgmVolume === step}
                    className={css.segBtn}
                    onClick={() => onUpdate({ bgmVolume: step as VolumeStepBgm })}
                  >
                    {Math.round(step * 100)}%{step === 0.2 ? ' (기본)' : ''}
                  </button>
                ))}
              </div>
            </section>

            <section className={css.settingSection}>
              <strong className={css.nickLabel}>효과음 크기</strong>
              <div className={css.segmentedRow} role="radiogroup" aria-label="효과음 크기">
                {SFX_STEPS.map(step => (
                  <button
                    key={step}
                    type="button"
                    role="radio"
                    aria-checked={settings.sfxVolume === step}
                    className={css.segBtn}
                    onClick={() => onUpdate({ sfxVolume: step as VolumeStepSfx })}
                  >
                    {Math.round(step * 100)}%{step === 0.4 ? ' (기본)' : ''}
                  </button>
                ))}
              </div>
              <div className={css.segmentedRow}>
                <button
                  type="button"
                  className={css.smallBtn}
                  disabled={!settings.soundOn}
                  onClick={() => previewSound.preview('correct')}
                >
                  정답음 들어보기
                </button>
                <button
                  type="button"
                  className={css.smallBtn}
                  disabled={!settings.soundOn}
                  onClick={() => previewSound.preview('fire.archer')}
                >
                  발사음 들어보기
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'display' && (
          <>
            <section className={css.settingSection}>
              <strong className={css.nickLabel}>글자 크기</strong>
              <p className={css.rankSub}>어휘 문제 문장과 화면 안내 글자 크기를 조절해요.</p>
              <div className={css.segmentedRow} role="radiogroup" aria-label="글자 크기">
                {(
                  [
                    ['base', '글자 보통'],
                    ['large', '글자 크게'],
                    ['xlarge', '글자 아주 크게'],
                  ] as readonly [FontScale, string][]
                ).map(([scale, label]) => (
                  <button
                    key={scale}
                    type="button"
                    role="radio"
                    aria-checked={settings.fontScale === scale}
                    className={css.segBtn}
                    onClick={() => onUpdate({ fontScale: scale })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className={css.fontPreviewBox} aria-label="글자 크기 미리보기">
                ‘준비물을 잘 챙길 만큼 꼼꼼하다’에서 ‘꼼꼼하다’의 뜻은?
              </div>
            </section>

            <section className={css.settingSection}>
              <strong className={css.nickLabel}>배경 움직임 단계</strong>
              <p className={css.rankSub}>집중이 필요하거나 기기가 느릴 때 움직이는 연출을 줄여요.</p>
              <div className={css.segmentedRow} role="radiogroup" aria-label="배경 움직임 단계">
                {(
                  [
                    ['full', '전체 연출'],
                    ['simple', '바람·낙엽만'],
                    ['minimal', '정지'],
                  ] as readonly [MotionMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={settings.motionMode === mode}
                    className={css.segBtn}
                    onClick={() => onUpdate({ motionMode: mode, motionCustomized: true })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className={css.settingSection}>
              <div className={css.settingRow}>
                <div>
                  <strong className={css.nickLabel}>전장 길·받침 고대비 윤곽선</strong>
                  <p className={css.rankSub}>흙길 테두리와 빈 타워 받침 자리를 더 선명하게 표시해요.</p>
                </div>
                <div className={css.segmentedRow} role="radiogroup" aria-label="전장 길·받침 고대비 윤곽선">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.highContrastMap}
                    className={css.segBtn}
                    onClick={() => onUpdate({ highContrastMap: true })}
                  >
                    켜짐
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!settings.highContrastMap}
                    className={css.segBtn}
                    onClick={() => onUpdate({ highContrastMap: false })}
                  >
                    꺼짐
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === 'assist' && (
          <>
            <section className={css.settingSection}>
              <div className={css.settingRow}>
                <div>
                  <strong className={css.nickLabel}>단축키 번호 배지 표시</strong>
                  <p className={css.rankSub}>어휘 문제 보기 옆에 키보드 숫자(1~4) 안내 배지를 보여 줘요.</p>
                </div>
                <div className={css.segmentedRow} role="radiogroup" aria-label="단축키 번호 배지 표시">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.showKeyHints}
                    className={css.segBtn}
                    onClick={() => onUpdate({ showKeyHints: true })}
                  >
                    켜짐
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!settings.showKeyHints}
                    className={css.segBtn}
                    onClick={() => onUpdate({ showKeyHints: false })}
                  >
                    꺼짐
                  </button>
                </div>
              </div>
            </section>

            <section className={css.settingSection}>
              <strong className={css.nickLabel}>이 기기의 로컬 기록 정리</strong>
              <p className={css.rankSub}>
                이 브라우저에 저장된 최근 판 기록을 모두 비워요. 출정 별명은 그대로 유지돼요.
              </p>
              {clearedNotice && (
                <p className={css.bannerNotice} role="status">이 기기의 로컬 기록을 모두 정리했어요.</p>
              )}
              {confirmClear ? (
                <div className={css.segmentedRow}>
                  <button
                    type="button"
                    className={css.segBtn}
                    style={{ background: 'var(--danger)', color: '#ffffff' }}
                    onClick={async () => {
                      await clearLocalHistory().catch(() => undefined);
                      setConfirmClear(false);
                      setClearedNotice(true);
                      onHistoryCleared();
                    }}
                  >
                    정말 정리하기
                  </button>
                  <button type="button" className={css.segBtn} onClick={() => setConfirmClear(false)}>
                    취소
                  </button>
                </div>
              ) : (
                <div>
                  <button type="button" className={css.smallBtn} onClick={() => setConfirmClear(true)}>
                    로컬 기록 정리하기
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ModalShell>
  );
}
