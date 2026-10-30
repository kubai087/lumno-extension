<p align="center">
  <img src="../assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno：Chrome 聚焦搜索命令栏 & 新标签页插件</h1>

<p align="center">
  免费开源的 Chrome / Edge / Firefox 浏览器扩展：类 Spotlight 的命令栏 + 可自定义的极简新标签页，也支持 Brave、Arc 等 Chromium 浏览器和 Zen 等 Firefox 系浏览器。
  <br />
  一个快捷键搜索标签页、书签和历史记录，直达网址，并调用站内搜索与 AI 搜索。
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/users/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=Chrome%20users&color=2563eb" alt="Chrome Web Store 用户数" /></a>
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/rating/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=rating&color=f59e0b" alt="Chrome Web Store 评分" /></a>
  <a href="https://github.com/kubai087/lumno-extension/stargazers"><img src="https://img.shields.io/github/stars/kubai087/lumno-extension?style=flat-square&color=111827" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/Manifest-V3-111827?style=flat-square" alt="Manifest V3" />
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0 许可证" /></a>
</p>

<p align="center">
  <a href="https://lumno.kubai.design/">官网</a> ·
  <a href="https://lumno.kubai.design/help/">帮助中心</a> ·
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#常见问题">常见问题</a> ·
  <a href="https://github.com/kubai087/lumno-extension/releases">更新日志</a>
  <br />
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

**Lumno** 是一款 Manifest V3 浏览器扩展：在任意网页上提供键盘优先的**聚焦搜索命令栏**（类似 macOS Spotlight、Raycast 或 Arc 浏览器的命令栏），并用一个快速、极简的**新标签页**替换浏览器默认新标签页。按下 `Cmd+Shift+K` / `Ctrl+Shift+K`，即可搜索已打开标签页、书签、浏览历史和常用网站，打开网址、切换标签页，或把关键词直接发送到 Google、百度、Bilibili、知乎、GitHub、ChatGPT、DeepSeek、Kimi、豆包等。无需注册账号，浏览数据只留在你的浏览器中。

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="../assets/images/readme/chrome-web-store-large-bordered.png" alt="在 Chrome 应用商店获取 Lumno" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="../assets/images/readme/microsoft-edge-addons-badge.png" alt="在 Microsoft Edge 加载项获取 Lumno" width="200" />
  </a><br />
  <a href="https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/">
    <img src="../assets/images/readme/firefox-get-the-addon-badge.png" alt="在 Firefox 附加组件获取 Lumno" width="200" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/kubai087/lumno-extension/releases/latest"><img src="https://img.shields.io/github/v/release/kubai087/lumno-extension?style=flat-square&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC&color=111827" alt="最新版本" /></a>
</p>

<img width="1200" height="480" alt="Lumno Chrome 命令栏插件：在任意网页搜索标签页、书签和历史记录" src="../assets/images/readme/banner.webp" decoding="async" />

## 功能

### 类 Spotlight 的网页命令栏

在当前网页上唤起悬浮命令栏，打开网址、搜索关键词、切换到已打开的标签页、打开 `chrome://settings` 等浏览器内部页面或进入 Lumno 设置，全程无需鼠标。

### 一站式搜索标签页、书签和历史记录

整合书签、浏览历史、常用网站、浏览器搜索建议和已打开标签页。支持结果来源筛选、首位结果优先级、按选择习惯排序和黑名单过滤。中文标题可以用全拼、首字母或两者混合搜索，并可开启拼音模糊音；忘记切换键盘布局（俄语、乌克兰语、希伯来语、阿拉伯语、韩语）时输入的内容也能搜到。搜索结果可在当前标签页、左侧、右侧或标签栏末尾打开。

### 站内搜索与 AI 搜索

输入前缀即可在站内搜索：YouTube、Bilibili、GitHub、Google、Bing、百度、知乎、豆瓣、掘金、淘宝、X、Reddit、Wikipedia 等。也可直接向 AI 提问：ChatGPT、Gemini、Google AI Studio、Copilot、Grok、DeepSeek、Kimi、豆包、千问、Qwen Chat、元宝、MiniMax。支持自定义搜索模板和别名。

