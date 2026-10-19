# 🇨🇳 中文 Quiz — 중국어 단어 연습

중국어 1~7과 단어 100개로 한어병음·뜻 4지선다 퀴즈를 출제합니다. 한자는 화면에 표시하지 않습니다.

- **기본 문제**: 단어장에서 자동 출제 (API 키 불필요)
- **🤖 AI 생성**: Gemini(기본 `gemini-3.8-flash`)가 매번 새 유형의 문제 30개 생성 (`GEMINI_API_KEY` 필요)

- 유형: 병음→뜻 / 뜻→병음 / 혼합 (한자는 표시하지 않음)
- 정답 후 병음·품사·뜻 표시, 🔊 발음 듣기(브라우저 TTS, 기본 문제만), 오답 노트, 틀린 문제만 다시 풀기

## 실행
https://aistudio.google.com/apikey 에서 무료 키 발급 후 `.env.local`에 `GEMINI_API_KEY=키` 저장
```
npm install
npm run dev
```

## 배포 (Vercel)
GitHub에 올린 뒤 vercel.com → Add New Project → 레포 선택 → Deploy → Environment Variables에 `GEMINI_API_KEY` 추가 → Deploy

## 단어 추가/수정
`app/vocab.json`의 `p`(병음) `m`(뜻) `pos`(품사)를 편집하세요. (`w`는 🔊 발음용으로만 쓰며 화면에는 표시되지 않습니다.)

## 모델 변경
기본 모델이 중단되면 환경 변수 `GEMINI_MODEL`에 새 모델 이름을 넣고 Redeploy 하세요.
