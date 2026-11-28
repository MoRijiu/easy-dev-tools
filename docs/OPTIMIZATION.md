# 代码优化盘点（R10a，2026-11-28）

R10 代码优化阶段的起点盘点：摸清重复逻辑、大组件、产物基线与死代码，为后续收敛定序。所有优化以**行为等价**为前提，每批迁移都要有回归冒烟与体积对比证据。

## 规模基线

- `src` 代码文件 170 个、约 38,084 行；工具组件 72 个、合计 17,624 行（均 245 行）。
- 最大文件：`src/router/tools-config.js` 1,172 行（工具元数据，属数据文件）；其后是 ImageConverter 1,010 行、ImageCompress 908 行、QrcodeGenerator 859 行、HashCalculator 742 行、UnitConverter 673 行、Header 647 行、TimestampConverter 626 行、AesEncryption 589 行、MarkdownEditor 561 行、PasswordGenerator 560 行、ColorConverter 555 行。
- 产物基线（2026-11-28 test 构建，exit=0）：dist 共 1,979,129 B / 178 个文件；JS 1,370,961 B / 88 个分块，CSS 240,726 B / 78 个文件。最大分块：QrcodeDecoder 145,546 B（jsQR，已按路由懒加载）、vue-vendor 99,794 B、主包 index 90,940 B（gzip 约 28.5 KB）。

## 重复逻辑清单（R10b 对象）

1. **状态消息自管**：71/72 个工具各自维护 `statusMessage`/`statusType` 两个 ref；展示层已统一用 ToolStatusMessage 组件，但状态写入与「2 秒后只清自己这条消息」的守卫写法（先存 `ownMsg` 再在 setTimeout 里比对）在各工具手抄多份（ColorConverter 一文件内就出现 3 处）。→ 抽 `useStatusMessage()` composable 统一提供 `showSuccess/showError/info` 与守卫式自动清除。
2. **复制逻辑自管**：69 个文件直调 `navigator.clipboard.writeText`（共 74 处），55 个工具各自定义 copy/copyText 函数，try/catch 后写状态消息的骨架高度同构；全仓无 execCommand 回退（失败统一提示手动复制，口径一致，保持）。→ 抽 `useClipboard()`（或 `copyText(text, okMsg)` 工具函数）与 useStatusMessage 组合，迁移后删除各工具手抄骨架。
3. **下载逻辑自管**：9 个文件用 `URL.createObjectURL` + 临时 `<a download>` + click + revoke 的同构写法（共 10 处），ImageCompress/ImageConverter 还各自维护批量下载定时器数组。→ 抽 `downloadBlob/downloadText` 工具函数收敛。
4. **防抖/定时器零散**：setTimeout 共 31 处分布在 20 个文件（输入防抖、状态守卫、时钟、弹幕、批量下载间隔），命名各异（debounceTimer/inputTimer/liveTimer 等）。状态守卫部分随第 1 项收敛；输入防抖视 R10d 核查结果再决定是否抽 `useDebouncedRef` 类工具，不强行统一时钟/动画类定时器。

## 重复 CSS（R10e 对象）

- 72 个工具的 scoped 样式合计 5,047 行；`h1` 与 `.description` 两条规则在 72 个工具里逐个重复定义（标题字号/居中/描述文案样式同构），容器 `.xxx { max-width: 1400px; margin: 0 auto; padding: 20px; }` 亦大面积同构。→ 公共版式规则上收到全局样式，工具内只留差异样式；迁移时逐页截图比对防视觉漂移。

## 死代码与导出面

- **死文件：无。** 按静态 import + 动态 import + `@` 别名解析全仓 import 图，169 个代码文件全部被引用。
- **导出面偏宽**：utils 各模块约 238 个导出符号未被任何其他模块引用，多为模块内部常量（如各类 MAX_* 上限）与内部辅助函数。它们不是死代码（模块内部在用），但对外暴露面过大。→ R10e 时逐个核实，确认仅内部使用的改为模块私有（去掉 export），降低误用面；此项低优先、无行为变化。

## 运行时关注点（R10d 对象）

- Danmaku 弹幕渲染（定时器/动画帧与 DOM 数量）、MarkdownEditor 的多处 setTimeout、HashCalculator 大文本哈希、ImageCompress/ImageConverter 的批量处理与定时器清理，逐项核查后再定优化动作。

## 定序（R10 后续台阶）

