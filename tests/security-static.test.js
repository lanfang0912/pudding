const assert = require('assert');
const fs = require('fs');

const worker = fs.readFileSync('cf-worker/worker.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');
const storefront = fs.readFileSync('index.html', 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('worker requires authorization headers for privileged routes', () => {
  assert.match(worker, /Access-Control-Allow-Headers': 'Content-Type, Authorization'/);
  [
    'getPDF',
    'debugPDF',
    'PrintOBT',
    'QueryOBT',
    'sendLine',
    'issueInvoice',
    'voidInvoice',
    'invoiceFile',
  ].forEach(route => assert.match(worker, new RegExp(`'${route}'`)));
  assert.match(worker, /await requireAdmin\(request, env\)/);
});

test('admin calls privileged worker routes through authenticated helper', () => {
  assert.match(admin, /async function workerFetch/);
  assert.doesNotMatch(admin, /fetch\('https:\/\/tcat-proxy\.lanfang-hsu\.workers\.dev\/sendLine'/);
  assert.doesNotMatch(admin, /fetch\(GUANGMAO\.(issueUrl|voidUrl)/);
  assert.doesNotMatch(admin, /fetch\(TCAT\.endpoint \+ '\/PrintOBT'/);
  assert.match(admin, /workerFetch\(GUANGMAO\.issueUrl/);
  assert.match(admin, /workerFetch\(GUANGMAO\.voidUrl/);
  assert.match(admin, /workerFetch\(`\$\{LINE_WORKER\}\/sendLine`/);
});

test('public pages do not expose legacy customer or sender data', () => {
  assert.doesNotMatch(admin, /WD-OLD|WD-NEW/);
  assert.doesNotMatch(admin, /0919058683|\u7e23\u653f\u4e94\u8857/);
  assert.doesNotMatch(storefront, /tcat-proxy\.lanfang-hsu\.workers\.dev\/sendLine/);
});
