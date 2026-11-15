---
id: wiki-codemap
type: registry
title: 모듈 코드맵
status: active
generated_by: tools/wiki/gen.mjs
---

# 모듈 코드맵 (`codemap`)

> 이 파일은 `npm run wiki:sync` (`tools/wiki/gen.mjs`)가 코드·계약 JSON·SQL에서 결정적으로 자동 생성합니다. 직접 수정하지 마세요.

## 1. ESLint 강제 계층 경계 (`eslint.config.js`)

| 대상 경로 | 가져올 수 없는 대상 (`no-restricted-imports`) |
| --- | --- |
| `src/domain/**` | `react`, `react-dom`, `phaser`, `idb`, `**/ui/**`, `**/game/**`, `**/persistence/**`, `**/application/**` |
| `src/content/**`, `src/contracts/**` | `react`, `react-dom`, `phaser`, `idb`, `**/ui/**`, `**/game/**`, `**/persistence/**` |
| `src/game/**` | `react-dom`, `idb`, `**/persistence/**`, `**/domain/run`, `**/domain/combat` |
| `src/ui/**` | `phaser`, `idb`, `**/persistence/**`, `**/domain/combat` |

## 2. 영역별 규모 요약

| 영역 | 파일 수 | 총 줄 수 | 책임 |
| --- | ---: | ---: | --- |
| `src/domain` | 16 | 3,362 | 30Hz 고정 틱 전투·경제·징집·보물·퀴즈·시드 PRNG 순수 도메인 |
| `src/contracts` | 7 | 1,231 | 밸런스·맵·문제은행·초안·로비·원화 manifest Zod 런타임 계약 |
| `src/content` | 3 | 425 | 학년별 문제은행 지연 로더·의미 검사·철회 목록 적용 |
| `src/application` | 9 | 1,707 | RunController(유일한 상태 작성자)·세션·로비·NEIS·QA 장면 상태 |
| `src/persistence` | 5 | 1,235 | IndexedDB 로컬 기록·오답 노트·기기 인증·서버 동기화 큐 |
| `src/game` | 19 | 3,484 | Phaser 4 전장 렌더러·레이어 6종·보행/자세 애니메이션·맵 지면 조립 |
| `src/ui` | 64 | 10,999 | React 19 화면(홈·새 게임·전투 HUD/카드·오답 노트·설명서·결과) 및 오디오 |
| `server/src` | 14 | 1,596 | Cloudflare Workers + D1 기기 발급·판 재채점·통합 랭킹·일일 정리 서버 |
| `tools/content & orchestrate` | 20 | 4,973 | 공개 은행 컴파일러·학년 띠 공유·CR-1000 다중 모델 공동검수 및 commit-lock |
| `tools/sim, qa & assets` | 14 | 3,542 | 밸런스 봇 시뮬레이터·관문 평가기·성능/장면 QA·WebP 알파 보존 변환기 |
| `tests/unit & e2e` | 108 | 19,074 | Vitest 단위/속성 시험 및 Playwright 실브라우저·로컬 서버 연결 시험 |

## 3. 영역별 대표 진입 모듈

### src/domain

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/domain/combat.ts](../src/domain/combat.ts) | 1023 | `battleTick`, `burningSpeedBP`, `burningBonusBP`, `towerSpeedBonusBP`, `chainDamage` | - |
| [src/domain/run.ts](../src/domain/run.ts) | 456 | `Command`, `CommandError`, `CommandResult`, `NewRunInput`, `correctGoldAt` | - |
| [src/domain/types.ts](../src/domain/types.ts) | 396 | `RUN_STATE_VERSION`, `RULES_VERSION`, `RunEndReason`, `Phase`, `PauseReason` | - |
| [src/domain/towers.ts](../src/domain/towers.ts) | 345 | `TowerStats`, `Effects`, `formTier`, `formBranch`, `formConfig` | - |
| [src/domain/quiz.ts](../src/domain/quiz.ts) | 253 | `RECENT_QUESTIONS`, `RECENT_SENSES`, `HELP_WINDOW`, `READING_BAND_RATIO`, `REVIEW_EVERY` | - |
| [src/domain/relics.ts](../src/domain/relics.ts) | 155 | `relicIds`, `relicDef`, `ownedRelics`, `relicBalance`, `relicContext` | - |
| [src/domain/waves.ts](../src/domain/waves.ts) | 145 | `waveCount`, `spawnIntervalMs`, `spawnIntervalTicks`, `hpBaseMilli`, `hpReferenceCount` | - |
| [src/domain/factions.ts](../src/domain/factions.ts) | 120 | `campaignOf`, `bossRank`, `artRoleOf`, `enemyArtId`, `bossDef` | - |

