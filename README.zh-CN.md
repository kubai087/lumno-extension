<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno：Chrome 聚焦搜索命令栏 & 新标签页插件</h1>

<p align="center">
  免费开源的 Chrome / Edge 浏览器扩展：类 Spotlight 的命令栏 + 可自定义的极简新标签页，支持 Brave、Arc 等 Chromium 浏览器，并提供适用于 Firefox、Zen 等 Firefox 系浏览器的版本。
  <br />
  一个快捷键搜索标签页、书签和历史记录，直达网址，并调用站内搜索与 AI 搜索。
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/users/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=Chrome%20users&color=2563eb" alt="Chrome Web Store 用户数" /></a>
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/rating/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=rating&color=f59e0b" alt="Chrome Web Store 评分" /></a>
  <a href="https://github.com/kubai087/lumno-extension/stargazers"><img src="https://img.shields.io/github/stars/kubai087/lumno-extension?style=flat-square&color=111827" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/Manifest-V3-111827?style=flat-square" alt="Manifest V3" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0 许可证" /></a>
</p>

<p align="center">
  <a href="https://lumno.kubai.design/">官网</a> ·
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#常见问题">常见问题</a> ·
  <a href="CHANGELOG.md">更新日志</a>
  <br />
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

**Lumno** 是一款 Manifest V3 浏览器扩展：在任意网页上提供键盘优先的**聚焦搜索命令栏**（类似 macOS Spotlight、Raycast 或 Arc 浏览器的命令栏），并用一个快速、极简的**新标签页**替换浏览器默认新标签页。按下 `Cmd+Shift+K` / `Ctrl+Shift+K`，即可搜索已打开标签页、书签、浏览历史和常用网站，打开网址、切换标签页，或把关键词直接发送到 Google、百度、Bilibili、知乎、GitHub、ChatGPT、DeepSeek、Kimi、豆包等。无需注册账号，浏览数据只留在你的浏览器中。

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="./assets/images/readme/chrome-web-store-large-bordered.png" alt="在 Chrome 应用商店获取 Lumno" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="./assets/images/readme/microsoft-edge-addons-badge.png" alt="在 Microsoft Edge 加载项获取 Lumno" width="200" />
  </a>
</p>

<p align="center">当前版本：<code>0.9.61</code></p>

<img width="1200" height="480" alt="Lumno Chrome 命令栏插件：在任意网页搜索标签页、书签和历史记录" src="./assets/images/readme/banner.webp" decoding="async" />

## 功能

### 类 Spotlight 的网页命令栏

在当前网页上唤起悬浮命令栏，打开网址、搜索关键词、切换到已打开的标签页、打开 `chrome://settings` 等浏览器内部页面或进入 Lumno 设置，全程无需鼠标。

### 一站式搜索标签页、书签和历史记录

整合书签、浏览历史、常用网站、浏览器搜索建议和已打开标签页。支持结果来源筛选、首位结果优先级、按选择习惯排序、拼音匹配和黑名单过滤；搜索结果可在当前标签页、左侧、右侧或标签栏末尾打开。

### 站内搜索与 AI 搜索

输入前缀即可在站内搜索：YouTube、Bilibili、GitHub、Google、Bing、百度、知乎、豆瓣、掘金、淘宝、X、Reddit、Wikipedia 等。也可直接向 AI 提问：ChatGPT、Gemini、DeepSeek、Kimi、豆包、千问、元宝、MiniMax。支持自定义搜索模板和别名。

### 聚合搜索：一次搜索多个引擎

将 2–10 个内置或自定义搜索源合并为一个搜索范围，同一个关键词同时在多个标签页打开结果；可自动归入以“聚合搜索名称：查询内容”命名的标签页组。

### 最近标签页切换器

按 `Alt+Q` 打开键盘标签页切换器，在最近使用的标签页之间快速跳转，就像浏览器里的 `Alt+Tab`。

### 划词 AI 快捷操作

