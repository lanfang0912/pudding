const LINE_TOKEN = '4iZSl7FQkV1Lc3d11Q6n0e1ELWOOqjdD7fprSLuVNneJVcE1bfyCFM9wUnfcg9CNj/94AuiwpD3wVJEdOJEd8y33fmoCsm4DMJuNaMCBs/cs0IlQPBa16OqEFzs0Mf/tRMe+NtQeTbKEsedZ/sGZYgdB04t89/1O/w1cDnyilFU=';

const TCAT = {
  endpoint: 'https://api.suda.com.tw/api/Egs',
  customerId: '935559690100',
  token: 'jkuck204',
};

// ── 光貿電子發票（amego）──
const AMEGO = {
  base:   'https://invoice-api.amego.tw',
  taxId:  '93555969',
  appKey: 'zvgUQb37BLj64EGCB3cA',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── 純 JS MD5（Cloudflare Worker 無 Node crypto，自行實作）──
function md5hex(str) {
  const bytes = new TextEncoder().encode(str);
  const len   = bytes.length;
  const padLen = ((len + 8) >> 6 << 6) + 64;
  const buf   = new Uint8Array(padLen);
  buf.set(bytes);
  buf[len] = 0x80;
  const lb = len * 8;
  buf[padLen-8]=lb&255; buf[padLen-7]=(lb>>>8)&255;
  buf[padLen-6]=(lb>>>16)&255; buf[padLen-5]=(lb>>>24)&255;

  const T = new Int32Array([
    -680876936,-389564586,606105819,-1044525330,-176418897,1200080426,-1473231341,-45705983,
    1770035416,-1958414417,-42063,-1990404162,1804603682,-40341101,-1502002290,1236535329,
    -165796510,-1069501632,643717713,-373897302,-701558691,38016083,-660478335,-405537848,
    568446438,-1019803690,-187363961,1163531501,-1444681467,-51403784,1735328473,-1926607734,
    -378558,-2022574463,1839030562,-35309556,-1530992060,1272893353,-155497632,-1094730640,
    681279174,-358537222,-722521979,76029189,-640364487,-421815835,530742520,-995338651,
    -198630844,1126891415,-1416354905,-57434055,1700485571,-1894986606,-1051523,-2054922799,
    1873313359,-30611744,-1560198380,1309151649,-145523070,-1120210379,718787259,-343485551,
  ]);
  const S = [7,12,17,22, 5,9,14,20, 4,11,16,23, 6,10,15,21];
  const add = (x,y) => (x+y)|0;
  const rol = (v,n) => (v<<n)|(v>>>(32-n));

  let a=0x67452301|0, b=0xefcdab89|0, c=0x98badcfe|0, d=0x10325476|0;
  for (let i=0; i<padLen; i+=64) {
    const M = new Int32Array(16);
    for (let j=0; j<64; j+=4)
      M[j>>2] = buf[i+j]|(buf[i+j+1]<<8)|(buf[i+j+2]<<16)|(buf[i+j+3]<<24);
    let aa=a, bb=b, cc=c, dd=d;
    for (let j=0; j<64; j++) {
      const r=j>>4;
      let f, k;
      if      (r===0){ f=(b&c)|(~b&d); k=j; }
      else if (r===1){ f=(b&d)|(c&~d); k=(5*j+1)%16; }
      else if (r===2){ f=b^c^d;        k=(3*j+5)%16; }
      else           { f=c^(b|~d);     k=(7*j)%16; }
      const t = add(add(add(a,f), M[k]), T[j]);
      a=d; d=c; c=b;
      b = add(b, rol(t, S[r*4+(j%4)]));
    }
    a=add(a,aa); b=add(b,bb); c=add(c,cc); d=add(d,dd);
  }
  return [a,b,c,d].map(v =>
    [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]
    .map(x=>x.toString(16).padStart(2,'0')).join('')
  ).join('');
}

// ── amego 共用：組 form-urlencoded body + sign ──
// sign = md5(data的JSON字串 + time + appKey)
function buildAmegoBody(dataObj) {
  const time     = Math.floor(Date.now() / 1000);
  const dataJson = JSON.stringify(dataObj);
  const sign     = md5hex(dataJson + time + AMEGO.appKey);
  return new URLSearchParams({
    invoice: AMEGO.taxId,
    data:    dataJson,
    time:    String(time),
    sign,
  }).toString();
}

// ── TCAT 工具函式 ──
async function tryGetPDF(fileNo) {
  const attempts = [
    () => fetch(`${TCAT.endpoint}/DownloadOBT`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CustomerId: TCAT.customerId, CustomerToken: TCAT.token, FileNo: fileNo }),
    }),
    () => fetch(`${TCAT.endpoint}/DownloadOBT?FileNo=${encodeURIComponent(fileNo)}`, { method: 'GET' }),
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

