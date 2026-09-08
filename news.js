const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

// 뉴스 주제 목록 - 주제별로 구글 뉴스 RSS를 각각 조회한다
const NEWS_TOPICS = [
  { key: 'military', label: '🎖️ 군대 관련 뉴스', query: 'military korea' },
  { key: 'ai', label: '🤖 AI 관련 뉴스', query: '인공지능 AI' }
];

// 뉴스 검색 - 주제별로 구글 뉴스 RSS 조회
const fetchAllNews = async () => {
  console.log('📰 뉴스 검색 중...');
  const newsByTopic = {};
  for (const topic of NEWS_TOPICS) {
    newsByTopic[topic.key] = await fetchFromGoogleNews(topic.query);
  }
  return newsByTopic;
};

// 한글 문자 판별 함수
const isKorean = (text) => {
  const koreanRegex = /[가-힯]/g;
  const matches = text.match(koreanRegex);
  return matches && matches.length > 5;
};

// 구글 뉴스 대체 방법 - 한글 뉴스만 선택
const fetchFromGoogleNews = async (query) => {
  try {
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;

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

      // 직접 href 속성에서 링크 추출 (RSS 포맷이 손상되어 있음)
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

    if (newsList.length > 0) {
      console.log(`✅ 구글 뉴스에서 한글 뉴스 ${newsList.length}개를 찾았습니다.`);
    } else {
      console.log('⚠️ 구글 뉴스에서 한글 뉴스를 찾을 수 없습니다.');
    }
    return newsList;
  } catch (error) {
    console.error('❌ 구글 뉴스도 실패:', error.message);
    return [];
  }
};

// 카카오워크 Block Kit의 text block + link inline으로 제목에 직접 링크를 건다
const buildKakaoWorkBlocks = (newsByTopic) => {
  const blocks = [];

  NEWS_TOPICS.forEach((topic) => {
    const newsList = newsByTopic[topic.key] || [];
    if (newsList.length === 0) return;

    blocks.push({ type: 'text', text: topic.label });

    newsList.forEach((news, index) => {
      const titleLine = `${index + 1}. ${news.title}`;
      blocks.push({
        type: 'text',
        text: titleLine,
        inlines: [{ type: 'link', text: titleLine, url: news.link }]
      });
      blocks.push({ type: 'text', text: `📰 ${news.source}` });
    });
  });

  return blocks;
};

// 카카오워크 Incoming Webhook으로 메시지 전송 (KAKAOWORK_WEBHOOK_URL 미설정 시 건너뜀)
const sendToKakaoWork = async (newsByTopic) => {
  const webhookUrl = process.env.KAKAOWORK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const blocks = buildKakaoWorkBlocks(newsByTopic);
  if (blocks.length === 0) return;

  try {
    await axios.post(
      webhookUrl,
      { text: '📰 오늘의 군대·AI 관련 뉴스가 도착했습니다.', blocks },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('✅ 카카오워크 전송 완료');
  } catch (error) {
    console.error('❌ 카카오워크 전송 실패:', error.message);
  }
};

// 뉴스 검색 후 카카오워크로 전송
const sendNews = async () => {
  try {
    const newsByTopic = await fetchAllNews();
    await sendToKakaoWork(newsByTopic);
  } catch (error) {
    console.error('❌ 뉴스 전송 중 오류:', error.message);
  }
};

module.exports = { sendNews };
