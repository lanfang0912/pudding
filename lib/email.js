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

const DEFAULT_BRAND = {
  name: '初白時光',
  company: '悠藍自得有限公司',
  foodSafetyRegNo: 'G-202263818-00000-5',
  lineId: '@281huzeg',
};

// 商家資料的權威來源是後台「網站設計」頁面寫入的 Firebase settings/design
// （跟網站本身讀的是同一份），環境變數只在讀不到 Firebase 設定時當備援。
async function fetchBusinessSettings(databaseUrl, fetchImpl) {
  if (!databaseUrl) return null;
  try {
    const res = await fetchImpl(`${databaseUrl.replace(/\/$/, '')}/settings/design.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function getBrandConfig(env, fetchImpl) {
  env = env || {};
  const settings = (await fetchBusinessSettings(env.FIREBASE_DATABASE_URL, fetchImpl || fetch)) || {};
  return {
    name: settings.footerBrand || env.BRAND_NAME || DEFAULT_BRAND.name,
    company: settings.companyName || env.COMPANY_NAME || DEFAULT_BRAND.company,
    foodSafetyRegNo: settings.foodSafetyRegNo || env.FOOD_SAFETY_REG_NO || DEFAULT_BRAND.foodSafetyRegNo,
    lineId: settings.lineId || env.SUPPORT_LINE_ID || DEFAULT_BRAND.lineId,
  };
}

function buildShipmentEmail(rawOrder, rawBrand) {
  const order = normalizeOrder(rawOrder);
  const brand = rawBrand || DEFAULT_BRAND;
  const isPickup = order.delivery === '面交';
  const dateText = formatDate(order.date);
  const timeText = order.time && order.time !== '未指定' ? order.time : '待確認';
  const subject = isPickup
    ? `${brand.name} 面交通知｜${order.id}`
    : `${brand.name} 出貨通知｜${order.id}`;
  const handoff = isPickup
    ? `已為您保留，請於 ${dateText}${timeText !== '待確認' ? ` ${timeText}` : ''} 至面交地點領取。`
    : `已交給黑貓宅急便，預計 ${dateText} 送達！`;
  const addressLabel = isPickup ? '面交地點' : '收件地址';

  const lines = [
    isPickup ? `${brand.name} 面交通知` : `${brand.name} 出貨通知`,
    '',
    `${order.name} 您好，`,
    '',
    `您訂購的${brand.name}手工布丁`,
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
    `如有任何問題請加 LINE：${brand.lineId}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '感謝你的支持，希望你喜歡這份布丁',
    `${brand.name}｜${brand.company}`,
    `食安登錄字號：${brand.foodSafetyRegNo}`
  );

  return { to: order.email, subject, text: lines.join('\n') };
}

function buildCustomerConfirmationEmail(rawOrder, rawBrand) {
  const order = normalizeOrder(rawOrder);
  const brand = rawBrand || DEFAULT_BRAND;
  const isPickup = order.delivery === '面交';
  const dateText = formatDate(order.date);
  const addressLabel = isPickup ? '面交地點' : '收件地址';
  const deliveryLabel = isPickup ? '面交領取' : '黑貓冷藏宅配';
  const subject = `${brand.name} 訂購確認｜${order.id}`;
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
    `如有任何問題請加 LINE：${brand.lineId}`,
    '',
    `${brand.name}｜${brand.company}`
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
  const to = String(email.to || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return {
    from,
    to,
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
  getBrandConfig,
};
