const crypto = require('crypto');
const { requireEnv } = require('./tcat');

const AMEGO_BASE = 'https://invoice-api.amego.tw';

function getAmegoSecrets(env) {
  return {
    base: env.AMEGO_BASE || AMEGO_BASE,
    taxId: requireEnv(env, 'AMEGO_TAX_ID'),
    appKey: requireEnv(env, 'AMEGO_APP_KEY'),
  };
}

// sign = md5(data 的 JSON 字串 + time + appKey)
function buildAmegoBody(dataObj, amego) {
  const time = Math.floor(Date.now() / 1000);
  const dataJson = JSON.stringify(dataObj);
  const sign = crypto.createHash('md5').update(dataJson + time + amego.appKey).digest('hex');
  return new URLSearchParams({
    invoice: amego.taxId,
    data: dataJson,
    time: String(time),
    sign,
  }).toString();
}

function buildIssueInvoiceData({
  orderId, buyerName, buyerEmail, buyerPhone,
  buyerIdentifier, carrierType, carrierNum, npoId, items, totalAmount,
}) {
  const isDonation = !!npoId;
  const dataObj = {
    OrderId: orderId || `WD-${Date.now()}`,
    BuyerIdentifier: buyerIdentifier || '0000000000',
    BuyerName: buyerName || '客人',
    BuyerAddress: '',
    BuyerTelephoneNumber: buyerPhone || '',
    BuyerEmailAddress: buyerEmail || '',
    MainRemark: '',
    CarrierType: isDonation ? '' : (carrierType || ''),
    CarrierId1: isDonation ? '' : (carrierNum || ''),
    CarrierId2: isDonation ? '' : (carrierNum || ''),
    NPOBAN: isDonation ? npoId : '',
    ProductItem: items.map((i) => ({
      Description: i.name,
      Quantity: String(i.count),
      Unit: i.unit || '盒',
      UnitPrice: String(i.price),
      Amount: String(i.amount),
      Remark: '',
      TaxType: '1',
    })),
    SalesAmount: String(totalAmount),
    FreeTaxSalesAmount: '0',
    ZeroTaxSalesAmount: '0',
    TaxType: '1',
    TaxRate: '0.05',
    TaxAmount: '0',
    TotalAmount: String(totalAmount),
  };

  // 打統編：品項改未稅價，拆算稅額
  const isBusiness = buyerIdentifier && buyerIdentifier !== '0000000000';
  if (isBusiness) {
    dataObj.DetailVat = '0';
    dataObj.ProductItem = items.map((i) => {
      const exclAmount = Math.round(i.amount / 1.05);
      const exclPrice = Math.round(i.price / 1.05);
      return {
        Description: i.name, Quantity: String(i.count), Unit: i.unit || '盒',
        UnitPrice: String(exclPrice), Amount: String(exclAmount), Remark: '', TaxType: '1',
      };
    });
    const salesAmount = dataObj.ProductItem.reduce((s, p) => s + Number(p.Amount), 0);
    const taxAmount = Math.round(salesAmount * 0.05);
    dataObj.SalesAmount = String(salesAmount);
    dataObj.TaxAmount = String(taxAmount);
    dataObj.TotalAmount = String(salesAmount + taxAmount);
  }

  return dataObj;
}

module.exports = { getAmegoSecrets, buildAmegoBody, buildIssueInvoiceData };
