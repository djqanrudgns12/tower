import type { Balance, FoeTag, FormId, TowerId } from '../../contracts/balance';
import { ArtIcon } from '../kit';
import { counterTags, counterText, FOE_LABEL, FOE_PORTRAIT, FOE_TRAIT_ICON } from './counters';
import css from './CounterIcons.module.css';

interface Props {
  balance: Balance;
  type: TowerId;
  form: FormId;
  /** 전장 텍스처 그림(적 초상화 대체용). */
  icons: Record<string, string>;
  /** 아이콘 크기(px). */
  size?: number;
}

/** 표지 하나: 원화 특성 아이콘 → 적 초상화 → 글자(13px) 순. */
function FoeMark({ tag, icons, size }: { tag: FoeTag; icons: Record<string, string>; size: number }) {
  const trait = FOE_TRAIT_ICON[tag];
  if (trait) return <ArtIcon name={trait} size={size} />;
  const portrait = FOE_PORTRAIT[tag] ? icons[FOE_PORTRAIT[tag]] : undefined;
  if (portrait) return <img className={css.portrait} src={portrait} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
  return <span className={css.word} aria-hidden="true">{FOE_LABEL[tag]}</span>;
}

/**
 * 잘 잡는 적(최대 2)·약한 적(최대 1) 아이콘 한 줄(prd-r4 §7.2 D·§9.1). 계약 strongVs·weakVs에서 만들고, 화면 읽기는 이름 목록으로 읽는다.
 * 둘 다 없으면(궁수·깃발) 아무것도 그리지 않는다.
 */
export function CounterIcons({ balance, type, form, icons, size = 20 }: Props) {
  const { strong, weak } = counterTags(balance, type, form);
  if (strong.length === 0 && weak.length === 0) return null;
  const said = counterText(balance, type, form);
  return (
    <div className={css.counters} role="img" aria-label={said} title={said}>
      {strong.length > 0 && (
        <span className={css.group} data-tone="strong">
          <span className={css.label} aria-hidden="true">잘 잡는 적</span>
          {strong.map(tag => <FoeMark key={tag} tag={tag} icons={icons} size={size} />)}
        </span>
      )}
      {weak.length > 0 && (
        <span className={css.group} data-tone="weak">
          <span className={css.label} aria-hidden="true">약한 적</span>
          {weak.map(tag => <FoeMark key={tag} tag={tag} icons={icons} size={size} />)}
        </span>
      )}
    </div>
  );
}
