'use strict';
const fs = require('node:fs');
const path = require('node:path');
const main = require('./main.js');
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

const DIR = 'D:/YYos(ob)/YYos/.obsidian/plugins/english-wordbook';
const adapter = {
  async read(p) { return fs.readFileSync(p, 'utf8'); },
  async write() { throw new Error('read-only diagnostic'); },
  async exists(p) { return fs.existsSync(p); },
  async mkdir() { throw new Error('read-only'); },
  async list(dirP) {
    const out = { files: [], folders: [] };
    try { for (const f of fs.readdirSync(dirP)) { const full = path.join(dirP, f); if (fs.statSync(full).isFile()) out.files.push(full.replace(/\\/g, '/')); else out.folders.push(full); } } catch (_) {}
    return out;
  }
};
const plugin = { manifest: { dir: DIR.replace(/\//g, '\\') }, app: { vault: { adapter } } };

(async () => {
  const loaded = await main.testing.readShards(plugin);
  if (!loaded) { console.log('readShards: null（无分片）'); return; }
  const data = loaded.data;
  console.log('=== 分片加载后的词书 ===');
  for (const [id, words] of Object.entries(data.library.books || {})) console.log('  ' + id + ': ' + words.join(', '));
  console.log('  selectedBook: ' + data.library.selectedBook);
  console.log('  library.words: ' + data.library.words.length + ' 张卡');
  console.log('  library.words 词表: ' + data.library.words.map(w => w.word).join(', '));
  console.log('  review 队列: ' + Object.keys(data.review || {}).length + ' 条');
  for (const [k, v] of Object.entries(data.review || {})) console.log('    ' + k + ' due=' + v.due);
  console.log('  state.revs: ' + JSON.stringify(loaded.state.revs));
  // data.json（keep 部分）
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'data.json'), 'utf8'));
  console.log('=== data.json ===');
  console.log('  storage: ' + raw.storage + ' | ai 已配置: ' + !!(raw.ai && raw.ai.baseUrl));
  console.log('  dailyStats: ' + JSON.stringify(raw.dailyStats || {}));
})().catch(e => { console.error('DIAG ERROR: ' + (e && e.stack || e)); process.exit(1); });
