# 设计说明 — 极速开发工具箱（Easy Dev Tools）

> 本文档记录技术与视觉设计约定，供后续迭代轮次遵循。署名：hxd。

## 1. 技术栈

- Vue 3.4 + Vue Router 4 + Vite 5，纯 JavaScript（无 TypeScript）。
- 依赖保持精简：`vue`、`vue-router`、`qrcode`；新增依赖需说明必要性，优先原生实现。
- 工具注册表：`src/router/tools-config.js` 的 `toolGroups` 是工具列表、路由与 SEO 的单一数据源，新增工具只改此处并新增对应视图组件。

## 2. 目录约定

- `src/views/tools/<分类>/`：各工具页面，按 text / converter / generator / crypto / image 分类。
- `src/components/`：跨工具公共组件（布局、工具栏、状态提示、示例/FAQ 等）。
- `src/composables/`：可复用逻辑（如 `useSeo`）。
- `src/config/`：构建期注入的静态配置（如版本信息 `version.js`）。

## 3. 版本与环境

- 版本号以 `package.json` 的 `version` 为准，构建时由 `vite.config.js` 注入为全局常量。
- 环境由构建变量 `VITE_APP_ENV` 决定，取值 `prod` / `test` / `dev`（未设置时为 `dev`）：
  - 生产构建：`VITE_APP_ENV=prod npm run build`，徽标显示如 `v1.0.0`。
  - 测试构建：`VITE_APP_ENV=test npm run build`，徽标显示如 `v1.0.0_test`。
  - 本地开发：徽标显示如 `v1.0.0_dev`。
- 页脚同时展示版本徽标与版权「© <年份> morijiu.cn」。

## 4. 视觉与交互约定