### 聚合搜索：一次搜索多个引擎

将 2–10 个内置或自定义搜索源合并为一个搜索范围，同一个关键词同时在多个标签页打开结果；可自动归入以“聚合搜索名称：查询内容”命名的标签页组。

### 最近标签页切换器

按 `Alt+Q` 打开键盘标签页切换器，在最近使用的标签页之间快速跳转，就像浏览器里的 `Alt+Tab`。

### 划词 AI 快捷操作

在网页上选中文字，即可用你偏好的 AI 服务回答、翻译、解释、总结、搜索调研或计算，结果在新标签页（可选后台）打开。

### 可自定义的新标签页

简洁的新标签页替代方案：搜索框、可分组命名的快捷方式（最多 200 个）、最近/最常访问站点卡片、书签网格与文件夹级联菜单、书签分页和自定义文件夹颜色。支持快捷方式与书签互相拖动转换、固定或隐藏最近站点、用动态进度卡片追踪剧集和小说的最新集数/章节、调整内容宽度，输入 `/zen` 进入专注的禅模式。在 Firefox 中，在命令栏或新标签页搜索框输入 `/appearance`，可在自动、浅色、深色之间切换网页看到的网站外观。任意网页都可以通过右键菜单或工具栏弹窗加入快捷方式；没有自带背景的图标会放在按图标主色着色的底板上。

时钟提供六款字体，可调整字号、不透明度、颜色和 12 小时制；每日名句可以来自一言，也可以导入自己的 TXT / Markdown 句库，并选择名句字体。

### 壁纸与主题

系统/浅色/深色主题，可全局生效或仅作用于新标签页。可选内置壁纸、Bing 每日壁纸、精选摄影与开放获取艺术作品（随机精选可限定分类），或使用本地图片、图片链接；喜欢的 Bing 和精选壁纸可以保存到本地壁纸。支持遮罩透明度、颗粒/半调/抖色/ASCII 滤镜、搜索框宽度和 Lumno 字标开关。

搜索框、卡片、菜单和对话框可以换上**亚克力**或会折射壁纸的**液态玻璃**材质，并通过「材质深浅色」固定浅色或深色。

### 画中画：网页剪裁与视频自动画中画

- **网页剪裁 PiP**：在支持的 HTTPS 页面中框选局部内容，放入 Document Picture-in-Picture 悬浮窗，方便参考和对照。
- **视频自动画中画**：切换标签页时，在 YouTube、Bilibili、腾讯视频、优酷、抖音、TikTok、Netflix、Twitch、Vimeo、Prime Video、Disney+ 等站点自动尝试进入视频画中画。

### 工具栏弹窗

点击工具栏中的 Lumno 图标，即可把当前网页加入新标签页快捷方式、复制链接、打开命令栏、剪裁网页或开启画中画。快速设置可以切换主题和命令栏选项，底部显示 WebDAV 同步状态。

### Chrome 同步与 WebDAV 同步

