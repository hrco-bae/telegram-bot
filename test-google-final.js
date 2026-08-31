const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    console.log('📰 구글 뉴스 RSS 파싱 최종 테스트 중...\n');
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

      // 직접 href 속성에서 링크 추출
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

    console.log(`✅ ${newsList.length}개의 뉴스를 찾았습니다!\n`);
    newsList.forEach((news, i) => {
      console.log(`${i + 1}. ${news.title}`);
      console.log(`   📰 ${news.source} | ${news.date}`);
      console.log(`   🔗 ${news.link.substring(0, 50)}...\n`);
    });
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
