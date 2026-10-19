# 🇨🇳 中文 Quiz — 중국어 단어 연습

중국어 1~7과 단어 100개로 4지선다 퀴즈를 자동 출제합니다. (API 키 불필요)

- 유형: 한자→뜻 / 뜻→한자 / 한자→병음 / 병음→한자 / 혼합
- 정답 후 병음·품사·뜻 표시, 🔊 발음 듣기(브라우저 TTS), 오답 노트, 틀린 문제만 다시 풀기

## 실행
```
npm install
npm run dev
```

## 배포 (Vercel)
GitHub에 올린 뒤 vercel.com → Add New Project → 레포 선택 → Deploy (환경 변수 없음)

## 단어 추가/수정
`app/vocab.json`의 `w`(한자) `m`(뜻) `p`(병음) `pos`(품사)를 편집하세요.
