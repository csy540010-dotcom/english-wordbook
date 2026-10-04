// 复习队列（胶带即测试）逻辑测试。运行：node test/review.test.js
'use strict';
const assert = require('assert');
const main = require('../main.js');
const { markTapePeek, graduateReview, dueReviewWords, shuffleInPlace, dateKey } = main.testing;

function makePlugin() {
  return { data: { review: {}, library: { books: { cet4: ['apple', 'table'] }, words: [] } }, persists: 0, persist() { this.persists++; } };
}

(async () => {
  console.log('复习队列逻辑测试');
  let passed = 0;
  const test = async (name, fn) => {
    try { await fn(); passed++; console.log('  ok - ' + name); }
    catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
  };
  const today = dateKey();
  const tomorrow = dateKey(1);

  await test('学习时点胶带：入队，次日到期', () => {
    const plugin = makePlugin();
    markTapePeek(plugin, 'Apple', false);
    assert.strictEqual(plugin.data.review['apple'].due, tomorrow);
    assert.strictEqual(plugin.persists, 1);
  });

  await test('学习时点胶带：已有未来到期日则保留不改期', () => {
    const plugin = makePlugin();
    plugin.data.review['apple'] = { due: dateKey(5) };
    markTapePeek(plugin, 'apple', false);
    assert.strictEqual(plugin.data.review['apple'].due, dateKey(5));
  });

  await test('复习时点胶带：明天再来（无论原到期日）', () => {
    const plugin = makePlugin();
    plugin.data.review['apple'] = { due: today };
    markTapePeek(plugin, 'apple', true);
    assert.strictEqual(plugin.data.review['apple'].due, tomorrow);
    assert.strictEqual(plugin.data.review['apple'].lastTape, today);
  });

  await test('复习时点胶带：整本模式点到未入队的词也会入队', () => {
    const plugin = makePlugin();
    markTapePeek(plugin, 'table', true);
    assert.strictEqual(plugin.data.review['table'].due, tomorrow);
  });

  await test('到期队列：只含 due<=今天 且在当前词书内的词', () => {
    const plugin = makePlugin();
    plugin.data.review['apple'] = { due: today };
    plugin.data.review['table'] = { due: tomorrow };
    plugin.data.review['ghost'] = { due: today };
    assert.deepStrictEqual(dueReviewWords(plugin, ['apple', 'table']), ['apple']);
  });

  await test('完成本轮：本轮没点的词毕业出队，点了的保留', () => {
    const plugin = makePlugin();
    plugin.data.review['apple'] = { due: today };           // 没点 → 毕业
    plugin.data.review['table'] = { due: tomorrow };        // 复习时点了 → 留队
    const inBook = plugin.data.library.books.cet4;
    const dueNow = Object.keys(plugin.data.review).filter(key => plugin.data.review[key].due <= today);
    graduateReview(plugin, dueNow);
    assert.strictEqual(plugin.data.review['apple'], undefined);
    assert.strictEqual(plugin.data.review['table'].due, tomorrow);
  });

  await test('大小写归一：点击与队列键不区分大小写', () => {
    const plugin = makePlugin();
    plugin.data.review['APPLE'] = { due: today };
    markTapePeek(plugin, 'apple', true);
    assert.strictEqual(plugin.data.review['apple'].due, tomorrow);
    assert.strictEqual(plugin.data.review['APPLE'], undefined);
  });

  await test('打乱：不丢词、只换序', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    const copy = list.slice();
    shuffleInPlace(list);
    assert.strictEqual(list.slice().sort().join(','), copy.sort().join(','));
  });

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });
