const assert = require('assert');
const {
  DEFAULT_PRODUCTS,
  normalizeProducts,
  buildOrderItemsFromSelection,
  legacyCountsFromItems,
} = require('../product-model');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('normalizes seeded products in active sort order', () => {
  const products = normalizeProducts(null);
  assert.deepStrictEqual(products.map(p => p.id), ['original', 'matcha', 'cocoa', 'pudding_mix', 'insulated_bag']);
  assert.strictEqual(products[0].productionMode, 'scheduled');
  assert.strictEqual(products[3].type, 'pudding_mix');
  assert.strictEqual(products[4].productionMode, 'none');
});

test('builds order item snapshots for box selections', () => {
  const activeProducts = normalizeProducts(DEFAULT_PRODUCTS);
  const items = buildOrderItemsFromSelection({
    products: activeProducts,
    quantities: { original: 2, cocoa: 1 },
    lowSugar: { cocoa: true },
  });

  assert.deepStrictEqual(items.map(i => i.productId), ['original', 'cocoa']);
  assert.strictEqual(items[0].amount, 720);
  assert.strictEqual(items[1].options.lowSugar, true);
});

test('builds mix item with components and legacy counts', () => {
  const items = buildOrderItemsFromSelection({
    products: DEFAULT_PRODUCTS,
    mixProductId: 'pudding_mix',
    mixQty: 2,
    mixLowSugar: true,
  });

  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].type, 'pudding_mix');
  assert.strictEqual(items[0].amount, 760);
  assert.deepStrictEqual(items[0].components.map(c => c.cups), [4, 4, 4]);
  assert.deepStrictEqual(legacyCountsFromItems(items), { orig: 4 / 6, matcha: 4 / 6, cocoa: 4 / 6 });
});

test('ignores non-scheduled add-ons in legacy production counts', () => {
  const items = buildOrderItemsFromSelection({
    products: DEFAULT_PRODUCTS,
    quantities: { insulated_bag: 3 },
  });

  assert.strictEqual(items[0].type, 'addon');
  assert.deepStrictEqual(legacyCountsFromItems(items), { orig: 0, matcha: 0, cocoa: 0 });
});
