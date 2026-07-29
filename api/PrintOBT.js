const { getTcatSecrets, proxyTcat } = require('../lib/tcat');
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

  res.status(200).json(await proxyTcat('PrintOBT', req.body || {}, tcat, fetchImpl));
}

module.exports = handler;
module.exports.handler = handler;
