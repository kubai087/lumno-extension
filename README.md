<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno: Command Bar & New Tab for Chrome</h1>

<p align="center">
  A free, open-source, Spotlight-style command bar and customizable new tab page for Chrome, Edge and Firefox, plus Brave, Arc and other Chromium browsers and Firefox-based browsers like Zen.
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
  <a href="https://lumno.kubai.design/en/help/">Help Center</a> ·
  <a href="#installation">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="https://github.com/kubai087/lumno-extension/releases">Changelog</a>
  <br />
  <a href="docs/README.zh-CN.md">简体中文</a> |
  <a href="README.md">English</a> |
  <a href="docs/README.ja.md">日本語</a>
</p>

**Lumno** is a Manifest V3 browser extension that brings a keyboard-first **command palette** (like macOS Spotlight, Raycast or the Arc browser command bar) to every web page, and replaces the default new tab with a fast, minimal **new tab page**. Press `Cmd+Shift+K` / `Ctrl+Shift+K` to search open tabs, bookmarks, browsing history and top sites, open a URL, switch tabs, or send a query to Google, YouTube, GitHub, ChatGPT, Gemini, DeepSeek and more. No account required, and your browsing data stays in your browser.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="./assets/images/readme/chrome-web-store-large-bordered.png" alt="Get Lumno from the Chrome Web Store" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="./assets/images/readme/microsoft-edge-addons-badge.png" alt="Get Lumno from Microsoft Edge Add-ons" width="200" />
  </a><br />
  <a href="https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/">
    <img src="./assets/images/readme/firefox-get-the-addon-badge.png" alt="Get Lumno from Firefox Add-ons" width="200" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/kubai087/lumno-extension/releases/latest"><img src="https://img.shields.io/github/v/release/kubai087/lumno-extension?style=flat-square&label=latest%20release&color=111827" alt="Latest release" /></a>
</p>

<img width="1200" height="480" alt="Lumno command bar for Chrome: search tabs, bookmarks and history from any page" src="./assets/images/readme/banner.webp" decoding="async" />

## Features

### Spotlight-style command bar for any web page

Open a floating command bar on top of the current page to visit URLs, search keywords, switch to an open tab, open browser internal pages such as `chrome://settings`, or jump into Lumno settings, all without touching the mouse.

### Search tabs, bookmarks and history in one place

Results combine bookmarks, browsing history, top sites, browser suggestions and open tabs. Filter by source, prioritize the first result, learn from what you pick, and hide sites with blacklist rules. Chinese titles match by full pinyin, initials or a mix of both (with optional fuzzy pinyin), and a query typed on the wrong keyboard layout (Russian, Ukrainian, Hebrew, Arabic or Korean) still finds what you meant. Choose whether results open in the current tab, to its left or right, or at the end of the tab strip.

### Site search and AI search shortcuts

Type a prefix to search inside a site: YouTube, Bilibili, GitHub, Google, Bing, Baidu, Zhihu, Douban, Juejin, Taobao, X, Reddit, Wikipedia and more. Ask AI assistants directly, including ChatGPT, Gemini, Google AI Studio, Copilot, Grok, DeepSeek, Kimi, Doubao, Qianwen, Qwen Chat, Yuanbao and MiniMax. Add your own search templates and aliases.

### Aggregate search across multiple engines

Combine 2–10 built-in or custom search sources into one scope and run the same query in several tabs at once. Results can be grouped into a tab group named "Aggregate name: query".

### Recent tab switcher

Press `Alt+Q` to open a keyboard tab switcher and jump between recently used tabs, similar to `Alt+Tab` for your browser.

### Arc-style recent-tab switching with a system remapper

