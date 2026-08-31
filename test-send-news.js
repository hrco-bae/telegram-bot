const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

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

const loadLastNews = () => {
  if (fs.existsSync(newsFile)) {
    return JSON.parse(fs.readFileSync(newsFile, 'utf-8'));
  }
  return { urls: [] };
};

const saveLastNews = (data) => {
  fs.writeFileSync(newsFile, JSON.stringify({ urls: data.urls }, null, 2));
};

// 뉴스 가져오기
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
      const guidText = $(elem).find('guid').text().trim();
      const link = guidText ? `https://news.google.com/rss/articles/${guidText}` : '';

      if (title && link && !title.startsWith('Google News')) {
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
      console.log(`✅ 구글 뉴스에서 ${newsList.length}개를 찾았습니다.\n`);
    }
    return newsList;
  } catch (error) {
    console.error('❌ 구글 뉴스 실패:', error.message);
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
    message += `${index + 1}. *${news.title}*\n`;
    message += `   📰 ${news.source} | ${news.date}\n`;
    message += `   🔗 ${news.link}\n\n`;
  });

  return message;
};

// 메인 테스트
(async () => {
  try {
    console.log('📰 뉴스 전송 시뮬레이션 중...\n');

    const config = loadConfig();
    const lastNews = loadLastNews();

    console.log(`📌 현재 구독자: ${config.subscribers.length}명`);
    console.log(`📌 저장된 뉴스 URL 개수: ${lastNews.urls.length}개\n`);

    const newsList = await fetchFromGoogleNews();

    if (newsList.length === 0) {
      console.log('📭 전송할 뉴스가 없습니다.');
      process.exit(1);
    }

    // 새로운 뉴스만 필터링
    const newsToSend = newsList.filter(news => !lastNews.urls.includes(news.link));

    console.log(`새로운 뉴스: ${newsToSend.length}개\n`);

    // 뉴스 URL 저장
    newsToSend.forEach(news => {
      lastNews.urls.push(news.link);
    });
    saveLastNews(lastNews);

    const message = formatNewsMessage(newsToSend);

    console.log('📧 전송될 메시지:');
    console.log('='.repeat(50));
    console.log(message);
    console.log('='.repeat(50));

    console.log(`\n✅ ${config.subscribers.length}명의 구독자에게 전송됨 (시뮬레이션)`);
    console.log(`✅ last_news.json에 ${newsToSend.length}개의 뉴스 URL 저장됨`);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