- **R10b1**：新增 `useStatusMessage` + `useClipboard`，试点迁移含守卫写法的代表工具（JsonFormatter、ColorConverter、PasswordGenerator、BaseConverter、HashCalculator、MarkdownEditor），冒烟验证等价后合入。
- **R10b2**：迁移 converter 组其余工具的 status + copy。
- **R10b3**：迁移 text 组其余工具的 status + copy。
- **R10b4**：迁移 crypto/generator/image 组；`downloadBlob/downloadText` 收敛 9 个文件的下载写法。
- **R10c**：产物优化——主包 90.9 KB 构成分析（tools-config 元数据与首屏代码同包问题）、按分析结果调整分块，给出优化前后体积对比。
- **R10d**：运行时性能核查（见上「运行时关注点」），逐项给结论或修复。
- **R10e**：重复 CSS 上收与导出面收敛收尾，逐页截图比对。

## R10b1 落地（2026-11-28）

- 新增 `src/composables/useStatusMessage.js`：统一 `statusMessage/statusType` 与守卫式自动清除（存 ownMsg、到期比对仍是自己这条才清文本、类型不动；不取消先前待发定时器，与旧手抄行为一致；卸载时清理待发定时器）。
- 新增 `src/composables/useClipboard.js`：统一 `copyToClipboard`（只返回布尔）与 `copyText`（复制并按旧文案回写成功/失败状态、可选守卫清除）；不加 execCommand 回退，保持全仓失败提示口径。
- 试点迁移 6 个工具：JsonFormatter、ColorConverter、PasswordGenerator、BaseConverter、HashCalculator、MarkdownEditor。各工具专属的错误原文留存与 aria 关联计算（inputErrorText/genError/compErrorText/fileErrorText 等）保持原样，只替换状态写入与复制骨架；迁移后 6 文件已无直调 `navigator.clipboard`。
- 等价口径：成功/失败文案逐字保留；原本带 2 秒守卫清除的消息继续带、原本常驻的消息继续常驻；ColorConverter 复制失败文案「✗ 复制失败」与 HashCalculator 的同名文案通过 failMsg 参数保留，未被统一文案覆盖。

## R10b2 落地（2026-11-28）

- converter 组其余 25 个工具全部迁移到 `useStatusMessage` + `useClipboard`：Chmod、Cidr、ColorContrast、Cron、CssBoxShadow、CssFormatter、CssGradient、CssUnit、DataSize、DateCalculator、DockerRun、EnvJson、HtmlFormatter、IpAddress、JsonCsv、JsonToTypescript、RmbCapital、Semver、SqlFormatter、Timestamp、Timezone、TomlJson、Unit、XmlFormatter、YamlJson。迁移后 converter 组已无直调 `navigator.clipboard` 的文件。
- 等价口径：成功/失败文案逐字保留——时区转换的无符号文案（已复制到剪贴板/复制失败，请手动选择复制）、时间戳与单位换算的 2 秒守卫清除 + 短失败文案（✗ 复制失败）、Semver 初始 statusType=info 均通过参数或初始值保留；各工具专属错误原文留存与 aria 关联（setInputError 等）原样保留。
- 体积：test 构建 dist 1,977,626 B / 179 文件（R10b1 后 1,978,599 B，−973 B）。

## R10b4 落地（2026-11-28）

- crypto/generator/image 三组其余 16 个工具全部迁移到 `useStatusMessage` + `useClipboard`：Aes、Hmac、JwtDecoder、JwtEncoder、PasswordStrength、Lorem、Nanoid、QrcodeGenerator、RandomNumber、Ulid、UuidGenerator、UuidParser、ImageCompress、ImageConverter、QrcodeDecoder，以及双状态区的 Snowflake（解析/生成各用一个 useStatusMessage 实例、互不干扰）。至此全仓工具已无直调 `navigator.clipboard.writeText`、无手抄 statusMessage/statusType 双 ref（QrcodeDecoder 的 clipboard.read 读剪贴板图片属功能本身，保留）。
- 新增 `src/composables/useDownload.js`（downloadBlob/downloadText/downloadUrl），收敛 9 个文件的下载写法共 10 处：Lorem、UuidGenerator、PasswordGenerator、QrcodeGenerator（data URL）、ImageCompress、ImageConverter、JsonFormatter、MarkdownEditor（两处）、TextDiff。QrcodeDecoder 的图片预览 createObjectURL 非下载用途，保留原样。
- 等价口径：文案逐字保留——无符号文案组（已复制到剪贴板/复制失败，请手动选择复制）经 failMsg 保留、AES 复制的 2 秒守卫清除与短失败文案、UUID 的 2500ms 成功守卫清除（本地 showStatus 改为 composable 薄包装）、Lorem 复制失败静默（只用底层 copyToClipboard 返回布尔、不回写失败状态）、各工具 setInputError 与专属错误原文/aria 关联原样保留。
- 体积：test 构建 dist 1,976,755 B / 180 文件（R10b3 后 1,976,928 B / 179 文件，−173 B / +1 文件为 useDownload 分块）。

