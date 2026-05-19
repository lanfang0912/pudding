(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ProductModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const DEFAULT_PRODUCTS = [
    {
      id: 'original',
      name: '原味布丁',
      type: 'pudding_box',
      status: 'active',
      price: 360,
      unit: '盒',
      unitCups: 6,
      emoji: '🍮',
      description: '蛋香濃厚，甜度適中',
      sort: 10,
      stockKey: 'original',
      productionMode: 'scheduled',
      capacityGroup: 'pudding',
      recipeKey: 'original',
      leadDays: { delivery: 2, pickup: 1 },
      legacyField: 'orig',
    },
    {
      id: 'matcha',
      name: '抹茶布丁',
      type: 'pudding_box',
      status: 'active',
      price: 390,
      unit: '盒',
      unitCups: 6,
      emoji: '🍵',
      description: '抹茶苦韻剛好，香氣乾淨',
      sort: 20,
      stockKey: 'matcha',
      productionMode: 'scheduled',
      capacityGroup: 'pudding',
      recipeKey: 'matcha',
      leadDays: { delivery: 2, pickup: 1 },
      legacyField: 'matcha',
    },
    {
      id: 'cocoa',
      name: '可可布丁',
      type: 'pudding_box',
      status: 'active',
      price: 390,
      unit: '盒',
      unitCups: 6,
      emoji: '🍫',
      description: '可可濃度高，尾韻帶一點大人味',
      sort: 30,
      stockKey: 'cocoa',
      productionMode: 'scheduled',
      capacityGroup: 'pudding',
      recipeKey: 'cocoa',
      leadDays: { delivery: 2, pickup: 1 },
      legacyField: 'cocoa',
    },
    {
      id: 'pudding_mix',
      name: '綜合三拼',
      type: 'pudding_mix',
      status: 'active',
      price: 380,
      unit: '組',
      unitCups: 6,
      emoji: '🎁',
      description: '原味 2 杯、抹茶 2 杯、可可 2 杯',
      sort: 40,
      productionMode: 'scheduled',
      capacityGroup: 'pudding',
      leadDays: { delivery: 2, pickup: 1 },
      components: [
        { stockKey: 'original', cups: 2, legacyField: 'orig' },
        { stockKey: 'matcha', cups: 2, legacyField: 'matcha' },
        { stockKey: 'cocoa', cups: 2, legacyField: 'cocoa' },
      ],
    },
    {
      id: 'insulated_bag',
      name: '保冷袋',
      type: 'addon',
      status: 'active',
      price: 20,
      unit: '個',
      emoji: '🧊',
      description: '一個可裝 2 至 3 盒',
      sort: 90,
      productionMode: 'none',
    },
  ];

  const LEGACY_FIELD_BY_STOCK = {
    original: 'orig',
    matcha: 'matcha',
    cocoa: 'cocoa',
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeProduct(id, product) {
    const p = { id, ...(product || {}) };
    p.name = String(p.name || id);
    p.type = p.type || 'other';
    p.status = p.status || 'draft';
    p.price = Number(p.price || 0);
    p.unit = p.unit || '個';
    p.unitCups = Number(p.unitCups || 0);
    p.emoji = p.emoji || '';
    p.description = p.description || '';
    p.sort = Number(p.sort || 999);
    p.productionMode = p.productionMode || (p.type === 'addon' ? 'none' : 'scheduled');
    if (p.stockKey && !p.legacyField) p.legacyField = LEGACY_FIELD_BY_STOCK[p.stockKey] || '';
    if (Array.isArray(p.components)) {
      p.components = p.components.map(c => ({
        stockKey: c.stockKey || '',
        cups: Number(c.cups || 0),
        legacyField: c.legacyField || LEGACY_FIELD_BY_STOCK[c.stockKey] || '',
      }));
    }
    return p;
  }

  function normalizeProducts(raw) {
    const source = raw && typeof raw === 'object' ? raw : DEFAULT_PRODUCTS.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
    return Object.entries(source)
      .map(([id, product]) => normalizeProduct(id, product))
      .filter(p => p.status !== 'archived')
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-Hant'));
  }

  function activeProducts(raw) {
    return normalizeProducts(raw).filter(p => p.status === 'active');
  }

  function productMap(products) {
    return normalizeProducts(products).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  }

  function snapshotBox(product, qty, options) {
    const amount = Math.round(product.price * qty);
    return {
      productId: product.id,
      name: product.name,
      type: product.type,
      price: product.price,
      qty,
      unit: product.unit,
      unitCups: product.unitCups || 0,
      amount,
      stockKey: product.stockKey || '',
      legacyField: product.legacyField || '',
      productionMode: product.productionMode,
      capacityGroup: product.capacityGroup || '',
      recipeKey: product.recipeKey || product.stockKey || '',
      options: options || {},
    };
  }

  function snapshotMix(product, qty, options) {
    return {
      productId: product.id,
      name: product.name,
      type: product.type,
      price: product.price,
      qty,
      unit: product.unit,
      unitCups: product.unitCups || 0,
      amount: Math.round(product.price * qty),
      productionMode: product.productionMode,
      capacityGroup: product.capacityGroup || '',
      components: (product.components || []).map(c => ({
        stockKey: c.stockKey,
        cups: Number(c.cups || 0) * qty,
        legacyField: c.legacyField || LEGACY_FIELD_BY_STOCK[c.stockKey] || '',
      })),
      options: options || {},
    };
  }

  function buildOrderItemsFromSelection({ products, quantities, lowSugar, mixProductId, mixQty, mixLowSugar }) {
    const map = productMap(products || DEFAULT_PRODUCTS);
    if (mixProductId && mixQty > 0) {
      const product = map[mixProductId];
      if (!product) return [];
      return [snapshotMix(product, Number(mixQty), { lowSugar: !!mixLowSugar })];
    }
    return Object.entries(quantities || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => {
        const product = map[productId];
        if (!product) return null;
        return snapshotBox(product, Number(qty), { lowSugar: !!(lowSugar && lowSugar[productId]) });
      })
      .filter(Boolean);
  }

  function legacyCountsFromItems(items) {
    const counts = { orig: 0, matcha: 0, cocoa: 0 };
    (items || []).forEach(item => {
      if (item.type === 'pudding_mix') {
        (item.components || []).forEach(c => {
          const field = c.legacyField || LEGACY_FIELD_BY_STOCK[c.stockKey];
          if (field && counts[field] != null) counts[field] += Number(c.cups || 0) / 6;
        });
        return;
      }
      if (item.productionMode !== 'scheduled') return;
      const field = item.legacyField || LEGACY_FIELD_BY_STOCK[item.stockKey];
      if (field && counts[field] != null) counts[field] += Number(item.qty || 0);
    });
    return counts;
  }

  function displayItems(items) {
    return (items || []).map(item => {
      if (item.type === 'pudding_mix') {
        const parts = (item.components || [])
          .map(c => `${stockLabel(c.stockKey)}×${Math.round(c.cups || 0)}杯`)
          .join('・');
        return `${item.emoji || '🎁'} ${item.name} ×${item.qty}${item.unit || ''}${parts ? `（${parts}）` : ''}`;
      }
      return `${item.name} ×${item.qty}${item.unit || ''}`;
    }).join('、');
  }

  function stockLabel(stockKey) {
    return { original: '原味', matcha: '抹茶', cocoa: '可可' }[stockKey] || stockKey;
  }

  return {
    DEFAULT_PRODUCTS: clone(DEFAULT_PRODUCTS),
    normalizeProduct,
    normalizeProducts,
    activeProducts,
    buildOrderItemsFromSelection,
    legacyCountsFromItems,
    displayItems,
    stockLabel,
  };
});
