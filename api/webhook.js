const { bot } = require('../bot');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  try {
    // res를 넘기면 telegraf가 첫 API 호출을 웹훅 응답에 실어보내면서 응답을 즉시 끝내버려
    // 그 뒤 이어지는 비동기 처리(뉴스 조회 등)가 잘린다. res 없이 호출해 모든 텔레그램
    // API 호출이 일반 네트워크 요청으로 나가게 하고, 처리가 끝난 뒤에만 응답한다.
    await bot.handleUpdate(req.body);
  } catch (error) {
    console.error('❌ 웹훅 처리 중 오류:', error.message);
  }

  res.status(200).end();
};
