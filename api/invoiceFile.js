const { getAmegoSecrets, buildAmegoBody } = require('../lib/amego');
const { setCors } = require('../lib/cors');

async function handler(req, res, deps = {}) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end('');
    return;
  }

  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;

  let amego;
  try {
    amego = getAmegoSecrets(env);
  } catch (e) {
    res.status(200).json({ success: false, message: e.message });
    return;
  }

  const { invoiceNo, orderId } = req.body || {};
  const dataObj = invoiceNo
    ? { type: 'invoice', invoice_number: invoiceNo }
    : { type: 'order', order_id: orderId };

  try {
    const r = await fetchImpl(`${amego.base}/json/invoice_query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildAmegoBody(dataObj, amego),
    });
    res.status(200).json(await r.json());
  } catch (e) {
    res.status(200).json({ success: false, message: e.message });
  }
}

module.exports = handler;
module.exports.handler = handler;
