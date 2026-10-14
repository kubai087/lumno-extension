# 书签卡片图钉入口

在书签卡片复制按钮左侧提供图钉入口，一次点击把网站保存为独立快捷方式；原书签保持不变。新增项目沿用原有快捷方式保存流程，加入最后一个快捷方式分组。已经添加的项目显示实心图钉，点击不会取消或重复添加。

## 用法与实际行为

- v1.0.4 的入口限于网站书签卡片的网格／列表视图，当时不包含顶部栏。v1.0.5 已覆盖网格、列表、顶部栏三种视图，以及文件夹／嵌套菜单内的网站；文件夹本身不作为网站添加。原“从收藏夹选择”对话框及“自定义最常访问”模式保持原有行为。最新用法与验证见 [1.0.5 导航交互更新](navigation-1.0.5.md)，下方验证记录为 1.0.4 的历史记录。
- 桌面悬停卡片或焦点进入卡片时显示图钉与复制按钮；图钉位于复制左侧，按钮为 30 × 30px，标题在操作显示时预留 64px。无悬停或粗指针设备上，两按钮始终可见、各为 44 × 44px，标题预留 88px。
- 点击图钉或聚焦后按 Enter／Space 添加，不触发卡片导航。实心图钉表示“已添加”，依据实际快捷方式数据更新；在快捷方式区添加或移除后，图钉状态同步变化。
- 保存期间显示加载图标并阻止重复操作；失败提示可重试。连续添加多个书签按队列串行保存，复用既有网址校验、去重、数量限制和持久化流程，不修改原书签。
- 图钉使用原卡片主题色与 Remix 图标，键盘焦点有 2px 轮廓。全局输入焦点逻辑仅对聚焦图钉的 Enter／Space 放行，保留原有输入即聚焦搜索的行为。

## 已有验证与复核

- React 测试 401 项通过；旧全量套件重跑完成，全部 197 个测试文件通过。类型、语法、构建、manifest、国际化及打包检查通过；此前三个回归测试工具的预算问题已修正，定向复跑通过。
- 隔离 Edge 中，源码扩展与最终 ZIP 的完整流程均通过：鼠标、Enter、触摸添加且无误导航，保存恢复、原书签不变、重复禁加、并发添加、移除／刷新及移动端 44px 操作目标。
- Halley 最终完整复核已纠正无效整页截图，采用 390 × 844 视口检查；功能范围内无实质发现，处置为 `SHIP`。整份 CSS 检测中的既有字体／布局警告位于图钉范围之外，保持现有视觉体系；结论不扩展为全局设计批准。

本次仅补充本文件，保留下方六块约定；未运行新测试或构建，未新增资产、修改源码或全局 `DESIGN.md`。

## Direction contract

THESIS: Add a bookmark to shortcuts in one click without opening another editor.
OWN-WORLD: Preserve Lumno cards, theme colors and the existing copy action; use Remix pin icons.
STORY: Hover or focus a bookmark; press pin; see saved state and existing confirmation.
FIRST VIEWPORT: Compact pin immediately left of copy; title reserves action space; touch targets grow on coarse pointers.
FORM: Narrow Operate extension of the existing bookmark grid/list, not a redesign.
FINISH: Verify click isolation, duplicate and failed saves, live status, desktop/dark/mobile and keyboard; finish review and feature-only documentation.
