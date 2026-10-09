<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno: Command Bar & New Tab for Chrome</h1>

<p align="center">
  A free, open-source, Spotlight-style command bar and customizable new tab page for Chrome, Edge, Brave, Arc and other Chromium browsers, with a build for Firefox, Zen and other Firefox-based browsers.
  <br />
  Search open tabs, bookmarks and history, jump to any URL, and launch site or AI search from one keyboard shortcut.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/users/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=Chrome%20users&color=2563eb" alt="Chrome Web Store users" /></a>
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/rating/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=rating&color=f59e0b" alt="Chrome Web Store rating" /></a>
  <a href="https://github.com/kubai087/lumno-extension/stargazers"><img src="https://img.shields.io/github/stars/kubai087/lumno-extension?style=flat-square&color=111827" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/Manifest-V3-111827?style=flat-square" alt="Manifest V3" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0 license" /></a>
</p>

<p align="center">
  <a href="https://lumno.kubai.design/">Website</a> ·
  <a href="#installation">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="CHANGELOG.md">Changelog</a>
  <br />
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

**Lumno** is a Manifest V3 browser extension that brings a keyboard-first **command palette** (like macOS Spotlight, Raycast or the Arc browser command bar) to every web page, and replaces the default new tab with a fast, minimal **new tab page**. Press `Cmd+Shift+K` / `Ctrl+Shift+K` to search open tabs, bookmarks, browsing history and top sites, open a URL, switch tabs, or send a query to Google, YouTube, GitHub, ChatGPT, Gemini, DeepSeek and more. No account required, and your browsing data stays in your browser.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="./assets/images/readme/chrome-web-store-large-bordered.png" alt="Get Lumno from the Chrome Web Store" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="./assets/images/readme/microsoft-edge-addons-badge.png" alt="Get Lumno from Microsoft Edge Add-ons" width="200" />
  </a>
</p>

<p align="center">Current version: <code>0.9.61</code></p>

<img width="1200" height="480" alt="Lumno command bar for Chrome: search tabs, bookmarks and history from any page" src="./assets/images/readme/banner.webp" decoding="async" />

## Features

### Spotlight-style command bar for any web page

Open a floating command bar on top of the current page to visit URLs, search keywords, switch to an open tab, open browser internal pages such as `chrome://settings`, or jump into Lumno settings, all without touching the mouse.

### Search tabs, bookmarks and history in one place

Results combine bookmarks, browsing history, top sites, browser suggestions and open tabs. Filter by source, prioritize the first result, learn from what you pick, match Chinese with pinyin, and hide sites with blacklist rules. Choose whether results open in the current tab, to its left or right, or at the end of the tab strip.

### Site search and AI search shortcuts

Type a prefix to search inside a site: YouTube, Bilibili, GitHub, Google, Bing, Baidu, Zhihu, Douban, Juejin, Taobao, X, Reddit, Wikipedia and more. Ask AI assistants directly, including ChatGPT, Gemini, DeepSeek, Kimi, Doubao, Qianwen, Yuanbao and MiniMax. Add your own search templates and aliases.

### Aggregate search across multiple engines

Combine 2–10 built-in or custom search sources into one scope and run the same query in several tabs at once. Results can be grouped into a tab group named "Aggregate name: query".

### Recent tab switcher

Press `Alt+Q` to open a keyboard tab switcher and jump between recently used tabs, similar to `Alt+Tab` for your browser.

### AI actions for selected text

Select text on any page to answer, translate, explain, summarize, research or calculate it with your preferred AI provider. Results open in a new tab, optionally in the background.

### Customizable new tab page

A clean new tab replacement with a search box, recent and most-visited site shortcuts, bookmark grids with cascading folder menus, bookmark paging and custom folder colors. Drag items between shortcuts and bookmarks, pin or hide recent sites, track the latest episode or chapter of a show or novel with progress cards, show a daily quote (Chinese interface), adjust content width, or type `/zen` for a distraction-free Zen mode.

### Wallpapers and themes

System, light and dark themes, applied globally or only to the new tab page. Pick built-in wallpapers, the Bing daily wallpaper, curated photos and open-access artwork, or your own image file or image URL. Fine-tune overlay opacity, grain, halftone, dither and ASCII filters, search-box width and the Lumno wordmark.

### Picture-in-Picture: Web Clip and auto video PiP

- **Web Clip PiP**: select part of any supported HTTPS page and float it in a Document Picture-in-Picture window for reference or side-by-side comparison.
- **Auto video PiP**: when you switch away from a playing video, Lumno tries to enter Picture-in-Picture automatically on YouTube, Bilibili, Netflix, Twitch, Vimeo, Prime Video, Disney+, TikTok, Douyin, Youku, Tencent Video and more.

