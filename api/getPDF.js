const { getTcatSecrets, tryGetPDF } = require('../lib/tcat');
const { setCors } = require('../lib/cors');

async function handler(req, res, deps = {}) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end('');
    return;
  }

  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;

  let tcat;
  try {
    tcat = getTcatSecrets(env);
  } catch (e) {
    res.status(200).json({ success: false, message: e.message });
    return;
  }

  const fileNo = req.method === 'GET' ? req.query.fileNo : (req.body || {}).fileNo;
  const result = await tryGetPDF(fileNo, tcat, fetchImpl);

  if (result.ok) {
    const buffer = Buffer.from(await result.res.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.status(200).send(buffer);
    return;
  }

  res.status(404).json({ error: '找不到 PDF endpoint' });
}

module.exports = handler;
module.exports.handler = handler;
