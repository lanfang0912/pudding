const LINE_TOKEN = '4iZSl7FQkV1Lc3d11Q6n0e1ELWOOqjdD7fprSLuVNneJVcE1bfyCFM9wUnfcg9CNj/94AuiwpD3wVJEdOJEd8y33fmoCsm4DMJuNaMCBs/cs0IlQPBa16OqEFzs0Mf/tRMe+NtQeTbKEsedZ/sGZYgdB04t89/1O/w1cDnyilFU=';

const TCAT = {
  endpoint: 'https://api.suda.com.tw/api/Egs',
  customerId: '935559690100',
  token: 'jkuck204',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function tryGetPDF(fileNo) {
  // 正確 endpoint 是 DownloadOBT，試 POST + GET 兩種方式
  const attempts = [
    () => fetch(`${TCAT.endpoint}/DownloadOBT`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CustomerId: TCAT.customerId, CustomerToken: TCAT.token, FileNo: fileNo }),
    }),
    () => fetch(`${TCAT.endpoint}/DownloadOBT?FileNo=${encodeURIComponent(fileNo)}`, {
      method: 'GET',
    }),
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

async function debugPDF(fileNo) {
  const endpoints = ['DownloadOBT', 'GetOBTFile', 'DownloadOBTFile', 'GetFile'];
  const results = [];
  for (const ep of endpoints) {
    try {
      const r = await fetch(`${TCAT.endpoint}/${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CustomerId: TCAT.customerId, CustomerToken: TCAT.token, FileNo: fileNo }),
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      results.push({ ep, status: r.status, ct, body: text.slice(0, 500) });
    } catch(e) {
      results.push({ ep, error: e.message });
    }
  }
  return results;
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
      const result = await tryGetPDF(fileNo);
      if (result.ok) {
        const blob = await result.res.arrayBuffer();
        return new Response(blob, {
          headers: { ...CORS, 'Content-Type': 'application/pdf' }
        });
      }
      return new Response(JSON.stringify({ error: '找不到 PDF endpoint' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    if (path === 'debugPDF') {
      const { fileNo } = await request.json();
      const results = await debugPDF(fileNo);
      return new Response(JSON.stringify(results, null, 2), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
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

    if (path === 'sendLine') {
      const { userId, message } = await request.json();
      if (!userId || !message) {
        return new Response(JSON.stringify({ error: '缺少 userId 或 message' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`,
        },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] }),
      });
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: CORS });
  }
};
