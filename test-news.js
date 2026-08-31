const axios = require('axios');
const cheerio = require('cheerio');

const testNewsAPI = async () => {
  try {
    console.log('🔍 네이버 뉴스 API 테스트 중...\n');

    const searchUrl = 'https://search.naver.com/search.naver?where=news&query=%EA%B5%B0%EB%8C%80&sort=1';

    console.log(`📡 URL: ${searchUrl}`);
    console.log('⏳ 요청 중...\n');

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    console.log(`✅ 네이버 연결 성공!`);
    console.log(`📊 응답 상태: ${response.status}`);
    console.log(`📏 응답 크기: ${response.data.length} bytes\n`);

    const $ = cheerio.load(response.data);

    // 다양한 선택자로 뉴스 찾기
    const newsArea = $('div.news_area').length;
    const newsItem = $('li.bx').length;
    const newsLink = $('a.news_tit').length;

    console.log('📰 찾은 요소들:');
    console.log(`   - div.news_area: ${newsArea}개`);
    console.log(`   - li.bx: ${newsItem}개`);
    console.log(`   - a.news_tit: ${newsLink}개\n`);

    if (newsArea > 0) {
      console.log('✅ 뉴스 스크래핑 작동!');
      console.log('\n🎯 최신 3개 뉴스:');
      let count = 0;
      $('div.news_area').each((i, elem) => {
        if (count < 3) {
          const title = $(elem).find('a.news_tit').text().trim();
          const link = $(elem).find('a.news_tit').attr('href');
          const source = $(elem).find('span.news_press').text().trim();

          if (title && link) {
            count++;
            console.log(`\n${count}. ${title}`);
            console.log(`   📰 출처: ${source}`);
            console.log(`   🔗 ${link.substring(0, 60)}...`);
          }
        }
      });
    } else {
      console.log('❌ 뉴스를 찾을 수 없습니다.');
      console.log('📝 네이버가 HTML 구조를 변경했을 수 있습니다.\n');

      // HTML 샘플 출력
      const htmlSample = response.data.substring(0, 1000);
      console.log('HTML 샘플 (첫 1000자):');
      console.log(htmlSample.substring(0, 500));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 에러 발생:');
    console.error(`   타입: ${error.code || error.name}`);
    console.error(`   메시지: ${error.message}`);

    if (error.response) {
      console.error(`   응답 상태: ${error.response.status}`);
    }

    process.exit(1);
  }
};

testNewsAPI();
