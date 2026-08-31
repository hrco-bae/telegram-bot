const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    console.log('📰 구글 뉴스 RSS 파싱 테스트 중...\n');
    const googleNewsUrl = 'https://news.google.com/rss/search?q=military+korea&hl=ko&gl=KR&ceid=KR:ko';

    const response = await axios.get(googleNewsUrl, {
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const newsList = [];
    const items = $('item');

    console.log(`📊 총 ${items.length}개의 item 태그 찾음\n`);

    items.each((index, elem) => {
      if (newsList.length >= 5) return; // break 대신 return 사용

      const title = $(elem).find('title').text().trim();
      const link = $(elem).find('link').text().trim();
      const pubDate = $(elem).find('pubDate').text().trim();

      if (title && link) {
        console.log(`[${newsList.length + 1}] 제목: ${title.substring(0, 60)}...`);
        console.log(`    링크: ${link.substring(0, 60)}...`);

        newsList.push({
          title,
          link,
          source: '구글 뉴스',
          date: pubDate.split(' ').slice(0, 4).join(' ')
        });
      }
    });

    console.log(`\n✅ 총 ${newsList.length}개의 뉴스를 파싱했습니다!\n`);
    newsList.forEach((news, i) => {
      console.log(`${i + 1}. ${news.title}`);
      console.log(`   📰 ${news.source} | ${news.date}`);
      console.log(`   🔗 ${news.link.substring(0, 50)}...\n`);
    });
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
