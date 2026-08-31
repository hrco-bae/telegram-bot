const axios = require('axios');
const cheerio = require('cheerio');

// 한글 문자 판별 함수
const isKorean = (text) => {
  const koreanRegex = /[가-힯]/g;
  const matches = text.match(koreanRegex);
  return matches && matches.length > 5;
};

// 새로운 포맷의 뉴스 메시지
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

(async () => {
  try {
    console.log('📰 새로운 포맷의 뉴스를 테스트 중...\n');
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

    const message = formatNewsMessage(newsList);

    console.log('📧 전송될 메시지:\n');
    console.log('='.repeat(60));
    console.log(message);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
