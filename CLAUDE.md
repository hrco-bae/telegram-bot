# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 제공하는 안내 문서입니다.

## 프로젝트 개요

구글 뉴스 RSS에서 군대·AI 관련 한글 뉴스를 주제별로 수집해 매일 정해진 시간에 **카카오워크 Incoming Webhook**으로 전송하는 서비스입니다. Vercel 서버리스 배포를 전제로 동작하며, 상시 실행 프로세스(`node-cron` 등)는 사용하지 않습니다.

과거에는 텔레그램 봇(구독자 관리, `/subscribe` 등)으로 동작했으나 텔레그램 연동은 완전히 제거되었고, 현재는 카카오워크로만 뉴스를 전송합니다.

## 명령어

- 의존성 설치: `npm install`
- 로컬 개발: `npm run dev` (`vercel dev` — Vercel CLI 필요, `api/` 함수를 로컬에서 서빙)
- 별도의 테스트 프레임워크는 구성되어 있지 않습니다(package.json에 test 스크립트 없음, jest/mocha 없음). 루트에 있는 `test-*.js` 파일들은 구글 뉴스 RSS 피드/파싱 로직을 확인하기 위한 임시 스크립트로, 테스트 러너가 아니라 `node test-<name>.js` 형태로 개별 실행합니다.

## 설정

`.env.example`을 참고해 다음 환경 변수가 필요합니다:
- `KAKAOWORK_WEBHOOK_URL` — 카카오워크 확장 서비스 > Incoming Webhook > Bot 만들기에서 발급받은 URL. 설정돼 있지 않으면 전송을 조용히 건너뜁니다(`sendToKakaoWork` 참고).

## 아키텍처

- **`news.js`**: 순수 모듈. 뉴스 수집·포맷팅·카카오워크 전송 로직을 정의하고 `{ sendNews }`를 export합니다. **자체적으로 실행되지 않으며** 스케줄러를 호출하지 않습니다 — `api/send-news.js`가 이를 가져다 씁니다.
  - **뉴스 수집**: `NEWS_TOPICS` 배열(`military` — "military korea", `ai` — "인공지능 AI")에 정의된 주제별로 `fetchAllNews()`가 각각 `fetchFromGoogleNews(query)`를 호출합니다. 각 호출은 axios로 `https://news.google.com/rss/search?q=<query>&hl=ko&gl=KR&ceid=KR:ko`를 요청하고 cheerio로 RSS XML을 파싱합니다. 피드의 기본 링크가 깨져 있기 때문에 `<guid>` 요소로부터 기사 링크를 재구성합니다(`https://news.google.com/rss/articles/<guid>`). `isKorean()`은 한글 문자가 5자를 초과하는 제목만 통과시키며, 주제당 최대 5개 기사로 제한합니다. 새 주제를 추가하려면 `NEWS_TOPICS`에 `{ key, label, query }`만 추가하면 됩니다.
  - **카카오워크 전송**: `sendNews()`는 매번 호출될 때마다 중복전송 이력과 무관하게 주제별 상위 5개를 그대로 가져와 `sendToKakaoWork()`로 전송합니다(별도의 저장소·구독자 목록 없음). 카카오워크는 텔레그램 Markdown 문법(`*bold*`, `[title](url)`)을 지원하지 않으므로, `buildKakaoWorkBlocks()`가 Block Kit의 `text` 블록 + `link` inline으로 기사 제목 자체에 하이퍼링크를 걸고 원본 URL 텍스트는 노출하지 않는다.
- **`api/send-news.js`**: 예약 뉴스 발송용 엔드포인트. `sendNews()`를 호출합니다.
- **`vercel.json`**: Vercel Cron이 매일 UTC 23:30(=서울 08:30)에 `/api/send-news`를 호출하도록 설정 — `node-cron`을 대체합니다. Vercel Hobby 플랜에서는 정확히 08:30이 아니라 최대 1시간 정도 지연될 수 있습니다.

## 금기 사항

- 환경 변수는 `.env` 파일에 저장하고 절대 커밋하지 않습니다(`.gitignore`에 이미 등록되어 있음, `.env.example`에는 실제 값을 넣지 않음).
- 카카오워크 Incoming Webhook URL은 그 자체로 인증 정보입니다(URL만 알면 누구나 해당 채팅방에 메시지를 보낼 수 있음) — 코드나 커밋, 대화 로그에 평문으로 남기지 않도록 주의합니다.