在网页上选中文字，即可用你偏好的 AI 服务回答、翻译、解释、总结、搜索调研或计算，结果在新标签页（可选后台）打开。

### 可自定义的新标签页

简洁的新标签页替代方案：搜索框、最近/最常访问站点快捷方式、书签网格与文件夹级联菜单、书签分页和自定义文件夹颜色。支持快捷方式与书签互相拖动转换、固定或隐藏最近站点、用动态进度卡片追踪剧集和小说的最新集数/章节、每日一言（文学或诗词）、调整内容宽度，输入 `/zen` 进入专注的禅模式。

### 壁纸与主题

系统/浅色/深色主题，可全局生效或仅作用于新标签页。可选内置壁纸、Bing 每日壁纸、精选摄影与开放获取艺术作品，或使用本地图片、图片链接。支持遮罩透明度、颗粒/半调/抖色/ASCII 滤镜、搜索框宽度和 Lumno 字标开关。

### 画中画：网页剪裁与视频自动画中画

- **网页剪裁 PiP**：在支持的 HTTPS 页面中框选局部内容，放入 Document Picture-in-Picture 悬浮窗，方便参考和对照。
- **视频自动画中画**：切换标签页时，在 YouTube、Bilibili、腾讯视频、优酷、抖音、TikTok、Netflix、Twitch、Vimeo、Prime Video、Disney+ 等站点自动尝试进入视频画中画。

### Chrome 同步与 WebDAV 同步

