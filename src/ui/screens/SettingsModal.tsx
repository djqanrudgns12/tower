import { useEffect, useState, type ReactNode } from 'react';
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
import { SETTINGS_COPY as T } from '../copy';
import { Button, Card, Modal, Segmented, Toggle, type SegmentOption } from '../kit';
import css from './SettingsModal.module.css';

interface Props {
  settings: Settings;
  onUpdate(patch: Partial<Settings>): void;
  onHistoryCleared(): void;
  onClose(): void;
}

const FONT_OPTIONS: readonly SegmentOption<FontScale>[] = [
  { value: 'base', label: '보통', ariaLabel: '글자 보통' },
  { value: 'large', label: '크게', ariaLabel: '글자 크게' },
  { value: 'xlarge', label: '아주 크게', ariaLabel: '글자 아주 크게' },
];

const MOTION_OPTIONS: readonly SegmentOption<MotionMode>[] = [
  { value: 'full', label: '전체', ariaLabel: '전체 연출' },
  { value: 'simple', label: '바람·낙엽', ariaLabel: '바람·낙엽만' },
  { value: 'minimal', label: '정지' },
];

/** 소리 크기 단계(0.2 같은 값)를 고르기 칸으로. 값이 숫자라 문자열로 바꿔 Segmented에 넘긴다. */
const volumeOptions = (steps: readonly number[], base: number): SegmentOption<string>[] =>
  steps.map(step => ({
    value: String(step),
    label: `${Math.round(step * 100)}%`,
    ariaLabel: `${Math.round(step * 100)}퍼센트${step === base ? ' (기본)' : ''}`,
  }));
const BGM_OPTIONS = volumeOptions(BGM_STEPS, 0.2);
const SFX_OPTIONS = volumeOptions(SFX_STEPS, 0.4);

/** 이름 + 조작 하나. 설명은 기록 지우기·공개 기록 줄에만 단다. */
function Row({ name, hint, children }: { name: string; hint?: string; children: ReactNode }) {
  return (
    <div className={css.row}>
      <div className={css.head}>
        <span className={css.name}>{name}</span>
        {children}
      </div>
      {hint && <p className={css.hint}>{hint}</p>}
    </div>
  );
}

/**
 * 환경설정(R4 U3, 랜딩 PRD §2.7). 탭 없이 한 목록이고, 줄마다 이름과 조작 하나다.
 * 닉네임 설정·대원 전환은 홈에서 직접 다루므로 이 창에 두지 않는다.
 */
export function SettingsModal({ settings, onUpdate, onHistoryCleared, onClose }: Props) {
  const [historyError, setHistoryError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [previewSound] = useState(() => new SoundDirector(DEFAULTS.audio, 5));

  useEffect(() => {
    previewSound.setEnabled(settings.soundOn);
    previewSound.setVolumes(settings.bgmVolume, settings.sfxVolume);
  }, [previewSound, settings.soundOn, settings.bgmVolume, settings.sfxVolume]);

  useEffect(() => () => previewSound.dispose(), [previewSound]);

  useEffect(() => {
    const notify = () => setHistoryError(T.blocked);
    window.addEventListener('vocabulary-td.storageBlocked', notify);
    return () => window.removeEventListener('vocabulary-td.storageBlocked', notify);
  }, []);

  const clearHistory = async () => {
    setClearedNotice(false);
    setHistoryError('');
    try {
      await clearLocalHistory();
      setConfirmClear(false);
      setClearedNotice(true);
      onHistoryCleared();
    } catch {
      setHistoryError(T.clearFailed);
    }
  };

  return (
    <Modal titleId="settingsModalTitle" title={T.title} onClose={onClose}>
      <div className={css.list}>
        <Toggle className={css.switchRow ?? ''} label={T.sound} checked={settings.soundOn} onChange={on => onUpdate({ soundOn: on })} />

        <Row name={T.bgm}>
          <Segmented
            label={T.bgm}
            options={BGM_OPTIONS}
            value={String(settings.bgmVolume)}
            onChange={v => onUpdate({ bgmVolume: Number(v) as VolumeStepBgm })}
          />
        </Row>

        <Row name={T.sfx}>
          <Segmented
            label={T.sfx}
            options={SFX_OPTIONS}
            value={String(settings.sfxVolume)}
            onChange={v => onUpdate({ sfxVolume: Number(v) as VolumeStepSfx })}
          />
        </Row>

        <Row name={T.correctSound}>
          <Button aria-label={`${T.correctSound} ${T.listen}`} disabled={!settings.soundOn} onClick={() => previewSound.preview('correct')}>{T.listen}</Button>
        </Row>

        <Row name={T.fireSound}>
          <Button aria-label={`${T.fireSound} ${T.listen}`} disabled={!settings.soundOn} onClick={() => previewSound.preview('fire.archer')}>{T.listen}</Button>
        </Row>

        <Row name={T.font}>
          <Segmented label={T.font} options={FONT_OPTIONS} value={settings.fontScale} onChange={fontScale => onUpdate({ fontScale })} />
        </Row>
        <Card sunk className={css.preview} aria-label="글자 크기 미리보기" data-content>{T.fontPreview}</Card>

        <Row name={T.motion}>
          <Segmented
            label={T.motion}
            options={MOTION_OPTIONS}
            value={settings.motionMode}
            onChange={motionMode => onUpdate({ motionMode, motionCustomized: true })}
          />
        </Row>

        <Toggle className={css.switchRow ?? ''} label={T.contrast} checked={settings.highContrastMap} onChange={highContrastMap => onUpdate({ highContrastMap })} />
        <Toggle className={css.switchRow ?? ''} label={T.keyHints} checked={settings.showKeyHints} onChange={showKeyHints => onUpdate({ showKeyHints })} />

        <div className={css.row}>
          <Toggle className={css.switchRow ?? ''} label={T.share} checked={settings.shareRecords === true} onChange={shareRecords => onUpdate({ shareRecords })} />
          <p className={css.hint}>{T.shareHint}</p>
        </div>

        <Row name={T.clear} hint={T.clearHint}>
          {confirmClear ? (
            <span className={css.actions}>
              <Button variant="danger" onClick={() => void clearHistory()}>{T.clearConfirm}</Button>
              <Button onClick={() => setConfirmClear(false)}>{T.cancel}</Button>
            </span>
          ) : (
            <Button variant="danger" onClick={() => setConfirmClear(true)}>{T.clearAction}</Button>
          )}
        </Row>
        {historyError && <p className={css.alert} role="alert">{historyError}</p>}
        {clearedNotice && <p className={css.status} role="status">{T.cleared}</p>}
      </div>
    </Modal>
  );
}
