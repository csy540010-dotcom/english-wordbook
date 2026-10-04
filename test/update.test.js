// 插件自助更新：版本比较逻辑测试。运行：node test/update.test.js
'use strict';
const assert = require('assert');
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
const main = require('../main.js');
const { versionNewer } = main.testing;

(async () => {
  console.log('插件更新逻辑测试');
  let passed = 0;
  const test = (name, fn) => {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
  };

  test('数字比较：0.24.0 比 0.23.9 新（不是字符串比较）', () => {
    assert.strictEqual(versionNewer('0.24.0', '0.23.9'), true);
    assert.strictEqual(versionNewer('0.23.10', '0.23.9'), true);
    assert.strictEqual(versionNewer('0.23.9', '0.24.0'), false);
  });

  test('相同版本不算更新', () => {
    assert.strictEqual(versionNewer('0.23.9', '0.23.9'), false);
  });

  test('大版本优先', () => {
    assert.strictEqual(versionNewer('1.0.0', '0.99.99'), true);
    assert.strictEqual(versionNewer('0.99.99', '1.0.0'), false);
  });

  test('位数不齐也能比较', () => {
    assert.strictEqual(versionNewer('0.24', '0.23.9'), true);
    assert.strictEqual(versionNewer('1', '0.23.9'), true);
    assert.strictEqual(versionNewer('0.23', '0.23.0'), false);
  });

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });
