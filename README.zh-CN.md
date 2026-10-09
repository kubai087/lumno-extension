<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno</h1>

<p align="center">
  聚焦搜索 & 极简新标签页
  <br />
  在任意网页快速搜索、直达网址、切换标签页，并增强新标签页体验。
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



Lumno 是一个面向 Chromium 浏览器的 Manifest V3 扩展，把「聚焦搜索命令栏」和「极简新标签页」放在一起：你可以从任意网页快速搜索书签、历史、常用网站、已打开标签页、站内搜索和 AI 助手，也可以把新标签页整理成更好用的工作入口。

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="./assets/images/readme/chrome-web-store-large-bordered.png" alt="Get it from Chrome Web Store" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="./assets/images/readme/microsoft-edge-addons-badge.png" alt="Get it from Microsoft Edge" width="200" />
  </a>
</p>

<p align="center">当前版本：<code>0.9.60</code></p>

<img width="1200" height="480" alt="Lumno command bar preview" src="./assets/images/readme/banner.webp" decoding="async" />

## 功能亮点

- 聚焦搜索命令栏：在任意可注入网页唤起悬浮搜索，支持打开网址、搜索关键词、切换已打开标签页、打开浏览器内部页面和进入 Lumno 设置。
- 智能搜索结果：整合书签、历史记录、常用网站、浏览器建议和当前已打开标签页，支持结果来源筛选、首位结果优先级、访问选择权重、拼音匹配和黑名单过滤。
- 站内搜索 / AI 搜索：内置 YouTube、Bilibili、GitHub、Google、Bing、Baidu、Zhihu、Douban、Juejin、Taobao、X、Reddit、Wikipedia 等快捷前缀；同时支持 ChatGPT、Gemini、豆包、千问、元宝、MiniMax、DeepSeek、Kimi 等 AI 入口。你也可以添加自定义模板和别名。
- 聚合搜索：可将 2–10 个内置或自定义搜索源合并为一个搜索范围，一次查询同时打开多个结果标签页；是否自动归入以关键词命名的标签页组，可在“常规”设置中统一控制。
- 新标签页：提供搜索框、最近/最常访问站点卡片、书签网格/文件夹级联菜单、书签分页、最近站点固定与隐藏、反馈入口和可调内容宽度。
- 外观与壁纸：支持系统/浅色/深色主题，全局或仅新标签页生效；新标签页内置多套壁纸，支持本地壁纸、遮罩透明度、颗粒/半调/抖色/ASCII 滤镜、搜索框宽度和 Lumno 字标开关。
- 网页剪裁 PiP：在支持 Document Picture-in-Picture 的 HTTPS 顶层页面中选择页面局部内容，放入悬浮窗口用于参考和对照。
- 视频自动画中画：在 YouTube、Bilibili、Youku、腾讯视频、抖音、TikTok、Netflix、Vimeo、Prime Video、Disney+、Twitch 等站点切换标签页时，尝试自动进入视频 PiP。
- 标签页与浏览器增强：支持重启后恢复置顶网页标签页、受限页面回退到新标签页、复制当前页面链接、打开扩展快捷键页和扩展详情页。
- 多语言：扩展 UI 支持简体中文、繁体中文、英文、日文和跟随浏览器语言；本 README 支持简体中文、英文、日文切换。

## 实机截图
<p align="center">
  <img src="./assets/images/readme/preview-newtab.webp" alt="Lumno new tab preview" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="./assets/images/readme/preview-command-bar.webp" alt="Lumno command bar preview" width="100%" loading="lazy" decoding="async" />
</p>

## 快捷键

| 操作 | 默认快捷键 |
| --- | --- |
| 打开聚焦搜索命令栏 | `Cmd+Shift+K` / `Ctrl+Shift+K` |
| 打开命令栏并预填当前页面链接 | `Cmd+Shift+L` / `Ctrl+Shift+L` |
| 复制当前页面链接 | `Cmd+Shift+C` / `Ctrl+Shift+C` |

浏览器可能会占用或限制扩展快捷键。请在 `chrome://extensions/shortcuts`、`edge://extensions/shortcuts` 或对应浏览器的扩展快捷键页面中修改。

## 安装使用

可通过上方的 Chrome Web Store 或 Microsoft Edge Add-ons 入口安装。

手动安装：

1. 克隆或下载本仓库。
2. 打开 `chrome://extensions/`，或在 Edge/Brave/Vivaldi/Opera 等 Chromium 浏览器中打开对应的扩展管理页。
3. 开启「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择仓库根目录。
5. 可选：进入扩展的设置页，调整语言、主题、新标签页内容、站内搜索、黑名单、PiP 和快捷键策略。

如果需要在本地 HTML、PDF 或 `file://` 页面使用聚焦搜索，请在扩展详情页开启「允许访问文件网址」。

## WebDAV 同步

WebDAV 为 Beta 功能，入口在「设置 → 账号与同步」。添加连接并填写 HTTPS 地址、同步目录、用户名与应用密码，点击「保存并开启同步」即可。它与原有 Chrome 同步同时运行，额外同步自定义快捷方式图标与上传的壁纸；图片不进入 Chrome Sync。连接信息仅保存在各自设备上。

首次连接已有远端数据时选择初始版本，后续冲突仅选择冲突内容采用的版本，其他改动仍合并，替换前保留备份。界面显示最近成功同步时间，关闭 WebDAV 不影响 Chrome 同步。详细行为与兼容要求见 [WebDAV 同步说明](docs/webdav-sync.md)。

## 开发

项目中的 React 页面需要先生成浏览器加载的产物。首次加载开发版，以及修改 `react-src/` 后，请运行：

```bash
npm ci
npm run build:react
```

然后在 `chrome://extensions/` 中保持「开发者模式」开启，并将仓库根目录作为已解压扩展加载。生成新产物，或修改后台脚本、`manifest.json` 后，请在扩展管理页手动点击「重新加载」。开发版不会在 Chrome 用户配置启动时主动二次刷新，以免中断启动阶段的新标签页接管。

提交前建议运行：

```bash
npm test
npm run check
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

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `manifest.json` | Manifest V3 配置、权限、命令、内容脚本和新标签页覆盖配置 |
| `src/background/` | Service worker、命令分发、搜索数据、站内/AI 搜索、PiP 所有权、置顶标签页恢复 |
| `src/newtab/` | 新标签页 UI、搜索、最近站点、书签、壁纸、反馈和页面提示 |
| `src/overlay/` | 网页内聚焦搜索浮层、结果列表、主题/语言同步和站点修正 |
| `src/content/` | 页面快捷键监听、网页剪裁 PiP、视频自动 PiP |
| `src/options/` | 扩展设置页 |
| `src/onboarding/` | 安装/更新引导页 |
| `src/shared/` | 设置、搜索、favicon、菜单、提示、URL 守卫等共享模块 |
| `_locales/` | 扩展 UI 文案 |
| `assets/data/` | 内置站内搜索和浏览器快捷入口数据 |
| `assets/wallpapers/` | 新标签页内置壁纸与缩略图 |
| `scripts/` | 校验、审计、打包和回归测试脚本 |

## 鸣谢

- 日文本地化：感谢 [Humi](https://github.com/Hum1Tab) 参与日文翻译与校对。
- 内置图标集：[Remix Icon](https://remixicon.com/)
- 内置字体：Open Sans；[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)（SIL OFL 1.1，子集化后用于每日一言）

## 许可证

本项目使用 [GPL-3.0](LICENSE) 许可证。
