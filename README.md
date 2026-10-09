<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno</h1>

<p align="center">
  Command Bar & New Tab
  <br />
  Open the command bar from any page, search faster, jump to URLs, switch tabs, and upgrade the new tab experience.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-MV3-111827?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Browser-Chromium-2563eb?style=flat-square" alt="Chromium" />
  <img src="https://img.shields.io/badge/Language-JavaScript-f59e0b?style=flat-square" alt="JavaScript" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0" />
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

Lumno is a Manifest V3 extension for Chromium browsers. It combines a focused browser command bar with a minimal new tab page, so you can search bookmarks, history, top sites, open tabs, site-search shortcuts, and AI assistants from one place.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="./assets/images/readme/chrome-web-store-large-bordered.png" alt="Get it from Chrome Web Store" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="./assets/images/readme/microsoft-edge-addons-badge.png" alt="Get it from Microsoft Edge" width="200" />
  </a>
</p>

<p align="center">Current version: <code>0.9.60</code></p>

<img width="1200" height="480" alt="Lumno command bar preview" src="./assets/images/readme/banner.webp" decoding="async" />

## Highlights

- Focused command bar: open an overlay on injectable pages to visit URLs, search keywords, switch open tabs, open browser internal pages, and jump into Lumno settings.
- Smart search results: combines bookmarks, history, top sites, browser suggestions, and open tabs, with source filters, first-result priority, selection-based ranking, pinyin matching, and blacklist filtering.
- Site search and AI search: ships with shortcuts for YouTube, Bilibili, GitHub, Google, Bing, Baidu, Zhihu, Douban, Juejin, Taobao, X, Reddit, Wikipedia, and more. AI entries include ChatGPT, Gemini, Doubao, Qianwen, Yuanbao, MiniMax, DeepSeek, and Kimi. Custom templates and aliases are supported.
- Aggregate search: combine 2–10 built-in or custom search sources into one scope and run the same query across multiple tabs. A General setting controls whether results are placed in a tab group named after the query.
- New tab page: includes a search box, recent/most-visited site cards, bookmark grids and cascading folder menus, bookmark paging, pinned/hidden recent sites, feedback links, and adjustable content width.
- Appearance and wallpapers: supports system/light/dark themes, global or new-tab-only theme scope, built-in wallpapers, local wallpaper import, overlay opacity, grain/halftone/dither/ASCII filters, search-box width, and Lumno wordmark visibility.
- Web Clip PiP: on supported HTTPS top-level pages, select part of a page and float it in a Document Picture-in-Picture window for reference and comparison.
- Auto video Picture-in-Picture: when you switch tabs while video is playing, Lumno attempts automatic video PiP on sites such as YouTube, Bilibili, Youku, Tencent Video, Douyin, TikTok, Netflix, Vimeo, Prime Video, Disney+, and Twitch.
- Browser enhancements: restore pinned web tabs after restart, fall back from restricted pages to the new tab page, copy the current page URL, and open extension shortcut/details pages.
- Localization: the extension UI supports Simplified Chinese, Traditional Chinese, English, Japanese, and browser-language mode. This README supports Simplified Chinese, English, and Japanese switching.

## Screenshots
<p align="center">
  <img src="./assets/images/readme/preview-newtab.webp" alt="Lumno new tab preview" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="./assets/images/readme/preview-command-bar.webp" alt="Lumno command bar preview" width="100%" loading="lazy" decoding="async" />
</p>

## Shortcuts

| Action | Default shortcut |
| --- | --- |
| Open the command bar | `Cmd+Shift+K` / `Ctrl+Shift+K` |
| Open the command bar with the current page URL | `Cmd+Shift+L` / `Ctrl+Shift+L` |
| Copy the current page URL | `Cmd+Shift+C` / `Ctrl+Shift+C` |

Browsers may reserve or limit extension shortcuts. Change them at `chrome://extensions/shortcuts`, `edge://extensions/shortcuts`, or the equivalent shortcuts page in your browser.

