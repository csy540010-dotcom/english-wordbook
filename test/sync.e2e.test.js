// 实体级同步端到端测试：真实 HTTP 服务 + 两台"设备"（插件桩）。
// 运行：node test/sync.e2e.test.js
'use strict';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval };
const main = require('../main.js');
const serverMod = require('../sync/server.js');
const { runSync, syncRequest, localEntities } = main.testing;

// requestUrl 桩 → 真实 HTTP
globalThis.__requestUrl = params => new Promise((resolve, reject) => {
  const url = new URL(params.url);
  const req = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: params.method || 'GET', headers: params.headers || {} }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try { json = JSON.parse(text); } catch (_) { /* 保持 null */ }
      resolve({ status: res.statusCode, text, json });
    });
  });
  req.on('error', reject);
  if (params.body) req.write(params.body);
  req.end();
});

const DIR = '.obsidian/plugins/english-wordbook';

function makeAdapter() {
  const files = new Map();
  return {
    files,
    async read(pathname) { const value = files.get(pathname); if (value === undefined) throw new Error('not found'); return value; },
    async write(pathname, data) { files.set(pathname, String(data)); },
    async exists(pathname) { return files.has(pathname); },
    async list(pathname) { const prefix = pathname.endsWith('/') ? pathname : pathname + '/'; return { files: [...files.keys()].filter(f => f.startsWith(prefix)), folders: [] }; }
  };
}

function makePlugin(adapter, serverUrl, token) {
  const plugin = Object.create(main.prototype);
  plugin.manifest = { dir: DIR };
  plugin.app = { vault: { adapter } };
  plugin.saveTail = Promise.resolve();
  plugin.refreshBook = () => {};
  plugin.loadData = async () => { const raw = adapter.files.get(DIR + '/data.json'); return raw === undefined ? null : JSON.parse(raw); };
  plugin.saveData = async data => { adapter.files.set(DIR + '/data.json', JSON.stringify(data, null, 2)); };
  plugin.data = {
    cards: {}, entries: {}, exercises: {}, exerciseAttempts: [], quizArchive: {}, translations: {},
    library: { words: [], importedNotes: [], books: { personal: [] }, customBooks: [], selectedBook: 'personal' },
    sync: { serverUrl, token }
  };
  return plugin;
}

(async () => {
  console.log('实体级同步端到端测试');
  let passed = 0;
  const test = async (name, fn) => {
    try { await fn(); passed++; console.log('  ok - ' + name); }
    catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
  };

  serverMod.CONFIG.dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-sync-test-'));
  const server = serverMod.createServer({ tokens: ['test-token'] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;

  try {
    const adapterA = makeAdapter();
    const adapterB = makeAdapter();
    const deviceA = makePlugin(adapterA, base, 'test-token');
    const deviceB = makePlugin(adapterB, base, 'test-token');

    deviceA.data.library.words.push(
      { word: 'apple', phonetic: '/ˈæpl/', meaning: '苹果', favorites: [{ sentence: 'I eat an apple.', mode: 'free' }] },
      { word: 'table', phonetic: '/ˈteɪbl/', meaning: '桌子', favorites: [] }
    );
    deviceA.data.library.books.personal.push('apple', 'table');
    deviceA.data.entries.apple = { phonetic: '/ˈæpl/', meaning: '苹果', prompts: ['我每天吃一个苹果。', '苹果树很高。'] };
    deviceA.data.exerciseAttempts.push({ id: 'a1', score: 3 });

    await test('设备 A 首次同步：推送全部实体，无冲突', async () => {
      const result = await runSync(deviceA);
      assert.deepStrictEqual(result, { changed: 0 });
      assert.ok(deviceA.__syncState.cursor > 0, '游标应推进');
      const manifest = await syncRequest(deviceA, 'GET', '/sync/manifest?since=0');
      assert.ok(manifest.changed.some(item => item.id === 'word:apple'));
      assert.ok(manifest.changed.some(item => item.id === 'index'));
      assert.ok(manifest.changed.some(item => item.id === 'attempt:a1'));
    });

    await test('设备 B 拉取：获得单词、释义、练习与词书索引', async () => {
      const result = await runSync(deviceB);
      assert.ok(result.changed > 0);
      const apple = deviceB.data.library.words.find(card => card.word === 'apple');
      assert.ok(apple, '应拉取到 apple 卡片');
      assert.strictEqual(apple.favorites[0].sentence, 'I eat an apple.');
      assert.strictEqual(deviceB.data.entries.apple.meaning, '苹果');
      assert.deepStrictEqual(deviceB.data.library.books.personal, ['apple', 'table']);
      assert.ok(deviceB.data.exerciseAttempts.some(item => item.id === 'a1'));
    });

    await test('并发冲突：两台设备各加一句 → 双向合并后两边都齐全', async () => {
      const appleA = deviceA.data.library.words.find(card => card.word === 'apple');
      appleA.favorites.push({ sentence: '设备A加的句子', mode: 'free' });
      const appleB = deviceB.data.library.words.find(card => card.word === 'apple');
      appleB.favorites.push({ sentence: '设备B加的句子', mode: 'guided' });
      await runSync(deviceB); // B 先推（覆盖服务器为 B 版本）
      await runSync(deviceA); // A 的推送会 409 → 合并 B 版本后重试
      const sentencesA = appleA.favorites.map(item => item.sentence).sort();
      assert.deepStrictEqual(sentencesA, ['I eat an apple.', '设备A加的句子', '设备B加的句子'], 'A 应在合并后同时拥有三句');
      await runSync(deviceB); // B 拉取 A 的合并结果
      const sentencesB = deviceB.data.library.words.find(card => card.word === 'apple').favorites.map(item => item.sentence).sort();
      assert.deepStrictEqual(sentencesB, sentencesA, '两侧应收敛一致');
    });

    await test('错误令牌：401 给出明确提示', async () => {
      const stranger = makePlugin(makeAdapter(), base, 'wrong-token');
      await assert.rejects(() => runSync(stranger), /令牌不正确/);
    });

    await test('服务器离线：报错但不崩溃', async () => {
      const offline = makePlugin(makeAdapter(), 'http://127.0.0.1:1', 'test-token');
      await assert.rejects(() => runSync(offline));
    });

    await test('localEntities：实体划分覆盖各类数据', () => {
      const ids = localEntities(deviceA).map(item => item.id);
      for (const expect of ['word:apple', 'word:table', 'entry:apple', 'attempt:a1', 'index']) {
        assert.ok(ids.includes(expect), '缺少 ' + expect);
      }
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });
