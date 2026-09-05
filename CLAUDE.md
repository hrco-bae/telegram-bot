# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 제공하는 안내 문서입니다.

## 프로젝트 개요

텔레그램 봇("군대 관련 뉴스 텔레그램 봇")으로, 구글 뉴스 RSS에서 군대 관련 한글 뉴스를 수집해 매일 정해진 시간에 구독자들에게 전송합니다. Vercel 서버리스 배포를 전제로 **웹훅 방식**으로 동작하며, 폴링(`bot.launch`)이나 `node-cron` 같은 상시 실행 프로세스는 사용하지 않습니다.

## 명령어

- 의존성 설치: `npm install`
- 로컬 개발: `npm run dev` (`vercel dev` — Vercel CLI 필요, `api/` 함수를 로컬에서 서빙)
- 별도의 테스트 프레임워크는 구성되어 있지 않습니다(package.json에 test 스크립트 없음, jest/mocha 없음). 루트에 있는 `test-*.js` 파일들은 구글 뉴스 RSS 피드/파싱 로직을 확인하기 위한 임시 스크립트로, 테스트 러너가 아니라 `node test-<name>.js` 형태로 개별 실행합니다.

## 설정

`.env.example`을 참고해 다음 환경 변수가 필요합니다:
- `BOT_TOKEN` — 없으면 `bot.js`를 require하는 시점에 예외가 발생합니다.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — 구독자 목록·중복전송 이력 저장용. Vercel 프로젝트에 Upstash Redis 통합(또는 레거시 Vercel KV, `KV_REST_API_URL`/`KV_REST_API_TOKEN`)을 연결하면 자동 주입됩니다.

## 아키텍처

- **`bot.js`**: 순수 모듈. Telegraf 인스턴스, 커맨드/액션 핸들러(`/start`, `/subscribe`, `/unsubscribe`, `/news`, 인라인 버튼 `subscribe`/`news_now`), 뉴스 수집·포맷팅 로직을 정의하고 `{ bot, sendNewsToSubscribers }`를 export합니다. **자체적으로 실행되지 않으며** `bot.launch()`나 스케줄러를 호출하지 않습니다 — `api/` 아래의 서버리스 함수가 이를 가져다 씁니다.
  - **뉴스 수집**: `fetchMilitaryNews()` → `fetchFromGoogleNews()`가 axios로 `https://news.google.com/rss/search?q=military+korea&hl=ko&gl=KR&ceid=KR:ko`를 요청하고 cheerio로 RSS XML을 파싱합니다. 피드의 기본 링크가 깨져 있기 때문에 `<guid>` 요소로부터 기사 링크를 재구성합니다(`https://news.google.com/rss/articles/<guid>`). `isKorean()`은 한글 문자가 5자를 초과하는 제목만 통과시키며, 최대 5개 기사로 제한합니다.
  - **저장소 (Upstash Redis, `@upstash/redis`)**: 플랫 JSON 파일 대신 Redis Set 두 개를 사용합니다(서버리스는 로컬 파일시스템이 휘발성/읽기전용이라 파일 저장이 불가능하기 때문).
    - `telegram-bot:subscribers` — 구독자 텔레그램 유저 ID 집합 (`getSubscribers`/`addSubscriber`/`removeSubscriber`/`isSubscriber`).
    - `telegram-bot:sent_news_urls` — 이미 전송한 기사 링크 집합 (`filterUnsentNews`/`markNewsSent`). 예약 전송(`sendNewsToSubscribers(true)`)만 이 이력으로 중복을 걸러내며, `/news` 즉시 조회는 이력과 무관하게 항상 현재 상위 5개를 보여줍니다.
- **`api/webhook.js`**: 텔레그램이 호출하는 웹훅 엔드포인트. `bot.handleUpdate(req.body, res)`로 업데이트를 처리합니다(Vercel이 이미 JSON body를 파싱해주므로 telegraf의 `webhookCallback`이 아니라 `handleUpdate`를 직접 사용).
- **`api/send-news.js`**: 예약 뉴스 발송용 엔드포인트. `sendNewsToSubscribers(true)`를 호출합니다.
- **`vercel.json`**: Vercel Cron이 매일 UTC 23:30(=서울 08:30)에 `/api/send-news`를 호출하도록 설정 — `node-cron`을 대체합니다.

배포 시 Telegram에 `setWebhook`으로 `<배포 URL>/api/webhook`을 등록해야 하며, 로컬에서 폴링 방식으로 기존 `bot.js`를 실행하던 방식(`bot.launch`)은 더 이상 존재하지 않습니다.

## 금기 사항

- 환경 변수는 `.env` 파일에 저장하고 절대 커밋하지 않습니다(`.gitignore`에 이미 등록되어 있음, `.env.example`에는 실제 값을 넣지 않음).
