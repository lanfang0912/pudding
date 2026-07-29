// ── Email helpers (ported from lib/email.js) ──────────────────────────

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
  return `NT$${Number(amount || 0).toLocaleString('zh-TW')}`;
}

function normalizeOrder(order) {
  return {
    id:           order.id || order.order_num || '',
    name:         order.name || order.customer_name || '您好',
    email:        order.email || order.to_email || '',
    phone:        order.phone || order.customer_phone || '',
    delivery:     order.delivery || '',
    address:      order.address || '',
    date:         order.date || '',
    time:         order.time || '',
    itemsText:    order.itemsText || order.flavor_lines || '',
    total:        order.total || order.totalAmount || order.total_amount || 0,
    transferDate: order.transferDate || order.transfer_date || '',
    transferCode: order.transferCode || order.transfer_code || '',
    note:         order.note || '',
  };
}

function buildCustomerConfirmationEmail(rawOrder) {
  const o = normalizeOrder(rawOrder);
  const isPickup = o.delivery === '面交';
  const dateText = formatDate(o.date);
  const lines = [
    `${o.name} 您好，`,
    '',
    '已收到您的訂單，謝謝你的支持。',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `訂單編號：${o.id}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '【訂單內容】',
    o.itemsText || '—',
    `合計：${money(o.total)}`,
    '',
    '【配送 / 面交資訊】',
    `方式：${isPickup ? '面交領取' : '黑貓冷藏宅配'}`,
    `${isPickup ? '面交日期' : '預計收貨'}：${dateText}`,
    `${isPickup ? '面交地點' : '收件地址'}：${o.address || '—'}`,
    '',
    '【匯款資訊】',
    `匯款日期：${o.transferDate || '—'}`,
    `帳號末五碼：${o.transferCode || '—'}`,
  ];
  if (o.note) lines.push('', '【備註】', o.note);
  lines.push(
    '',
    '我們確認匯款後會再安排製作與通知。',
    '如有任何問題請加 LINE：@281huzeg',
    '',
    '初白時光｜悠藍自得有限公司'
  );
  return { to: o.email, subject: `初白時光 訂購確認｜${o.id}`, text: lines.join('\n') };
}

function buildShipmentEmail(rawOrder) {
  const o = normalizeOrder(rawOrder);
  const isPickup = o.delivery === '面交';
  const dateText = formatDate(o.date);
  const timeText = o.time && o.time !== '未指定' ? o.time : '待確認';
  const handoff = isPickup
    ? `已為您保留，請於 ${dateText}${timeText !== '待確認' ? ` ${timeText}` : ''} 至面交地點領取。`
    : `已交給黑貓宅急便，預計 ${dateText} 送達！`;
  const lines = [
    isPickup ? '初白時光 面交通知' : '初白時光 出貨通知',
    '',
    `${o.name} 您好，`,
    '',
    '您訂購的初白時光手工布丁',
    handoff,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `訂單編號：${o.id}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '【出貨內容】',
    o.itemsText || '—',
    `合計：${money(o.total)}`,
    '',
    '【收件資訊】',
    `${isPickup ? '面交地點' : '收件地址'}：${o.address || '—'}`,
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
  return {
    to: o.email,
    subject: isPickup ? `初白時光 面交通知｜${o.id}` : `初白時光 出貨通知｜${o.id}`,
    text: lines.join('\n'),
  };
}

function buildOwnerNotificationEmail(rawOrder) {
  const o = normalizeOrder(rawOrder);
  const isPickup = o.delivery === '面交';
  const dateText = formatDate(o.date);
  const lines = [
    `新訂單 ${o.id}`,
    '',
    `顧客：${o.name}`,
    `電話：${o.phone || '—'}`,
    `Email：${o.email || '—'}`,
    '',
    '【訂單內容】',
    o.itemsText || '—',
    `合計：${money(o.total)}`,
    '',
    '【配送資訊】',
    `方式：${isPickup ? '面交' : '宅配'}`,
    `${isPickup ? '面交日期' : '預計收貨'}：${dateText}`,
    `地址：${o.address || '—'}`,
    '',
    '【匯款資訊】',
    `匯款日期：${o.transferDate || '—'}`,
    `帳號末五碼：${o.transferCode || '—'}`,
  ];
  if (o.note) lines.push('', `備註：${o.note}`);
  return { subject: `🍮 新訂單｜${o.id}`, text: lines.join('\n') };
}

// ── API handler ───────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function handleSendEmail(request, env, ctx) {
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const apiKey = env.RESEND_API_KEY;
    const from   = env.RESEND_FROM_EMAIL;
    if (!apiKey) throw new Error('Missing RESEND_API_KEY');
    if (!from)   throw new Error('Missing RESEND_FROM_EMAIL');

    const { type, order } = await request.json();
    if (!order || typeof order !== 'object') throw new Error('Missing order');

    let email;
    if (type === 'customer-confirmation') email = buildCustomerConfirmationEmail(order);
    else if (type === 'shipment')         email = buildShipmentEmail(order);
    else throw new Error('Unsupported email type');

    if (!email.to || !email.to.includes('@')) throw new Error('Missing recipient email');

    const sendEmail = async (payload) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) {}
      return { ok: res.ok, status: res.status, data };
    };

    const { ok, status, data } = await sendEmail({ from, to: [email.to], subject: email.subject, text: email.text });
    if (!ok) return json({ success: false, error: data.message || data.error || 'Resend error', details: data }, status || 502);

    // 新訂單時通知店家
    if (type === 'customer-confirmation') {
      if (env.OWNER_EMAIL) {
        const ownerEmail = buildOwnerNotificationEmail(order);
        const notifyOwner = sendEmail({ from, to: [env.OWNER_EMAIL], subject: ownerEmail.subject, text: ownerEmail.text })
          .then((result) => {
            if (!result.ok) console.error('店家通知信寄送失敗:', result.status, result.data);
          })
          .catch((err) => console.error('店家通知信寄送發生例外:', err));
        // 用 waitUntil 確保 Worker 回傳 response 後這個非同步呼叫仍會執行完成，
        // 否則 Cloudflare 可能在 fetch 尚未完成時就直接終止它。
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(notifyOwner);
        else await notifyOwner;
      } else {
        console.error('未設定 OWNER_EMAIL，略過店家新訂單通知');
      }
    }

    return json({ success: true, id: data.id || '' });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

// ── Worker entry ──────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/send-email') return handleSendEmail(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