## R10c 落地（2026-11-28）

- 主包构成分析（基线 main@8fef36c test 构建，入口 index 91,233 B / vite 报告 gzip 29.15 kB）：入口静态图含 App/MainLayout/Header/Footer/Home + tools-config 元数据（首屏必需）之外，还混入了非首屏代码——About（512 行）、NotFound（123 行）两个路由页被 router 静态导入、默认隐藏的 CommandPalette（395 行）被 MainLayout 静态导入，三者及其 CSS 全压在首屏入口里。
- 调整：About/NotFound 改路由懒加载（`() => import()`，与 72 个工具页同口径）；CommandPalette 改 `defineAsyncComponent` 异步组件（布局渲染时即并行加载分块，挂载仅后移一个分块往返，Ctrl+K/`/`/Header 按钮唤起行为不变）。Home 为首屏保持静态；tools-config 元数据被首页/Header/搜索同步依赖，拆独立 chunk 不减首屏字节、只增往返，结论是不拆。
- 体积对比：入口 index 91,233 → 78,440 B（−12,793 B / −14.0%），vite 报告 gzip 29.15 → 25.29 kB（−13.2%）；新增 About 6,965 B、CommandPalette 5,405 B、NotFound 1,408 B 三个按需 JS 分块及各自 CSS 分块。dist 总量 1,976,755 → 1,979,390 B（+2,635 B / +6 文件）——分块包装与 CSS 拆分开销，换首屏入口净减，属预期取舍。
- 等价证据：无头 Chrome 冒烟 11/11（脚本 edt-r10c-smoke.js：首页渲染/无溢出、Ctrl+K 打开面板、输 json 首项与 Enter 跳转、/about 渲染与标题、未知深路径落 404 页、工具页正常、320px 无溢出、无 pageerror）。

## R10d 落地（2026-11-28，运行时性能逐项核查）

- **Danmaku（有问题，已改）**：渲染方式本身已是 CSS transform 动画（无 JS 逐帧改样式），问题在 DOM 量——每行把全部 72 个工具重复 3 遍、三行 × 两份无缝复制共 1,296 个链接。单份 72 个工具宽度已远超容器，无缝滚动只需两份相同内容，重复 3 遍纯属多余。改每份只放 1 遍：链接 1,296 → 432（−66%）；行宽缩为 1/3、动画时长同步除以 3，滚动线速度不变。另把弹幕项 `transition: all` 收窄到 hover 实际变化的四个属性。
- **MarkdownEditor（有问题，已改）**：台账所说「多处 setTimeout」已不存在——状态消息定时器在 R10b1 已收敛到 useStatusMessage，本文件只剩同步滚动的 requestAnimationFrame（防回环、合理，保留）。真正开销是预览无防抖：每敲一键全量 renderMarkdown 并整块替换预览 DOM。改 120ms 防抖渲染（连续输入只渲染最终文本，停顿后结果与旧版逐字一致）；复制/导出 HTML 改按当前文本现算，不用可能滞后的预览值；卸载清理防抖定时器。
- **HashCalculator（有问题，已改）**：`digestAll` 旧版逐个 await 串行算各算法，改 Promise.all 并发、按入参顺序组装（键序与值经 Node 独立向量核对与串行版/Node crypto 完全一致，含 100k 字符大文本）；`textStats` 旧版每敲一键都把全文 encode 一遍只为取字节数，改按码点算术求 UTF-8 字节长，免去整份分配（孤立代理项等边界已与 TextEncoder 核对）。已有的 250ms 输入防抖与序号防竞态守卫核查无误，保留。
- **ImageCompress / ImageConverter（有问题，已改）**：① 预览旧版用 FileReader 读成 base64 data URL（比原文件大约 1/3 的字符串常驻内存），改 `URL.createObjectURL(file)` 引用式预览，解码与压缩/转换结果不变；ObjectURL 在条目移除、清空、组件卸载、探针加载失败时配对 revoke。② 批量下载定时器旧版只在「再次下载全部」与卸载时清理，移除/清空不清——到期会按旧下标取图，列表变短取到 undefined 报错、变位下错图；两工具现统一抽 `clearDownloadTimers()` 供下载全部/移除/清空/卸载共用，`downloadImage` 加空守卫。③ 批量压缩/转换的逐张串行 await 核查合理（并行会同时解码多张大图、内存峰值更高），保留不动。
