const functions = require('firebase-functions');
const fetch = require('node-fetch');
const crypto = require('crypto');

const TCAT_ENDPOINT = 'https://api.suda.com.tw/api/Egs';
const AMEGO_BASE     = 'https://invoice-api.amego.tw';

function requiredConfig(path) {
  const parts = path.split('.');
  let cur = functions.config();
  for (const part of parts) cur = cur && cur[part];
  if (!cur) throw new Error(`Missing Firebase Functions config: ${path}`);
  return cur;
}

function getTcatConfig() {
  return {
    endpoint: functions.config().tcat?.endpoint || TCAT_ENDPOINT,
    customerId: requiredConfig('tcat.customer_id'),
    customerToken: requiredConfig('tcat.customer_token'),
  };
}

function getAmegoConfig() {
  return {
    base: functions.config().amego?.base || AMEGO_BASE,
    taxId: requiredConfig('amego.tax_id'),
    appKey: requiredConfig('amego.app_key'),
  };
}

// Proxy: 建立托運單
exports.tcatPrintOBT = functions.region('asia-east1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const tcat = getTcatConfig();
    const body = { ...req.body, CustomerId: tcat.customerId, CustomerToken: tcat.customerToken };
    const r = await fetch(`${tcat.endpoint}/PrintOBT`, {
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
  const tcat = getTcatConfig();
  const endpoints = ['GetOBTFile', 'DownloadOBTFile', 'GetFile', 'PrintOBTFile'];

  for (const ep of endpoints) {
    try {
      const r = await fetch(`${tcat.endpoint}/${ep}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CustomerId: tcat.customerId, CustomerToken: tcat.customerToken, FileNo: fileNo })
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

// 共用：組 amego API 請求 body
// 格式：Content-Type: application/x-www-form-urlencoded
// 欄位：invoice（統編）、data（url-encoded JSON）、time（timestamp）、sign（md5）
// 簽名：md5(data的JSON字串 + time + APP_KEY)
function buildAmegoBody(dataObj) {
  const amego = getAmegoConfig();
  const time     = Math.floor(Date.now() / 1000);
  const dataJson = JSON.stringify(dataObj);
  const sign     = crypto.createHash('md5')
    .update(dataJson + time + amego.appKey)
    .digest('hex');

  return new URLSearchParams({
    invoice: amego.taxId,
    data:    dataJson,
    time:    String(time),
    sign,
  }).toString();
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

    // data 欄位內容（amego B2C 開立發票，MIG 4.0，/json/f0401）
    // B2C 不打統編：TaxAmount 一律帶 0，含稅單價直接填入 UnitPrice
    const dataObj = {
      OrderId:              req.body.orderId || `WD-${Date.now()}`,
      BuyerIdentifier:      '0000000000',   // B2C 一律填 0000000000
      BuyerName:            buyerName  || '客人',
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
        Quantity:    i.count,          // Number
        Unit:        i.unit || '盒',
        UnitPrice:   i.price,          // Number，含稅單價
        Amount:      i.amount,         // Number
        Remark:      '',
        TaxType:     1,                // Number：1 = 應稅
      })),
      SalesAmount:        totalAmount, // Number，B2C 含稅，應稅額 = 總計
      FreeTaxSalesAmount: 0,           // Number
      ZeroTaxSalesAmount: 0,           // Number
      TaxType:            1,           // Number：1 = 應稅
      TaxRate:            '0.05',      // String
      TaxAmount:          0,           // Number：B2C 不打統編一律帶 0
      TotalAmount:        totalAmount, // Number
    };

    const amego = getAmegoConfig();
    const r = await fetch(`${amego.base}/json/f0401`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildAmegoBody(dataObj),
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

    const dataObj = {
      invoice_no:   invoiceNo,
      invoice_date: invoiceDate,
      reason:       reason || '訂單取消',
    };

    const amego = getAmegoConfig();
    const r = await fetch(`${amego.base}/json/f0501`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildAmegoBody(dataObj),
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