设置默认通过 Chrome 浏览器内置同步。可选开启 [WebDAV 同步](#webdav-同步)（Beta），额外同步自定义快捷方式图标与上传的壁纸，支持坚果云和自建服务器。服务器限流时，Lumno 会暂停并自动重试。

### 浏览器增强与多语言

按住 Shift 点击链接，会在页面上方的小窗里预览，看完可以关闭或移到新标签页。重启后恢复置顶标签页、受限页面回退到新标签页、一键复制当前页面链接、打开扩展快捷键页和详情页。

界面支持 10 种语言（简体中文、繁体中文、英文、日文、韩文、德文、法文、西班牙文、巴西葡萄牙文和俄文），也可以跟随浏览器语言。简体中文、繁体中文、英文、日文由人工撰写和校对，其余语言为 AI 翻译；母语用户可以在设置 → 常规 → 语言 → **改进翻译** 中帮忙修正。

每项功能的图文教程见 [Lumno 帮助中心](https://lumno.kubai.design/help/)。

## 实机截图

<p align="center">
  <img src="../assets/images/readme/preview-newtab.webp" alt="Lumno 自定义新标签页：壁纸、快捷方式和书签" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="../assets/images/readme/preview-command-bar.webp" alt="Lumno 命令栏：搜索已打开标签页、书签和历史记录" width="100%" loading="lazy" decoding="async" />
</p>

## 快捷键

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 打开聚焦搜索命令栏 | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| 打开命令栏并预填当前页面链接 | `Cmd+Shift+L` | `Ctrl+Shift+L` |
| 复制当前页面链接 | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| 打开最近标签页切换器 | `Alt+Q` | `Alt+Q` |

在 Lumno 新标签页按下聚焦搜索快捷键，会把焦点移到搜索框，即使焦点在地址栏、没有开启「输入框自动聚焦」也可以。已输入的内容和显示的结果都会保留。

浏览器可能会占用或限制扩展快捷键。请在 `chrome://extensions/shortcuts`、`edge://extensions/shortcuts` 或对应浏览器的扩展快捷键页面中修改。

Firefox 已占用 `Cmd+Shift+K` / `Ctrl+Shift+K` 等按键，因此 Firefox 版默认在 macOS 上使用 `Ctrl+Shift+K/L/C`，在 Windows 和 Linux 上使用 `Alt+K/L/C`，`Alt+Q` 不变。可在附加组件管理器的齿轮菜单 →「管理扩展快捷键」中修改。

## 安装

| 浏览器 | 安装入口 |
| --- | --- |
| Google Chrome | [Chrome 应用商店](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Microsoft Edge | [Microsoft Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc) |
| Brave、Arc、Vivaldi、Opera 等 Chromium 浏览器 | [Chrome 应用商店](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Firefox 140+、Zen、LibreWolf、Floorp 等 Firefox 系浏览器 | [Firefox 附加组件](https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/) |

从源码安装：

1. 克隆或下载本仓库。
2. 运行 `npm ci` 和 `npm run build`（见[开发](#开发)）。
3. 打开 `chrome://extensions/` 或对应 Chromium 浏览器的扩展管理页，开启「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择构建生成的 `dist/chrome` 目录。
5. 可选：进入扩展设置页，调整语言、主题、新标签页内容、站内搜索、黑名单、PiP 和快捷键策略。

如果需要在本地 HTML、PDF 或 `file://` 页面使用命令栏，请在扩展详情页开启「允许访问文件网址」。

## 浏览器兼容性

Lumno 为 Chromium 浏览器开发，同时提供 Firefox 版。Zen、LibreWolf、Floorp、Waterfox 等基于 Firefox 的浏览器使用 Firefox 版，需要 Firefox 140 及以上的内核。暂不支持 Safari。

**Firefox 及 Firefox 系浏览器。** Firefox 的扩展接口与 Chromium 有几处不同：

| 功能 | 在 Firefox 中 | 原因 |
| --- | --- | --- |
| 视频自动画中画 | 不可用；设置中显示为禁用，悬停可查看原因 | Firefox 不允许扩展让网页视频进入画中画 |
| 网页剪裁 | 不可用；设置中显示为禁用，悬停可查看原因 | 依赖文档画中画（Document Picture-in-Picture），Firefox 不支持 |
| 新标签页的书签管理器按钮 | 隐藏 | 扩展无法打开 Firefox 的「我的足迹」窗口 |
| 从快捷方式或命令栏打开 `about:` 页面（如 `about:config`） | 不可用 | Firefox 不允许扩展打开其特权页面 |
| 在 `about:` 页面和 addons.mozilla.org 上打开命令栏 | 不可用 | Firefox 禁止扩展脚本在这些页面运行，快捷键按「受限页」设置处理 |
| 在本地 `file://` 页面上打开命令栏 | 不可用 | Firefox 没有为扩展开放文件网址访问权限的设置 |
| 网站图标 | 表现不同 | Firefox 没有供扩展使用的图标接口。Lumno 读取 Firefox 自己的图标缓存（已打开的标签页和常用网站），开启后再使用在线图标服务；从未访问过的网站可能先显示占位图标，访问一次后即可显示 |
| `about:` 页面在标签切换器中 | 表现不同 | 显示浏览器 logo 而不是页面预览，因为 Firefox 只返回这些页面的模糊截图 |
| 新标签页搜索框聚焦 | 表现不同 | Firefox 会把新标签页的焦点给地址栏；开启自动聚焦后，Lumno 会重新打开该标签页，让焦点落在搜索框 |
| 「前往快捷键设置」 | 表现不同 | 打开附加组件管理器，需在齿轮菜单中选择「管理扩展快捷键」 |
| 设置同步 | 表现不同 | 使用 Firefox 同步而非 Chrome 同步。WebDAV 同步可在 Chrome 与 Firefox 之间进行，包括同一台电脑上同时打开两者 |

**Chromium 系浏览器。** Brave、Arc、Vivaldi、Opera 等使用 Chrome 应用商店的版本，功能与 Chrome 相同，但部分浏览器会占用或改写扩展快捷键。在 Dia 中，新标签页功能暂不可用，聚焦搜索可正常使用。Dia 自带快捷键优先，想用 ⌘T 唤起聚焦搜索，需先在 Dia 的 Settings → Shortcuts 中把「New Tab」的 ⌘T 改成其他按键，再到浏览器的扩展快捷键页面把「Open command bar」设为 ⌘T；如果快捷键无效，请在同一页面把它从 In Dia 改为 Global。

## 隐私

Lumno 本地优先。书签、历史和标签页仅在本机读取用于搜索，不会发送到 Lumno 或开发者服务器；没有 Lumno 账号、统计分析或广告追踪。默认会联网的只有两项：搜索建议会把你输入的文字发送给默认搜索引擎的联想服务（网址、主机名、文件路径和预填的当前页地址不会发送）；浏览器未缓存的网站图标会向 Google 图标服务（Gstatic）获取，它只会得知网站来源，不会得知具体页面。每日一言、在线壁纸和 WebDAV 只在你开启后才会联网。完整说明见[隐私政策](https://lumno.kubai.design/privacy/)。

## 常见问题

**在哪里可以找到各项功能的使用教程？**
[Lumno 帮助中心](https://lumno.kubai.design/help/)介绍了安装设置、命令栏、新标签页、同步、兼容性和隐私等内容，提供十种语言。

**Lumno 免费吗？**
免费。Lumno 以 GPL-3.0 许可证开源。

**支持哪些浏览器？**
支持 Manifest V3 扩展的 Chromium 浏览器（Google Chrome、Microsoft Edge、Brave、Arc、Vivaldi、Opera 等），以及 Firefox 140 及以上版本和 Zen、LibreWolf 等 Firefox 系浏览器。Firefox 中有少数功能不可用，见[浏览器兼容性](#浏览器兼容性)。暂不支持 Safari。

**设置能在多台设备间同步吗？**
可以。登录浏览器后，设置会通过 Chrome 内置同步；开启 [WebDAV 同步](#webdav-同步)后，还能通过你自己的服务器同步自定义图标和壁纸。

**为什么有些页面打不开命令栏？**
浏览器禁止扩展在 `chrome://` 等内部页面和 Chrome 应用商店中运行，这些页面上 Lumno 会回退到新标签页。本地文件请开启「允许访问文件网址」。

**如何修改快捷键？**
打开 `chrome://extensions/shortcuts`（或 `edge://extensions/shortcuts`），为 Lumno 设置新的按键。

**能像 Arc 一样用 Ctrl+Tab 打开标签切换器吗？**
可以，但快捷键页面本身不接受 Ctrl+Tab。打开 `chrome://extensions/shortcuts`，按 `Cmd+Option+J`（Windows 和 Linux 上为 `Ctrl+Shift+J`）打开开发者工具的控制台，运行：

```js
const extensions = await chrome.developerPrivate.getExtensionsInfo();
const lumno = extensions.find((item) =>
  item.commands.some((command) => command.name === "show-tab-switcher"));
await chrome.developerPrivate.updateExtensionCommand({
  extensionId: lumno.id,
  commandName: "show-tab-switcher",
  keybinding: "Ctrl+Tab",
});
```

这段代码只修改 Lumno 标签切换器的快捷键，设置后浏览器自带的 Ctrl+Tab 不再生效。图文步骤见[帮助中心](https://lumno.kubai.design/help/tab-switcher/#ctrl-tab)。

**和 Chrome 自带的标签页搜索有什么不同？**
Lumno 同时搜索标签页、书签、历史和常用网站，额外提供站内搜索和 AI 搜索前缀、聚合搜索和最近标签页切换器，并且直接在当前网页上以浮层打开，而不只是在工具栏中。

## WebDAV 同步

WebDAV 为 Beta 功能，入口在「设置 → 账号与同步」。添加连接并填写 HTTPS 地址、同步目录、用户名与应用密码，点击「保存并开启同步」即可。它与原有 Chrome 同步同时运行，额外同步自定义快捷方式图标与上传的壁纸；图片不进入 Chrome Sync。连接信息仅保存在各自设备上。

首次连接已有远端数据时选择初始版本，后续冲突仅选择冲突内容采用的版本，其他改动仍合并，替换前保留备份。界面显示最近成功同步时间，关闭 WebDAV 不影响 Chrome 同步。

## 开发

开发和 CI 使用 Node.js 22。如果使用 `nvm`，运行 `nvm use` 即可切换到 `.nvmrc` 中声明的版本。

Chrome 加载的是构建后的扩展：`npm run build` 会把它写到 `dist/chrome/`（不提交）。页面、样式、资源和语言文件原样复制，扩展运行的所有脚本用 Vite 构建到其中的 `build/`，`manifest.json` 由仓库里的同名文件生成。该目录保持与仓库相同的结构，因此页面 URL 与商店包一致。首次加载开发版前，请运行：

```bash
npm ci
npm run build
```

`src/` 下的脚本都是 TypeScript ES 模块，各自 import 所需的模块；`build/` 中的每个脚本都由 `scripts/build/entries.js` 列出的一个入口模块构建而成。页面脚本是共享 chunk 的 ES 模块；预加载脚本、内容脚本和 service worker 是自包含的经典脚本。开发期间运行 `npm run watch` 可保持 `dist/chrome/` 最新：每次改动都会复制变更的文件并重新构建脚本。

然后在 `chrome://extensions/` 中保持「开发者模式」开启，并将 `dist/chrome` 作为已解压扩展加载。生成新产物，或修改后台脚本、`manifest.json` 后，请在扩展管理页手动点击「重新加载」。开发版不会在 Chrome 用户配置启动时主动二次刷新，以免中断启动阶段的新标签页接管。

提交 Pull Request 前请运行 `npm run verify`。它会构建扩展，并运行测试、静态检查和 ESLint，与 CI 一致。开发过程中可以只运行其中一部分：

```bash
npx vitest run src/domain/search tests/pages/newtab
npx vitest run --project dom -t "scope panel"
npm run lint
```

所有测试都用 TypeScript 编写，由 Vitest 运行：`npx vitest run <路径>` 运行这些路径下的测试文件，`-t <名称>` 只运行名称匹配的测试。`npm run check:locales` 检查所有语言的文案；AI 翻译语言里还没翻译的文案只给出警告，`npm run package:store` 打包时会把它们当作错误。`npm run audit:i18n` 和 `npm run audit:style` 会列出直接写在代码里的中文和遗留的样式问题。

`npm run package:store` 会读取 `manifest.json` 的版本号，并生成 `dist/lumno-store-v<version>.zip`。本命令依赖系统可用的 `zip` 和 `zipinfo`。

`npm run package:firefox` 会先生成商店包，再转换为 `dist/firefox` 中的 Firefox 版。所有 Firefox 专属改动都列在 `scripts/build/build-firefox.js` 中：用后台脚本替代服务工作线程、Gecko 扩展 ID、Firefox 快捷键、去掉自动画中画脚本，以及用带 `__firefox` 后缀的语言条目替换对应的基础文案。试用时打开 `about:debugging#/runtime/this-firefox`，选择「临时加载附加组件」，再选中 `dist/firefox/manifest.json`；运行 `npm run lint:firefox` 可用 `web-ext` 检查。共享代码中请调用 `LumnoBrowserProfile.isFirefoxExtensionRuntime()` 判断运行环境，不要直接检查 URL 协议；只属于某一类浏览器的界面用 `data-browser-only="chromium"` 标记（在其他浏览器中隐藏），设置项则用 `data-browser-unsupported="firefox"`（显示为禁用并说明原因）。

### 目录结构

| 路径 | 说明 |
| --- | --- |
| `manifest.json` | Manifest V3 配置、权限、命令、内容脚本和新标签页覆盖配置 |
| `src/background/` | Service worker 入口及其 `*-service.ts` 部件：命令分发、打开浮层、搜索数据、站内/AI 搜索、标签页切换器、PiP 所有权、置顶标签页恢复、WebDAV 同步 |
| `src/newtab/` | 新标签页运行时；按功能分为 `bookmarks/`、`shortcuts/`、`recent/`、`wallpaper/`、`search/`、`top-content/`、`theme/` |
| `src/overlay/` | 网页内命令栏浮层（`search-panel.ts` 及其位于 `panel/` 的部件）、主题/语言同步和站点修正 |
| `src/content/` | 页面快捷键监听、划词快捷操作、网页剪裁 PiP、视频自动 PiP |
| `src/options/` | 扩展设置页（`options.ts` 及其 `options-*.ts` 部件） |
| `src/onboarding/` | 安装/更新引导页 |
| `src/domain/` | 不访问浏览器和 DOM 的纯逻辑：设置键与规范化、路由、搜索排序与匹配（`search/`）、favicon 规则、快捷方式与最近访问存储 |
| `src/platform/` | 浏览器与扩展 API 的封装：浏览器识别、URL 守卫 |
| `src/shared/` | 多个界面共用的 UI 与页面运行时：`search/`（输入与建议）、`ui/`（提示、Toast、菜单与控件样式）、`favicon/`、预加载脚本 |
| `src/*/react/` | 各界面的 React 视图；多个页面共用的在 `src/shared/react/` |
| `_locales/` | 扩展 UI 文案 |
| `assets/data/` | 内置站内搜索和浏览器快捷入口数据 |
| `assets/wallpapers/` | 新标签页内置壁纸与缩略图 |
| `tests/` | 不放在模块旁边的测试：整页测试（`tests/pages/<页面>/`）、仓库与构建检查（`tests/repo/`）、浏览器流程（`tests/e2e/`）和共用的模拟对象（`tests/fakes/`）。单元测试和组件测试以 `*.test.ts(x)` 放在各自模块旁边 |
| `scripts/` | 按用途划分的工具：`build/`（打包）、`check/`（静态检查与审计）、`dev/`（e2e 试验、性能剖析）、`release/`（商店提交） |

## 参与贡献

欢迎在 [Issues](https://github.com/kubai087/lumno-extension/issues) 反馈问题、提出建议或提交 Pull Request。如果你的母语是某种 AI 翻译的语言，可以在设置 → 常规 → 语言 → **改进翻译** 中报告某一句译文，或提交填好的整份翻译表格。如果 Lumno 帮你节省了时间，欢迎在 GitHub 点个 ⭐，或在 Chrome 应用商店、Firefox 附加组件留下评价，让更多人发现它。

提交 Pull Request 前，请先阅读 [CONTRIBUTING.md](../.github/CONTRIBUTING.md)，了解开发环境、需要运行的检查以及翻译流程。新增的界面文案只需写英文、简体中文、繁体中文和日文，其余语言由维护者补齐。所有参与者都须遵守[行为准则](../.github/CODE_OF_CONDUCT.md)，安全问题请按 [SECURITY.md](../.github/SECURITY.md) 报告。

## 鸣谢

- 日文本地化：感谢 [Humi](https://github.com/Hum1Tab) 参与日文翻译与校对。
- macOS `Ctrl+N` / `Ctrl+P` 结果导航实验功能：基于 [wanghanzhen](https://github.com/wanghanzhen) 在 [PR #38](https://github.com/kubai087/lumno-extension/pull/38) 中的贡献。
- 内置图标集：[Remix Icon](https://remixicon.com/) 4.9.1，适用 [Remix Icon License v1.0](../assets/remixicon/LICENSE.txt)，不适用 GPL
- 内置字体：Open Sans；[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)（SIL OFL 1.1，子集化后用于每日一言）

## 许可证

本项目使用 [GPL-3.0](../LICENSE) 许可证。内置的第三方代码、图标和字体沿用各自的许可证，详见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
