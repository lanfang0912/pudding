const functions = require('firebase-functions');
const fetch = require('node-fetch');

const TCAT_ENDPOINT = 'https://api.suda.com.tw/api/Egs';
const CUSTOMER_ID = '9355596901';
const CUSTOMER_TOKEN = 'jkuck204';

// ── 光貿電子發票 ──
// 請至光貿後台取得以下憑證後填入：
//   GUANGMAO_MERCHANT_ID : 商家代號
//   GUANGMAO_API_HASH_KEY: HashKey
//   GUANGMAO_API_HASH_IV : HashIV
// 測試環境: https://einvoice-stage.ecrm.com.tw/B2CInvoice/Issue
// 正式環境: https://einvoice.ecrm.com.tw/B2CInvoice/Issue
const GUANGMAO_ENDPOINT   = 'https://einvoice.ecrm.com.tw/B2CInvoice/Issue';
const GUANGMAO_MERCHANT_ID = 'CHANGE_ME'; // TODO: 填入光貿商家代號
const GUANGMAO_HASH_KEY    = 'CHANGE_ME'; // TODO: 填入 HashKey
const GUANGMAO_HASH_IV     = 'CHANGE_ME'; // TODO: 填入 HashIV

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

// Proxy: 光貿電子發票 — 開立發票
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

    // 根據載具/捐贈決定 Print / Donation 旗標
    const isDonation  = !!npoId;
    const hasCarrier  = !!carrierType && !!carrierNum;
    const shouldPrint = (!isDonation && !hasCarrier) ? '1' : '0';

    // 稅額計算（含稅 5%）
    const salesAmount = Math.floor(totalAmount / 1.05);
    const taxAmount   = totalAmount - salesAmount;

    // 品項欄位（| 分隔）
    const itemName   = items.map(i => i.name).join('|');
    const itemCount  = items.map(i => String(i.count)).join('|');
    const itemWord   = items.map(i => i.unit || '盒').join('|');
    const itemPrice  = items.map(i => String(i.price)).join('|');
    const itemAmount = items.map(i => String(i.amount)).join('|');

    const timeStamp = Math.floor(Date.now() / 1000);

    const payload = {
      MerchantID:   GUANGMAO_MERCHANT_ID,
      TimeStamp:    timeStamp,
      BuyerName:    buyerName   || '',
      BuyerEmail:   buyerEmail  || '',
      BuyerPhone:   buyerPhone  || '',
      CarrierType:  isDonation ? '' : (carrierType || ''),
      CarrierNum:   isDonation ? '' : (carrierNum  || ''),
      NpoId:        isDonation ? npoId : '',
      Print:        shouldPrint,
      Donation:     isDonation ? '1' : '0',
      TaxType:      '1',       // 1 = 應稅
      TaxRate:      5,
      SalesAmount:  salesAmount,
      TaxAmount:    taxAmount,
      TotalAmount:  totalAmount,
      ItemName:     itemName,
      ItemCount:    itemCount,
      ItemWord:     itemWord,
      ItemPrice:    itemPrice,
      ItemAmount:   itemAmount,
    };

    const r = await fetch(GUANGMAO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-HashKey':     GUANGMAO_HASH_KEY,
        'X-HashIV':      GUANGMAO_HASH_IV,
        'X-MerchantID':  GUANGMAO_MERCHANT_ID,
      },
      body: JSON.stringify(payload),
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ RtnCode: 0, RtnMsg: e.message });
  }
});

// Proxy: 光貿電子發票 — 作廢發票
exports.voidInvoice = functions.region('asia-east1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const { invoiceNo, invoiceDate, reason } = req.body;
    const timeStamp = Math.floor(Date.now() / 1000);

    const payload = {
      MerchantID:  GUANGMAO_MERCHANT_ID,
      TimeStamp:   timeStamp,
      InvoiceNo:   invoiceNo,
      InvoiceDate: invoiceDate,
      Reason:      reason || '訂單取消',
    };

    const voidEndpoint = GUANGMAO_ENDPOINT.replace('/Issue', '/Invalid');
    const r = await fetch(voidEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HashKey':    GUANGMAO_HASH_KEY,
        'X-HashIV':     GUANGMAO_HASH_IV,
        'X-MerchantID': GUANGMAO_MERCHANT_ID,
      },
      body: JSON.stringify(payload),
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ RtnCode: 0, RtnMsg: e.message });
  }
});
