const axios = require('axios');
const cheerio = require('cheerio');

// 한글 문자 판별 함수
const isKorean = (text) => {
  const koreanRegex = /[가-힯]/g;
  const matches = text.match(koreanRegex);
  return matches && matches.length > 5; // 한글이 5개 이상이면 한글 뉴스
};

(async () => {
  try {
    console.log('📰 한글 뉴스만 찾는 중...\n');
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

    console.log(`✅ 한글 뉴스 ${newsList.length}개 찾았습니다!\n`);
    newsList.forEach((news, i) => {
      console.log(`${i + 1}. ${news.title}`);
      console.log(`   📰 ${news.source} | ${news.date}`);
      console.log(`   🔗 ${news.link.substring(0, 50)}...\n`);
    });
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
