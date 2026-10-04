// 构建发布产物：社区商店只分发 main.js / manifest.json / styles.css 三个文件，
// 因此 content.js（起步词条模块）与 dictionary.json（内置词典）在构建时内嵌进 main.js。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const content = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
const dictionary = fs.readFileSync(path.join(__dirname, 'dictionary.json'), 'utf8');
JSON.parse(dictionary); // 词典必须先通过 JSON 校验才允许内嵌

const contentMarker = "require('./content')";
const dictionaryMarker = 'const EMBEDDED_DICTIONARY = null;';
if (source.split(contentMarker).length !== 2) throw Error('Expected exactly one local content import in main.js.');
if (source.split(dictionaryMarker).length !== 2) throw Error('Expected exactly one EMBEDDED_DICTIONARY placeholder in main.js.');

const bundled = source
  .replace(contentMarker, () => `(function(){ const module = { exports: {} };\n${content}\nreturn module.exports; })()`)
  .replace(dictionaryMarker, () => `const EMBEDDED_DICTIONARY = ${JSON.stringify(dictionary)};`);

fs.mkdirSync(path.join(__dirname, 'release'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'release', 'main.js'), bundled, 'utf8');
for (const name of ['manifest.json', 'styles.css']) fs.copyFileSync(path.join(__dirname, name), path.join(__dirname, 'release', name));
console.log('Built self-contained release/main.js (content module + dictionary embedded).');
