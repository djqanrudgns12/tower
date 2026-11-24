import raw from '../../docs/contracts/balance.v2.json';
import { BALANCE, MAPS, PILOT_TOWERS, contextFor } from '../content';
import { loadR6Theme } from '../content/theme';
import type { DifficultyId } from '../contracts/balance';
import { R6_TOWERS, balanceV2Schema } from '../contracts/balanceV2';
import { buildPath } from '../domain/geometry';
import { compileR6Balance } from '../domain/r6Balance';
import { createRun, type NewRunInput } from '../domain/run';

function loadR6() {
  const rules = balanceV2Schema.parse(raw);
  const map = MAPS.find(m=>m.id===rules.prototypeMap);
  if (!map) throw new Error('R6 지도 좌표가 없습니다');
  return {balance:compileR6Balance(BALANCE,rules),map,path:buildPath(map),theme:loadR6Theme(rules)};
}
let cached: ReturnType<typeof loadR6> | undefined;

/** 로컬 전장과 시연용 진입점. 학년별 문제·읽기 기준을 유지하고 판별로 지도와 장착함을 고른다. */
export function localBalanceSession(version:'1.0.0'|'2.0.0', grade:number,difficulty:DifficultyId,
  input:Omit<NewRunInput,'grade'|'difficulty'|'availableTowers'|'mapId'>) {
  const source = contextFor(grade,difficulty);
  if (version==='1.0.0') return {version,ctx:source,state:createRun(source,{...input,grade,difficulty,mapId:source.map.id,availableTowers:[...PILOT_TOWERS]})};
  if (version!=='2.0.0') throw new Error('지원하지 않는 밸런스 판입니다');
  const {map,path,balance,theme} = cached ??= loadR6();
  const ctx = {...source,map,path,balance,difficulty:balance.difficulties[difficulty],questionGrade:grade};
  return {version,ctx,theme,state:createRun(ctx,{...input,grade,difficulty,mapId:map.id,availableTowers:[...R6_TOWERS]})};
}
