# English Wordbook (英语单词书)

An Obsidian plugin for English learning: an offline ~13k-word dictionary, CET-4/6 wordbooks, AI-powered sentence grading and long-sentence translation practice — using your own OpenAI-compatible API key. All data stays in your vault.

## Features

- **Offline dictionary**: ~13k entries (CET-4/6, TOEFL, IELTS, GRE vocabulary) with instant phonetics and definitions — works fully offline
- **CET-4/6 wordbooks**: 4,544 CET-4 words and 3,991 CET-6 words, plus custom wordbooks
- **Sentence grading**: write your own sentence or use guided Chinese prompts; the AI returns the original text, why it is wrong, and a suggested fix
- **Long-sentence translation**: English-to-Chinese drills with paraphrase-tolerant grading, reference translations, and structure analysis
- **Favorites & annotations**: sentence favorites, personal notes, highlights, text styling, undo/redo
- **App-like UI**: splash screen, mobile bottom navigation with drawers, immersive mode
- **Multi-device**: sharded storage with conflict merging — works with file sync or the built-in sync server

## Installation

- **Community plugins**: Settings → Community plugins → Browse → search "English Wordbook"
- **Manual**: download `main.js`, `manifest.json`, `styles.css` from [Releases](../../releases) into `<vault>/.obsidian/plugins/english-wordbook/`
- **BRAT**: add this repository in BRAT

## AI configuration (bring your own key)

Settings → English Wordbook → AI: choose a preset (Zhipu GLM, DeepSeek, Qwen, Moonshot Kimi, SiliconFlow, or any OpenAI-compatible endpoint), enter your API key and model name, then run "Test connection". Dictionary lookups and guided prompts work offline; grading features need the API configuration. Each device configures its own key.

## Privacy

No telemetry, no ads, no tracking. The author runs no servers that collect user data. Network requests go (1) directly to the AI provider you configure with your own API key — only the current word/sentence being practiced is sent — and (2) optionally to a self-hosted sync server you configure (learning data only). Your API key is stored in the plugin's `data.json` inside your vault.

## Development

- `npm run test` — logic tests (BYOK, sharded storage, UI, sync end-to-end); no Obsidian installation required
- `npm run build` — builds the self-contained `release/main.js` (content module and dictionary embedded)
- Releases: bump the version in `manifest.json` / `package.json` / `versions.json`, push a tag, and GitHub Actions publishes the release with the three plugin files and build provenance attestations

## Documentation in Chinese / 中文文档

See [README.zh-CN.md](./README.zh-CN.md) for the full Chinese documentation.