### src/contracts

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/contracts/balance.ts](../src/contracts/balance.ts) | 546 | `DIFFICULTY_IDS`, `ENEMY_KINDS`, `REGULAR_KINDS`, `BASE_ROLES`, `BOSS_TIERS` | - |
| [src/contracts/questions.ts](../src/contracts/questions.ts) | 194 | `OPTION_IDS`, `OptionId`, `QUESTION_TYPES`, `QuestionType`, `DIFFICULTY_TIERS` | - |
| [src/contracts/lobby.ts](../src/contracts/lobby.ts) | 191 | `TelemetryStatus`, `TelemetrySnapshot`, `RANKING_TAB_IDS`, `RankingTabId`, `RANKING_PERIODS` | - |
| [src/contracts/questionDraft.ts](../src/contracts/questionDraft.ts) | 126 | `questionDraftSchema`, `draftBatchSchema`, `draftSidecarSchema`, `blindReviewSchema`, `explanationReviewSchema` | - |
| [src/contracts/levels.ts](../src/contracts/levels.ts) | 100 | `LEVEL_RUBRIC_VERSION`, `levelJudgeSchema`, `levelPrecomputedSchema`, `LEVEL_FLAGS`, `levelMergedSchema` | - |
| [src/contracts/assetManifest.ts](../src/contracts/assetManifest.ts) | 45 | `ASSET_STATUS`, `assetEntrySchema`, `assetManifestSchema`, `AssetEntry`, `AssetManifest` | - |
| [src/contracts/maps.ts](../src/contracts/maps.ts) | 29 | `mapSchema`, `mapsFileSchema`, `MapConfig`, `MapSlot` | - |

### src/content

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/content/lint.ts](../src/content/lint.ts) | 232 | `LintInput`, `lintQuestion`, `lintBatchStrict`, `loadOf`, `lintBatchForGrade` | - |
| [src/content/index.ts](../src/content/index.ts) | 149 | `BALANCE`, `MAPS`, `DEFAULTS`, `PILOT_TOWERS`, `RETRACTIONS` | - |
| [src/content/gradeLoader.ts](../src/content/gradeLoader.ts) | 44 | `GradeLoadState`, `BankLoader`, `createGradeLoader` | - |

### src/application

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/application/lobby.ts](../src/application/lobby.ts) | 687 | `subscribeRecordSharing`, `fnv1a32`, `loadAllStudyCards`, `pickRandomInitialStudyIndex`, `selectDailySteleCards` | - |
| [src/application/RunController.ts](../src/application/RunController.ts) | 280 | `TICK_MS`, `USER_CLEARABLE`, `RunControllerOptions`, `RunController` | - |
| [src/application/neis.ts](../src/application/neis.ts) | 182 | `NeisSchool`, `SearchOptions`, `searchNeisSchools` | NEIS(교육부 나이스) 오픈 API 학교 정보 연동 서비스. |
| [src/application/view.ts](../src/application/view.ts) | 152 | `QuestionView`, `TowerView`, `QuestionStakesView`, `GameView`, `Notice` | - |
| [src/application/entryUrl.ts](../src/application/entryUrl.ts) | 132 | `ParsedEntryUrl`, `parseEntrySearchParams`, `consumeEntryUrlPatch`, `buildClassroomShareUrl`, `detectInAppBrowser` | - |
| [src/application/mapPreview.ts](../src/application/mapPreview.ts) | 111 | `PREVIEW_PARAM`, `SAMPLE_TOWERS`, `MapPreviewRequest`, `parseMapPreview`, `startMapPreview` | - |
| [src/application/session.ts](../src/application/session.ts) | 109 | `StartResult`, `startNewRun`, `bestWaveOf`, `bestWaveFor`, `reviewNoteItems` | - |
| [src/application/qaRun.ts](../src/application/qaRun.ts) | 39 | `QA_RUN_PARAM`, `QA_RUN_KEY`, `startQaRun`, `qaRunFromLocation` | - |

### src/persistence

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/persistence/lobbyClient.ts](../src/persistence/lobbyClient.ts) | 508 | `buildLocalRanking`, `fetchRanking`, `computeLocalPlayCounts`, `fetchInitialTelemetry`, `cancelRunStartRetry` | - |
| [src/persistence/reviewNote.ts](../src/persistence/reviewNote.ts) | 218 | `REVIEW_NOTE_KEY`, `REVIEW_NOTE_MAX`, `REVIEW_GRADUATE_CLEARS`, `ReviewNoteItem`, `ReviewNote` | - |
| [src/persistence/db.ts](../src/persistence/db.ts) | 217 | `RunRecord`, `RunAnswer`, `PendingRunSync`, `QuestionHistory`, `db` | - |
| [src/persistence/settings.ts](../src/persistence/settings.ts) | 172 | `FontScale`, `MotionMode`, `VolumeStepBgm`, `VolumeStepSfx`, `BGM_STEPS` | 환경설정은 기기에 따로 저장하며 전투 판정에 영향을 주지 않는다(PRD §2, §17.1). |
| [src/persistence/auth.ts](../src/persistence/auth.ts) | 120 | `ApiEnv`, `PublicRecordNotice`, `getPublicRecordNotice`, `subscribePublicRecordNotice`, `setPublicRecordNotice` | - |

### src/game

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/game/art.ts](../src/game/art.ts) | 448 | `PALETTE`, `rand01`, `isTreeCell`, `GroundSkip`, `GROUND_ART` | - |
| [src/game/layers/EffectLayer.ts](../src/game/layers/EffectLayer.ts) | 427 | `EffectLayer` | - |
| [src/game/layers/cues.ts](../src/game/layers/cues.ts) | 271 | `FLYER_LIFT_CELLS`, `INTRO_MS`, `SPLIT_HOP_CELLS`, `SPLIT_LABEL_RAISE_CELLS`, `BossStatus` | - |
| [src/game/layouts/index.ts](../src/game/layouts/index.ts) | 266 | `PLACEMENT_KINDS`, `PlacementKind`, `mapLayoutSchema`, `MapLayout`, `LayoutPlacement` | - |
| [src/game/layers/AmbientLayer.ts](../src/game/layers/AmbientLayer.ts) | 259 | `AmbientLayer` | - |
| [src/game/layers/EnemyLayer.ts](../src/game/layers/EnemyLayer.ts) | 251 | `EnemyLayer` | - |
| [src/game/ambient.ts](../src/game/ambient.ts) | 242 | `rng`, `ambientSeed`, `Tint`, `TintTable`, `DAY_WAVES` | - |
| [src/game/layers/TowerLayer.ts](../src/game/layers/TowerLayer.ts) | 230 | `TowerLayer` | - |

