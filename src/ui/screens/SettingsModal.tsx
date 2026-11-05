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
import { Button, Card, Modal, ModalTabPanel, ModalTabs, ModalTabShell, Segmented, Toggle, type ModalTabOption, type SegmentOption } from '../kit';
import { SETTINGS_SECTIONS as S } from './home/homeCopy';
import css from './SettingsModal.module.css';

type SettingsTabId = 'sound' | 'display' | 'records';

interface Props {
  settings: Settings;
  onUpdate(patch: Partial<Settings>): void;
  onHistoryCleared(): void;
  onClose(): void;
}

/** 기본값인 칸은 이름 아래 '(기본)'을 작게 붙인다(S2). 칸 높이는 44px 안이다. */
const withMark = (text: string, isBase: boolean): ReactNode =>
  isBase ? <span className={css.optTwo}><span>{text}</span><span className={css.optMark}>{S.base}</span></span> : text;
const baseSr = (isBase: boolean) => (isBase ? `, ${S.baseSr}` : '');

const fontOptions = (): SegmentOption<FontScale>[] => [
  { value: 'base', label: withMark('보통', true), ariaLabel: `글자 보통${baseSr(true)}` },
  { value: 'large', label: '크게', ariaLabel: '글자 크게' },
  { value: 'xlarge', label: '아주 크게', ariaLabel: '글자 아주 크게' },
];

/** 움직임의 기본값은 기기의 '움직임 줄이기' 설정을 따른다(persistence/settings.ts defaults와 같은 규칙). */
const motionOptions = (base: MotionMode): SegmentOption<MotionMode>[] => [
  { value: 'full', label: withMark('전체', base === 'full'), ariaLabel: `전체 연출${baseSr(base === 'full')}` },
  { value: 'simple', label: withMark('바람·낙엽', base === 'simple'), ariaLabel: `바람·낙엽만${baseSr(base === 'simple')}` },
  { value: 'minimal', label: withMark('정지', base === 'minimal'), ariaLabel: `정지${baseSr(base === 'minimal')}` },
];

/** 소리 크기 단계(0.2 같은 값)를 고르기 칸으로. 값이 숫자라 문자열로 바꿔 Segmented에 넘긴다. */
const volumeOptions = (steps: readonly number[], base: number): SegmentOption<string>[] =>
  steps.map(step => ({
    value: String(step),
    label: withMark(`${Math.round(step * 100)}%`, step === base),
    ariaLabel: `${Math.round(step * 100)}퍼센트${step === base ? ' (기본)' : ''}`,
  }));
const BGM_OPTIONS = volumeOptions(BGM_STEPS, 0.2);
const SFX_OPTIONS = volumeOptions(SFX_STEPS, 0.4);

const TAB_OPTIONS: readonly ModalTabOption<SettingsTabId>[] = [
  { value: 'sound', label: S.sound, id: 'settings-tab-sound' },
  { value: 'display', label: S.display, id: 'settings-tab-display' },
  { value: 'records', label: S.records, id: 'settings-tab-records' },
];

/** 이름 + 조작 하나. 짧은 설명은 있는 줄에만 단다. */
function Row({ name, hint, contentHint = false, children }: { name: string; hint?: string; contentHint?: boolean; children: ReactNode }) {
  return (
    <div className={css.row}>
      <div className={css.head}>
        <span className={css.name}>{name}</span>
        <div className={css.controlTrack}>{children}</div>
      </div>
      {hint && <p className={css.hint} data-content={contentHint || undefined}>{hint}</p>}
    </div>
  );
}

/** 켜기·끄기 줄. 설명이 있으면 스위치 아래에 붙는다. */
function SwitchRow({ label, checked, hint, contentHint = false, onChange }: { label: string; checked: boolean; hint?: string; contentHint?: boolean; onChange(checked: boolean): void }) {
  return (
    <div className={css.row}>
      <Toggle className={css.switchRow ?? ''} label={label} checked={checked} onChange={onChange} />
      {hint && <p className={css.hint} data-content={contentHint || undefined}>{hint}</p>}
    </div>
  );
}

/**
 * 환경설정(md 680×540 고정 프레임 + 3탭: 소리 / 화면·조작 / 기록 관리).
 * 탭을 전환해도 창 바깥 크기가 흔들리지 않고, 모든 조작 트랙이 오른쪽 고정 축에 정렬된다.
 */
