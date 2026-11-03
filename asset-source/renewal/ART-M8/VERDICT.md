# ART-M8 제작자 자체검수 (2026-11-03)

- 제작: Codex / OpenAI built-in image_gen. breeze_corsair(솔바람 하늘유랑단) 12종을 역할마다 별도 프롬프트로 생성했다. 재생성 0회. 최종 프롬프트와 생성 경로는 PROMPTS.json에 기록했다.
- 생성 도구 원본 12장을 raw에 보존했다. sources에는 1024px 정사각 RGB PNG 12장을 저장했다. 필요한 경우 LANCZOS 리사이즈를 적용하고 중성 백색(min>=228, 채널차<=24)을 #FFFFFF로 정규화했다.
- 지정 명령 실행: `uv run --no-project --with pillow --with numpy python asset-source/renewal/tools/monster_prepare.py asset-source/renewal/ART-M8` → `ART-M8 ok 12`.
- 일반 8종 128×128 RGBA, 대장 4종 192×192 RGBA, originX 0.5 / originY 0.75와 역할별 공용 heightScale을 사용했다. 공용 도구가 기입한 producer만 실제 생성 도구명으로 정정했다.
- 원본 12장을 개별 확인하고, 처리 후 잔디·어두운 배경 접촉판(각 1370×560, 64/48/32px)을 한 차례 확인했다. 오른쪽 진행, 삼각 활공 망토와 S자 꼬리, 역할별 장비, 표정과 프레임 안 전신을 확인했다. 문자·숫자·룬·외부 발광·배경 타일·잘림과 뚜렷한 흰 외곽 halo는 관찰되지 않았다. 꼬리는 넓은 색면과 소수의 큰 털 끝으로 표현했다.
- flyer: 베이지 삼각 활공막을 펼친 날다람쥐 정찰병. splitter: 분리된 베이지 돛주머니 두 개를 멘 다람쥐 운반병. 두 외형은 카탈로그 미기재 슬롯의 제작자 제안이며 다른 파일은 수정하지 않았다.
- 한 차례 규격 검사 PASS: 정확한 12역할 집합, 원본 1024px RGB와 순백 외곽, 결과 RGBA 치수·투명 외곽·pivot, 두 접촉판 규격.
- 총 41파일: raw 12 + sources 12 + r1 12 + 접촉판 2 + manifest.json / PROMPTS.json / VERDICT.md 3.
- 제작자 자체검수 draft. 독립 아트 승인·게임 내 확인·저장소 시험·빌드는 미실행. 커밋하지 않았다.

- 재생성(2026-11-03, Codex / OpenAI built-in image_gen): 54px에서 walker와 구별되지 않던 runner·flyer·splitter 3장을 각각 낮은 공중 질주+긴 스카프 / 대형 돛천 행글라이더 / 양쪽 어깨의 큰 둥근 보따리 두 개로 교체했다. PROMPTS.json에 최종 프롬프트·생성 경로·재생성 사유를 기록했고, 지정 처리 명령 `ART-M8 ok 12` 및 잔디·어두운 접촉판과 별도 54px 비교에서 세 역할의 실루엣 구별을 확인했다. 게임 내 확인·빌드는 미실행, 커밋하지 않았다.