### src/ui

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [src/ui/game/GameScreen.tsx](../src/ui/game/GameScreen.tsx) | 836 | `GameScreen` | - |
| [src/ui/screens/home/MiniStageCanvas.tsx](../src/ui/screens/home/MiniStageCanvas.tsx) | 718 | `DemoEnemy`, `DemoProjectile`, `StageDemoSnapshot`, `sampleStageDemo`, `MiniStageCanvas` | - |
| [src/ui/screens/guide/guideModel.ts](../src/ui/screens/guide/guideModel.ts) | 553 | `GUIDE_CHAPTER_IDS`, `GuideChapterId`, `GuideRowIconId`, `GuideSummaryRow`, `GuideChapterSpec` | - |
| [src/ui/screens/home/terrainBaker.ts](../src/ui/screens/home/terrainBaker.ts) | 501 | `TonePool`, `SplineSample`, `ArcSample`, `hash2d`, `lowFreqNoise` | - |
| [src/ui/utils/qr.ts](../src/ui/utils/qr.ts) | 447 | `encodeQrMatrix`, `qrMatrixToSvgPath` | 외부 의존성 없는 순수 TypeScript ISO/IEC 18004 QR 코드 행렬 생성기 (Byte 모드 · 오류 복원 수준 M · 버전 1~10). |
| [src/ui/screens/home/RankingBoard.tsx](../src/ui/screens/home/RankingBoard.tsx) | 442 | `TAB_LABELS`, `PERIOD_LABELS`, `formatPrimaryMetric`, `RankingBoard` | - |
| [src/ui/screens/home/LaunchDeck.tsx](../src/ui/screens/home/LaunchDeck.tsx) | 435 | `LaunchDeck` | - |
| [src/ui/kit/index.tsx](../src/ui/kit/index.tsx) | 395 | `Button`, `IconButton`, `Card`, `Segmented`, `Toggle` | - |

