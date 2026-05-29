function parseDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '待確認';
  const ws = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}/${d.getDate()}（週${ws[d.getDay()]}）`;
}

function money(amount) {
  const n = Number(amount || 0);
  return `NT$${n.toLocaleString('zh-TW')}`;
}

function normalizeOrder(order) {
  return {
    id: order.id || order.order_num || '',
    name: order.name || order.customer_name || '您好',
    email: order.email || order.to_email || '',
    phone: order.phone || order.customer_phone || '',
    delivery: order.delivery || '',
    address: order.address || '',
    date: order.date || '',
    time: order.time || '',
    itemsText: order.itemsText || order.flavor_lines || '',
    total: order.total || order.totalAmount || order.total_amount || 0,
    transferDate: order.transferDate || order.transfer_date || '',
    transferCode: order.transferCode || order.transfer_code || '',
    note: order.note || '',
  };
}

function buildShipmentEmail(rawOrder) {
  const order = normalizeOrder(rawOrder);
  const isPickup = order.delivery === '面交';
  const dateText = formatDate(order.date);
  const timeText = order.time && order.time !== '未指定' ? order.time : '待確認';
  const subject = isPickup
    ? `初白時光 面交通知｜${order.id}`
    : `初白時光 出貨通知｜${order.id}`;
  const handoff = isPickup
    ? `已為您保留，請於 ${dateText}${timeText !== '待確認' ? ` ${timeText}` : ''} 至面交地點領取。`
    : `已交給黑貓宅急便，預計 ${dateText} 送達！`;
  const addressLabel = isPickup ? '面交地點' : '收件地址';

  const lines = [
    isPickup ? '初白時光 面交通知' : '初白時光 出貨通知',
    '',
    `${order.name} 您好，`,
    '',
    '您訂購的初白時光手工布丁',
    handoff,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `訂單編號：${order.id}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '【出貨內容】',
    order.itemsText || '—',
    `合計：${money(order.total)}`,
    '',
    '【收件資訊】',
    `${addressLabel}：${order.address || '—'}`,
  ];

  if (isPickup && timeText !== '待確認') lines.push(`面交時間：${timeText}`);

  lines.push(
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '收到後請盡快冷藏，保存期限 5 天。',
    '如有任何問題請加 LINE：@281huzeg',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '感謝你的支持，希望你喜歡這份布丁',
    '初白時光｜悠藍自得有限公司',
    '食安登錄字號：G-202263818-00000-5'
  );

  return { to: order.email, subject, text: lines.join('\n') };
}

function buildCustomerConfirmationEmail(rawOrder) {
  const order = normalizeOrder(rawOrder);
  const isPickup = order.delivery === '面交';
  const dateText = formatDate(order.date);
  const addressLabel = isPickup ? '面交地點' : '收件地址';
  const deliveryLabel = isPickup ? '面交領取' : '黑貓冷藏宅配';
  const subject = `初白時光 訂購確認｜${order.id}`;
  const lines = [
    `${order.name} 您好，`,
    '',
    '已收到您的訂單，謝謝你的支持。',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `訂單編號：${order.id}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '【訂單內容】',
    order.itemsText || '—',
    `合計：${money(order.total)}`,
    '',
    '【配送 / 面交資訊】',
    `方式：${deliveryLabel}`,
    `${isPickup ? '面交日期' : '預計收貨'}：${dateText}`,
    `${addressLabel}：${order.address || '—'}`,
    '',
    '【匯款資訊】',
    `匯款日期：${order.transferDate || '—'}`,
    `帳號末五碼：${order.transferCode || '—'}`,
  ];

  if (order.note) {
    lines.push('', '【備註】', order.note);
  }

  lines.push(
    '',
    '我們確認匯款後會再安排製作與通知。',
    '如有任何問題請加 LINE：@281huzeg',
    '',
    '初白時光｜悠藍自得有限公司'
  );

  return { to: order.email, subject, text: lines.join('\n') };
}

function buildOwnerNotificationEmail(rawOrder) {
  const order = normalizeOrder(rawOrder);
  const isPickup = order.delivery === '面交';
  const dateText = formatDate(order.date);
  const deliveryLabel = isPickup ? '面交' : '宅配';
  const subject = `🍮 新訂單｜${order.id}`;
  const lines = [
    `新訂單 ${order.id}`,
    '',
    `顧客：${order.name}`,
    `電話：${order.phone || '—'}`,
    `Email：${order.email || '—'}`,
    '',
    '【訂單內容】',
    order.itemsText || '—',
    `合計：${money(order.total)}`,
    '',
    '【配送資訊】',
    `方式：${deliveryLabel}`,
    `${isPickup ? '面交日期' : '預計收貨'}：${dateText}`,
    `地址：${order.address || '—'}`,
    '',
    '【匯款資訊】',
    `匯款日期：${order.transferDate || '—'}`,
    `帳號末五碼：${order.transferCode || '—'}`,
  ];

  if (order.note) {
    lines.push('', `備註：${order.note}`);
  }

  return { subject, text: lines.join('\n') };
}

function buildResendPayload({ from, email }) {
  return {
    from,
    to: [email.to],
    subject: email.subject,
    text: email.text,
  };
}

module.exports = {
  buildCustomerConfirmationEmail,
  buildOwnerNotificationEmail,
  buildShipmentEmail,
  buildResendPayload,
  formatDate,
};