### Sync with Chrome or your own WebDAV server

Settings sync through Chrome's built-in sync by default. Optional [WebDAV sync](#webdav-sync) (Beta) also carries custom shortcut icons and uploaded wallpapers, and works with Nutstore (Jianguoyun) and self-hosted servers.

### Browser helpers and languages

Restore pinned tabs after a restart, fall back from restricted pages to the new tab page, copy the current page URL with one shortcut, and open extension shortcut or details pages. The interface is available in English, Simplified Chinese, Traditional Chinese and Japanese, or follows your browser language.

## Screenshots

<p align="center">
  <img src="./assets/images/readme/preview-newtab.webp" alt="Lumno custom new tab page with wallpaper, shortcuts and bookmarks" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="./assets/images/readme/preview-command-bar.webp" alt="Lumno command palette searching open tabs, bookmarks and history" width="100%" loading="lazy" decoding="async" />
</p>

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open the command bar | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| Open the command bar with the current page URL | `Cmd+Shift+L` | `Ctrl+Shift+L` |
| Copy the current page URL | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| Open the recent tab switcher | `Alt+Q` | `Alt+Q` |

Browsers may reserve or limit extension shortcuts. Change them at `chrome://extensions/shortcuts`, `edge://extensions/shortcuts`, or the equivalent shortcuts page in your browser.

Firefox already uses `Cmd+Shift+K` / `Ctrl+Shift+K` and similar keys, so the Firefox build defaults to `Ctrl+Shift+K/L/C` on macOS and `Alt+K/L/C` on Windows and Linux; `Alt+Q` is unchanged. Change them in the Add-ons Manager under the gear menu → **Manage Extension Shortcuts**.

## Installation

