const assert = require('assert');
const crypto = require('crypto');
const { handler: issueInvoice } = require('../api/issueInvoice');
const { handler: voidInvoice } = require('../api/voidInvoice');
const { handler: invoiceFile } = require('../api/invoiceFile');
const { handler: sendLine } = require('../api/sendLine');
const { handler: printOBT } = require('../api/PrintOBT');
const { handler: getPDF } = require('../api/getPDF');

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => {
      console.error(`not ok - ${name}`);
      throw err;
    });
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end(value) { this.body = value || ''; return this; },
  };
}

const amegoEnv = { AMEGO_TAX_ID: '12345678', AMEGO_APP_KEY: 'appkey123' };
const tcatEnv = { TCAT_CUSTOMER_ID: 'cust1', TCAT_CUSTOMER_TOKEN: 'token1' };

test('issueInvoice: individual buyer keeps tax-inclusive amounts', async () => {
  const res = createRes();
  const calls = [];
  await issueInvoice({
    method: 'POST',
    body: {
      orderId: 'WD1', buyerName: '王小明', totalAmount: 390,
      items: [{ name: '抹茶布丁', count: 1, price: 390, amount: 390 }],
    },
  }, res, {
    env: amegoEnv,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { json: async () => ({ code: 200 }) };
    },
  });

  assert.strictEqual(calls.length, 1);
  assert.match(calls[0].url, /\/json\/f0401$/);
  const params = new URLSearchParams(calls[0].options.body);
  const data = JSON.parse(params.get('data'));
  assert.strictEqual(data.SalesAmount, '390');
  assert.strictEqual(data.TotalAmount, '390');
  assert.strictEqual(data.BuyerIdentifier, '0000000000');
});

test('issueInvoice: business buyer (统編) splits out tax amount', async () => {
  const res = createRes();
  const calls = [];
  await issueInvoice({
    method: 'POST',
    body: {
      orderId: 'WD2', buyerName: '測試公司', buyerIdentifier: '12345678', totalAmount: 1050,
      items: [{ name: '抹茶布丁', count: 1, price: 1050, amount: 1050 }],
    },
  }, res, {
    env: amegoEnv,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { json: async () => ({ code: 200 }) };
    },
  });

  const params = new URLSearchParams(calls[0].options.body);
  const data = JSON.parse(params.get('data'));
  assert.strictEqual(data.SalesAmount, '1000');
  assert.strictEqual(data.TaxAmount, '50');
  assert.strictEqual(data.TotalAmount, '1050');
});

test('issueInvoice: sign matches manual md5 of data+time+appKey', async () => {
  const res = createRes();
  let capturedBody;
  await issueInvoice({
    method: 'POST',
    body: { orderId: 'WD3', totalAmount: 100, items: [{ name: 'x', count: 1, price: 100, amount: 100 }] },
  }, res, {
    env: amegoEnv,
    fetchImpl: async (url, options) => {
      capturedBody = options.body;
      return { json: async () => ({ code: 200 }) };
    },
  });

  const params = new URLSearchParams(capturedBody);
  const expectedSign = crypto.createHash('md5')
    .update(params.get('data') + params.get('time') + amegoEnv.AMEGO_APP_KEY)
    .digest('hex');
  assert.strictEqual(params.get('sign'), expectedSign);
  assert.strictEqual(params.get('invoice'), amegoEnv.AMEGO_TAX_ID);
});

test('issueInvoice: missing AMEGO_APP_KEY returns error without calling fetch', async () => {
  const res = createRes();
  let called = false;
  await issueInvoice({ method: 'POST', body: { totalAmount: 0, items: [] } }, res, {
    env: { AMEGO_TAX_ID: '12345678' },
    fetchImpl: async () => { called = true; },
  });
  assert.strictEqual(called, false);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.message, /AMEGO_APP_KEY/);
});

test('voidInvoice: sends cancel payload as array', async () => {
  const res = createRes();
  let capturedBody;
  await voidInvoice({
    method: 'POST',
    body: { invoiceNo: 'AB12345678', invoiceDate: '2026-05-01', reason: '客人取消' },
  }, res, {
    env: amegoEnv,
    fetchImpl: async (url, options) => { capturedBody = options.body; return { json: async () => ({ code: 200 }) }; },
  });
  const data = JSON.parse(new URLSearchParams(capturedBody).get('data'));
  assert.deepStrictEqual(data, [{ CancelInvoiceNumber: 'AB12345678', CancelDate: '2026-05-01', Reason: '客人取消' }]);
});

test('invoiceFile: queries by invoice number when provided', async () => {
  const res = createRes();
  let capturedBody;
  await invoiceFile({ method: 'POST', body: { invoiceNo: 'AB12345678' } }, res, {
    env: amegoEnv,
    fetchImpl: async (url, options) => { capturedBody = options.body; return { json: async () => ({ code: 200 }) }; },
  });
  const data = JSON.parse(new URLSearchParams(capturedBody).get('data'));
  assert.deepStrictEqual(data, { type: 'invoice', invoice_number: 'AB12345678' });
});

test('sendLine: forwards Bearer token and message payload to LINE', async () => {
  const res = createRes();
  const calls = [];
  await sendLine({ method: 'POST', body: { userId: 'U123', message: 'hello' } }, res, {
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'linetoken' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 200, text: async () => '{"ok":true}' };
    },
  });
  assert.strictEqual(calls[0].url, 'https://api.line.me/v2/bot/message/push');
  assert.strictEqual(calls[0].options.headers.Authorization, 'Bearer linetoken');
  assert.deepStrictEqual(JSON.parse(calls[0].options.body), {
    to: 'U123', messages: [{ type: 'text', text: 'hello' }],
  });
});

test('PrintOBT: injects TCAT credentials into proxied body', async () => {
  const res = createRes();
  let capturedUrl, capturedBody;
  await printOBT({ method: 'POST', body: { OBTNumber: 'X1' } }, res, {
    env: tcatEnv,
    fetchImpl: async (url, options) => {
      capturedUrl = url; capturedBody = JSON.parse(options.body);
      return { json: async () => ({ ok: true }) };
    },
  });
  assert.match(capturedUrl, /\/PrintOBT$/);
  assert.strictEqual(capturedBody.CustomerId, 'cust1');
  assert.strictEqual(capturedBody.CustomerToken, 'token1');
  assert.strictEqual(capturedBody.OBTNumber, 'X1');
});

test('getPDF: returns PDF buffer when TCAT responds with pdf content-type', async () => {
  const res = createRes();
  await getPDF({ method: 'POST', body: { fileNo: 'F1' } }, res, {
    env: tcatEnv,
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: async () => Buffer.from('%PDF-1.4'),
    }),
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['Content-Type'], 'application/pdf');
  assert.ok(Buffer.isBuffer(res.body));
});
