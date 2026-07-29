const { requireEnv } = require('../lib/tcat');
const { setCors } = require('../lib/cors');

async function handler(req, res, deps = {}) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end('');
    return;
  }

  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;

  let lineToken;
  try {
    lineToken = requireEnv(env, 'LINE_CHANNEL_ACCESS_TOKEN');
  } catch (e) {
    res.status(200).json({ success: false, message: e.message });
    return;
  }

  const { userId, message } = req.body || {};
  if (!userId || !message) {
    res.status(200).json({ error: '缺少 userId 或 message' });
    return;
  }

  const r = await fetchImpl('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] }),
  });
  const text = await r.text();
  res.status(r.status).setHeader('Content-Type', 'application/json');
  res.send(text);
}

module.exports = handler;
module.exports.handler = handler;