export function SettingsModal({ settings, onUpdate, onHistoryCleared, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTabId>('sound');
  const [historyError, setHistoryError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [previewSound] = useState(() => new SoundDirector(DEFAULTS.audio, 5));
  const [fontChoices] = useState(fontOptions);
  const [motionChoices] = useState(() => motionOptions(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'minimal' : 'full'));

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

  const handleTabChange = (next: SettingsTabId) => {
    setTab(next);
    setConfirmClear(false);
  };

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
    <Modal titleId="settingsModalTitle" title={T.title} size="md" fixed onClose={onClose}>
      <ModalTabShell>
        <ModalTabs<SettingsTabId>
          label={S.tabLabel}
          options={TAB_OPTIONS}
          value={tab}
          onChange={handleTabChange}
          controls="settings-tabpanel"
        />
        <ModalTabPanel id="settings-tabpanel" labelledBy={`settings-tab-${tab}`} pad="sm">
          {tab === 'sound' && (
            <div className={`${css.rows} ${css.rowsSpacious}`}>
              <SwitchRow label={T.sound} checked={settings.soundOn} onChange={on => onUpdate({ soundOn: on })} />

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

              <Row name={S.previewSound}>
                <div className={css.previewBtns}>
                  <Button
                    aria-label={`${T.correctSound} ${T.listen}`}
                    disabled={!settings.soundOn}
                    onClick={() => previewSound.preview('correct')}
                  >
                    {T.correctSound}
                  </Button>
                  <Button
                    aria-label={`${T.fireSound} ${T.listen}`}
                    disabled={!settings.soundOn}
                    onClick={() => previewSound.preview('fire.archer')}
                  >
                    {T.fireSound}
                  </Button>
                </div>
              </Row>
            </div>
          )}

          {tab === 'display' && (
            <div className={css.rows}>
              <Row name={T.font}>
                <Segmented label={T.font} options={fontChoices} value={settings.fontScale} onChange={fontScale => onUpdate({ fontScale })} />
              </Row>
              <Card sunk pad="sm" className={css.preview} aria-label="글자 크기 미리보기" data-content>{T.fontPreview}</Card>

              <Row name={T.motion} hint={S.motionHint}>
                <Segmented
                  label={T.motion}
                  options={motionChoices}
                  value={settings.motionMode}
                  onChange={motionMode => onUpdate({ motionMode, motionCustomized: true })}
                />
              </Row>

              <SwitchRow label={T.contrast} checked={settings.highContrastMap} hint={S.contrastHint} onChange={highContrastMap => onUpdate({ highContrastMap })} />
              <SwitchRow label={T.keyHints} checked={settings.showKeyHints} onChange={showKeyHints => onUpdate({ showKeyHints })} />
            </div>
          )}

          {tab === 'records' && (
            <div className={css.recordsPane}>
              <div className={css.rows}>
                <SwitchRow
                  label={T.share}
                  checked={settings.shareRecords === true}
                  hint={T.shareHint}
                  contentHint
                  onChange={shareRecords => onUpdate({ shareRecords })}
                />
              </div>

              <Card sunk pad="sm" className={css.cautionBox}>
                <div className={css.cautionHead}>
                  <span className={css.cautionTitle}>
                    <span className={css.cautionTag}>{S.caution}</span>
                    <span className={css.name}>{T.clear}</span>
                  </span>
                  {confirmClear ? (
                    <span className={css.actions}>
                      <Button variant="danger" onClick={() => void clearHistory()}>{T.clearConfirm}</Button>
                      <Button onClick={() => setConfirmClear(false)}>{T.cancel}</Button>
                    </span>
                  ) : (
                    <Button variant="danger" onClick={() => setConfirmClear(true)}>{T.clearAction}</Button>
                  )}
                </div>
                <p className={css.hint} data-content>{T.clearHint}</p>
              </Card>

              {historyError && <p className={css.alert} role="alert">{historyError}</p>}
              {clearedNotice && <p className={css.status} role="status">{T.cleared}</p>}
            </div>
          )}
        </ModalTabPanel>
      </ModalTabShell>
    </Modal>
  );
}