### server/src

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [server/src/handlers.ts](../server/src/handlers.ts) | 386 | `Context`, `healthCheck`, `searchSchools`, `issueDevice`, `recordLobbyVisit` | 엔드포인트 판단. |
| [server/src/store.ts](../server/src/store.ts) | 244 | `VERIFIED_LEVEL`, `RateLimit`, `DEVICE_RATE_LIMITS`, `RateAction`, `IP_RATE_LIMITS` | 요청마다 |
| [server/src/validate.ts](../server/src/validate.ts) | 184 | `MAX_ANSWERS_JSON_BYTES`, `MAX_ANSWERS`, `parseRunId`, `parseTimestamp`, `SubmitClaim` | - |
| [server/src/ranking-cache.ts](../server/src/ranking-cache.ts) | 118 | `CacheLike`, `CacheScope`, `RankingCache`, `cacheSeconds` | 랭킹 응답 캐시(Workers Cache API, 거점별). |
| [server/src/http.ts](../server/src/http.ts) | 100 | `BODY_LIMIT_SMALL`, `BODY_LIMIT_SUBMIT`, `PREFLIGHT_MAX_AGE_SECONDS`, `HttpError`, `parseAllowedOrigins` | 응답 모양·CORS·요청 본문 크기 제한. |
| [server/src/app.ts](../server/src/app.ts) | 99 | `Env`, `Deps`, `handleRequest`, `runScheduledCleanup` | - |
| [server/src/graphemes.ts](../server/src/graphemes.ts) | 99 | `countGraphemes` | 사용자 인식 문자 수(UAX #29, Unicode 17.0). |
| [server/src/crypto.ts](../server/src/crypto.ts) | 98 | `KEY_LABELS`, `MIN_SALT_LENGTH`, `ServerKeys`, `isUsableSalt`, `deriveKeys` | 비밀값은 PLAYER_SALT 하나다. |

### tools/content & orchestrate

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [tools/orchestrate/review.mjs](../tools/orchestrate/review.mjs) | 705 | `resolveReviewConfig`, `assertPhaseConfig`, `existingReportArchive`, `load`, `pendingReviewFiles` | 공동검수 자동화(공동검수 절차 3~5단계, PRD §9.3). |
| [tools/orchestrate/content-loop.mjs](../tools/orchestrate/content-loop.mjs) | 678 | `acquireGateRun`, `createGateRuntime`, `gatePrimary`, `runGate`, `runProduce` | 문항 공동검수 전체 자동 루프(공동검수 절차 3~6단계, PRD §9.3). |
| [tools/orchestrate/produce.mjs](../tools/orchestrate/produce.mjs) | 451 | `load`, `selectItems`, `evidenceInput`, `prepare`, `promptFor` | S6: 검증한 새 낱말 → 근거 → Argon 초안. |
| [tools/orchestrate/revise.mjs](../tools/orchestrate/revise.mjs) | 430 | `load`, `pendingJson`, `readReviseLog`, `flagged`, `promptFor` | 공동검수 6단계 자동화: fail·uncertain을 받은 문항을 작성자(Argon)에게 돌려보내 revision을 올린다. |
| [tools/content/bankBuild.ts](../tools/content/bankBuild.ts) | 372 | `BLIND_REVIEWERS`, `MIN_PUBLISHED`, `isPractice`, `PRACTICE_SIZE`, `RULE` | - |
| [tools/orchestrate/level.mjs](../tools/orchestrate/level.mjs) | 366 | `load`, `stdictSpecialized`, `rubricText`, `promptFor`, `parseReply` | S1 수준 판정. |
| [tools/orchestrate/commit-lock.mjs](../tools/orchestrate/commit-lock.mjs) | 281 | `guardedServerTest`, `withCommitLock`, `resolveCoAuthor`, `applyStaged` | 추적 콘텐츠 쓰기·빌드·서버 시험·경로 한정 커밋을 하나의 잠금으로 묶는다. |
| [tools/orchestrate/wp.mjs](../tools/orchestrate/wp.mjs) | 275 | `loadJobs`, `loadState`, `globToRegExp`, `matchesAny`, `create` | 작업 패키지 자동 발행·수합기. |

### tools/sim, qa & assets

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [tools/sim/balanceSim.ts](../tools/sim/balanceSim.ts) | 590 | `StrategyId`, `Strategy`, `DraftPolicy`, `DRAFT_POLICIES`, `Judge` | - |
| [tools/sim/gate.ts](../tools/sim/gate.ts) | 500 | `Status`, `GateRow`, `Dataset`, `median`, `mean` | - |
| [tools/qa/states.ts](../tools/qa/states.ts) | 439 | `BuiltScene`, `SceneRequest`, `TowerSpec`, `BUILDERS`, `buildScene` | - |
| [tools/sim/bots.ts](../tools/sim/bots.ts) | 394 | `NUMERIC_LIMIT`, `CORE4`, `BotName`, `BotTuning`, `FAST_TUNING` | - |
| [tools/qa/scenes.mjs](../tools/qa/scenes.mjs) | 273 | `SCENES`, `makeMontages`, `summarize` | global window, document, getComputedStyle -- page.evaluate 안에서 도는 코드가 쓰는 브라우저 전역이다 |
| [tools/qa/lib.mjs](../tools/qa/lib.mjs) | 232 | `ROOT`, `SIZES`, `NICKNAME`, `flag`, `ensureServer` | global window, document, getComputedStyle -- page.evaluate 안에서 도는 코드가 쓰는 브라우저 전역이다 |
| [tools/sim/towerEfficiency.ts](../tools/sim/towerEfficiency.ts) | 224 | `Placement`, `Stream`, `STREAMS`, `StreamName`, `TRAIT_STREAMS` | - |
| [tools/sim/gateReport.ts](../tools/sim/gateReport.ts) | 202 | `CellReport`, `ReportData`, `reportData`, `fullReport` | - |

### tests/unit & e2e

| 파일 | 줄 수 | 주요 `export` | 상단 설명 |
| --- | ---: | --- | --- |
| [tests/unit/imageMeta.ts](../tests/unit/imageMeta.ts) | 342 | `ImageInfo`, `AlphaImage`, `readImageInfo`, `readAlphaFromBuffer`, `readAlpha` | - |
| [tests/e2e/tower-browser.ts](../tests/e2e/tower-browser.ts) | 114 | `TowerBrowserTransport`, `test` | - |
| [tests/unit/helpers.ts](../tests/unit/helpers.ts) | 86 | `THREE_TOWERS`, `newRun`, `ok`, `correctChoice`, `wrongChoice` | - |
| [tests/unit/review-core/fixtures.ts](../tests/unit/review-core/fixtures.ts) | 39 | `battleFixture`, `enemy`, `controlledFrames` | - |
