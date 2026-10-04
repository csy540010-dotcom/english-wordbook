// 释义词性校正（repairMissingPos）测试。运行：node test/meanings.test.js
'use strict';
const assert = require('assert');
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
const main = require('../main.js');
const makePlugin = () => Object.create(main.prototype);

(async () => {
  console.log('释义词性校正测试');
  let passed = 0;
  const test = (name, fn) => {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
  };

  test('缓存与卡片缺词性 → 用带词性的词典版修复', () => {
    const plugin = makePlugin();
    plugin.dictionary = { entries: { abruptly: ["/ə'brʌptlɪ/", 'adv. 突然地'], absorb: ["/əb'sɔ:b/", 'v. 吸收（液体、气体等）'] } };
    plugin.data = {
      entries: { abruptly: { phonetic: "/ə'brʌptlɪ/", meaning: '突然地，意外地' } },
      library: { words: [ { word: 'abruptly', meaning: '突然地，意外地' }, { word: 'absorb', meaning: '吸收；理解；吞没' } ] }
    };
    const changed = plugin.repairMissingPos();
    assert.strictEqual(changed, true);
    assert.strictEqual(plugin.data.entries.abruptly.meaning, 'adv. 突然地');
    assert.strictEqual(plugin.data.library.words[0].meaning, 'adv. 突然地');
    assert.strictEqual(plugin.data.library.words[1].meaning, 'v. 吸收（液体、气体等）');
  });

  test('已有词性的释义不动（如 improve 的 AI 富释义）', () => {
    const plugin = makePlugin();
    plugin.dictionary = { entries: { improve: ['/ɪmˈpruːv/', 'v. 使更好；改善'] } };
    plugin.data = { entries: {}, library: { words: [ { word: 'improve', meaning: 'v. 提高；改善' } ] } };
    assert.strictEqual(plugin.repairMissingPos(), false);
    assert.strictEqual(plugin.data.library.words[0].meaning, 'v. 提高；改善');
  });

  test('词典未收录的词不动（如 petrichor）', () => {
    const plugin = makePlugin();
    plugin.dictionary = { entries: {} };
    plugin.data = { entries: { petrichor: { meaning: '雨后泥土的气息' } }, library: { words: [] } };
    assert.strictEqual(plugin.repairMissingPos(), false);
    assert.strictEqual(plugin.data.entries.petrichor.meaning, '雨后泥土的气息');
  });

  test('词典未加载时安全返回 false', () => {
    const plugin = makePlugin();
    plugin.dictionary = null;
    plugin.data = { entries: {}, library: { words: [] } };
    assert.strictEqual(plugin.repairMissingPos(), false);
  });

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });
