# R07 · 작업대

실내등 아래 나무 위에 올려 둔 지형판과 손으로 도색한 미니어처.

- **참고** · Warhammer의 모형 받침과 지형판 사이 단차, Citadel Colour의 얇은 명암층을 원리로 삼았다. [Games Workshop의 테이블 구상](https://www.warhammer-community.com/en-gb/articles/a9S2dbUn/hobby-at-home-getting-started/) · [Citadel Colour의 도색 방식](https://www.warhammer-community.com/en-gb/articles/omfjuf55/citadel-colour-the-only-painting-partner-you-need/)
- **팔레트와 글꼴** · 그늘 `#241E1A`, 올리브 `#666D52`, 석재 `#D9C7A5`, 철 `#35342B`, 나무와 흙의 중간색 `#62574B`, 구리 `#A56F52`. 표제에는 Noto Serif KR, 조작과 문제에는 Noto Sans KR을 쓴다. [Serif 라이선스](https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt) · [Sans 라이선스](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt)
- **형태와 조명** · 모형마다 기단을 두고 폭이 넓은 실내광과 접지 그림자로 크기를 전달한다. 나뭇결은 판 밖에만 나타난다. 약한 틸트시프트는 지도 바깥과 가장자리에 집중하고 길과 선택지는 또렷하게 유지한다.
- **제작** · 공용 모델로 타워 20종 × 7형태(140), 적 8종족 × 12형태(96), 맵 4종을 조립한다. 재질·그림자 세팅 4인일, 타워 8인일, 적과 걷기·공격 자세 8인일, 맵 4인일, 축소 검수 2인일로 약 26인일을 가정한다. 모형과 접지 그림자를 따로 사전 렌더 → WebP 스프라이트 시트로 패킹한다. 초점이 좁으면 먼 칸이 흐릿해지므로 양산 시 흐림은 배경에만 굽는다. Tripo 초벌 메시를 쓸 경우 광택과 표면 잔무늬를 줄이고 도색 색면을 다시 맞춘다. [Tripo](https://www.tripo3d.ai/)
- **크롬북** · 틸트시프트와 그림자는 배경에 미리 굽고 전장에는 필요한 2D 시트만 합성한다. 저사양 실기기 성능은 미측정이다.

저장소 루트에서 로컬 HTTP 서버를 띄우고 [목업](mock/index.html)을 연다. `?view=towers`와 `?view=enemies`는 비교 시트, `?still=1`은 움직임 정지다. 장면은 [공용 three.js 코드](../R06/mock/)를 사용한다.
