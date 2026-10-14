# 自定义网站显示模式

适用版本：本 fork 的 1.0.2。

1. 点击新标签页的“最常访问”标题，在显示模式中选择“自定义”。也可在设置或外观面板中切换。
2. 点击“管理网站”，输入名称和 HTTP / HTTPS 网址，再点击“添加网站”。不写协议时默认使用 HTTPS。
3. 用上移 / 下移按钮调整顺序，用编辑按钮更改名称或网址，用移除按钮删除列表中的网站。
4. 保留原有卡片和行数设置；每页容量由现有行数与当前网格列数决定，列表超出容量时通过标题栏翻页。最多保存 24 个网站；行数设为 0 时隐藏整个区域。
5. 管理区在卡片网格上方内联展开。再次点击“管理网站”或在管理区内按 Esc 收起；右击自定义卡片会直接打开编辑。

列表使用 `chrome.storage.local` 的 `_x_extension_newtab_custom_recent_sites_2026_unique_` 键，随刷新保留，同一扩展的其他标签页会更新。列表不会混入历史记录，不改变原生收藏夹或浏览历史；列表不参与浏览器或 WebDAV 同步。显示模式沿用原来的设置同步。

自定义模式直接读取手动列表，绕过最近访问／最常访问的自动数据源，也不合并原有固定网站或应用自动来源的隐藏、排除过滤。切回原有模式后恢复其原有处理流程。

保存会验证 HTTP / HTTPS 协议、规范化后的重复网址和 24 个网站的数量限制，不接受带用户名或密码的网址；失败时保留输入并展示错误。Web Locks 可用时，扩展页面使用同名锁串行保存；写入前会重新读取并比较规范化后的列表快照，发现冲突则更新列表、提示检查后重试。Web Locks 不可用时仍执行快照检查，但不提供并发写入的串行保证。

`node scripts/test-custom-recent-sites.js` 验证增删改、排序、分页、网址校验、保存失败、刷新恢复、跨标签页更新和自动数据源隔离。Windows 可直接运行 `npm run package:store`，无需另外安装 ZIP 工具。

## 审阅结论

Reviewer disposition: SHIP。本次仅通过源码核对确认焦点、标题栏可读性与错误对比度修复；未运行测试、重建或浏览器实机验收。

- 焦点：打开管理区或编辑网站时聚焦名称输入框；成功保存、取消编辑后回到名称输入框；在管理区按 Esc 收起后回到“管理网站”。列表重绘按网站与操作恢复可用按钮焦点，成功移动后聚焦移动后的行，成功移除后聚焦相邻行或名称输入框。
- 标题栏与主题：管理和分页控件使用现有 `--x-nt-bg` 背景与 `--x-nt-text` 文字色，保持控件文字与壁纸分离；编辑区沿用 Lumno 的字体、圆角、边框和浅色／深色主题变量。600px 及以下的表单改为单列，行操作允许换行。
- 错误与无障碍：浅色错误文字为 `#b91c1c`，深色为 `#fca5a5`，分别显示在主题编辑区背景上。按钮和输入框有 2px 可见焦点轮廓；字段有标签，行操作包含网站名称的无障碍标签；校验错误关联 URL 输入框并标记无效，错误使用 `role="alert"`，保存反馈使用 `role="status"`，展开按钮提供 `aria-controls` 与 `aria-expanded`。

## Direction contract

THESIS: Extend recent sites with a manually managed source.
OWN-WORLD: Preserve Lumno tokens, themes, cards and mode controls.
STORY: Choose Custom; add sites; edit their order; return to the cards.
FIRST VIEWPORT: Heading and Manage sites button, inline editor above the grid, paging in the header.
FORM: Narrow extension, Operate; no concept roll or new visual identity.
FINISH: Verify desktop, dark and mobile views, keyboard behavior, persistence and source isolation; review the changed feature.