## Installation

Install from the Chrome Web Store: [Install Lumno on Chrome Web Store](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao?utm_source=item-share-cb)

For manual installation:

1. Clone or download this repository.
2. Open `chrome://extensions/`, or the equivalent extension management page in Edge, Brave, Vivaldi, Opera, or another Chromium browser.
3. Enable Developer mode.
4. Choose "Load unpacked" and select the repository root.
5. Optional: open Lumno settings to configure language, theme, new tab content, site search, blacklist rules, PiP, and shortcut behavior.

To use the command bar on local HTML, PDF, or `file://` pages, enable "Allow access to file URLs" on the extension details page.

## WebDAV sync

WebDAV is a Beta feature under **Settings → Account & sync**. Add a connection with the HTTPS endpoint, directory, username and app password, then choose **Save and turn on sync**. It runs alongside the existing Chrome sync and adds custom shortcut icons and uploaded wallpapers; images stay out of Chrome Sync. Connection details are saved only on each device.

Existing server data requires an explicit initial-version choice. Later conflicts let you choose a version for conflicting content while merging other changes, with backups before replacement. The UI shows the last successful sync time. Turning WebDAV off keeps Chrome sync running. See [WebDAV sync details](docs/webdav-sync.md) for behavior and server requirements.

## Development

Development and CI use Node.js 20. If you use `nvm`, run `nvm use` to select the version declared in `.nvmrc`.

The React pages must be built before Chrome can load their generated assets. Before loading the development extension for the first time, and after editing `react-src/`, run:

```bash
npm ci
npm run build:react
```

Then keep Developer mode enabled in `chrome://extensions/` and load the repository root as an unpacked extension. After generating new assets or changing background scripts or `manifest.json`, click Reload on the extensions page. Development installs do not force a second refresh when the Chrome profile starts, avoiding interruption of the startup New Tab override.

Before committing, run:

```bash
npm run verify
npm run audit:i18n
npm run audit:style
npm run package:store
```

Common targeted tests:

```bash
npm run test:settings
npm run test:search
npm run test:site-search-store
npm run test:message-router
npm run test:newtab-layout
npm run test:onboarding-content
```

`npm run package:store` reads the version from `manifest.json` and creates `dist/lumno-store-v<version>.zip`. It requires `zip` and `zipinfo` to be available on the system.

## Project Structure

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 configuration, permissions, commands, content scripts, and new tab override |
| `src/background/` | Service worker, command routing, search data, site/AI search, PiP ownership, pinned-tab recovery |
| `src/newtab/` | New tab UI, search, recent sites, bookmarks, wallpapers, feedback, and page notices |
| `src/overlay/` | In-page command bar overlay, suggestion list, theme/language sync, and site fixes |
| `src/content/` | Page hotkey listener, Web Clip PiP, and auto video PiP |
| `src/options/` | Extension settings page |
| `src/onboarding/` | Install and update onboarding |
| `src/shared/` | Shared settings, search, favicon, menu, tooltip, and URL guard modules |
| `_locales/` | Extension UI copy |
| `assets/data/` | Built-in site-search and browser shortcut data |
| `assets/wallpapers/` | Built-in new tab wallpapers and thumbnails |
| `scripts/` | Checks, audits, packaging, and regression tests |

## Credits

- Japanese localization: thanks to [Humi](https://github.com/Hum1Tab) for Japanese translation and review.
- macOS `Ctrl+N` / `Ctrl+P` suggestion navigation experiment: based on a contribution by [wanghanzhen](https://github.com/wanghanzhen) in [PR #38](https://github.com/kubai087/lumno-extension/pull/38).
- Bundled icon set: [Remix Icon](https://remixicon.com/)
- Bundled typefaces: Open Sans; [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) (SIL OFL 1.1, subset for the daily quote)

## License

This project is licensed under [GPL-3.0](LICENSE).
