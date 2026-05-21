const assert = require('assert');
const {
  buildCustomerConfirmationEmail,
  buildShipmentEmail,
  buildResendPayload,
} = require('../lib/email');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

const baseOrder = {
  id: 'WD12345678',
  name: '王小明',
  email: 'buyer@example.com',
  phone: '0912345678',
  date: '2026-05-24',
  time: '14:00-21:00',
  delivery: '面交',
  address: '宜蘭凱旋國小',
  itemsText: '抹茶×1盒',
  total: 390,
  transferDate: '2026-05-21',
  transferCode: '12345',
  note: '',
};

test('shipment email for pickup does not mention black cat delivery', () => {
  const email = buildShipmentEmail(baseOrder);

  assert.strictEqual(email.to, 'buyer@example.com');
  assert.match(email.text, /面交通知/);
  assert.match(email.text, /面交地點：宜蘭凱旋國小/);
  assert.match(email.text, /請於 5\/24（週日） 14:00-21:00 至面交地點領取/);
  assert.doesNotMatch(email.text, /黑貓|宅急便|收件地址/);
});

test('shipment email for delivery mentions refrigerated delivery', () => {
  const email = buildShipmentEmail({
    ...baseOrder,
    delivery: '宅配',
    address: '台北市中正區測試路 1 號',
    time: '未指定',
  });

  assert.match(email.text, /出貨通知/);
  assert.match(email.text, /黑貓宅急便/);
  assert.match(email.text, /收件地址：台北市中正區測試路 1 號/);
});

test('customer confirmation email contains payment and order details', () => {
  const email = buildCustomerConfirmationEmail(baseOrder);

  assert.match(email.subject, /訂購確認/);
  assert.match(email.text, /訂單編號：WD12345678/);
  assert.match(email.text, /帳號末五碼：12345/);
  assert.match(email.text, /面交地點：宜蘭凱旋國小/);
});

test('resend payload uses configured sender and template output', () => {
  const payload = buildResendPayload({
    from: 'white dessert <notice@example.com>',
    email: buildShipmentEmail(baseOrder),
  });

  assert.deepStrictEqual(payload.from, 'white dessert <notice@example.com>');
  assert.deepStrictEqual(payload.to, ['buyer@example.com']);
  assert.match(payload.subject, /面交通知/);
  assert.match(payload.text, /抹茶×1盒/);
});
