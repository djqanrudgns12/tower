import type { BossSkillKind, EnemyKind, TowerId } from '../contracts/balance';
import type { HazardKind, HazardLine, Phase } from './types';

/** 장판·덫·굴림체가 사라진 까닭: 지속 끝(time), 횟수를 다 씀·폭발(spent), 굴림 끝(end), 웨이브 끝(wave), 타워 판매(sold). */
export type HazardEndReason = 'time' | 'spent' | 'end' | 'wave' | 'sold';

// 화면·렌더러로 보내는 사건. 보상은 이미 상태에 반영된 뒤 알린다(애니메이션이 보상을 만들지 않는다, PRD §10.3).
export type DomainEvent =
  | { type: 'phase'; phase: Phase; wave: number }
  | { type: 'encounter'; encounterId: number }
  | { type: 'answered'; encounterId: number; result: 'correct' | 'wrong' | 'skipped'; pt: number; gold: number }
  | { type: 'burning'; untilTick: number }
  /** art는 렌더러가 쓸 그림 id(`<종족 접두어>.<역할|boss5~boss20>`, domain/factions.ts enemyArtId). */
  | { type: 'spawn'; enemyId: number; kind: EnemyKind; faction: string; art: string }
  | { type: 'fire'; projectileId: number; towerId: number; towerType: TowerId }
  /** 즉발 공격(번개·화염·근접). 비행 지연 없이 같은 틱에 맞힌다(PRD §11.4, §20.3). targets는 맞힌 순서다. */
  | { type: 'strike'; towerId: number; towerType: TowerId; fromX: number; fromY: number; targets: Array<{ enemyId: number; x: number; y: number }> }
  /** 화상 피해 한 번(적마다 0.5초 시계). */
  | { type: 'burn'; enemyId: number; damage: number }
  | { type: 'hit'; enemyId: number; x: number; y: number; damage: number; towerType: TowerId }
  | { type: 'kill'; enemyId: number; kind: EnemyKind; elite: boolean; x: number; y: number; gold: number; pt: number }
  | { type: 'leak'; enemyId: number; kind: EnemyKind; damage: number; gateHp: number }
  | { type: 'waveComplete'; wave: number; milestoneGold: number }
  | { type: 'gameOver'; completedWave: number; endedAtWave: number; reason: 'DEFEAT' | 'QUIT' }
  | { type: 'towerBuilt' | 'towerUpgraded' | 'towerSold'; towerId: number; slotId: string; gold: number }
  /** 대장 기믹이 발동했다(방어 태세·겹방패 한 겹·회복·호위 호출). 돌진·북소리는 상시라 알리지 않는다. */
  | { type: 'bossSkill'; enemyId: number; skill: BossSkillKind }
  /**
   * 장판·덫·굴림체·지연 폭발이 생겼다(towers.md §4-7). 자세한 상태(남은 횟수·굴림 끝 등)는 RunState.hazards에서 같은 id로 읽는다.
   * radius는 zone 반경·trap 감지 반경·roller 반쪽 폭, progress는 경로 위 진행도(zone은 null), line은 직선 지연 폭발(노포 B2)이다.
   * blast는 한 번 터지고 사라지는 지연 폭발(덫 B1 2차 폭죽·노포 B2 도화선)이면 true다.
   */
  | { type: 'hazardPlaced'; hazardId: number; kind: HazardKind; towerId: number; towerType: TowerId; x: number; y: number; radius: number; progress: number | null; expiresTick: number | null; line: HazardLine | null; blast: boolean }
  /**
   * 장판 한 번 타격·덫 발동·굴림체 충돌·폭발. x·y는 그 순간의 중심(굴림체는 지금 위치), targets는 맞힌 순서다.
   * blast는 둘레 폭발(통나무 B 화약 술통·지연 폭발)이면 true이고, 맞은 적이 없어도 알린다.
   */
  | { type: 'hazardTriggered'; hazardId: number; kind: HazardKind; towerId: number; towerType: TowerId; x: number; y: number; blast: boolean; targets: Array<{ enemyId: number; x: number; y: number }> }
  /** 장판·덫·굴림체가 사라졌다. */
  | { type: 'hazardExpired'; hazardId: number; kind: HazardKind; towerId: number; reason: HazardEndReason }
  /** 처치 골드 오라(깃발 A2)가 골드를 줬다. */
  | { type: 'auraGold'; towerId: number; gold: number }
  /** 징집 후보가 나왔다(웨이브 완료 직후). */
  | { type: 'draftOffered'; wave: number; offers: TowerId[] }
  /** 징집으로 장착함에 타워가 들어왔다. auto는 고르지 않은 채 다음 징집이 와서 첫 후보로 정해진 경우다. */
  | { type: 'draftPicked'; tower: TowerId; auto: boolean };
