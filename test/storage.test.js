// 分片存储（sharded-v1）逻辑测试。运行：node test/storage.test.js
'use strict';
const assert = require('assert');
const main = require('../main.js');
const { initShardStorage, saveShards, shardFileName, shardPaths, readShards } = main.testing;

const DIR = '.obsidian/plugins/english-wordbook';
const P = shardPaths({ manifest: { dir: DIR } });

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok - ' + name); }
  catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
}

function makeAdapter() {
  const files = new Map();
  return {
    files,
    async read(path) { const v = files.get(path); if (v === undefined) throw new Error('not found: ' + path); return v; },
    async write(path, data) { files.set(path, String(data)); },
    async exists(path) { return files.has(path); },
    async remove(path) { files.delete(path); },
    async list(path) {
      const prefix = path.endsWith('/') ? path : path + '/';
      return { files: [...files.keys()].filter(f => f.startsWith(prefix)), folders: [] };
    }
  };
}

function makePlugin(adapter) {
  const plugin = Object.create(main.prototype);
  plugin.manifest = { dir: DIR };
  plugin.app = { vault: { adapter } };
  plugin.saveTail = Promise.resolve(); // onload 中初始化，测试桩需手动设置
  plugin.loadData = async () => { const raw = adapter.files.get(DIR + '/data.json'); return raw === undefined ? null : JSON.parse(raw); };
  plugin.saveData = async data => { adapter.files.set(DIR + '/data.json', JSON.stringify(data, null, 2)); };
  return plugin;
}

function legacyDataJson() {
  return {
    cards: { 'note.md::apple': { reviews: { free: { requestId: 'r1', recordPath: '英语练习卡/学习记录/r1.json' } } } },
    entries: { apple: { phonetic: '/ˈæpl/', meaning: '苹果', prompts: ['我每天吃一个苹果。', '苹果树很高。'] } },
    exercises: {},
    exerciseAttempts: [{ id: 'a1', score: 2 }],
    quizArchive: { q1: { id: 'q1' } },
    translations: { 'apple::guided::句': { attempts: [] } },
    library: {
      words: [
        { word: 'apple', phonetic: '/ˈæpl/', meaning: '苹果', favorites: [{ sentence: 'I eat an apple.', mode: 'free' }] },
        { word: 'table', phonetic: '/ˈteɪbl/', meaning: '桌子', favorites: [] }
      ],
      importedNotes: ['n1.md'],
      books: { personal: ['apple', 'table'] },
      customBooks: [{ id: 'cb1', name: '我的生词' }],
      selectedBook: 'personal'
    },
    ai: { preset: 'siliconflow', baseUrl: 'https://api.siliconflow.cn/v1', apiKey: 'sk-x', model: 'Qwen/Qwen3-8B' },
    directoryPlacement: 'left'
  };
}

const wordFile = (adapter, word) => P.words + '/' + shardFileName(word) + '.json';

