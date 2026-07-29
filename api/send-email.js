const {
  buildCustomerConfirmationEmail,
  buildOwnerNotificationEmail,
  buildResendPayload,
  buildShipmentEmail,
} = require('../lib/email');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function selectEmail(type, order) {
  if (type === 'customer-confirmation') return buildCustomerConfirmationEmail(order);
  if (type === 'shipment') return buildShipmentEmail(order);
  throw new Error('Unsupported email type');
}

async function handler(req, res, deps = {}) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;

  try {
    const apiKey = env.RESEND_API_KEY;
    const from = env.RESEND_FROM_EMAIL;
    if (!apiKey) throw new Error('Missing RESEND_API_KEY');
    if (!from) throw new Error('Missing RESEND_FROM_EMAIL');

    const { type, order } = parseBody(req);
    if (!order || typeof order !== 'object') throw new Error('Missing order');

    const email = selectEmail(type, order);
    if (!email.to || !email.to.includes('@')) throw new Error('Missing recipient email');

    const payload = buildResendPayload({ from, email });
    const resendRes = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await resendRes.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }

    if (!resendRes.ok) {
      res.status(resendRes.status || 502).json({
        success: false,
        error: data.message || data.error || 'Resend request failed',
        details: data,
      });
      return;
    }

    // 新訂單時通知店家（await 執行完成，避免 serverless function 在寄送完成前就被終止）
    if (type === 'customer-confirmation') {
      const ownerEmail = env.OWNER_EMAIL;
      if (ownerEmail) {
        try {
          const ownerNotification = buildOwnerNotificationEmail(order);
          const ownerPayload = buildResendPayload({ from, email: { to: ownerEmail, ...ownerNotification } });
          const ownerRes = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(ownerPayload),
          });
          if (!ownerRes.ok) {
            const ownerText = await ownerRes.text();
            console.error('店家通知信寄送失敗:', ownerRes.status, ownerText);
          }
        } catch (err) {
          console.error('店家通知信寄送發生例外:', err);
        }
      } else {
        console.error('未設定 OWNER_EMAIL，略過店家新訂單通知');
      }
    }

    res.status(200).json({ success: true, id: data.id || '' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = handler;
module.exports.handler = handler;
