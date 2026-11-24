# R08 · 모래 협곡

사막 지형에 잉크 윤곽과 세 단계 명암을 얹은 지형도 같은 전장.

- **참고** · Sable에서 뫼비우스 작품의 영향을 받은 넓고 듬성한 사막, 대형 색면과 가는 윤곽의 대비를 가져왔다. [Sable 공식 소개](https://rawfury.com/games/sable/) · [Shedworks 제작 인터뷰](https://unity.com/resources/shedworks-sable-modular-design-approach)
- **팔레트와 글꼴** · 하늘 `#D4DCCE`, 모래 `#D9B285`, 밝은 사암 `#F3E4C6`, 잉크 `#262823`, 적의 회녹색 `#575B51`, 적갈색 `#9B4531`. Noto Serif KR 표제와 Noto Sans KR 문제 글을 조합했다. [Serif 라이선스](https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt) · [Sans 라이선스](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt)
- **형태와 조명** · 사암 면에 가는 검은 윤곽을 붙이고, 바깥에 멀리 보이는 능선 한 겹을 두었다. 협곡 바닥은 큰 색 덩어리로 두고 움직이는 적과 타워에만 작은 선을 집중했다. 번호와 선택된 타워의 강조색은 같은 적갈색이다.
- **제작** · 타워 20종 × 7형태(140), 적 8종족 × 12형태(96), 맵 4종에 같은 툰 램프를 적용한다. 선 굵기·조명 세팅 4인일, 타워 8인일, 적과 걷기·공격 자세 8인일, 맵 4인일, 축소 검수 3인일로 약 27인일을 가정한다. 방향별 자세를 사전 렌더 → 48px 선 정리 → WebP 스프라이트 시트로 패킹한다. Tripo 초벌 메시를 쓸 경우 엣지 밀도가 늘어날 수 있어 외곽선 후보부터 수동으로 줄인다. [Tripo](https://www.tripo3d.ai/)
- **크롬북** · 선화와 명암은 시트에 함께 굽는다. 화면에서 쓰는 애니메이션 프레임만 올리고 저사양 실기기에서 윤곽 떨림과 합성 시간을 확인한다.

저장소 루트에서 로컬 HTTP 서버를 띄우고 [목업](mock/index.html)을 연다. `?view=towers`와 `?view=enemies`는 비교 시트, `?still=1`은 움직임 정지다. 장면은 [공용 three.js 코드](../R06/mock/)를 사용한다.
