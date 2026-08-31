const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    console.log('📰 구글 뉴스 RSS 테스트 중...\n');
    const googleNewsUrl = 'https://news.google.com/rss/search?q=military+korea&hl=ko&gl=KR&ceid=KR:ko';

    const response = await axios.get(googleNewsUrl, {
      timeout: 10000
    });

    console.log('✅ 구글 뉴스 연결 성공!');
    console.log(`📏 응답 크기: ${response.data.length} bytes\n`);

    const $ = cheerio.load(response.data);
    const newsList = [];

    $('item').each((index, elem) => {
      if (newsList.length >= 5) return false;

      const title = $(elem).find('title').text().trim();
      const link = $(elem).find('link').text().trim();
      const pubDate = $(elem).find('pubDate').text().trim();

      if (title && link) {
        newsList.push({
          title,
          link,
          source: '구글 뉴스',
          date: pubDate.split(' ').slice(0, 4).join(' ')
        });
      }
    });

    console.log(`✅ ${newsList.length}개의 뉴스를 찾았습니다!\n`);
    newsList.forEach((news, i) => {
      console.log(`${i + 1}. ${news.title}`);
      console.log(`   📰 ${news.source} | ${news.date}`);
      console.log(`   🔗 ${news.link?.substring(0, 50)}...\n`);
    });
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
