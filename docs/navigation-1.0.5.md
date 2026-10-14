# 1.0.5 导航交互更新

三项功能沿用现有 Lumno 界面：三种书签模式的图钉入口、自定义 Markdown 句库、关闭其他标签页的明确取消／确认。

## 从书签添加快捷方式

多层文件夹视图、多级列表视图、顶部书签栏三种模式均可在网站书签上使用图钉；文件夹及嵌套菜单内的网站也提供入口，文件夹本身不作为网站添加。点击图钉或聚焦后按 Enter／Space，即沿用既有保存流程加入最后一个快捷方式分组，不打开编辑器、不触发网站导航。

实心图钉表示“已添加”，不用于移除，也不会重复添加。保存期间阻止重复操作，多个添加按队列保存，失败可重试；快捷方式增删后状态同步更新。新建的是独立快捷方式，原书签不移动、不修改、不删除。原“从收藏夹选择”对话框与“自定义最常访问”继续可用。

## 导入每日名句

在“外观”下打开“每日名句”（Daily quote），启用后将来源切换为“自定义”（Custom），点击导入 Markdown 文件。支持 `.md`／`.markdown`：每个空行分隔的段落或每个列表项作为一句；也可使用引用块，并在最后一行用 `— 作者` 标注作者，作者可省略。标题及围栏代码块忽略，内容按纯文本处理。

文件最多 1 MB，句库最多 1,000 条，每句正文最多 500 字符。句库仅存于本设备，自定义模式不请求 Hitokoto。每天按本地日期选句，“换一句”的选择会保存，刷新后保留，当天不会因刷新随机切换。

解析或保存失败保留旧句库；修正文件后可重新导入。保存失败的恢复提示为“无法在本机保存句库，原句库已保留。请重试。”首次尚未导入时提示导入文件开始使用。示例见[自定义句库](../../../outputs/custom-quotes-example.md)。

## 关闭其他标签页

点击“关闭其他标签页”先显示取消／确认提示，默认焦点在“取消”。点击取消、按 Esc 或点击提示外部均仅关闭提示；只有明确激活“确认”才执行关闭。当前标签页、固定标签页及分组标签页保留。触摸设备上的取消／确认按钮提供至少 44px 操作目标，沿用原有主题与确认样式。

## 已有验证与交付

- 检查、类型、构建及 manifest 均通过；旧全量套件全部 198 个测试文件通过；React 的 53 个测试文件、402 项测试通过；四种语言共 1,141 个键，缺失为 0。
- 隔离 Edge 的源码扩展与最终 ZIP 完整流程均通过：三种书签模式及嵌套入口、自定义句库持久化且不请求 Hitokoto，以及取消／Esc／确认和受保护标签页保留。
- Boyle 最新 finish 复核在本功能范围内处置为 `SHIP`；触摸目标与本地保存提示两项发现均已解决。该结论不构成全局设计批准，无后续 UI 修正计划。

交付物位于工作区根目录的 `outputs`：[安装 ZIP](../../../outputs/lumno-edge-1.0.5.zip)、解压目录 `outputs/lumno-edge-1.0.5/`，以及上述 Markdown 示例。文档整理仅记录上述实现与验证，保留六块约定，不修改全局 `DESIGN.md`。

## Direction contract

THESIS: Keep collection, daily reading and destructive actions understandable and deliberate.
OWN-WORLD: Preserve Lumno cards, cascade menus, appearance settings and shared confirmation styling.
STORY: Pin from any bookmark mode; import a local Markdown collection; explicitly confirm tab closure.
FIRST VIEWPORT: Pin beside bookmark actions; quote source/import in the existing Daily quote section; Cancel beside destructive confirmation.
FORM: Narrow Operate additions; no new visual identity or conceptual comps.
FINISH: Verify all bookmark modes, Markdown safety and persistence, cancel/confirm behavior, keyboard and responsive themes; scope-bound review and documentation.
