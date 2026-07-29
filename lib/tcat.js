const TCAT_ENDPOINT = 'https://api.suda.com.tw/api/Egs';

function requireEnv(env, name) {
  const value = env && env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getTcatSecrets(env) {
  return {
    endpoint: env.TCAT_ENDPOINT || TCAT_ENDPOINT,
    customerId: requireEnv(env, 'TCAT_CUSTOMER_ID'),
    token: requireEnv(env, 'TCAT_CUSTOMER_TOKEN'),
  };
}

async function tryGetPDF(fileNo, tcat, fetchImpl) {
  const attempts = [
    () => fetchImpl(`${tcat.endpoint}/DownloadOBT`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CustomerId: tcat.customerId, CustomerToken: tcat.token, FileNo: fileNo }),
    }),
    () => fetchImpl(`${tcat.endpoint}/DownloadOBT?FileNo=${encodeURIComponent(fileNo)}`, { method: 'GET' }),
  ];
  for (const attempt of attempts) {
    const r = await attempt();
    const ct = r.headers.get('content-type') || '';
    if (r.ok && (ct.includes('pdf') || ct.includes('octet'))) return { ok: true, res: r };
    const text = await r.text();
    console.log(`DownloadOBT → ${r.status} [${ct}]: ${text.slice(0, 300)}`);
  }
  return { ok: false };
}

async function debugPDF(fileNo, tcat, fetchImpl) {
  const endpoints = ['DownloadOBT', 'GetOBTFile', 'DownloadOBTFile', 'GetFile'];
  const results = [];
  for (const ep of endpoints) {
    try {
      const r = await fetchImpl(`${tcat.endpoint}/${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CustomerId: tcat.customerId, CustomerToken: tcat.token, FileNo: fileNo }),
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      results.push({ ep, status: r.status, ct, body: text.slice(0, 500) });
    } catch (e) {
      results.push({ ep, error: e.message });
    }
  }
  return results;
}

async function proxyTcat(pathSegment, body, tcat, fetchImpl) {
  const payload = { ...body, CustomerId: tcat.customerId, CustomerToken: tcat.token };
  const r = await fetchImpl(`${tcat.endpoint}/${pathSegment}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

module.exports = { requireEnv, getTcatSecrets, tryGetPDF, debugPDF, proxyTcat };