- 风格紧凑现代：常规间距 8/12/16px，卡片圆角 8–12px，按钮高度以 32–36px 为主，避免大留白与大按钮。
- 工具页统一使用公共布局组件，保证输入区、操作区、输出区的位置与行为一致。
- 所有可复制结果提供一键复制与成功反馈；错误输入给出就近的中文错误提示，不弹全局模态。
- 移动端优先保证单列可用、点击目标不小于 40px；桌面端再做多列增强。
- 暗色模式自 R4a 起落地：颜色一律走 `src/style.css` 的 CSS 变量（`--bg` / `--surface` / `--border` / `--text` / `--text-2` / `--text-3` / `--accent-soft` 等），组件内禁止再写死中性色；强调色（`#667eea` 渐变）与成功/危险等语义色可保留。主题由 `src/composables/useTheme.js` 管理（亮 / 暗 / 跟随系统，持久化键 `edt:theme`，生效值写入 `<html data-theme>`），`index.html` 有首屏防闪烁脚本与之保持一致。
- 工具页主容器（`.tool-container`）阴影一律用 `var(--shadow-md)`（R9a 起全站统一）：该变量亮/暗两套主题取值不同（暗色更深），写死 `rgba(0,0,0,0.1)` 类字面量会在暗色下几乎不可见、与其它工具页不一致。
- 中性卡片/浮层阴影同样禁止写死黑色字面量（R9b 起）：小卡片与图片用 `var(--shadow-card)`、hover 与强调浮层用 `var(--shadow-card-hover)`、细边阴影用 `var(--shadow-sm)`，取值均在 `src/style.css` 按亮/暗两套主题定义；强调色渐变按钮的彩色辉光阴影为有意设计，不在此列。
- 代码语法高亮色一律走 `--syntax-*` 变量（R9c 起）：亮色值为 GitHub 亮色口径，暗色值已按暗背景校准对比度（均 ≥6:1）；禁止在组件里写死单主题高亮色——亮色调色板（如 `#005cc5`）在暗背景上对比度只有约 2.6:1。语义徽标背景/文字同样用 `--danger-soft`/`--danger-text` 等成对变量，不写死浅色底（如 `#fee`）。
- CSS 变量引用必须先在 `src/style.css` 定义（R9d 起）：禁止引用未定义变量（如已废弃的 `--text-1`）或靠 fallback 掩盖缺失——`--warning`/`--warning-text`/`--warning-soft`/`--warning-border` 警告色族与 `--on-accent` 已按亮/暗两套主题定义（暗色警告文字 `#fbbf24`，在暗背景上对比度 ≥7.8:1；旧 fallback `#b45309` 在暗色下仅约 2.6–3.5:1）；`--warn-soft` 为既有别名，与 `--warning-soft` 同值保留。页脚统计分隔点等中性元素用 `--text-3`，不写死单主题灰（如 `#cbd5e1` 亮色下对比度仅 1.33:1）。
- 键盘与无障碍自 R5 起落地：命令面板 `src/components/CommandPalette.vue` 全局挂载，`Ctrl+K` / `Cmd+K` 开关、非输入区按 `/` 打开、`Esc` 关闭，支持方向键 + Enter 选择；Header 搜索按钮通过 `edt:open-command-palette` 事件唤起。新增交互控件须带 `aria-label`，键盘焦点统一走全局 `:focus-visible` 焦点环，不要单独移除 outline；页面保留「跳到主要内容」跳过链接（`#main-content`）。表单控件（input/select/textarea）必须有可达名（R9f 起全站 324 个控件已清零）：与可见 `<label for>` 关联、被 `<label>` 包裹、或带 `aria-label` 三者居一；仅有相邻未关联的 `<label>` 文本或 placeholder 不算——placeholder 不是标签。分组字段（如 RGB 三个分量框共用一个组标签）须逐个带 `aria-label` 注明组名与分量。
- SEO 与分享口径（R9e 起）：canonical / og:url 一律本站域名 `https://tools.morijiu.cn` + 工具真实路由路径（`tools-config` 的 `path`），禁止写其它域名或臆造路径（如已废弃的 `easy-dev-tools.com/tools/<id>`）；`og:image` / `twitter:image` 引用的图片文件必须真实存在于 `public/`（`og-image.png` / `twitter-image.png`，1200×630），改引用前先确认文件落地。纯图标/Emoji 按钮（如 📋 复制钮）必须带 `aria-label` 说明动作与对象，屏幕阅读器读不出 Emoji 含义。
- 图片与装饰图标可达名（R9h 起）：与文字相邻的装饰性图标元素（class 含 `icon` 的 span/div，如按钮前的 📝/🗑️/📋、卡片与分组图标、About 的 section-icon）一律加 `aria-hidden="true"`，避免屏幕阅读器把 Emoji 名逐个念出、与相邻文字重复；纯图标按钮（内容只有图标/符号、如 Markdown 工具栏与逐条 📋 复制钮、图片移除 ×）必须带 `aria-label` 说明动作与对象，仅有 `title` 不算可达名。品牌 Logo 图片与相邻品牌名文字并存时 `alt=""`（装饰），避免同一名称读两遍；有内容的图片 `alt` 用中文描述内容（如「生成的二维码图片」），不用英文占位。普通元素（如无 role 的 div）上的 `aria-label` 不会被读出，不要用它代替 `aria-hidden` 或真实文本。
- 状态消息必须可播报（R9k 起）：全站状态反馈走共享组件 `ToolStatusMessage`（72 个工具页共用），组件按类型给出 live region 语义——错误用 `role="alert"` + `aria-live="assertive"`、成功/信息用 `role="status"` + `aria-live="polite"`，均带 `aria-atomic="true"`，屏幕阅读器才会主动念出「成功/失败」结果；禁止只靠颜色与视觉出现传达状态。自带的状态段落（如哈希校验结果）同样须带 role/aria-live。各工具自带的动态提示条（计算后才出现的 notes/warnings/截断与处理提示，R9l 起）统一带 `role="status"` + `aria-live="polite"`，让「已自动处理/需要注意」类信息也能被读屏播报；静态说明文字（常驻的格式提示、字段说明）不加 live region，避免进页即朗读。
- 自动移动内容必须可暂停（R9j 起）：持续自动滚动/移动超过 5 秒的内容（如首页工具弹幕 Danmaku）必须提供暂停/继续开关（带 `aria-pressed` 与 `aria-label`），且鼠标悬停、键盘焦点进入区域时自动暂停（`animation-play-state: paused`），方便点中与读清移动中的链接；系统 `prefers-reduced-motion: reduce` 时默认静止——组件内显式 `animation: none` 并默认暂停，不要只依赖全局规则压缩动画时长（那会跳到末帧而非停在起点）。
- 披露菜单须多通道可操作（R9i 起）：Header「全部工具」下拉一类的展开菜单禁止只靠鼠标悬停打开——触发按钮必须可点击切换、带 `aria-expanded` 与 `aria-controls` 指向菜单，并支持 Esc 关闭并回焦、焦点离开区域自动关闭、点击外部关闭、路由变化关闭；悬停只作鼠标用户的快捷方式，不能是唯一入口（触屏与键盘用户没有 hover）。
- 示例区可达名（R9m 起）：共享组件 `ToolExamples` 的标题与按钮内装饰 Emoji（📝/🚀）须用 `<span aria-hidden="true">` 包裹（同 R9h 口径，不限于 class 含 icon 的元素）；同页多个「使用此示例」按钮的可达名禁止完全相同——按钮须带含示例序号与说明的 `aria-label`（如「使用示例 1：格式化 JSON」），屏幕阅读器与语音控制用户才能区分要触发哪一个。共享组件卡片网格列宽用 `minmax(min(<列宽>, 100%), 1fr)`，不裸写 `minmax(300px, 1fr)` 以防窄容器溢出（同 R7d 口径，`ToolExamples`/`ToolFeatures` 已统一）。
- 三级文字对比度（R9o 起）：`--text-3` 被页脚、提示、统计、行号、placeholder 等小字广泛用作正文色，取值必须在两套主题的主背景（surface/bg/bg-soft）上均 ≥4.5:1——亮色 `#646c78`（旧值 `#9ca3af` 仅 2.28–2.54:1）、暗色 `#8b94a5`（旧值 `#6b7280` 仅 3.03–3.91:1）；不得为「更淡的灰」调浅，层级感靠字号与字重拉开，不靠牺牲对比度。
- 标题层级与地标（R9g 起）：全站只有一个 `<main>`（`MainLayout` 的 `#main-content`），页面与工具组件禁止再嵌套 `<main>` 或 `role="main"`，根元素用 `<div>`。标题不得跳级：页面 `<h1>` 后的一级小节用 `<h2>`（含页脚栏目名、编辑面板标题与各工具的结果/设置小节），`<h3>` 只用于 `<h2>` 之下的子项（如功能特点卡片）；改标题级别时同步改对应 CSS 选择器并靠 class 固定字号，不靠标签默认字号。多个 `<nav>` 并存时每个都要有 `aria-label` 区分（主导航 / 分类快速导航）。

## 5. 构建与发布纪律

- 构建后必须单独核验退出码（日志落文件后检查），不得用管道掩盖构建失败。
- 测试与生产使用同一份代码、不同构建变量；先在测试环境验收，再谈生产发布。
- 单页应用需保证深路径可直接访问（静态托管侧做 SPA 兜底）。
