const { sendNewsToSubscribers } = require('../bot');

module.exports = async (req, res) => {
  try {
    await sendNewsToSubscribers(true);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ 예약 뉴스 전송 실패:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
};
