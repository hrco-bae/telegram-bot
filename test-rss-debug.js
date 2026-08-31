const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    const googleNewsUrl = 'https://news.google.com/rss/search?q=military+korea&hl=ko&gl=KR&ceid=KR:ko';

    const response = await axios.get(googleNewsUrl, {
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const firstItem = $('item').first();

    console.log('첫 번째 item HTML:');
    console.log(firstItem.html().substring(0, 1000));

    console.log('\n\n찾아본 필드들:');
    console.log(`title: "${firstItem.find('title').text()}"`);
    console.log(`link: "${firstItem.find('link').text()}"`);
    console.log(`pubDate: "${firstItem.find('pubDate').text()}"`);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
})();
