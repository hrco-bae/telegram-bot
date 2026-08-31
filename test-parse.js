const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    console.log('📰 뉴스 검색 테스트 중...\n');
    const searchUrl = 'https://search.naver.com/search.naver?where=news&query=%EA%B5%B0%EB%8C%80&sort=1';

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const newsList = [];

    $('li.bx').each((index, elem) => {
      if (newsList.length >= 5) return false;

      const titleElem = $(elem).find('a.news_tit, a.tit, h2 a, .sub_txt a');
      const title = titleElem.text().trim();
      const link = titleElem.attr('href');
      const source = $(elem).find('span.press, .press_area span').text().trim() || '네이버 뉴스';
      const dateText = $(elem).find('span.time').text().trim() || '';

      if (title && link) {
        newsList.push({
          title,
          link,
          source,
          date: dateText || '최근'
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