| Browser | Install |
| --- | --- |
| Google Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Microsoft Edge | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc) |
| Brave, Arc, Vivaldi, Opera and other Chromium browsers | [Chrome Web Store](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Firefox 140+, Zen, LibreWolf, Floorp and other Firefox-based browsers | Not yet listed on Firefox Add-ons; build it from source (see [Development](#development)) |

To install from source:

1. Clone or download this repository.
2. Run `npm ci` and `npm run build:react` (see [Development](#development)).
3. Open `chrome://extensions/`, or the extension management page of your Chromium browser, and enable Developer mode.
4. Choose "Load unpacked" and select the repository root.
5. Optional: open Lumno settings to configure language, theme, new tab content, site search, blacklist rules, PiP and shortcut behavior.

To use the command bar on local HTML, PDF or `file://` pages, enable "Allow access to file URLs" on the extension details page.

## Browser compatibility

Lumno is built for Chromium browsers and also ships a Firefox build. Browsers built on Firefox, such as Zen, LibreWolf, Floorp and Waterfox, use the Firefox build and need a Firefox 140 or later engine. Safari is not supported.

**Firefox and Firefox-based browsers.** Firefox's extension APIs differ from Chromium's in a few places:

| Feature | In Firefox | Reason |
| --- | --- | --- |
| Auto video Picture-in-Picture | Unavailable; shown disabled in settings with the reason | Firefox does not let extensions start Picture-in-Picture for page videos |
| Web Clip | Unavailable; shown disabled in settings with the reason | It needs Document Picture-in-Picture, which Firefox does not support |
| Bookmark manager button on New Tab | Hidden | Extensions cannot open Firefox's Library window |
| Opening `about:` pages (such as `about:config`) from shortcuts or the command bar | Unavailable | Firefox does not let extensions open its privileged pages |
| Command bar on `about:` pages and addons.mozilla.org | Unavailable | Firefox blocks extension scripts there; the shortcut follows the restricted-page setting |
| Command bar on local `file://` pages | Unavailable | Firefox has no setting that grants extensions access to file URLs |
| Site icons | Works differently | Firefox has no icon endpoint for extensions. Lumno reads Firefox's own icon cache (open tabs and top sites) and then, if enabled, the online icon service; a site you have never visited may show a placeholder until you visit it |
| Tab switcher on `about:` pages | Works differently | Shows the browser's logo instead of a page preview, because Firefox only returns a blurred capture of those pages |
| New Tab search box focus | Works differently | Firefox focuses the address bar on new tabs; with auto focus on, Lumno reopens the tab so focus lands in its search box |
| "Open shortcut settings" | Works differently | Opens the Add-ons Manager; choose **Manage Extension Shortcuts** from the gear menu |
| Rating prompts and review links | Hidden | Until Lumno is listed on Firefox Add-ons |
| Settings sync | Works differently | Uses Firefox Sync instead of Chrome sync. WebDAV sync works across Chrome and Firefox, including both open on the same computer |

**Chromium-based browsers.** Brave, Arc, Vivaldi, Opera and others use the Chrome Web Store build with the same features as Chrome, though some reserve or remap extension shortcuts. In Dia, the New Tab page is unavailable but the command bar works; if its shortcut does nothing, set "Open command bar" from **In Dia** to **Global** in the browser's shortcut settings.

## Privacy

Lumno is local-first. Bookmarks, history and tabs are read on your device to power search and are never sent to Lumno or developer servers. There is no Lumno account, analytics or ad tracking. Optional features that contact third parties (site icons, daily quotes, online wallpapers and WebDAV) only do so after you turn them on. Read the full [privacy policy](https://lumno.kubai.design/privacy/).

## FAQ

**Is Lumno free?**
Yes. Lumno is free and open source under the GPL-3.0 license. If you would like to support development, see [Sponsoring](SPONSORING.md).

**Which browsers does Lumno support?**
Any Chromium-based browser that supports Manifest V3 extensions (Google Chrome, Microsoft Edge, Brave, Arc, Vivaldi, Opera and others), plus Firefox 140 or later and Firefox-based browsers such as Zen and LibreWolf. A few features are unavailable in Firefox; see [Browser compatibility](#browser-compatibility). Safari is not supported.

**Does Lumno sync my settings across devices?**
Yes. Settings sync through Chrome's built-in sync when you are signed in to the browser. Turn on [WebDAV sync](#webdav-sync) to also sync custom icons and wallpapers through your own server.

**Why doesn't the command bar open on some pages?**
Browsers block extensions on internal pages such as `chrome://` and on the Chrome Web Store. On those pages Lumno falls back to the new tab page. For local files, enable "Allow access to file URLs".

**How do I change the keyboard shortcut?**
Open `chrome://extensions/shortcuts` (or `edge://extensions/shortcuts`) and set new keys for Lumno.

**How is Lumno different from the default Chrome tab search?**
Lumno searches tabs, bookmarks, history and top sites together, adds site and AI search prefixes, aggregate search and a recent tab switcher, and works as an overlay on the current page instead of only in the toolbar.

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

`npm run package:firefox` builds the store package and turns it into the Firefox build in `dist/firefox`. `scripts/build-firefox.js` lists every Firefox-specific change: background scripts instead of a service worker, the Gecko add-on ID, Firefox shortcuts, no auto Picture-in-Picture scripts, and locale messages with a `__firefox` suffix that replace their base message. To try it, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`; run `npm run lint:firefox` to check it with `web-ext`. In shared code, ask `LumnoBrowserProfile.isFirefoxExtensionRuntime()` instead of checking the URL scheme, and mark UI for one browser family with `data-browser-only="chromium"` (hidden elsewhere) or, for settings, `data-browser-unsupported="firefox"` (shown disabled with a reason).

### Project structure

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 configuration, permissions, commands, content scripts, and new tab override |
| `src/background/` | Service worker, command routing, search data, site/AI search, tab switcher, PiP ownership, pinned-tab recovery, WebDAV sync |
| `src/newtab/` | New tab UI, search, recent sites, bookmarks, wallpapers, feedback, and page notices |
| `src/overlay/` | In-page command bar overlay, suggestion list, theme/language sync, and site fixes |
| `src/content/` | Page hotkey listener, selection quick actions, Web Clip PiP, and auto video PiP |
| `src/options/` | Extension settings page |
| `src/onboarding/` | Install and update onboarding |
| `src/shared/` | Shared settings, search, favicon, menu, tooltip, and URL guard modules |
| `react-src/` | React sources built into `src/react/` |
| `_locales/` | Extension UI copy |
| `assets/data/` | Built-in site-search and browser shortcut data |
| `assets/wallpapers/` | Built-in new tab wallpapers and thumbnails |
| `scripts/` | Checks, audits, packaging, and regression tests |

## Contributing

Bug reports, feature ideas and pull requests are welcome in [Issues](https://github.com/kubai087/lumno-extension/issues). See [GOVERNANCE.md](GOVERNANCE.md) for how the project is maintained. If Lumno saves you time, a ⭐ on GitHub or a review on the Chrome Web Store helps other people find it.

## Credits

- Japanese localization: thanks to [Humi](https://github.com/Hum1Tab) for Japanese translation and review.
- macOS `Ctrl+N` / `Ctrl+P` suggestion navigation experiment: based on a contribution by [wanghanzhen](https://github.com/wanghanzhen) in [PR #38](https://github.com/kubai087/lumno-extension/pull/38).
- Bundled icon set: [Remix Icon](https://remixicon.com/)
- Bundled typefaces: Open Sans; [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) (SIL OFL 1.1, subset for the daily quote)

## License

This project is licensed under [GPL-3.0](LICENSE).
