// App 感界面逻辑测试（纯函数部分 + 样式存在性）。运行：node test/ui.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const main = require('../main.js');
const { catalogEntries } = main.testing;

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok - ' + name); }
  catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
}

(async () => {
  console.log('App 感界面逻辑测试');

  await test('catalogEntries：当前词书的单词与释义（含词典回退）', () => {
    const plugin = {
      libraryCards: () => [
        { word: 'apple', meaning: '苹果' },
        { word: 'petrichor', meaning: '' }
      ],
      cachedEntry: word => word === 'petrichor' ? { meaning: '雨后泥土香' } : null
    };
    const entries = catalogEntries(plugin);
    assert.deepStrictEqual(entries, [
      { word: 'apple', meaning: '苹果' },
      { word: 'petrichor', meaning: '雨后泥土香' }
    ]);
  });

  await test('catalogEntries：无词书时为空数组', () => {
    assert.deepStrictEqual(catalogEntries({ libraryCards: () => [] }), []);
  });

  await test('styles.css：包含启动页/底部导航/抽屉/沉浸模式样式与安全区适配', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
    for (const marker of ['.ew-splash', '.ew-app-nav', '.ew-sheet-scrim', 'body.ew-immersive', 'safe-area-inset-bottom', 'prefers-reduced-motion']) {
      assert.ok(css.includes(marker), 'styles.css 缺少 ' + marker);
    }
  });

  await test('styles.css：沉浸模式隐藏 Obsidian 外壳的关键元素', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
    for (const selector of ['.workspace-ribbon', '.mod-left-split', '.mod-right-split', '.workspace-tab-header-container', '.view-header', '.status-bar']) {
      assert.ok(css.includes('body.ew-immersive ' + selector), '沉浸模式应隐藏 ' + selector);
    }
  });

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });
