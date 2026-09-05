const { bot } = require('../bot');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  try {
    await bot.handleUpdate(req.body, res);
  } catch (error) {
    console.error('❌ 웹훅 처리 중 오류:', error.message);
  }

  if (!res.headersSent) {
    res.status(200).end();
  }
};
