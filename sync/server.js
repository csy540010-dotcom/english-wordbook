#!/usr/bin/env node
// 英语单词书 · 实体级同步服务端（零依赖，Node 18+）
// 用法：node server.js  （首次运行生成 config.json，内含访问令牌）
// 建议放在反向代理（nginx/caddy）后启用 HTTPS；仅在局域网使用时可直接 http。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
  let config = null;
  try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) { /* 首次运行 */ }
  config = config || {};
  if (!config.port) config.port = 8899;
  if (!config.dataDir) config.dataDir = path.join(__dirname, 'data');
  if (!Array.isArray(config.tokens) || !config.tokens.length) config.tokens = [crypto.randomBytes(16).toString('hex')];
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

const CONFIG = loadConfig();

function tokenId(token) { return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16); }

function spaceDir(token) { return path.join(CONFIG.dataDir, 'spaces', tokenId(token)); }

function entityIdFile(dir, id) {
  const base = String(id).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0;
  return path.join(dir, 'entities', base + '-' + (hash >>> 0).toString(36) + '.json');
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2);
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }

// 每个令牌一个"空间"：实体常驻内存，写入时原子落盘。
const spaces = new Map();

function getSpace(token) {
  const key = tokenId(token);
  let space = spaces.get(key);
  if (space) return space;
  const dir = spaceDir(token);
  const meta = readJson(path.join(dir, 'meta.json'), { cursor: 0 });
  space = { dir, cursor: meta.cursor || 0, entities: new Map() };
  const entityDir = path.join(dir, 'entities');
  try {
    for (const file of fs.readdirSync(entityDir)) {
      if (!file.endsWith('.json')) continue;
      const entity = readJson(path.join(entityDir, file), null);
      if (entity && entity.id) space.entities.set(entity.id, entity);
    }
  } catch (_) { /* 空空间 */ }
  spaces.set(key, space);
  return space;
}

function persistEntity(space, entity) {
  atomicWrite(entityIdFile(space.dir, entity.id), JSON.stringify(entity));
  atomicWrite(path.join(space.dir, 'meta.json'), JSON.stringify({ cursor: space.cursor }));
}

function handle(space, method, pathname, query, body) {
  if (method === 'GET' && pathname === '/auth/ping') return { status: 200, json: { ok: true, cursor: space.cursor } };
  if (method === 'GET' && pathname === '/sync/manifest') {
    const since = Number(query.get('since') || 0) || 0;
    const changed = [...space.entities.values()].filter(entity => (entity.seq || 0) > since)
      .map(entity => ({ id: entity.id, rev: entity.rev, updatedAt: entity.updatedAt }));
    return { status: 200, json: { cursor: space.cursor, changed } };
  }
  const entityMatch = pathname.match(/^\/sync\/entity\/(.+)$/);
  if (entityMatch) {
    const id = decodeURIComponent(entityMatch[1]);
    if (method === 'GET') {
      const entity = space.entities.get(id);
      if (!entity) return { status: 404, json: { error: '实体不存在' } };
      return { status: 200, json: entity };
    }
    if (method === 'PUT') {
      if (!body || typeof body.data !== 'object' || body.data === null) return { status: 400, json: { error: '缺少 data' } };
      const current = space.entities.get(id);
      const baseRev = Number(body.baseRev || 0);
      if (current && baseRev < current.rev) return { status: 409, json: { error: '版本已过期，请合并后重试', entity: current } };
      const entity = { id, rev: current ? current.rev + 1 : 1, updatedAt: new Date().toISOString(), seq: ++space.cursor, data: body.data };
      space.entities.set(id, entity);
      persistEntity(space, entity);
      return { status: 200, json: { ok: true, rev: entity.rev, cursor: space.cursor } };
    }
  }
  return { status: 404, json: { error: '未知接口' } };
}

function createServer(options = {}) {
  const tokens = options.tokens || CONFIG.tokens;
  const server = http.createServer((req, res) => {
    const send = (status, json) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(json)); };
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || !tokens.includes(token)) return send(401, { error: '令牌无效' });
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > 5 * 1024 * 1024) { send(413, { error: '请求过大' }); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => {
      let body = null;
      if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return send(400, { error: 'JSON 无效' }); } }
      try { const result = handle(getSpace(token), req.method, url.pathname, url.searchParams, body); send(result.status, result.json); }
      catch (error) { send(500, { error: String(error.message || error) }); }
    });
  });
  return server;
}

if (require.main === module) {
  createServer().listen(CONFIG.port, () => {
    console.log('[english-wordbook-sync] 已启动: http://127.0.0.1:' + CONFIG.port);
    console.log('[english-wordbook-sync] 访问令牌（同时写入 config.json）:');
    for (const token of CONFIG.tokens) console.log('  ' + token);
    console.log('[english-wordbook-sync] 数据目录: ' + CONFIG.dataDir);
  });
}

module.exports = { createServer, loadConfig, getSpace, handle, CONFIG };