// ── 主路由 ──
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname.replace(/^\//, '');
    const json = h => new Response(JSON.stringify(h), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    // ── TCAT PDF ──
    if (path === 'getPDF') {
      const { fileNo } = await request.json();
      const result = await tryGetPDF(fileNo);
      if (result.ok) {
        const blob = await result.res.arrayBuffer();
        return new Response(blob, { headers: { ...CORS, 'Content-Type': 'application/pdf' } });
      }
      return new Response(JSON.stringify({ error: '找不到 PDF endpoint' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (path === 'debugPDF') {
      const { fileNo } = await request.json();
      return json(await debugPDF(fileNo));
    }

    // ── TCAT 通用 proxy ──
    if (['PrintOBT', 'QueryOBT'].includes(path)) {
      const body = await request.json();
      body.CustomerId = TCAT.customerId;
      body.CustomerToken = TCAT.token;
      const r = await fetch(`${TCAT.endpoint}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return json(await r.json());
    }

    // ── LINE 推播 ──
    if (path === 'sendLine') {
      const { userId, message } = await request.json();
      if (!userId || !message) return json({ error: '缺少 userId 或 message' });
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_TOKEN}` },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] }),
      });
      return new Response(await r.text(), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── 電子發票：開立 ──
    if (path === 'issueInvoice') {
      const { orderId, buyerName, buyerEmail, buyerPhone,
              buyerIdentifier, carrierType, carrierNum, npoId, items, totalAmount } = await request.json();

      const isDonation = !!npoId;
      const dataObj = {
        OrderId:              orderId || `WD-${Date.now()}`,
        BuyerIdentifier:      buyerIdentifier || '0000000000',
        BuyerName:            buyerName || '客人',
        BuyerAddress:         '',
        BuyerTelephoneNumber: buyerPhone || '',
        BuyerEmailAddress:    buyerEmail || '',
        MainRemark:           '',
        CarrierType:          isDonation ? '' : (carrierType || ''),
        CarrierId1:           isDonation ? '' : (carrierNum  || ''),
        CarrierId2:           isDonation ? '' : (carrierNum  || ''),
        NPOBAN:               isDonation ? npoId : '',
        ProductItem: items.map(i => ({
          Description: i.name,
          Quantity:    String(i.count),
          Unit:        i.unit || '盒',
          UnitPrice:   String(i.price),
          Amount:      String(i.amount),
          Remark:      '',
          TaxType:     '1',
        })),
        SalesAmount:        String(totalAmount),
        FreeTaxSalesAmount: '0',
        ZeroTaxSalesAmount: '0',
        TaxType:            '1',
        TaxRate:            '0.05',
        TaxAmount:          '0',
        TotalAmount:        String(totalAmount),
      };

      try {
        const r = await fetch(`${AMEGO.base}/json/f0401`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: buildAmegoBody(dataObj),
        });
        return json(await r.json());
      } catch(e) {
        return json({ success: false, message: e.message });
      }
    }

    // ── 電子發票：作廢 ──
    if (path === 'voidInvoice') {
      const { invoiceNo, invoiceDate, reason } = await request.json();
      const dataObj = [{
        CancelInvoiceNumber: invoiceNo,
        CancelDate:          invoiceDate,
        Reason:              reason || '訂單取消',
      }];
      try {
        const r = await fetch(`${AMEGO.base}/json/f0501`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: buildAmegoBody(dataObj),
        });
        return json(await r.json());
      } catch(e) {
        return json({ success: false, message: e.message });
      }
    }

    // ── 電子發票：查詢內容（取 URL）──
    if (path === 'invoiceFile') {
      const { invoiceNo, orderId } = await request.json();
      const dataObj = invoiceNo
        ? { type: 'invoice', invoice_number: invoiceNo }
        : { type: 'order',   order_id: orderId };
      try {
        const r = await fetch(`${AMEGO.base}/json/invoice_query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: buildAmegoBody(dataObj),
        });
        return json(await r.json());
      } catch(e) {
        return json({ success: false, message: e.message });
      }
    }

    return new Response('Not found', { status: 404, headers: CORS });
  }
};
