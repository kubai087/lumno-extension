如无必要，勿增实体。中文回复，言简意赅。善用 Emoji
每次修改都必须适配深色、浅色模式。
新增功能时，验证下是否会导致浮层、suggestions 唤起失败
Remix Icon 规则：以后你给我一个 icon id，我必须按本项目的 Remix Icon SVG sprite 方式匹配并导入；若找不到匹配项需明确反馈。

# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json` defines the Chrome Extension (Manifest V3) metadata, permissions, and entry points.
- `background.js` is the service worker that listens for commands, queries tabs/history/bookmarks, and injects UI scripts.
- `content.js` handles the in-page overlay UI and user interactions.
- `arc.png` provides the extension icon assets.

## Build, Test, and Development Commands
- No build step is required; this is a plain JavaScript Chrome extension.
- Load locally in Chrome: open `chrome://extensions`, enable Developer Mode, then choose “Load unpacked” and select this folder.
- Trigger the search overlay with the registered command (see `manifest.json`, default `Ctrl+T` / `Command+T`).

## Coding Style & Naming Conventions
- Use 2-space indentation in JavaScript to match the existing style.
- Prefer descriptive function and variable names (e.g., `getSearchSuggestions`, `toggleBlackRectangle`).
- Keep DOM IDs unique and prefixed (current pattern: `_x_extension_*_2024_unique_`).
- Avoid introducing new dependencies; stick to standard Web/Chrome APIs.
- Any new user-facing text must be internationalized and added to all supported locales (zh_CN, zh_TW, zh_HK, en); UI should update without refresh when language changes.

## Testing Guidelines
- No automated tests are configured.
- Validate behavior manually in Chrome by loading the unpacked extension and testing:
  - command hotkey opens/closes overlay
  - search suggestions populate
  - tab switching and navigation works

## Commit & Pull Request Guidelines
- Commit message conventions are not defined in this repo; use short, imperative messages (e.g., `Fix overlay close on blur`).
- PRs should include:
  - a brief description of behavior changes
  - steps to validate (manual checks in Chrome)
  - screenshots or screen recordings for UI changes

## Security & Configuration Tips
- Be cautious with permissions in `manifest.json`; only add permissions that are required.
- Avoid sending browsing data off-device; suggestions should rely on Chrome APIs only.
