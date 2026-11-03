# ART-CY1 궁궐 뜰 바닥 재료

## 완료
- 12장 원본 생성 및 규격 처리 완료. 최종 PNG 12장, manifest 전부 draft.
- 내장 image_gen.imagegen 사용. 최종 프롬프트는 prompts.json, 시도별 원문은 generation-metadata.json 및 logs/*.generation.json.
- ground 3종: 256×256 불투명, 평균색 #7fb553 / #8fc260 / #6da047.
- meadow 3종: 384×384 실제 투명 알파. 마사토·이끼 낀 박석 틈·매화 꽃잎.
- path.dirt: 256×256 불투명 박석 질감. 잔디 술 2종·흰 자갈 1종: 128×128 투명.
- slot.pad 2종: 192×192 투명, 표시 0.8칸. 낮은 네모 화강암 기단.
- 밝음/어두움 접촉판에 32/48/64px 축소와 기존 인수 그림을 함께 놓음. 합성 맵 미리보기는 요청에 따라 만들지 않음.

## 반려·재생성
- courtyard.meadow.0 1차: 중심이 불투명하고 외곽이 판처럼 또렷함. 내부 빈틈과 반투명 붓결을 강화해 2차 생성.
- courtyard.path.pebbles.0 1차: 누런 분홍·갈색 기와 넓은 그림자. 흰색·회색 자갈과 짧은 그림자로 2차 생성.
- 재생성 총 2회. 원본 14장과 반려 가공본 2장은 sources/ 및 rejected/에 보존.
- 기단은 재생성하지 않음. 원본 alpha 1~4 잡점 때문에 보이는 기단이 작아져, alpha>4 경계 + 원본 8px 여백으로 잘라낸 뒤 정원 동일 번호 받침의 실제 폭·중심에 맞춰 비율 유지 축소. 내부 알파 재도색 없음.

## 검증
- 실행: prepare.py prepare, 신규 원본 처리 및 접촉판 생성. 12장 기술 검사 오류 없음.
- 실행: prepare.py verify. 최종 PNG 12장 규격·해시·draft·투명 여백·타일 경계·원본 보존 검사 통과. logs/final-verification.json.
- 실행: 밝음/어두움 접촉판, tile-check.png 육안 확인. 1차 자체 검수 통과. 총괄 인수는 미실행.
- 빌드·e2e 미실행: 앱 코드와 실제 배치 변경 없음.
- 공유 작업트리에서 public/assets/manifest.json의 외부 변경 관측. logs/scope-observation.json 참고. 본 작업은 ART-CY1 외부에 쓰지 않음.

## 총괄 판단
- 궁궐 뜰 전체 배치에서 마사토/박석/잔디의 면적 비율과 은은한 꽃잎의 가독성.
- 네모 기단의 실제 타워 결합과 짧은 옆면. 정원 받침과의 coreBBox 수치는 logs/alpha-and-pad-measurements.json에 기록.
- 좌우반전 시 작은 좌상단 명암·우하단 그림자의 자연스러움은 총괄 배치에서 최종 판단.
- 배포·등록·다른 폴더 수정·커밋 미실행.
