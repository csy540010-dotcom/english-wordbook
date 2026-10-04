// Logic tests for the BYOK direct-connection layer (v0.18.0).
// Run: node test/byok.test.js
'use strict';
const assert = require('assert');
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto; // Obsidian 环境自带，Node 需补齐
const main = require('../main.js');
const { aiSettings, aiConfigured, chatCompletion, getAiTab, readTagged, AI_PRESETS } = main.testing;

const originalRequestUrl = globalThis.__requestUrl;
function stubRequestUrl(impl) { globalThis.__requestUrl = impl; }
function resetNotices() { globalThis.__notices = []; }
function notices() { return globalThis.__notices || []; }
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval };

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok - ' + name); }
  catch (error) { console.error('  FAIL - ' + name + '\n    ' + (error && error.stack || error)); process.exitCode = 1; }
  finally { resetNotices(); stubRequestUrl(originalRequestUrl); }
}

function chatResponse(content, status = 200) {
  return { status, text: JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), json: { choices: [{ message: { role: 'assistant', content } }] } };
}

(async () => {
  console.log('BYOK 直连逻辑测试');

  await test('aiSettings 读取并规范化 baseUrl（去尾部斜杠）', () => {
    const settings = aiSettings({ data: { ai: { baseUrl: 'https://api.deepseek.com/v1///', model: ' deepseek-chat ' } } });
    assert.strictEqual(settings.baseUrl, 'https://api.deepseek.com/v1');
    assert.strictEqual(settings.model, 'deepseek-chat');
  });

  await test('aiConfigured：地址+模型齐全才算配置完成', () => {
    assert.strictEqual(aiConfigured({ data: { ai: { baseUrl: 'https://x/v1', model: 'm', apiKey: 'k' } } }), true);
    assert.strictEqual(aiConfigured({ data: { ai: { baseUrl: '', model: 'm' } } }), false);
    assert.strictEqual(aiConfigured({ data: {} }), false);
  });

  await test('chatCompletion 成功：返回模型文本', async () => {
    let captured = null;
    stubRequestUrl(async params => {
      captured = params;
      return chatResponse('  连接成功  ');
    });
    const plugin = { data: { ai: { baseUrl: 'https://api.deepseek.com/v1/', apiKey: 'sk-test', model: 'deepseek-chat' } } };
    const text = await chatCompletion(plugin, '你好');
    assert.strictEqual(text, '连接成功');
    assert.strictEqual(captured.url, 'https://api.deepseek.com/v1/chat/completions');
    assert.strictEqual(captured.method, 'POST');
    assert.strictEqual(captured.headers.Authorization, 'Bearer sk-test');
    const body = JSON.parse(captured.body);
    assert.strictEqual(body.model, 'deepseek-chat');
    assert.strictEqual(body.messages[0].content, '你好');
    assert.strictEqual(body.stream, false);
  });

  await test('chatCompletion 无 Key 时省略 Authorization 头', async () => {
    let captured = null;
    stubRequestUrl(async params => { captured = params; return chatResponse('ok'); });
    const plugin = { data: { ai: { baseUrl: 'https://localhost:11434/v1', model: 'llama3' } } };
    await chatCompletion(plugin, 'hi');
    assert.strictEqual(captured.headers.Authorization, undefined);
  });

  await test('chatCompletion 401：抛出带状态码和厂商错误信息', async () => {
    stubRequestUrl(async () => ({ status: 401, text: '{"error":{"message":"Invalid API key"}}', json: { error: { message: 'Invalid API key' } } }));
    const plugin = { data: { ai: { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'bad', model: 'deepseek-chat' } } };
    await assert.rejects(() => chatCompletion(plugin, 'hi'), /AI 接口返回 401：Invalid API key/);
  });

  await test('chatCompletion 未配置时给出设置引导', async () => {
    await assert.rejects(() => chatCompletion({ data: {} }, 'hi'), /设置 → 英语单词书/);
  });

  await test('getAiTab.sendMessage：推送 assistant 消息，readTagged 能取回 JSON', async () => {
    stubRequestUrl(async params => {
      const prompt = JSON.parse(params.body).messages[0].content;
      const id = prompt.match(/<wordbook-data:([^>]+)>/)[1];
      const payload = { phonetic: '/ɡʊd/', meaning: '好的', prompts: ['今天天气很好。', '他是个好学生。'] };
      return chatResponse(`<wordbook-data:${id}>${JSON.stringify(payload)}</wordbook-data:${id}>`);
    });
    const plugin = { data: { ai: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } } };
    const tab = getAiTab(plugin);
    assert.ok(tab, 'BYOK 配置后应返回直连 tab');
    const oldIds = new Set(tab.state.messages.map(m => m.id));
    const id = 'test-' + randomId();
    await tab.controllers.inputController.sendMessage({ content: `任务。仅输出 <wordbook-data:${id}>有效 JSON</wordbook-data:${id}>。` });
    const value = readTagged(tab.state.messages, id, oldIds, 'wordbook-data');
    assert.strictEqual(value.meaning, '好的');
  });

  await test('getAiTab 并发锁：上一项任务未结束时拒绝新任务', async () => {
    let calls = 0;
    let release;
    stubRequestUrl(() => {
      calls++;
      if (calls === 1) return new Promise(resolve => { release = () => resolve(chatResponse('done')); });
      return Promise.resolve(chatResponse('done-' + calls));
    });
    const plugin = { data: { ai: { baseUrl: 'https://x/v1', model: 'm' } } };
    const tab = getAiTab(plugin);
    const first = tab.controllers.inputController.sendMessage({ content: 'a' });
    await assert.rejects(() => tab.controllers.inputController.sendMessage({ content: 'b' }), /正在处理/);
    release();
    await first;
    assert.strictEqual(tab.state.isStreaming, false, '结束后应释放锁');
    await tab.controllers.inputController.sendMessage({ content: 'c' });
  });

  await test('ensureBridge：BYOK 优先，返回直连 tab', async () => {
    stubRequestUrl(async () => chatResponse('ok'));
    const proto = main.prototype;
    const plugin = Object.create(proto);
    plugin.data = { ai: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } };
    const { tab } = await plugin.ensureBridge();
    assert.strictEqual(tab, plugin.__byokTab);
  });

  await test('ensureBridge：BYOK 配置不完整时给出明确报错', async () => {
    const plugin = Object.create(main.prototype);
    plugin.data = { ai: { baseUrl: '', apiKey: 'sk-something', model: '' } };
    await assert.rejects(() => plugin.ensureBridge(), /配置不完整/);
  });

  await test('ensureBridge：未配置 BYOK 时提示去设置，不再回退 Copilot', async () => {
    const plugin = Object.create(main.prototype);
    plugin.data = {};
    plugin.app = { plugins: { plugins: { copilot: { chainOwner: { getCurrentChainManager: () => ({ chatModelManager: { getChatModel: () => ({ invoke: async () => 'x' }) } }) } } } } };
    await assert.rejects(() => plugin.ensureBridge(), /尚未配置 AI/);
  });

  await test('requestJSON 端到端：直连 tab → 轮询 → 返回带标记 JSON', async () => {
    stubRequestUrl(async params => {
      const prompt = JSON.parse(params.body).messages[0].content;
      const match = prompt.match(/<wordbook-data:([^>]+)>/);
      const payload = { phonetic: '/teɪbl/', meaning: '桌子', prompts: ['书在桌子上。', '我们围坐在桌旁。'] };
      return chatResponse(`<wordbook-data:${match[1]}>${JSON.stringify(payload)}</wordbook-data:${match[1]}>`);
    });
    const plugin = Object.create(main.prototype);
    plugin.data = { ai: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } };
    plugin.unloaded = false;
    plugin.textBusy = false;
    plugin.dispatching = false;
    plugin.inFlight = new Set();
    plugin.auxStops = new Set();
    const value = await plugin.requestJSON('entry', '为英语学习词条提供音标等。目标词：table');
    assert.deepStrictEqual(value, { phonetic: '/teɪbl/', meaning: '桌子', prompts: ['书在桌子上。', '我们围坐在桌旁。'] });
    assert.strictEqual(plugin.textBusy, false, '结束后 textBusy 应复位');
  });

  await test('WordbookSettingTab.display：渲染全部设置项', () => {
    const { WordbookSettingTab } = main.testing;
    const plugin = { data: { ai: { preset: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' } }, persist: async () => {} };
    const tab = new WordbookSettingTab({}, plugin);
    tab.display();
    const texts = tab.containerEl.children.filter(c => c.text);
    assert.ok(texts.some(c => c.text === 'AI 接口（自带 Key 直连）'), '应渲染标题');
  });

  await test('AI_PRESETS：四家预设均为 OpenAI 兼容路径', () => {
    for (const [id, preset] of Object.entries(AI_PRESETS)) {
      if (id === 'custom') continue;
      assert.ok(preset.baseUrl.startsWith('https://'), id + ' 应为 https');
      assert.ok(preset.model.length > 0, id + ' 应有默认模型');
    }
  });

  await test('AI_PRESETS：硅基流动预设指向 Qwen/Qwen3-8B', () => {
    assert.strictEqual(AI_PRESETS.siliconflow.baseUrl, 'https://api.siliconflow.cn/v1');
    assert.strictEqual(AI_PRESETS.siliconflow.model, 'Qwen/Qwen3-8B');
  });

  await test('chatCompletion：Qwen3 自动关闭思考模式，其他模型不带该参数', async () => {
    const bodies = [];
    stubRequestUrl(async params => { bodies.push(JSON.parse(params.body)); return chatResponse('ok'); });
    await chatCompletion({ data: { ai: { baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3-8B' } } }, 'hi');
    assert.strictEqual(bodies[0].enable_thinking, false);
    await chatCompletion({ data: { ai: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } } }, 'hi');
    assert.strictEqual('enable_thinking' in bodies[1], false);
  });

  await test('chatCompletion：剥离正文中的 <think> 块', async () => {
    stubRequestUrl(async () => chatResponse('<think>推理过程…</think>最终答案'));
    const text = await chatCompletion({ data: { ai: { baseUrl: 'https://x/v1', model: 'm' } } }, 'hi');
    assert.strictEqual(text, '最终答案');
  });

  console.log(process.exitCode ? '存在失败用例' : `全部通过：${passed} 项`);
})().catch(error => { console.error(error); process.exit(1); });

function aiMessageTextSafe(message) {
  if (typeof message === 'string') return message;
  if (typeof message?.content === 'string') return message.content;
  return '';
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
