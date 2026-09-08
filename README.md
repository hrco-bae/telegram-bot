# 🎖️ 군대·AI 뉴스 카카오워크 봇

매일 아침 자동으로 군대·AI 관련 최신 뉴스를 카카오워크로 받을 수 있는 서비스입니다. Vercel 서버리스 + Vercel Cron으로 동작합니다.

## 🚀 시작하기

### 1. 카카오워크 Incoming Webhook 발급받기
1. 카카오워크에서 **확장 서비스 > Incoming Webhook**을 선택하세요
2. **Bot 만들기**를 누르고 뉴스를 받을 채팅방을 선택하세요
3. 발급된 Webhook URL을 복사하세요 (외부에 노출되지 않도록 안전하게 보관)

### 2. 환경 설정
`.env.example` 파일을 복사해서 `.env` 파일을 만들고 URL을 붙여넣으세요:
```bash
cp .env.example .env
```

```
KAKAOWORK_WEBHOOK_URL=발급받은_웹훅_URL
```

### 3. 패키지 설치
```bash
npm install
```

### 4. 로컬 개발
```bash
npm run dev
```

### 5. 배포
Vercel 프로젝트에 연결하고 `KAKAOWORK_WEBHOOK_URL`을 프로덕션 환경 변수로 등록하면, `vercel.json`에 설정된 크론(매일 UTC 23:30 = 서울 08:30)이 `/api/send-news`를 호출해 뉴스를 전송합니다.

## ✨ 주요 기능

- 📰 **한글 필터링** - 한글 뉴스만 수집하여 전송
- 🎯 **주제별 고정 5개** - 군대·AI 관련 뉴스 각 5개씩 매번 전송
- 🔗 **제목에 링크** - 카카오워크 Block Kit으로 기사 제목 자체에 링크를 걸고 원본 URL은 노출하지 않음

## 📁 파일 구조

```
telegram-bot/
├── news.js              # 뉴스 수집·포맷팅·카카오워크 전송 로직
├── api/
│   └── send-news.js     # Vercel Cron이 호출하는 엔드포인트
├── vercel.json           # Vercel Cron 설정
├── package.json           # 프로젝트 설정
├── .env                  # 환경 변수 (웹훅 URL) - 절대 커밋하지 마세요!
├── .env.example          # 환경 변수 예시 파일
├── .gitignore            # Git 무시 파일
└── README.md             # 이 파일
```

## 🔒 보안 주의사항

**.env 파일은 절대 깃허브에 올리지 마세요!**
- `.gitignore`에 `.env`가 포함되어 있으므로 자동으로 무시됩니다.
- 카카오워크 Webhook URL은 그 자체로 인증 정보입니다 — URL만 알면 누구나 해당 채팅방에 메시지를 보낼 수 있습니다. 공개 저장소나 대화에 노출되지 않도록 주의하세요.

## 📜 라이센스

MIT

## 👨‍💻 개발자

- Created: 2026
