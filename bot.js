const { Telegraf } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const { Redis } = require('@upstash/redis');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.');
}
const bot = new Telegraf(BOT_TOKEN);

// Redis(Upstash) - 구독자 목록 & 중복전송 이력 저장
// Vercel의 Upstash Redis 통합을 프로젝트에 연결하면 아래 env var가 자동으로 주입됩니다.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
});

const SUBSCRIBERS_KEY = 'telegram-bot:subscribers';
const SENT_URLS_KEY = 'telegram-bot:sent_news_urls';

const getSubscribers = async () => {
  const ids = await redis.smembers(SUBSCRIBERS_KEY);
  return ids.map(Number);
};

const addSubscriber = async (userId) => {
  await redis.sadd(SUBSCRIBERS_KEY, userId);
};

const removeSubscriber = async (userId) => {
  await redis.srem(SUBSCRIBERS_KEY, userId);
};

const isSubscriber = async (userId) => {
  return (await redis.sismember(SUBSCRIBERS_KEY, userId)) === 1;
};

// 이미 보낸 뉴스만 걸러내기
const filterUnsentNews = async (newsList) => {
  const sentFlags = await Promise.all(
    newsList.map((news) => redis.sismember(SENT_URLS_KEY, news.link))
  );
  return newsList.filter((_, index) => sentFlags[index] !== 1);
};

const markNewsSent = async (newsList) => {
  if (newsList.length === 0) return;
  await redis.sadd(SENT_URLS_KEY, ...newsList.map((news) => news.link));
};

// 뉴스 주제 목록 - 주제별로 구글 뉴스 RSS를 각각 조회한다
const NEWS_TOPICS = [
  { key: 'military', label: '🎖️ 군대 관련 뉴스', query: 'military korea' },
  { key: 'ai', label: '🤖 AI 관련 뉴스', query: '인공지능 AI' }
];

// 뉴스 검색 - 주제별로 구글 뉴스 RSS 조회
const fetchAllNews = async () => {
  console.log('📰 뉴스 검색 중...');
  const newsByTopic = {};
  for (const topic of NEWS_TOPICS) {
    newsByTopic[topic.key] = await fetchFromGoogleNews(topic.query);
  }
  return newsByTopic;
};

// 한글 문자 판별 함수
const isKorean = (text) => {
  const koreanRegex = /[가-힯]/g;
  const matches = text.match(koreanRegex);
  return matches && matches.length > 5;
};

