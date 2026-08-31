const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    console.log('📰 구글 뉴스 RSS 구조 확인 중...\n');
    const googleNewsUrl = 'https://news.google.com/rss/search?q=military+korea&hl=ko&gl=KR&ceid=KR:ko';

    const response = await axios.get(googleNewsUrl, {
      timeout: 10000
    });

    console.log('첫 2000자:\n');
    console.log(response.data.substring(0, 2000));
    console.log('\n---\n');

    const $ = cheerio.load(response.data);

    // 다양한 태그 찾기
    console.log('태그 개수:');
    console.log(`- item: ${$('item').length}`);
    console.log(`- entry: ${$('entry').length}`);
    console.log(`- article: ${$('article').length}`);
    console.log(`- news: ${$('news').length}`);

    // 모든 최상위 요소 확인
    const rootChild = $('rss > *').length || $('feed > *').length;
    console.log(`- 루트 자식 요소: ${rootChild}`);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
