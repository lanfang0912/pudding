const functions = require('firebase-functions');
const fetch = require('node-fetch');

const TCAT_ENDPOINT = 'https://api.suda.com.tw/api/Egs';
const CUSTOMER_ID = '9355596901';
const CUSTOMER_TOKEN = 'jkuck204';

// ── 光貿電子發票（amego 平台）──
// API 文件：https://invoice.amego.tw/
// 測試憑證：統編 12345678 / App Key sHeq7t8G1wiQvhAuIM27
// 正式上線後請換為貴公司統編與 App Key（向 amego 客服取得）
const AMEGO_BASE     = 'https://invoice-api.amego.tw';
const AMEGO_TAX_ID   = 'CHANGE_ME'; // TODO: 填入公司統編（正式）
const AMEGO_APP_KEY  = 'CHANGE_ME'; // TODO: 填入 App Key（正式）

// Proxy: 建立托運單
exports.tcatPrintOBT = functions.region('asia-east1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const body = { ...req.body, CustomerId: CUSTOMER_ID, CustomerToken: CUSTOMER_TOKEN };
    const r = await fetch(`${TCAT_ENDPOINT}/PrintOBT`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ IsOK: 'N', Message: e.message });
  }
});

// Proxy: 下載 PDF
exports.tcatGetPDF = functions.region('asia-east1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const { fileNo } = req.body;
  const endpoints = ['GetOBTFile', 'DownloadOBTFile', 'GetFile', 'PrintOBTFile'];

  for (const ep of endpoints) {
    try {
      const r = await fetch(`${TCAT_ENDPOINT}/${ep}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CustomerId: CUSTOMER_ID, CustomerToken: CUSTOMER_TOKEN, FileNo: fileNo })
      });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('pdf')) {
        res.set('Content-Type', 'application/pdf');
        r.body.pipe(res);
        return;
      }
      const text = await r.text();
      console.log(`${ep} → ${r.status} ${ct}: ${text.slice(0, 200)}`);
    } catch (e) {
      console.log(`${ep} error: ${e.message}`);
    }
  }
  res.status(404).json({ error: '找不到可用的 PDF endpoint' });
});

// 共用：amego API 請求標頭
function amegoHeaders() {
  return {
    'Content-Type': 'application/json',
    'tax-id':  AMEGO_TAX_ID,
    'app-key': AMEGO_APP_KEY,
  };
}

// Proxy: amego 電子發票 — 開立發票
exports.issueInvoice = functions.region('asia-east1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const {
      buyerName, buyerEmail, buyerPhone,
      carrierType, carrierNum, npoId,
      items, totalAmount,
    } = req.body;

    // 根據載具/捐贈決定旗標
    const isDonation = !!npoId;
    const hasCarrier = !!carrierType && !!carrierNum;
    const print      = (!isDonation && !hasCarrier) ? 1 : 0;

    // 稅額計算（含稅 5%）
    const salesAmount = Math.floor(totalAmount / 1.05);
    const taxAmount   = totalAmount - salesAmount;

    const payload = {
      tax_id:       AMEGO_TAX_ID,
      buyer_name:   buyerName  || '',
      buyer_email:  buyerEmail || '',
      buyer_phone:  buyerPhone || '',
      carrier_type: isDonation ? '' : (carrierType || ''),
      carrier_num:  isDonation ? '' : (carrierNum  || ''),
      npo_id:       isDonation ? npoId : '',
      print,
      donation:     isDonation ? 1 : 0,
      tax_type:     1,   // 1 = 應稅
      tax_rate:     5,
      sales_amount: salesAmount,
      tax_amount:   taxAmount,
      total_amount: totalAmount,
      items: items.map(i => ({
        name:   i.name,
        count:  i.count,
        unit:   i.unit  || '盒',
        price:  i.price,
        amount: i.amount,
      })),
    };

    const r = await fetch(`${AMEGO_BASE}/invoice`, {
      method: 'POST',
      headers: amegoHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Proxy: amego 電子發票 — 作廢發票
exports.voidInvoice = functions.region('asia-east1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const { invoiceNo, invoiceDate, reason } = req.body;

    const payload = {
      tax_id:       AMEGO_TAX_ID,
      invoice_no:   invoiceNo,
      invoice_date: invoiceDate,
      reason:       reason || '訂單取消',
    };

    const r = await fetch(`${AMEGO_BASE}/invoice/void`, {
      method: 'POST',
      headers: amegoHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