// 구글 뉴스 대체 방법 - 한글 뉴스만 선택
const fetchFromGoogleNews = async (query) => {
  try {
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;

    const response = await axios.get(googleNewsUrl, {
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const newsList = [];
    let count = 0;

    $('item').each((index, elem) => {
      if (count >= 5) return;

      const title = $(elem).find('title').text().trim();
      const pubDate = $(elem).find('pubDate').text().trim();

      // 직접 href 속성에서 링크 추출 (RSS 포맷이 손상되어 있음)
      const guidText = $(elem).find('guid').text().trim();
      const link = guidText ? `https://news.google.com/rss/articles/${guidText}` : '';

      // 한글 뉴스만 필터링
      if (title && link && isKorean(title) && !title.startsWith('Google News')) {
        newsList.push({
          title,
          link,
          source: '구글 뉴스',
          date: pubDate.split(' ').slice(0, 4).join(' ')
        });
        count++;
      }
    });

    if (newsList.length > 0) {
      console.log(`✅ 구글 뉴스에서 한글 뉴스 ${newsList.length}개를 찾았습니다.`);
    } else {
      console.log('⚠️ 구글 뉴스에서 한글 뉴스를 찾을 수 없습니다.');
    }
    return newsList;
  } catch (error) {
    console.error('❌ 구글 뉴스도 실패:', error.message);
    return [];
  }
};

// 제목에 [ ]가 들어있으면 마크다운 링크 문법과 충돌해 링크가 깨지므로 제거
const sanitizeTitleForLink = (title) => title.replace(/[[\]]/g, '');

// 뉴스를 포맷팅해서 메시지로 변환 (주제별 섹션으로 묶음)
const formatNewsMessage = (newsByTopic) => {
  const sections = NEWS_TOPICS
    .map((topic) => {
      const newsList = newsByTopic[topic.key] || [];
      if (newsList.length === 0) return null;

      let section = `*${topic.label}*\n\n`;
      newsList.forEach((news, index) => {
        section += `${index + 1}. [${sanitizeTitleForLink(news.title)}](${news.link})\n`;
        section += `   📰 ${news.source}\n\n`;
      });
      return section.trim();
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return '📰 현재 검색된 뉴스가 없습니다.';
  }

  return sections.join('\n\n');
};

// 뉴스 전송 함수
const sendNewsToSubscribers = async (onlyNew = false) => {
  try {
    const newsByTopic = await fetchAllNews();

    // 주제별로 새로운 뉴스만 필터링
    const newsToSendByTopic = {};
    for (const topic of NEWS_TOPICS) {
      let list = newsByTopic[topic.key] || [];
      if (onlyNew) {
        list = await filterUnsentNews(list);
      }
      newsToSendByTopic[topic.key] = list;
    }

    const allToSend = Object.values(newsToSendByTopic).flat();
    if (allToSend.length === 0) {
      console.log(onlyNew ? '📭 새로운 뉴스가 없습니다.' : '📭 전송할 뉴스가 없습니다.');
      return;
    }

    await markNewsSent(allToSend);

    const message = formatNewsMessage(newsToSendByTopic);
    const subscribers = await getSubscribers();

    // 구독자들에게 전송
    for (const subscriberId of subscribers) {
      try {
        await bot.telegram.sendMessage(subscriberId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        console.log(`✅ 사용자 ${subscriberId}에게 뉴스 전송 완료`);
      } catch (error) {
        console.error(`❌ 사용자 ${subscriberId}에게 전송 실패:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ 뉴스 전송 중 오류:', error.message);
  }
};

// 봇 명령어
bot.start((ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔔 뉴스 구독', callback_data: 'subscribe' }],
        [{ text: '📰 최신 뉴스 보기', callback_data: 'news_now' }]
      ]
    }
  };

  ctx.reply(
    '👋 안녕하세요! 군대·AI 관련 최신 뉴스 봇입니다.\n\n' +
    '📌 기능:\n' +
    '• 🔔 /subscribe - 매일 아침 8시 30분 자동 뉴스 수신\n' +
    '• 📰 /news - 지금 바로 뉴스 보기\n' +
    '• ❌ /unsubscribe - 뉴스 구독 해제',
    keyboard
  );
});

// 뉴스 구독
bot.command('subscribe', async (ctx) => {
  const userId = ctx.from.id;

  if (await isSubscriber(userId)) {
    ctx.reply('✅ 이미 뉴스 구독 중입니다!');
    return;
  }

  await addSubscriber(userId);

  ctx.reply(
    '🔔 뉴스 구독 완료!\n\n' +
    '매일 아침 8시 30분에 최신 군대·AI 관련 뉴스를 자동으로 전송해드립니다.\n\n' +
    '구독을 취소하려면 /unsubscribe 명령을 사용하세요.'
  );

  console.log(`✅ 사용자 ${userId}가 뉴스 구독했습니다.`);
});

// 뉴스 구독 해제
bot.command('unsubscribe', async (ctx) => {
  const userId = ctx.from.id;

  if (!(await isSubscriber(userId))) {
    ctx.reply('❌ 현재 뉴스 구독 중이 아닙니다.');
    return;
  }

  await removeSubscriber(userId);

  ctx.reply('❌ 뉴스 구독이 취소되었습니다.');
  console.log(`❌ 사용자 ${userId}가 뉴스 구독을 취소했습니다.`);
});

// 즉시 뉴스 조회
bot.command('news', async (ctx) => {
  ctx.sendChatAction('typing');

  const newsByTopic = await fetchAllNews();
  const message = formatNewsMessage(newsByTopic);

  ctx.reply(message, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
});

// 인라인 버튼 처리
bot.action('subscribe', async (ctx) => {
  const userId = ctx.from.id;

  if (!(await isSubscriber(userId))) {
    await addSubscriber(userId);
    ctx.answerCbQuery('✅ 뉴스 구독 완료!');
    ctx.editMessageText(
      '✅ 뉴스 구독 완료!\n\n' +
      '매일 아침 8시 30분에 최신 군대·AI 관련 뉴스를 자동으로 전송해드립니다.'
    );
  } else {
    ctx.answerCbQuery('✅ 이미 뉴스 구독 중입니다!');
  }
});

bot.action('news_now', async (ctx) => {
  ctx.answerCbQuery('📰 뉴스를 불러오는 중...');
  ctx.sendChatAction('typing');

  const newsByTopic = await fetchAllNews();
  const message = formatNewsMessage(newsByTopic);

  ctx.reply(message, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
});

// 일반 텍스트 메시지
bot.on('text', (ctx) => {
  ctx.reply(
    '안녕하세요! 😊\n\n' +
    '사용 가능한 명령어:\n' +
    '• /subscribe - 매일 아침 8시 30분 뉴스 자동 수신\n' +
    '• /unsubscribe - 구독 취소\n' +
    '• /news - 지금 바로 뉴스 보기'
  );
});

module.exports = { bot, sendNewsToSubscribers };