设置默认通过 Chrome 浏览器内置同步。可选开启 [WebDAV 同步](#webdav-同步)（Beta），额外同步自定义快捷方式图标与上传的壁纸，支持坚果云和自建服务器。

### 浏览器增强与多语言

重启后恢复置顶标签页、受限页面回退到新标签页、一键复制当前页面链接、打开扩展快捷键页和详情页。界面支持简体中文、繁体中文、英文、日文，或跟随浏览器语言。

## 实机截图

<p align="center">
  <img src="./assets/images/readme/preview-newtab.webp" alt="Lumno 自定义新标签页：壁纸、快捷方式和书签" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="./assets/images/readme/preview-command-bar.webp" alt="Lumno 命令栏：搜索已打开标签页、书签和历史记录" width="100%" loading="lazy" decoding="async" />
</p>

## 快捷键

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 打开聚焦搜索命令栏 | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| 打开命令栏并预填当前页面链接 | `Cmd+Shift+L` | `Ctrl+Shift+L` |
| 复制当前页面链接 | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| 打开最近标签页切换器 | `Alt+Q` | `Alt+Q` |

浏览器可能会占用或限制扩展快捷键。请在 `chrome://extensions/shortcuts`、`edge://extensions/shortcuts` 或对应浏览器的扩展快捷键页面中修改。

Firefox 已占用 `Cmd+Shift+K` / `Ctrl+Shift+K` 等按键，因此 Firefox 版默认在 macOS 上使用 `Ctrl+Shift+K/L/C`，在 Windows 和 Linux 上使用 `Alt+K/L/C`，`Alt+Q` 不变。可在附加组件管理器的齿轮菜单 →「管理扩展快捷键」中修改。

## 安装

| 浏览器 | 安装入口 |
| --- | --- |
| Google Chrome | [Chrome 应用商店](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Microsoft Edge | [Microsoft Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc) |
| Brave、Arc、Vivaldi、Opera 等 Chromium 浏览器 | [Chrome 应用商店](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Firefox 140+、Zen、LibreWolf、Floorp 等 Firefox 系浏览器 | 尚未上架 Firefox 附加组件商店，可从源码构建（见[开发](#开发)） |

从源码安装：

1. 克隆或下载本仓库。
2. 运行 `npm ci` 和 `npm run build:react`（见[开发](#开发)）。
3. 打开 `chrome://extensions/` 或对应 Chromium 浏览器的扩展管理页，开启「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择仓库根目录。
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
| 评分邀请和评价入口 | 隐藏 | 等 Lumno 上架 Firefox 附加组件商店后恢复 |
| 设置同步 | 表现不同 | 使用 Firefox 同步而非 Chrome 同步。WebDAV 同步可在 Chrome 与 Firefox 之间进行，包括同一台电脑上同时打开两者 |

**Chromium 系浏览器。** Brave、Arc、Vivaldi、Opera 等使用 Chrome 应用商店的版本，功能与 Chrome 相同，但部分浏览器会占用或改写扩展快捷键。在 Dia 中，新标签页功能暂不可用，聚焦搜索可正常使用；如果快捷键无效，请在浏览器的快捷键设置中把「Open command bar」从 In Dia 改为 Global。

## 隐私

Lumno 本地优先。书签、历史和标签页仅在本机读取用于搜索，不会发送到 Lumno 或开发者服务器；没有 Lumno 账号、统计分析或广告追踪。网站图标、每日一言、在线壁纸和 WebDAV 等需要联网的可选功能，只在你开启后才会请求第三方服务。完整说明见[隐私政策](https://lumno.kubai.design/privacy/)。

## 常见问题

**Lumno 免费吗？**
免费。Lumno 以 GPL-3.0 许可证开源。如果想支持开发，可以查看[赞助说明](SPONSORING.zh-CN.md)。

**支持哪些浏览器？**
支持 Manifest V3 扩展的 Chromium 浏览器（Google Chrome、Microsoft Edge、Brave、Arc、Vivaldi、Opera 等），以及 Firefox 140 及以上版本和 Zen、LibreWolf 等 Firefox 系浏览器。Firefox 中有少数功能不可用，见[浏览器兼容性](#浏览器兼容性)。暂不支持 Safari。

**设置能在多台设备间同步吗？**
可以。登录浏览器后，设置会通过 Chrome 内置同步；开启 [WebDAV 同步](#webdav-同步)后，还能通过你自己的服务器同步自定义图标和壁纸。

**为什么有些页面打不开命令栏？**
浏览器禁止扩展在 `chrome://` 等内部页面和 Chrome 应用商店中运行，这些页面上 Lumno 会回退到新标签页。本地文件请开启「允许访问文件网址」。

**如何修改快捷键？**
打开 `chrome://extensions/shortcuts`（或 `edge://extensions/shortcuts`），为 Lumno 设置新的按键。

**和 Chrome 自带的标签页搜索有什么不同？**
Lumno 同时搜索标签页、书签、历史和常用网站，额外提供站内搜索和 AI 搜索前缀、聚合搜索和最近标签页切换器，并且直接在当前网页上以浮层打开，而不只是在工具栏中。

## WebDAV 同步

WebDAV 为 Beta 功能，入口在「设置 → 账号与同步」。添加连接并填写 HTTPS 地址、同步目录、用户名与应用密码，点击「保存并开启同步」即可。它与原有 Chrome 同步同时运行，额外同步自定义快捷方式图标与上传的壁纸；图片不进入 Chrome Sync。连接信息仅保存在各自设备上。

首次连接已有远端数据时选择初始版本，后续冲突仅选择冲突内容采用的版本，其他改动仍合并，替换前保留备份。界面显示最近成功同步时间，关闭 WebDAV 不影响 Chrome 同步。详细行为与兼容要求见 [WebDAV 同步说明](docs/webdav-sync.md)。

## 开发

开发和 CI 使用 Node.js 20。如果使用 `nvm`，运行 `nvm use` 即可切换到 `.nvmrc` 中声明的版本。

项目中的 React 页面需要先生成浏览器加载的产物。首次加载开发版，以及修改 `react-src/` 后，请运行：

```bash
npm ci
npm run build:react
```

然后在 `chrome://extensions/` 中保持「开发者模式」开启，并将仓库根目录作为已解压扩展加载。生成新产物，或修改后台脚本、`manifest.json` 后，请在扩展管理页手动点击「重新加载」。开发版不会在 Chrome 用户配置启动时主动二次刷新，以免中断启动阶段的新标签页接管。

提交前建议运行：

```bash
npm run verify
npm run audit:i18n
npm run audit:style
npm run package:store
```

常用专项测试示例：

```bash
npm run test:settings
npm run test:search
npm run test:site-search-store
npm run test:message-router
npm run test:newtab-layout
npm run test:onboarding-content
```

`npm run package:store` 会读取 `manifest.json` 的版本号，并生成 `dist/lumno-store-v<version>.zip`。本命令依赖系统可用的 `zip` 和 `zipinfo`。

`npm run package:firefox` 会先生成商店包，再转换为 `dist/firefox` 中的 Firefox 版。所有 Firefox 专属改动都列在 `scripts/build-firefox.js` 中：用后台脚本替代服务工作线程、Gecko 扩展 ID、Firefox 快捷键、去掉自动画中画脚本，以及用带 `__firefox` 后缀的语言条目替换对应的基础文案。试用时打开 `about:debugging#/runtime/this-firefox`，选择「临时加载附加组件」，再选中 `dist/firefox/manifest.json`；运行 `npm run lint:firefox` 可用 `web-ext` 检查。共享代码中请调用 `LumnoBrowserProfile.isFirefoxExtensionRuntime()` 判断运行环境，不要直接检查 URL 协议；只属于某一类浏览器的界面用 `data-browser-only="chromium"` 标记（在其他浏览器中隐藏），设置项则用 `data-browser-unsupported="firefox"`（显示为禁用并说明原因）。

### 目录结构

| 路径 | 说明 |
| --- | --- |
| `manifest.json` | Manifest V3 配置、权限、命令、内容脚本和新标签页覆盖配置 |
| `src/background/` | Service worker、命令分发、搜索数据、站内/AI 搜索、标签页切换器、PiP 所有权、置顶标签页恢复、WebDAV 同步 |
| `src/newtab/` | 新标签页 UI、搜索、最近站点、书签、壁纸、反馈和页面提示 |
| `src/overlay/` | 网页内命令栏浮层、结果列表、主题/语言同步和站点修正 |
| `src/content/` | 页面快捷键监听、划词快捷操作、网页剪裁 PiP、视频自动 PiP |
| `src/options/` | 扩展设置页 |
| `src/onboarding/` | 安装/更新引导页 |
| `src/shared/` | 设置、搜索、favicon、菜单、提示、URL 守卫等共享模块 |
| `react-src/` | React 源码，构建产物输出到 `src/react/` |
| `_locales/` | 扩展 UI 文案 |
| `assets/data/` | 内置站内搜索和浏览器快捷入口数据 |
| `assets/wallpapers/` | 新标签页内置壁纸与缩略图 |
| `scripts/` | 校验、审计、打包和回归测试脚本 |

## 参与贡献

欢迎在 [Issues](https://github.com/kubai087/lumno-extension/issues) 反馈问题、提出建议或提交 Pull Request。项目维护方式见 [GOVERNANCE.md](GOVERNANCE.md)。如果 Lumno 帮你节省了时间，欢迎在 GitHub 点个 ⭐，或在 Chrome 应用商店留下评价，让更多人发现它。

## 鸣谢

- 日文本地化：感谢 [Humi](https://github.com/Hum1Tab) 参与日文翻译与校对。
- macOS `Ctrl+N` / `Ctrl+P` 结果导航实验功能：基于 [wanghanzhen](https://github.com/wanghanzhen) 在 [PR #38](https://github.com/kubai087/lumno-extension/pull/38) 中的贡献。
- 内置图标集：[Remix Icon](https://remixicon.com/)
- 内置字体：Open Sans；[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)（SIL OFL 1.1，子集化后用于每日一言）

## 许可证

本项目使用 [GPL-3.0](LICENSE) 许可证。