(async () => {
  console.log('分片存储逻辑测试');

  await test('旧版 data.json 缺少新字段（久未升级的手机端）→ 自动补默认结构，视图打开不崩溃', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify({ ai: { preset: 'custom', baseUrl: 'https://x/v1', apiKey: '', model: 'm' } }));
    const plugin = makePlugin(adapter);
    plugin.app.vault.getMarkdownFiles = () => [];
    const data = await initShardStorage(plugin);
    assert.deepStrictEqual(data.cards, {});
    assert.deepStrictEqual(data.entries, {});
    assert.ok(Array.isArray(data.exerciseAttempts));
    assert.strictEqual(data.library.selectedBook, 'personal');
    assert.ok(Array.isArray(data.library.words));
    assert.deepStrictEqual(data.library.books, {});
    assert.ok(Array.isArray(data.library.importedNotes));
    assert.ok(Array.isArray(data.library.customBooks));
    plugin.data = data;
    await plugin.importWordNotes(); // 视图打开的第一步，缺字段时会在此抛错
  });

  await test('首次启动迁移：拆分文件、备份、瘦身 data.json', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    const data = await initShardStorage(plugin);
    assert.strictEqual(data.library.words.length, 2);
    assert.strictEqual(data.library.books.personal.join(','), 'apple,table');
    assert.strictEqual(data.entries.apple.meaning, '苹果');
    assert.strictEqual(data.ai.model, 'Qwen/Qwen3-8B');
    const wordFiles = (await adapter.list(P.words)).files.filter(f => f.endsWith('.json'));
    assert.strictEqual(wordFiles.length, 2, '应有两个词条分片');
    for (const name of ['entries.json', 'cards.json', 'translations.json', 'exercises.json', 'exercise-attempts.json', 'quiz-archive.json', 'library-index.json']) {
      assert.ok(adapter.files.has(P.dir + '/' + name), '缺少 ' + name);
    }
    const slim = JSON.parse(adapter.files.get(DIR + '/data.json'));
    assert.strictEqual(slim.storage, 'sharded-v1');
    assert.ok(!slim.library && !slim.entries, 'data.json 不应再含学习数据');
    assert.strictEqual(slim.ai.preset, 'siliconflow', '设置应保留在 data.json');
    const backup = JSON.parse(adapter.files.get(DIR + '/data.pre-shard.json'));
    assert.ok(backup.library && backup.entries, '迁移前备份应包含完整旧数据');
  });

  await test('迁移幂等：重复初始化不丢不重', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    await initShardStorage(makePlugin(adapter));
    const data = await initShardStorage(makePlugin(adapter));
    assert.strictEqual(data.library.words.length, 2);
    assert.strictEqual(data.library.books.personal.length, 2);
    const wordFiles = (await adapter.list(P.words)).files.filter(f => f.endsWith('.json'));
    assert.strictEqual(wordFiles.length, 2);
  });

  await test('往返一致：改动 → persist → 重新加载可见', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    plugin.data.library.words[0].favorites.push({ sentence: 'An apple a day.', mode: 'free' });
    plugin.data.library.words.push({ word: 'petrichor', phonetic: '/ˈpetrɪkɔːr/', meaning: '雨后泥土香', favorites: [] });
    plugin.data.entries.petrichor = { phonetic: '/ˈpetrɪkɔːr/', meaning: '雨后泥土香', prompts: ['雨后的 petrichor 很好闻。', '我喜欢 petrichor。'] };
    plugin.persist();
    await plugin.saveTail;
    const reloaded = makePlugin(adapter);
    const data = await initShardStorage(reloaded);
    assert.strictEqual(data.library.words.length, 3);
    const apple = data.library.words.find(c => c.word === 'apple');
    assert.strictEqual(apple.favorites.length, 2);
    assert.strictEqual(data.entries.petrichor.meaning, '雨后泥土香');
  });

  await test('词条冲突：磁盘被其他设备更新 → 快照 + 并集合并，不丢任何一方', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    // 模拟另一台设备的修改同步下来：rev 抬高、在原有收藏上多加了一句
    const path = wordFile(adapter, 'apple');
    const disk = JSON.parse(await adapter.read(path));
    disk.rev = 5;
    disk.card.favorites = [...disk.card.favorites, { sentence: '另一台设备加的句子', mode: 'guided' }];
    disk.card.annotations = { s1: '别家的批注' };
    await adapter.write(path, JSON.stringify(disk));
    // 本机在旧状态（rev 1）上继续改同一词
    plugin.data.library.words[0].favorites.push({ sentence: '本机加的句子', mode: 'free' });
    plugin.persist();
    await plugin.saveTail;
    const conflicts = (await adapter.list(P.words)).files.filter(f => f.includes('.conflict-'));
    assert.strictEqual(conflicts.length, 1, '应留下冲突副本');
    const snapshot = JSON.parse(await adapter.read(conflicts[0]));
    assert.ok(snapshot.card.favorites.some(f => f.sentence.includes('另一台设备')), '冲突副本应保存磁盘旧版');
    const sentences = plugin.data.library.words[0].favorites.map(f => f.sentence).sort();
    assert.deepStrictEqual(sentences, ['I eat an apple.', '另一台设备加的句子', '本机加的句子']);
    assert.strictEqual(plugin.data.library.words[0].annotations.s1, '别家的批注');
    const written = JSON.parse(await adapter.read(path));
    assert.strictEqual(written.rev, 6, '新版本号应越过磁盘版本');
    const again = makePlugin(adapter);
    const data = await initShardStorage(again);
    assert.strictEqual(data.library.words.find(c => c.word === 'apple').favorites.length, 3, '重新加载后三方收藏都在');
  });

  await test('集合冲突（entries）：外部新增词条保留，本机修改不丢', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    const path = P.entries;
    const disk = JSON.parse(await adapter.read(path));
    disk.rev = 3;
    disk.entries.banana = { phonetic: '/bəˈnɑːnə/', meaning: '香蕉', prompts: ['a', 'b'] };
    await adapter.write(path, JSON.stringify(disk));
    plugin.data.entries.apple.meaning = '苹果（修改）';
    plugin.persist();
    await plugin.saveTail;
    const conflicts = (await adapter.list(P.dir)).files.filter(f => f.includes('entries.conflict-'));
    assert.strictEqual(conflicts.length, 1);
    const reloaded = makePlugin(adapter);
    const data = await initShardStorage(reloaded);
    assert.strictEqual(data.entries.banana.meaning, '香蕉');
    assert.strictEqual(data.entries.apple.meaning, '苹果（修改）');
  });

  await test('词书索引冲突：不同设备各自加词 → 并集', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    const disk = JSON.parse(await adapter.read(P.libraryIndex));
    disk.rev = 4;
    disk.books.personal = ['apple', 'table', 'grape'];
    disk.customBooks = [{ id: 'cb2', name: '别处的词书' }];
    await adapter.write(P.libraryIndex, JSON.stringify(disk));
    plugin.data.library.selectedBook = 'cb1';
    plugin.data.library.books.personal.push('kiwi');
    plugin.data.library.words.push({ word: 'kiwi', phonetic: '', meaning: '猕猴桃' });
    plugin.persist();
    await plugin.saveTail;
    const reloaded = makePlugin(adapter);
    const data = await initShardStorage(reloaded);
    assert.deepStrictEqual(data.library.books.personal, ['apple', 'table', 'kiwi', 'grape']);
    assert.strictEqual(data.library.customBooks.length, 2);
    assert.strictEqual(data.library.selectedBook, 'cb1', 'selectedBook 采用本机值');
  });

  await test('迁移中断恢复：data.json 是旧版全量、分片已存在 → 合并不丢', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const first = makePlugin(adapter);
    await initShardStorage(first);
    // 模拟迁移在新数据写入后、瘦身 data.json 前崩溃：恢复旧 data.json，并给分片补一个新词
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const extra = { rev: 2, updatedAt: 'x', word: 'melon', card: { word: 'melon', meaning: '瓜' } };
    await adapter.write(wordFile(adapter, 'melon'), JSON.stringify(extra));
    const data = await initShardStorage(makePlugin(adapter));
    assert.ok(data.library.words.some(c => c.word === 'melon'), '分片新词应保留');
    assert.ok(data.library.words.some(c => c.word === 'apple'), '旧词不丢');
    const slim = JSON.parse(adapter.files.get(DIR + '/data.json'));
    assert.strictEqual(slim.storage, 'sharded-v1', '重新完成瘦身');
  });

  await test('分片丢失恢复：有标记无分片 → 从 data.pre-shard.json 重建', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const first = makePlugin(adapter);
    await initShardStorage(first);
    for (const path of [...adapter.files.keys()]) if (path.startsWith(P.dir + '/data/')) adapter.files.delete(path);
    const plugin = makePlugin(adapter);
    const data = await initShardStorage(plugin);
    assert.strictEqual(data.library.words.length, 2, '从备份恢复完整数据');
    const wordFiles = (await adapter.list(P.words)).files.filter(f => f.endsWith('.json'));
    assert.strictEqual(wordFiles.length, 2, '分片已重建');
  });

  await test('分片被禁用时回退整文件保存', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    plugin.__shardDisabled = true;
    plugin.persist();
    await plugin.saveTail;
    const full = JSON.parse(adapter.files.get(DIR + '/data.json'));
    assert.ok(full.library && full.entries, '回退路径应写入完整数据');
  });

  await test('readShards：无分片目录时返回 null', async () => {
    const adapter = makeAdapter();
    const plugin = makePlugin(adapter);
    assert.strictEqual(await readShards(plugin), null);
  });

  await test('磁盘过期（rev 未超前）：内存为准，已删除的词不复活', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    await saveShards(plugin, plugin.data);
    // 模拟磁盘被回滚成旧快照（rev 未超前于内存）
    const stale = JSON.parse(adapter.files.get(P.libraryIndex));
    stale.rev = 1;
    adapter.files.set(P.libraryIndex, JSON.stringify(stale));
    // 内存中删除一个词后再保存：应以内存的删除为准
    plugin.data.library.books.personal = plugin.data.library.books.personal.filter(w => w !== 'table');
    await saveShards(plugin, plugin.data);
    const disk = JSON.parse(adapter.files.get(P.libraryIndex));
    assert.ok(!disk.books.personal.includes('table'), '已删除的词不应从过期磁盘复活');
    assert.ok(disk.books.personal.includes('apple'), '未删除的词保留');
  });

  await test('磁盘更新（rev 超前）：另一台设备的改动仍并入', async () => {
    const adapter = makeAdapter();
    adapter.files.set(DIR + '/data.json', JSON.stringify(legacyDataJson()));
    const plugin = makePlugin(adapter);
    plugin.data = await initShardStorage(plugin);
    await saveShards(plugin, plugin.data);
    // 模拟另一台设备写入了更高版本（personal 词书新增一个词）
    const newer = JSON.parse(adapter.files.get(P.libraryIndex));
    newer.rev = (newer.rev || 1) + 5;
    newer.books.personal = [...newer.books.personal, 'brandnew'];
    adapter.files.set(P.libraryIndex, JSON.stringify(newer));
    // 本机改动一个无关字段后保存：应并入新设备的改动
    plugin.data.library.selectedBook = 'personal';
    await saveShards(plugin, plugin.data);
    const disk = JSON.parse(adapter.files.get(P.libraryIndex));
    assert.ok(disk.books.personal.includes('brandnew'), '新设备的词应保留');
  });

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });
