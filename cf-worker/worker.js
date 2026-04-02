const TCAT = {
  endpoint: 'https://api.suda.com.tw/api/Egs',
  customerId: '9355596901',
  token: 'jkuck204',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function tryGetPDF(fileNo) {
  const endpoints = ['GetOBTFile', 'DownloadOBTFile', 'GetFile', 'PrintOBTFile'];
  for (const ep of endpoints) {
    const r = await fetch(`${TCAT.endpoint}/${ep}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CustomerId: TCAT.customerId, CustomerToken: TCAT.token, FileNo: fileNo }),
    });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('pdf')) return r;
  }
  return null;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, '');

    if (path === 'getPDF') {
      const { fileNo } = await request.json();
      const pdfRes = await tryGetPDF(fileNo);
      if (pdfRes) {
        const blob = await pdfRes.arrayBuffer();
        return new Response(blob, {
          headers: { ...CORS, 'Content-Type': 'application/pdf' }
        });
      }
      return new Response(JSON.stringify({ error: '找不到 PDF endpoint' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 通用 proxy：轉發到黑貓 API
    if (['PrintOBT', 'QueryOBT'].includes(path)) {
      const body = await request.json();
      body.CustomerId = TCAT.customerId;
      body.CustomerToken = TCAT.token;
      const r = await fetch(`${TCAT.endpoint}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      return new Response(JSON.stringify(json), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: CORS });
  }
};
