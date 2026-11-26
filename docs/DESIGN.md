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

## 5. 构建与发布纪律

- 构建后必须单独核验退出码（日志落文件后检查），不得用管道掩盖构建失败。
- 测试与生产使用同一份代码、不同构建变量；先在测试环境验收，再谈生产发布。
- 单页应用需保证深路径可直接访问（静态托管侧做 SPA 兜底）。
