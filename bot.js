const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ 오류: BOT_TOKEN 환경변수가 설정되지 않았습니다.');
  console.error('📝 .env 파일에서 BOT_TOKEN을 설정해주세요.');
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

// 설정 파일 경로
const configFile = path.join(__dirname, 'news_config.json');
const newsFile = path.join(__dirname, 'last_news.json');

// 설정 로드/저장 함수
const loadConfig = () => {
  if (fs.existsSync(configFile)) {
    return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  }
  return { subscribers: [] };
};

const saveConfig = (config) => {
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
};

const loadLastNews = () => {
  if (fs.existsSync(newsFile)) {
    return JSON.parse(fs.readFileSync(newsFile, 'utf-8'));
  }
  return { urls: new Set() };
};

const saveLastNews = (data) => {
  fs.writeFileSync(newsFile, JSON.stringify({ urls: Array.from(data.urls) }, null, 2));
};

// 뉴스 검색 - 구글 뉴스 RSS 먼저 시도
const fetchMilitaryNews = async () => {
  console.log('📰 뉴스 검색 중...');
  return await fetchFromGoogleNews();
};

// 한글 문자 판별 함수
const isKorean = (text) => {
  const koreanRegex = /[가-힯]/g;
  const matches = text.match(koreanRegex);
  return matches && matches.length > 5;
};

// 구글 뉴스 대체 방법 - 한글 뉴스만 선택
const fetchFromGoogleNews = async () => {
  try {
    const googleNewsUrl = 'https://news.google.com/rss/search?q=military+korea&hl=ko&gl=KR&ceid=KR:ko';

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

// 뉴스를 포맷팅해서 메시지로 변환
const formatNewsMessage = (newsList) => {
  if (newsList.length === 0) {
    return '📰 현재 검색된 뉴스가 없습니다.';
  }

  let message = '🎖️ *최신 군대 관련 뉴스*\n\n';

  newsList.forEach((news, index) => {
    message += `${index + 1}. [${news.title}](${news.link})\n`;
    message += `   📰 ${news.source}\n\n`;
  });

  return message;
};

// 뉴스 전송 함수
const sendNewsToSubscribers = async (onlyNew = false) => {
  try {
    const newsList = await fetchMilitaryNews();

    if (newsList.length === 0) {
      console.log('📭 전송할 뉴스가 없습니다.');
      return;
    }

    const config = loadConfig();
    const lastNews = loadLastNews();

    // 새로운 뉴스만 필터링
    let newsToSend = newsList;
    if (onlyNew) {
      newsToSend = newsList.filter(news => !lastNews.urls.includes(news.link));
    }

    if (newsToSend.length === 0 && onlyNew) {
      console.log('📭 새로운 뉴스가 없습니다.');
      return;
    }

    // 뉴스 URL 저장
    newsToSend.forEach(news => {
      lastNews.urls.add(news.link);
    });
    saveLastNews(lastNews);

    const message = formatNewsMessage(newsToSend);

    // 구독자들에게 전송
    for (const subscriberId of config.subscribers) {
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
    '👋 안녕하세요! 군대 관련 최신 뉴스 봇입니다.\n\n' +
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
  const config = loadConfig();

  if (config.subscribers.includes(userId)) {
    ctx.reply('✅ 이미 뉴스 구독 중입니다!');
    return;
  }

  config.subscribers.push(userId);
  saveConfig(config);

  ctx.reply(
    '🔔 뉴스 구독 완료!\n\n' +
    '매일 아침 8시 30분에 최신 군대 관련 뉴스를 자동으로 전송해드립니다.\n\n' +
    '구독을 취소하려면 /unsubscribe 명령을 사용하세요.'
  );

  console.log(`✅ 사용자 ${userId}가 뉴스 구독했습니다.`);
});

// 뉴스 구독 해제
bot.command('unsubscribe', async (ctx) => {
  const userId = ctx.from.id;
  const config = loadConfig();

  const index = config.subscribers.indexOf(userId);
  if (index === -1) {
    ctx.reply('❌ 현재 뉴스 구독 중이 아닙니다.');
    return;
  }

  config.subscribers.splice(index, 1);
  saveConfig(config);

  ctx.reply('❌ 뉴스 구독이 취소되었습니다.');
  console.log(`❌ 사용자 ${userId}가 뉴스 구독을 취소했습니다.`);
});

// 즉시 뉴스 조회
bot.command('news', async (ctx) => {
  ctx.sendChatAction('typing');

  const newsList = await fetchMilitaryNews();
  const message = formatNewsMessage(newsList);

  ctx.reply(message, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
});

// 인라인 버튼 처리
bot.action('subscribe', async (ctx) => {
  const userId = ctx.from.id;
  const config = loadConfig();

  if (!config.subscribers.includes(userId)) {
    config.subscribers.push(userId);
    saveConfig(config);
    ctx.answerCbQuery('✅ 뉴스 구독 완료!');
    ctx.editMessageText(
      '✅ 뉴스 구독 완료!\n\n' +
      '매일 아침 8시 30분에 최신 군대 관련 뉴스를 자동으로 전송해드립니다.'
    );
  } else {
    ctx.answerCbQuery('✅ 이미 뉴스 구독 중입니다!');
  }
});

bot.action('news_now', async (ctx) => {
  ctx.answerCbQuery('📰 뉴스를 불러오는 중...');
  ctx.sendChatAction('typing');

  const newsList = await fetchMilitaryNews();
  const message = formatNewsMessage(newsList);

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

// 스케줄러: 매일 아침 8시 30분에 뉴스 전송
console.log('⏰ 스케줄러 설정 중...');
cron.schedule('30 8 * * *', async () => {
  console.log('🔔 예약된 뉴스 전송 시작 (아침 8시 30분)');
  await sendNewsToSubscribers(true); // 새로운 뉴스만 전송
}, {
  timezone: 'Asia/Seoul'
});

console.log('✅ 스케줄러 설정 완료 (매일 아침 8시 30분)');

// 봇 시작
bot.launch({
  polling: {
    timeout: 25,
    limit: 100,
    allowed_updates: ['message', 'callback_query']
  }
})
  .then(() => {
    console.log('🤖 봇이 실행 중입니다...');
    console.log('⏰ 매일 아침 8시 30분에 뉴스가 자동으로 전송됩니다.');
  })
  .catch(err => {
    console.error('❌ 봇 시작 실패:', err);
    process.exit(1);
  });

process.once('SIGINT', () => {
  console.log('\n봇 종료 중...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('\n봇 종료 중...');
  bot.stop('SIGTERM');
});
