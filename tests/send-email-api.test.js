const assert = require('assert');
const { handler } = require('../api/send-email');

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch(err => {
      console.error(`not ok - ${name}`);
      throw err;
    });
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end(value) {
      this.body = value || '';
      return this;
    },
  };
}

const order = {
  id: 'WD12345678',
  name: '王小明',
  email: 'buyer@example.com',
  date: '2026-05-24',
  time: '14:00',
  delivery: '面交',
  address: '宜蘭凱旋國小',
  itemsText: '抹茶×1盒',
  total: 390,
};

test('rejects unsupported methods without calling fetch', async () => {
  const res = createRes();
  let called = false;
  await handler({ method: 'GET' }, res, { fetchImpl: async () => { called = true; } });

  assert.strictEqual(res.statusCode, 405);
  assert.strictEqual(called, false);
});

test('requires resend api key', async () => {
  const res = createRes();
  await handler({ method: 'POST', body: { type: 'shipment', order } }, res, {
    env: { RESEND_FROM_EMAIL: 'white dessert <notice@example.com>' },
    fetchImpl: async () => { throw new Error('should not call fetch'); },
  });

  assert.strictEqual(res.statusCode, 500);
  assert.match(res.body.error, /RESEND_API_KEY/);
});

test('sends shipment email through resend', async () => {
  const res = createRes();
  const calls = [];
  await handler({ method: 'POST', body: { type: 'shipment', order } }, res, {
    env: {
      RESEND_API_KEY: 'test_key',
      RESEND_FROM_EMAIL: 'white dessert <notice@example.com>',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_123' }),
        text: async () => '{"id":"email_123"}',
      };
    },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.resend.com/emails');
  assert.strictEqual(calls[0].options.headers.Authorization, 'Bearer test_key');
  const payload = JSON.parse(calls[0].options.body);
  assert.deepStrictEqual(payload.to, ['buyer@example.com']);
  assert.match(payload.subject, /面交通知/);
  assert.doesNotMatch(payload.text, /黑貓|宅急便/);
});

test('uses default brand name when no brand env vars are set', async () => {
  const res = createRes();
  const calls = [];
  await handler({ method: 'POST', body: { type: 'shipment', order } }, res, {
    env: { RESEND_API_KEY: 'test_key', RESEND_FROM_EMAIL: 'white dessert <notice@example.com>' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    },
  });
  const payload = JSON.parse(calls[0].options.body);
  assert.match(payload.subject, /^初白時光 面交通知｜/);
  assert.match(payload.text, /初白時光｜悠藍自得有限公司/);
});

test('overrides brand name/company/LINE id via env vars for resale template use', async () => {
  const res = createRes();
  const calls = [];
  await handler({ method: 'POST', body: { type: 'shipment', order } }, res, {
    env: {
      RESEND_API_KEY: 'test_key',
      RESEND_FROM_EMAIL: 'other shop <notice@example.com>',
      BRAND_NAME: '甜點小舖',
      COMPANY_NAME: '測試有限公司',
      SUPPORT_LINE_ID: '@testshop',
      FOOD_SAFETY_REG_NO: 'X-000000000-00000-0',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    },
  });
  const payload = JSON.parse(calls[0].options.body);
  assert.match(payload.subject, /^甜點小舖 面交通知｜/);
  assert.match(payload.text, /甜點小舖｜測試有限公司/);
  assert.match(payload.text, /LINE：@testshop/);
  assert.match(payload.text, /食安登錄字號：X-000000000-00000-0/);
  assert.doesNotMatch(payload.text, /初白時光|悠藍自得/);
});