Chrome reserves `Ctrl+Tab`, so an extension cannot reliably intercept it. Enable **Enable mapped tab-switcher shortcut** in Lumno settings (off by default), then configure an OS keyboard remapper of your choice (for example, [Pawgic](https://pawgic.lifeos.md/)) for your browser only:

| Physical shortcut | Send to Lumno | Behavior |
| --- | --- | --- |
| `Ctrl+Tab` | `Ctrl+Q` | Open the recent-tab switcher / select the next item |
| `Ctrl+Shift+Tab` | `Ctrl+Shift+Q` | Open in reverse / select the previous item |

Keep Control held while cycling; release it to activate the selected tab. `Escape` cancels. On macOS, use **Control**, not Command. Pawgic is one example, not a requirement; other tools that preserve modifier press/release behavior can also be used. For example, in [Pawgic](https://pawgic.lifeos.md/), add two keyboard shortcut rules scoped to the browser app (for example, ego lite), using the source/target pairs above. Preserve Control in both mappings so releasing the physical modifier can confirm the selection.

The mapped shortcut works while page content has focus, including inputs and Lumno's new-tab search field. It takes over `Ctrl+Q` and `Ctrl+Shift+Q` in those pages while enabled. It cannot run from the address bar or browser internal pages; use the regular extension shortcut (`Alt+Q` by default) there. Direct `Ctrl+Tab` handling is best effort only where the browser delivers it to the page, and leaves ordinary inputs/editors alone. No additional extension permissions are required.


### AI actions for selected text

Select text on any page to answer, translate, explain, summarize, research or calculate it with your preferred AI provider. Results open in a new tab, optionally in the background.

### Customizable new tab page

A clean new tab replacement with a search box, up to 200 shortcuts organized into named groups, recent and most-visited site cards, bookmark grids with cascading folder menus, bookmark paging and custom folder colors. Drag items between shortcuts and bookmarks, pin or hide recent sites, track the latest episode or chapter of a show or novel with progress cards, adjust content width, or type `/zen` for a distraction-free Zen mode. In Firefox, `/appearance` in the command bar or the new tab search box switches the website appearance pages see between automatic, light and dark. Add any page to your shortcuts from its right-click menu or the toolbar popup; icons without a background of their own sit on a plate tinted from their main color.

Show a clock in one of six fonts, with its own size, opacity, color and an optional 12-hour format, or a daily quote from your own TXT or Markdown collection in the font you choose.

### Wallpapers and themes

System, light and dark themes, applied globally or only to the new tab page. Pick built-in wallpapers, the Bing daily wallpaper, curated photos and open-access artwork (limit the random mix to the categories you like), or your own image file or image URL, and save Bing or curated wallpapers you like to your local library. Fine-tune overlay opacity, grain, halftone, dither and ASCII filters, search-box width and the Lumno wordmark.

Give the search bar, cards, menus and dialogs an **Acrylic** or **Liquid glass** material that refracts the wallpaper behind it, and keep the glass in light or dark with Material theme.

### Picture-in-Picture: Web Clip and auto video PiP

- **Web Clip PiP**: select part of any supported HTTPS page and float it in a Document Picture-in-Picture window for reference or side-by-side comparison.
- **Auto video PiP**: when you switch away from a playing video, Lumno tries to enter Picture-in-Picture automatically on YouTube, Bilibili, Netflix, Twitch, Vimeo, Prime Video, Disney+, TikTok, Douyin, Youku, Tencent Video and more.

### Toolbar popup

Click the Lumno icon in the toolbar to add the current page to your New Tab shortcuts, copy its link, open the command bar, clip the page or start picture-in-picture. Quick settings switch the theme and command bar options, and the footer shows the WebDAV sync status.

### Sync with Chrome or your own WebDAV server

Settings sync through Chrome's built-in sync by default. Optional [WebDAV sync](#webdav-sync) (Beta) also carries custom shortcut icons and uploaded wallpapers, and works with Nutstore (Jianguoyun) and self-hosted servers. When a server throttles requests, Lumno backs off and retries on its own.

### Browser helpers and languages

Shift+click a link to preview it in a small window over the page, then close it or move it to a tab. Restore pinned tabs after a restart, fall back from restricted pages to the new tab page, copy the current page URL with one shortcut, and open extension shortcut or details pages.

The interface comes in 48 languages, or follows your browser language. English, Simplified Chinese, Traditional Chinese and Japanese are written and reviewed by people; the rest are AI-translated, and native speakers can fix them from Settings → General → Language → **Improve translation**.

Step-by-step guides for every feature, with screenshots, are in the [Lumno Help Center](https://lumno.kubai.design/en/help/).

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

On Lumno's New Tab page, the command-bar shortcut moves focus to the search box, even while the address bar has focus and input auto-focus is off. What you typed and the results on screen stay.

Browsers may reserve or limit extension shortcuts. Change them at `chrome://extensions/shortcuts`, `edge://extensions/shortcuts`, or the equivalent shortcuts page in your browser.

Firefox already uses `Cmd+Shift+K` / `Ctrl+Shift+K` and similar keys, so the Firefox build defaults to `Ctrl+Shift+K/L/C` on macOS and `Alt+K/L/C` on Windows and Linux; `Alt+Q` is unchanged. Change them in the Add-ons Manager under the gear menu → **Manage Extension Shortcuts**.

## Installation

| Browser | Install |
| --- | --- |
| Google Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Microsoft Edge | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc) |
| Brave, Arc, Vivaldi, Opera and other Chromium browsers | [Chrome Web Store](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Firefox 140+, Zen, LibreWolf, Floorp and other Firefox-based browsers | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/) |

To install from source:

1. Clone or download this repository.
2. Run `npm ci` and `npm run build` (see [Development](#development)).
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
| Settings sync | Works differently | Uses Firefox Sync instead of Chrome sync. WebDAV sync works across Chrome and Firefox, including both open on the same computer |

**Chromium-based browsers.** Brave, Arc, Vivaldi, Opera and others use the Chrome Web Store build with the same features as Chrome, though some reserve or remap extension shortcuts. In Dia, the New Tab page is unavailable but the command bar works; if its shortcut does nothing, set "Open command bar" from **In Dia** to **Global** in the browser's shortcut settings.

## Privacy

Lumno is local-first. Bookmarks, history and tabs are read on your device to power search and are never sent to Lumno or developer servers. There is no Lumno account, analytics or ad tracking. Two features contact third parties by default: search suggestions send what you type to your default search engine's suggestion service (never URLs, host names, file paths or the prefilled page address), and site icons the browser has not cached come from Google's icon service (Gstatic), which learns only the site's origin, never the page. Daily quotes, online wallpapers and WebDAV only connect after you turn them on. Read the full [privacy policy](https://lumno.kubai.design/privacy/).

## FAQ

**Where can I find guides for each feature?**
The [Lumno Help Center](https://lumno.kubai.design/en/help/) covers setup, the command bar, the new tab, sync, compatibility and privacy, in ten languages.

**Is Lumno free?**
Yes. Lumno is free and open source under the GPL-3.0 license.

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

Existing server data requires an explicit initial-version choice. Later conflicts let you choose a version for conflicting content while merging other changes, with backups before replacement. The UI shows the last successful sync time. Turning WebDAV off keeps Chrome sync running.

## Development

Development and CI use Node.js 22. If you use `nvm`, run `nvm use` to select the version declared in `.nvmrc`.

Chrome loads built scripts: `npm run build` builds the React islands into `src/react/` with Vite and bundles every script the extension runs into `build/` with esbuild. Neither folder is committed. Before loading the development extension for the first time, and after editing `src/` or `react-src/`, run:

```bash
npm ci
npm run build
```

The scripts under `src/` are ES modules: each one imports what it uses, and a bundle holds the modules `scripts/build/bundles.js` lists for it and everything they import. While editing `src/`, `npm run watch:bundles` rebuilds the bundles on every change.

Then keep Developer mode enabled in `chrome://extensions/` and load the repository root as an unpacked extension. After generating new assets or changing background scripts or `manifest.json`, click Reload on the extensions page. Development installs do not force a second refresh when the Chrome profile starts, avoiding interruption of the startup New Tab override.

Before opening a pull request, run `npm run verify`. It builds the extension and runs the Node and React test suites, the static checks and ESLint, the same as CI. While you work, run only part of it:

```bash
npm run test:legacy -- settings search/
npm run test:react
npm run lint
```

`npm run test:legacy -- <filter>` runs the Node tests whose path contains any of the filters. `npm run check:locales` checks the copy in every language; strings the AI-translated languages still wait for are warnings, which `npm run package:store` turns into errors. `npm run audit:i18n` and `npm run audit:style` report Chinese text written straight into the code and leftover style debt.

`npm run package:store` reads the version from `manifest.json` and creates `dist/lumno-store-v<version>.zip`. It requires `zip` and `zipinfo` to be available on the system.

`npm run package:firefox` builds the store package and turns it into the Firefox build in `dist/firefox`. `scripts/build/build-firefox.js` lists every Firefox-specific change: background scripts instead of a service worker, the Gecko add-on ID, Firefox shortcuts, no auto Picture-in-Picture scripts, and locale messages with a `__firefox` suffix that replace their base message. To try it, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`; run `npm run lint:firefox` to check it with `web-ext`. In shared code, ask `LumnoBrowserProfile.isFirefoxExtensionRuntime()` instead of checking the URL scheme, and mark UI for one browser family with `data-browser-only="chromium"` (hidden elsewhere) or, for settings, `data-browser-unsupported="firefox"` (shown disabled with a reason).

### Project structure

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 configuration, permissions, commands, content scripts, and new tab override |
| `src/background/` | Service worker entry and its `*-service.js` parts: command routing, overlay opening, search data, site/AI search, tab switcher, PiP ownership, pinned-tab recovery, WebDAV sync |
| `src/newtab/` | New tab page runtime; feature folders `bookmarks/`, `shortcuts/`, `recent/`, `wallpaper/`, `search/`, `top-content/`, `theme/` |
| `src/overlay/` | In-page command bar overlay (`search-panel.js` with its parts in `panel/`), theme/language sync, and site fixes |
| `src/content/` | Page hotkey listener, selection quick actions, Web Clip PiP, and auto video PiP |
| `src/options/` | Extension settings page (`options.js` and its `options-*.js` parts) |
| `src/onboarding/` | Install and update onboarding |
| `src/shared/` | Shared settings, routes and URL guards; `search/` (ranking, input, suggestions), `ui/` (tooltip, toast, menu and control styles), `favicon/` |
| `react-src/` | React sources built into `src/react/` |
| `_locales/` | Extension UI copy |
| `assets/data/` | Built-in site-search and browser shortcut data |
| `assets/wallpapers/` | Built-in new tab wallpapers and thumbnails |
| `tests/` | Node regression tests by area (`tests/<area>/test-*.js`, shared `tests/helpers/`); `npm run test:legacy -- <filter>` runs a subset |
| `scripts/` | Tooling by purpose: `build/` (packaging), `check/` (static checks and audits), `dev/` (smoke, e2e, profiling), `release/` (store submissions) |

## Contributing

Bug reports, feature ideas and pull requests are welcome in [Issues](https://github.com/kubai087/lumno-extension/issues). If you speak one of the AI-translated languages, Settings → General → Language → **Improve translation** lets you report a wrong string or send a whole spreadsheet of fixes. If Lumno saves you time, a ⭐ on GitHub or a review on the Chrome Web Store or Firefox Add-ons helps other people find it.

Before you send a pull request, read [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the setup, the checks to run and how translations work. New UI text goes into English, Simplified Chinese, Traditional Chinese and Japanese; maintainers fill in the other languages. Everyone taking part follows the [Code of Conduct](.github/CODE_OF_CONDUCT.md), and security problems go through [SECURITY.md](.github/SECURITY.md).

## Credits

- Japanese localization: thanks to [Humi](https://github.com/Hum1Tab) for Japanese translation and review.
- macOS `Ctrl+N` / `Ctrl+P` suggestion navigation experiment: based on a contribution by [wanghanzhen](https://github.com/wanghanzhen) in [PR #38](https://github.com/kubai087/lumno-extension/pull/38).
- Bundled icon set: [Remix Icon](https://remixicon.com/) 4.9.1, under the [Remix Icon License v1.0](assets/remixicon/LICENSE.txt), not the GPL
- Bundled typefaces: Open Sans; [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) (SIL OFL 1.1, subset for the daily quote)

## License

This project is licensed under [GPL-3.0](LICENSE). Bundled third-party code, icons and fonts keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
