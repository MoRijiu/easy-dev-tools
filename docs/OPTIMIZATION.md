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

## R10e1 落地（2026-11-28，重复 CSS 上收）

- 盘点复核：72 个工具的四组规则逐字同构——外层容器 `max-width: 1400px; margin: 0 auto; padding: 20px`、标题 `h1`、`.description`、`.tool-container` 基础规则；响应式 `h1 2rem` + `.tool-container padding 20px` 在 66 个工具里同为 640px 断点，另 5 个工具为 760/768px 断点（Unit/ImageCompress/ImageConverter/Encoding/Morse），QrcodeGenerator 无响应式组。
- 上收：四组基础规则 + 640px 响应式组移入 `src/style.css` 一份，工具页 scoped 中删除（72 文件共删 727 行量级）。全局选择器以工具页共同结构定位（主内容区直下、含 `.tool-container` 子元素的根元素），首页/关于/404 根元素无此子元素、不受影响；祖先段用 `:where()` 压低优先级，使 5 个保留在 scoped 里的 760/768px 响应式规则仍能覆盖全局 640px 规则，断点行为与上收前逐字一致。
- R10e 拆分：本轮为 R10e1（CSS 上收）；utils 导出面收敛列为 R10e2 下一轮（逐个核实仅内部使用的导出改私有，低优先、无行为变化）。
- 等价证据：test 构建 exit=0，dist 1,979,911 → 1,946,107 B（−33,804 B，文件数 186 不变，CSS 重复消除）。无头 Chrome 计算样式冒烟 12/12（脚本 edt-r10e-smoke.js）：桌面工具页 h1 40px/居中/mb10、描述 17.6px/mb30、卡 padding 30px/圆角 12px、外层 padding 20px/max-width 1400px 与上收前一致；700px 时 640 断点工具回到桌面尺寸、768 断点 Unit 工具仍 32px/padding 20px（scoped 宽断点规则胜出）；390px 两类均为 32px/padding 20px；首页 h1 保持 36px 未被上收规则污染；无溢出、无 pageerror。
- 一处刻意的一致性修正：QrcodeGenerator 原是 72 个工具里唯一没有响应式组的，上收后它在 ≤640px 也获得与其余 71 个工具相同的 h1 32px / 卡 padding 20px（桌面无变化）。

## R10e2 落地（2026-11-28，utils 导出面收敛）

- 精确审计（静态 import 图，含 `@` 别名与 utils 内部相对路径 import）：utils 共 609 个导出符号，307 个被外部引用，282 个仅模块内部使用，20 个无处使用。审计中途修正一处口径——相对路径跨模块 import（如 dockerRun 引 curlParse 的 tokenizeShell、多个模块引 jsonFormat 的 parseJsonDetailed）最初漏计，险些误伤 8 个跨模块符号，修正后定版。
- 仅内部使用 282 个：去掉 `export` 改模块私有（含 cssShadow 的 re-export 列表移除 formatCssColor 一项，parseCssColor 的对外转发保留）。变换后复查：导出 307 个且全部被外部引用，仅内部/无处使用均为 0。
- 无处使用 20 个：均为从未被任何代码调用的小包装/常量（baseConvert.convertAll、ulid.generateUlid 与 isValidUlid、uuidGenerate.generateUuidV7、semver.isValidSemver、urlCodec.URL_ENCODE_MODES 等），连同定义一并删除（同名符号在其他模块的同名导出经逐文件核实不受影响，如 unitConvert.convertAll 仍在用、保留）。
- 等价证据：构建期 Rollup 对缺失 import 名会直接报错，test 构建 exit=0 即证明 307 个保留导出与全部 import 对齐；dist 1,946,107 B / 186 文件与 R10e1 逐字相同（未用导出原本就被 tree-shaking 剔除，去 export 不改变产物）。Node 直载 72 个 utils 模块全成功，关键向量 8/8（进制 255→ff、命名转换、JSON/CSV 往返、SemVer 比较、ULID 批量、UUID 解析、单位换算、Luhn 校验）；无头 Chrome 页面冒烟 12/12、无 pageerror。
- R10e 至此收官（CSS 上收 + 导出面收敛）；R10 代码优化队列全部完成，后续新台阶待定（新功能继续暂停，遵阶段口径）。

## R10f 盘点续项（2026-11-28，composables/views 层与 tools-config）

R10e 收官后对剩余优化面再盘点（脚本 r10f-inventory，台账存档）：src 共 172 个代码文件、36,978 行；工具组件 72 个、16,789 行（R10a 时 17,624 行，R10b–R10e 累计净减约 835 行）。

- **composables 层已收敛到位**：现有 6 个 composable（useStatusMessage/useClipboard/useDownload/useSeo/useTheme/useToolPrefs）覆盖状态、复制、下载、SEO、主题与收藏。工具内 `setTimeout` 只剩 9 个文件 10 处（批量下载间隔、二维码生成防抖、摩尔斯播放、时间戳时钟等），语义各异且多已在 R10d 核查合理，硬抽 `useDebouncedRef` 收益低、风险高，结论**不做**。输入错误关联（aria-invalid/describedby）在 66 个工具出现 606 处，但每处绑定各自的字段与错误原文，属 R9az–R9bk 的逐字段口径，不存在可安全共享的骨架，结论**不抽象**。
- **第二波重复 CSS（R10g 对象）**：R10e1 上收基础版式后，工具 scoped 样式仍有 4,310 行，其中 38 条规则在 ≥5 个工具里逐字重复——`.btn` 基础样式 20 处、`.btn.ghost` 23 处、`.error` 21 处、`.chip` 14 处、`.block` 12 处、`.panes` 双栏布局 11 处等。注意全局样式已有 `.btn` 兜底（R9av），scoped 里的同名规则多为冗余复写；逐条核对与全局同值者删除、仅数值不同者保留，并按规则族分两批做（按钮/错误族一批、布局/表格族一批），每批以计算样式冒烟保等价。
- **tools-config 数据体积（R10h 对象）**：配置源文件 57,851 B（gzip 13,650 B），其中每工具的 `meta`（title/description/keywords）共 72 段、14,965 B，约占 26%；`aliases` 4,267 B。meta 只在进入对应工具页设置 SEO 时才需要，首页、Header 与搜索同步依赖的是 id/name/path/description/aliases。R10h 先做拆分原型并实测入口收益（当前入口 78,425 B / gzip 25,276 B）：若 meta 改为按 id 的独立映射并在路由守卫里查表，源数据仍在同一文件则无收益，必须评估独立分块 + 守卫同步可达的组织方式；收益不足 5% 或需改异步守卫则放弃并记录结论，不为拆而拆。
- **大组件拆分暂缓**：ImageConverter 990 行、ImageCompress 892 行、QrcodeGenerator 835 行主要是模板+样式+单一职责逻辑，拆子组件纯结构搬家、回归面大且无用户收益，暂缓；待后续真要改这三个工具时顺带拆，不单独立项。
- **定序**：R10g1 按钮/错误族重复 CSS 收敛 → R10g2 布局/表格族重复 CSS 收敛 → R10h tools-config meta 拆分评估（原型 + 实测 + 结论） → R10i R10 收官核查（全量构建体积对比 R10a 基线、冒烟总回归、OPTIMIZATION.md 总结）。新功能继续暂停，遵阶段口径。

## R10g1 落地（2026-11-28，按钮/错误族重复 CSS 收敛）

- 上收三族逐字重复规则到 `src/style.css`（锚点与 R10e 同口径、只作用于工具页）：`.btn.ghost`（23 个工具）、`.error`（21 个）、`.chip`（14 个），工具 scoped 内共删除 68 条（另含 `.btn:disabled` 10 条，见下）。异值定义的工具（Chmod 的 `.chip`、HashCalculator 的 `.error` 等 15 处）保留 scoped、优先级高于上收规则，行为不变；全仓核查三族均无「模板使用但未定义」的文件，上收不改变任何现存元素外观。
- `.btn.ghost` 的锚点祖先段不用 `:where()`：需压过同文件保留的 scoped `.btn` 基础式（data-v 属性选择器同为 (0,2,0) 时靠加载顺序会输），实测幽灵按钮底色与上收前一致。
- `.btn:disabled` 逐字副本（10 个）与全局 `.btn:disabled` 同值、直接删除；但带 scoped `.btn` 的工具里分块 CSS 靠后加载使 `.btn` 的 `cursor: pointer` 压过全局 disabled 规则，补一条锚定强化规则 `button.btn:disabled`（特异性 (0,2,1)，高于 scoped `.btn`、低于个别工具保留的异值 scoped `.btn:disabled`），禁用光标与删除前一致。
- `.btn` 基础式（20 个工具逐字）**不上收**：另有 44 个工具未定义 `.btn`、靠全局兜底 + `.btn-primary` 等变体色（或 ToolToolbar 的 :deep 规则），全局改成强调底基础式会污染其外观（如颜色转换「解析」钮的尺寸与底色），收益不抵风险，维持现状并记录结论。
- 等价证据：基线与新构建两轮无头 Chrome 计算样式探针（脚本 edt-r10g1-probe.js，合成元素复制根元素 data-v 属性以命中 scoped 规则）——4 个全中工具页（JsonEscape/Timezone/Luhn/QrcodeDecoder）五项探针与真实 `.btn.ghost`/`.chip` 元素计算样式逐项一致；对照页（Chmod 异值 chip、ColorConverter 全局兜底、JsonFormatter 工具栏）真实元素零变化（剩余差异仅为对照页模板从不使用的类的合成元素，属上收规则的预期覆盖面）；另 8 路由 × 桌面/390px 巡检无溢出、无 pageerror。
- 体积：test 构建 exit=0，dist 1,946,107 → 1,940,082 B（−6,025 B，186 文件不变）。
- 下一步 R10g2：布局/表格族重复 CSS 收敛（`.panes`/`.row`/`.text-input`/`table`/`.kv` 等）。

## R10g2 落地（2026-11-28，布局/表格族重复 CSS 收敛）

- 精确统计（脚本逐条比对 scoped 规则块）：布局/表格族逐字重复 ≥5 工具的有 `.panes` 11（+640px 响应式 11）、`.block` 12、`.row` 居中变体 10、`.text-input` 9、`.table-wrap` 两变体各 6、`.kv th/td` 合并规则 5、`.kv code` 5、`.stats` 顶距变体 5 等。
- 实际上收三族到 `src/style.css`（锚点与 R10e 同口径、`:where()` 压低优先级）：`.panes`（11 工具，含响应式）、`.table-wrap` 无边距变体（6 工具）、`.kv code`（5 工具），工具 scoped 内共删除 33 条。全仓核查三族均无「模板使用但未定义」的工具页；`.table-wrap` 带 margin 变体（6 工具）声明的 overflow-x 与全局同值、margin 未被全局声明，不受影响；其余 3 个 `.kv` 工具的表格内无 code 元素。
- **五族经探针实证后撤下、不上收**（与 R10g1 对 `.btn` 基础式的处理同口径）：`.row`/`.block`/`.stats` 的异值变体是「少声明属性」的部分变体，全局规则多出的属性会加法漏入——AsciiTable 真实 `.row` 元素探针 margin-bottom 0→10px 实证（flex-end 变体不声明 margin-bottom），DateCalculator 的 `.block` 只有 margin-bottom: 20px、JsonToTypescript 的 `.stats` 只有 margin-left/color，同理会被漏入 flex/字号/顶距；`.kv th/td` 的 border 会漏入 QrcodeDecoder/LuhnChecker/UlidTool 的无边框键值表（三者 scoped 单元格规则均不声明 border）；`.text-input` 另有 4 个工具在 ToolEditorPanel 内以 `:deep(.text-input)` 使用同名类，全局 border-radius 等非冲突属性会漏入面板上下文。`textarea`/`table` 元素规则使用面远超定义面（44/多工具），同样不上收。均维持现状并记录结论。
- 等价证据：基线与新构建两轮无头 Chrome 计算样式探针（脚本 edt-r10g2-probe.js，12 路由 × 桌面/390px）——真实元素计算样式 diff 为 0（含回滚三族的对照页 AsciiTable 真实 `.row`、DateCalculator 真实 `.block`、JsonToTypescript 真实 `.stats`、QrcodeDecoder 真实 `.kv th/td`）；全中工具的合成探针（CssFormatter/JsonCsv/LineTools 的 `.panes` 桌面双栏与 390px 单栏、Timezone/AsciiTable 的 `.table-wrap`、Cidr/CurlParser 的 `.kv code`）逐项一致；剩余合成差异仅出现在模板从不使用该类的页面，属上收规则的预期覆盖面（同 R10g1 口径）；12 路由双视口无溢出、无 pageerror。
- 体积：test 构建 exit=0，dist 1,940,082 → 1,938,245 B（−1,837 B，186 文件不变）。
- 下一步 R10h：tools-config meta 拆分评估（原型 + 实测 + 结论）。

## R10h 评估（2026-11-28，tools-config meta 拆分：放弃，记录结论）

按 R10f 预设标准做原型实测：收益不足 5% 或需改异步守卫则放弃。基线（main@56fc755，test 构建 exit=0）：入口 `index` 78,425 B / gzip 24,798 B，dist 1,938,245 B / 186 文件。原型脚本把 72 段 `meta`（title/description/keywords）抽成按 id 索引的独立模块 `tools-meta.js`（24,027 B 源文件），分别实测三种组织方式，原型分支已丢弃、不合入：

- **静态同图拆文件**：meta 独立文件但仍被路由静态导入，Rollup 直接内联回入口——入口 79,066 B（+641 B / +0.8%），gzip 26,315 B（+6.1%）。按 id 索引多出一层键名开销，拆文件本身无收益。
- **manualChunks 强制分块 + 同步导入**：入口降至 56,227 B，但 meta 分块 23,145 B 为入口的静态依赖，浏览器执行入口前必须先加载它；首屏合计 79,372 B（+947 B / +1.2%）、gzip 合计 26,341 B（+6.2%），还多一次请求。入口文件变小只是账面搬家，首屏字节不减反增。
- **异步守卫拆分**：路由守卫改为 `async` + 动态导入 meta 分块后，入口单独降至 56,055 B（−28.5%）/ gzip 18,962 B（−23.5%），仅首页访问受益；但任何工具页导航都要先等 meta 分块（23,156 B）加载完才放行，工具访问合计反而 +786 B / gzip +1,564 B，并串行延迟工具组件的加载；且 `searchTools` 同步依赖 `meta.keywords` 做搜索命中——344 个关键词词条中有 194 个只出现在 meta.keywords 里（72 个工具全部受影响），异步化要么丢这部分搜索命中、要么把 keywords 留在主配置里（收益随之缩水）；meta 分块加载失败时 SEO 信息还会静默缺失。此方案命中预设的「需改异步守卫」放弃条件。

结论：**不拆分，维持现状**。meta 与工具配置同文件同步可达是当前组织下的最优解；入口体积若再优化，应从其他构成入手而非 meta。下一步 R10i：R10 收官核查（全量构建体积对比 R10a 基线、冒烟总回归、本文件总结）。

## R10i 收官核查（2026-11-28，R10 总结）

R10 代码优化阶段（R10a–R10i，PR #204–#217）至此收官。本轮只做核查与总结、不改行为代码：全量构建体积对比 R10a 基线、72 工具总回归冒烟、各项收敛结论复查。

### 体积对比（test 构建，exit=0）

| 指标 | R10a 基线 | R10i 收官 | 变化 |
| --- | --- | --- | --- |
| dist 总量 | 1,979,129 B / 178 文件 | 1,938,245 B / 186 文件 | −40,884 B（−2.1%） |
| JS 总量 | 1,370,961 B / 88 分块 | 1,371,688 B / 93 分块 | +727 B（共享 composable 与懒加载分块开销） |
| CSS 总量 | 240,726 B / 78 文件 | 199,115 B / 81 文件 | −41,611 B（−17.3%，重复 CSS 上收净收益） |
| 入口主包 | 90,940 B（gzip 约 28.5 KB） | 78,425 B（gzip 25,269 B） | −12,515 B（−13.8%） |
| 源码（vue/js 口径） | 170 文件 / 约 38,084 行 | 172 文件 / 36,879 行 | 文件 +2（新 composable 等）、行数 −1,205 |
| 工具组件 | 72 个 / 17,624 行 | 72 个 / 16,762 行 | −862 行 |
| 工具 scoped CSS | 5,047 行 | 4,211 行 | −836 行（另有基础上收规则移入全局一份） |

dist 文件数增加是 R10c 懒加载拆分（About/NotFound/CommandPalette 按需分块）的预期取舍：首屏入口净减、总量仍下降。

### 收敛结论复查

- **共享逻辑**：`navigator.clipboard.writeText` 全仓只剩 `useClipboard.js` 一处实现（QrcodeDecoder 的 `clipboard.read` 读图属功能本身保留）；状态消息、下载分别收敛到 `useStatusMessage` / `useDownload`，72 工具已无手抄 status 双 ref。
- **导出面**：utils 共 307 个导出符号、全部被外部引用，仅内部使用与无处使用均为 0（R10e2 审计脚本复查一致）。
- **重复 CSS**：已上收的规则族（基础版式、`.btn.ghost` / `.error` / `.chip`、`.panes` / `.table-wrap` / `.kv code`）维持一份全局定义；剩余逐字重复 ≥5 的 30 条均为已实证不上收者（`.btn` 基础式、`.row` / `.block` / `.stats` 等部分变体、`.kv th/td`、`.text-input` 等，理由见 R10g1/R10g2 记录），维持现状是结论而非遗漏。
- **明确放弃项**：tools-config meta 拆分（R10h 三原型实测首屏不减反增）、防抖 composable 硬抽与大组件拆分（R10f 评估收益低、风险高），均已记录结论、不再重复尝试。

### 总回归证据

- 无头 Chrome 总回归冒烟 9/9（脚本 edt-r10i-smoke.js）：首页含 72 工具与 Danmaku 432 链接（R10d 口径）、72 工具桌面 h1 与无溢出全扫、72 工具 390px 移动无溢出全扫、Ctrl+K 命令面板、About 与 404 懒加载页渲染、全程无 pageerror。
- R10 期间各批的等价冒烟（R10b1–R10b4 共 68 项、R10c 11 项、R10d 16 项、R10e 24 项、R10g 计算样式探针）均已在各批记录，本轮总回归与之互证。

### R10 阶段结论

行为等价前提下，R10 共完成：共享逻辑收敛（b1–b4）、入口分块优化（c）、运行时性能四项修复（d）、重复 CSS 两波上收与导出面收敛（e/g）、两轮盘点与一项实测放弃（f/h）。后续若再优化，应基于新的实测瓶颈立项，不再做无证据的搬家式重构；新功能继续按产品阶段口径等待拍板。

## R11a 落地（2026-11-28，About 赞赏码图片按展示尺寸优化）

R10 收官后小盘点发现的图片权重问题：About 页两张赞赏码图展示尺寸仅 160px（移动端 180px），源图却为 668×668 / 464×464，合计 196,993 B，是 About 懒加载页最重的资产。

- 处理：两图等比缩到 360×360（展示尺寸的 2 倍，覆盖高清屏），JPEG quality 88 重编码。zfb-qr.jpg 152,766 → 44,333 B，wx-qr.jpg 44,227 → 38,768 B，合计 196,993 → 83,101 B（−113,892 B / −57.8%）。
- 等价证据（扫码内容不变是硬条件）：用项目自身依赖 jsQR（与站内二维码解码工具同一解码器）对优化前后四张图逐一解码，两张码的解码文本长度与内容逐字一致；尺寸外无任何代码/样式改动，About 页渲染与布局不变。
- 未动项：og-image.png / twitter-image.png 为 1200×630 社交分享标准尺寸且两文件内容相同属不同 URL 的预期副本，保留；其余分块体积维持 R10i 收官基线，无新瓶颈。
- 后续 R11 候选（有实测瓶颈再立项）：大组件拆分仍暂缓（R10f 结论）；新功能继续按阶段口径等待拍板。

## R11b 落地（2026-11-28，零引用死资产清理）

R11 小盘点续项：逐个核查 `public/` 与 `src/assets/` 静态资产的引用情况，发现三个自初始提交起从未被任何代码引用的文件。

- 删除 `public/logo.svg`（2,806 B）：全仓源码、`index.html` 与 git 全部历史中均无引用；站内 Header/Footer 的品牌图标实际使用的是 `/favicon.svg`，该文件只是随 `public/` 原样拷贝进 dist 发布。
- 删除 `public/vite.svg`（1,497 B）与 `src/assets/vue.svg`（496 B）：Vite/Vue 脚手架默认残留，全仓零引用（`vue.svg` 未被 import、不进产物；`vite.svg` 随 `public/` 进 dist）。
- 等价证据：删除前以文件名对全仓（含 `index.html`、全部 `.vue`/`.js`/`.css`）与 `git log --all -S` 历史检索，三文件引用数均为 0；删除后 test 构建 exit=0，dist 由 1,824,353 B / 186 文件降至 1,820,050 B / 184 文件（−4,303 B，与两张 public 死图字节数逐字吻合），`favicon.svg`、`apple-touch-icon.png`、`og-image.png` 等在用资产仍在产物中，页面冒烟无异常。三文件均可从 git 历史随时恢复。
- 后续 R11 候选（有实测瓶颈再立项）：大组件拆分仍暂缓（R10f 结论）；新功能继续按阶段口径等待拍板。

## R11c 落地（2026-11-28，移除首页弹幕手动暂停按钮）

产品决定项：首页弹幕的「暂停滚动 / 继续滚动」手动按钮用处不大，予以移除。

- 删除 `Danmaku.vue` 的切换按钮（含 `aria-pressed` / `aria-label` 与点击状态）、`paused` 状态 ref、行上的 `is-paused` 类绑定，以及 `.danmaku-toggle` 与 `.danmaku-row.is-paused` 两组样式。
- 保留两条暂停通道不变：桌面 `(hover: hover) and (pointer: fine)` 悬停自动暂停、`prefers-reduced-motion: reduce` 时 `animation: none` 直接静止；弹幕行数、每行内容与动画时长逻辑未动，链接仍为 432 个。
- 同步修订 `docs/DESIGN.md`「自动移动内容的暂停通道」约定：手动开关口径改为已移除、不要再加回。

## R11d 落地（2026-11-28，删除从未生效的 .htaccess 死配置）

R11 小盘点续项：核查 `public/` 随产物发布的文件时，发现一份只对 Apache 服务器生效的 `.htaccess`。

- 删除 `public/.htaccess`（1,955 B）：自初始提交起随 `public/` 原样拷贝进 dist 发布，但本站的托管与回源环境均不读取 Apache 配置，其中的 SPA 回退、缓存与安全响应头规则从未生效（这些行为由实际托管侧配置承担），留着只会误导后来者以为改它能改变线上行为。
- 等价证据：删除前以文件名与内容关键词对全仓（含 `index.html`、全部源码与文档）与 `git log --all -S` 历史检索，引用数为 0、历史仅初始提交引入；删除后 test 构建 exit=0，dist 由 1,819,080 B / 184 文件降至 1,817,125 B / 183 文件（−1,955 B，与该文件字节数逐字吻合），其余资产与分块不变，页面冒烟无异常。该文件可从 git 历史随时恢复。
- 后续 R11 候选（有实测瓶颈再立项）：大组件拆分仍暂缓（R10f 结论）；新功能继续按阶段口径等待拍板。

## R11e 落地（2026-11-28，分享图与触摸图标无损重压缩）

R11 小盘点续项：`public/` 里三张 PNG 均为解码像素层面的无损可压缩对象，源文件并非最优编码。

- 处理：对 `og-image.png` / `twitter-image.png`（1200×630）与 `apple-touch-icon.png`（180×180）用 zopfli 做无损重压缩，只重写 DEFLATE 编码、不动任何像素。og/twitter 两图内容相同，优化后仍逐字相同。
- 体积：og-image 68,674 → 58,943 B、twitter-image 68,674 → 58,943 B、apple-touch-icon 6,443 → 5,173 B，合计 143,791 → 123,059 B（−20,732 B / −14.4%）。
- 等价证据：优化前后三图逐一解码比对——尺寸一致、全部像素 RGBA 值逐项 identical（True），属真无损，页面与分享卡片显示不可能有任何差异；尺寸外无代码/样式改动。
- 放弃项：调色板量化（256 色）可再省约一半，但会改动约 1.6% 像素的色值、属有损，不取；PIL optimize 重编码与原文件同大小，无收益。
- 后续 R11 候选（有实测瓶颈再立项）：大组件拆分仍暂缓（R10f 结论）；新功能继续按阶段口径等待拍板。

## R11 收官盘点（2026-11-28，R11a–R11e 总结与候选实测结论）

R11 阶段（PR #218–#222）以「有实测瓶颈才立项」为口径，共落地五项：About 赞赏码按展示尺寸重编码（−113,892 B）、零引用死资产清理（−4,303 B）、移除首页弹幕手动暂停按钮（产品决定，−970 B）、删除从未生效的 .htaccess 死配置（−1,955 B）、分享图与触摸图标无损重压缩（−20,732 B）。dist 总量由 R10 收官的 1,938,245 B 降至 1,796,393 B（−141,852 B / −7.3%，186 → 183 文件），入口主包与 index.html 哈希在此期间未变（R11c 除外，为弹幕代码删除的预期变化）。

收官盘点对剩余候选逐项实测，结论均为不立项：

- **favicon.svg 空白/注释压缩**：1,349 → 1,171 B，仅 −178 B，绝对收益过小，且源文件可读性是后续改图标时的维护成本，不做。
- **赞赏码 JPEG 无损再优化**：两图除 JFIF 段外无 EXIF 等可剥离元数据；Huffman 重优化需要 jpegtran 类工具链，解码后重编码则属有损、会改变二维码像素，不做（扫码内容零容忍，R11a 口径）。
- **og-image / twitter-image 内容重复**：两图逐字相同（各 58,943 B），但 Open Graph 与 Twitter 卡片分别引用各自 URL，属不同地址的预期副本，删任一都会让对应平台分享卡片缺图，不做（R11a 已记此结论，本轮复核维持）。
- **sitemap.xml 空白压缩**：标签间空白剥除可省 1,956 B（13,547 → 11,591 B），但 sitemap 为手工维护文件（每新增工具追加一条），压成一行后增改与 diff 审查成本远高于这点传输收益（且该文件仅爬虫低频抓取），不做。
- **browser 分块（23,711 B）**：为二维码生成/解码两工具共享的 `qrcode` 库分块，仅在进入这两个懒加载工具时才请求，不占首屏，无瓶颈，不做。
- **大组件拆分**：维持 R10f 暂缓结论（纯结构搬家、回归面大、无用户收益），待日后真改这三个工具时顺带处理。

结论：R11 阶段至此收官。后续优化仍遵循同一口径——基于新的实测瓶颈立项，不做无证据的搬家式重构；新功能继续按产品阶段口径等待拍板。

## R12a 落地（2026-11-28，SEO 可信度与可渲染性清理）

R11 收官后小盘点发现两处 SEO 文件与本站实际不符的问题，均会误导搜索引擎而非用户：

- **虚假评分结构化数据**：`index.html` 的 JSON-LD 里写有 `aggregateRating` 4.8 分 / 1000 条评价，本站从无评价系统、无任何评分来源，属无依据的结构化数据，可能被搜索引擎判定为作弊标记。删除该段，其余 WebApplication 字段（名称/描述/免费 offers/作者）保留，JSON-LD 仍可正常解析。
- **robots.txt 屏蔽渲染资源 + 无效指令**：旧 robots 对全部爬虫 `Disallow: /js/` 与 `/css/`，而本站构建产物正是这两个目录、且是纯前端应用——爬虫拿不到 JS/CSS 就无法渲染页面。另有六组按爬虫拆分的 `Crawl-delay`（Google/Bing 等并不支持该指令）与已废弃的 `Host:` 指令（且文件末尾无换行）。改为单一 `User-agent: * / Allow: /` + Sitemap 一行，709 → 347 B。
- 等价证据：改后 JSON-LD 经解析校验字段完整且无 aggregateRating；robots 全仓已无 Disallow /js//css/、Crawl-delay、Host；页面渲染与功能代码未动，构建产物仅 index.html 与 robots.txt 两文件变化。

## R12b 落地（2026-11-28，canonical 与 og:url 按页同步）

R12 小盘点续项：路由守卫（`src/router/index.js`）此前只按页更新标题/描述/关键词，`canonical` 与 `og:url` 从未更新——两者的值恒为 `index.html` 里写死的首页地址。纯前端应用靠渲染后 DOM 给爬虫读元信息，等于 72 个工具页与关于页全部宣称「我的规范地址是首页」，可能被搜索引擎合并索引、工具页难以独立收录。

- 处理：守卫新增 `syncCanonical(to)`，进入每个已知路由时把 canonical 与 og:url 同步为 `https://tools.morijiu.cn` + 当前路径（首页为根路径，与静态值同口径）；NotFound 路由则移除这两项——给不存在的 URL 写 canonical 等于宣称它有规范版本，同样误导爬虫。
- 边界：canonical 只取路径、不带查询串与锚点（同页不同参数不另立规范地址）；Home 的 `useSeo` 传入的 canonical 与守卫结果一致，不冲突；About 的 `useSeo` 未传 canonical、原先会把 og:url 写成当前页地址，与守卫口径一致。
- 等价证据：无头 Chrome 冒烟逐页核对——首页 canonical/og:url 为根地址、工具页为各自路径、关于页为 /about、未知路径两项均已移除，且页面标题与无溢出检查无回归。

## R12c 落地（2026-11-28，分享文案 og/twitter 按页同步）

R12 小盘点续项：R12b 只同步了 canonical 与 og:url，路由守卫对 og:title / og:description、twitter:title / twitter:description / twitter:url 与 meta[name=title] 从未更新——它们恒为 index.html 写死的首页文案；SPA 内跳转时还会残留上一页的值（Home/About 的 useSeo 只在各自页面挂载时写）。分享任何工具页出去，卡片标题与摘要全是首页的，与 R12b 的按页 URL 也不配套。

- 处理：守卫新增 setMetaAll/removeMetaAll 辅助函数，syncCanonical 内一并按当前路由的 meta.title / meta.description 同步上述分享文案，twitter:url 与 canonical 同步为当前页地址；NotFound 时分享文案写 404 页自身的标题/描述（避免残留上一页），三个 URL 类标签一并移除。
- 边界：index.html 的 twitter 标签用 property=、useSeo 创建的用 name=，setMetaAll 两种属性的同名标签全部更新、一个都没有时才新建，避免留一份旧值被平台优先读到；Home/About 挂载后 useSeo 仍会以其专属长文案覆盖首页/关于页的分享标题（与 document.title 的既有口径一致），工具页无此覆盖、守卫值即最终值。
- 等价证据：无头 Chrome 冒烟 23/23——工具页 og/twitter 标题与摘要逐字等于该页 title/description、twitter:url 为各自路径，SPA 跳转跟随且无上一页残留，首页/关于页正常，404 三个 URL 标签移除且分享文案为 404 自身，桌面/390px 无溢出、无 pageerror。

## R12d 落地（2026-11-28，sitemap lastmod 按真实变更校准）

R12 小盘点续项：`public/sitemap.xml` 共 74 条 URL（72 工具 + 首页 + 关于），条目齐全、与路由配置逐项一致，但 `lastmod` 已全面失准——19 条仍停在 2025-12-05（hxd 接手前的最后一次提交日），其余 55 条停在各自工具的上线日 2026-11-26/27。

- 失准证据：2026-11-26 起每一页都发生过实质变更——R2–R5 的全站搜索/收藏/暗色模式/命令面板、R7–R9 的逐工具打磨、R10e 的全局 CSS 上收，以及 2026-11-28 当天落地的 R12b/R12c（每个页面渲染出的 canonical 与分享文案都已改变）。没有任何一页的内容还停留在其 lastmod 所写日期；搜索引擎对长期不准的 lastmod 会整体忽略，该字段等于白写。
- 处理：74 条 lastmod 统一更新为 2026-11-28，即全站最近一次逐页变更（R12b/R12c 合入日）；loc 集合、顺序、changefreq 与 priority 一字未动。
- 评估未动项：changefreq/priority 主流搜索引擎已明确忽略，删除无收益、保留亦无害，为缩小 diff 不动；sitemap 仍为手工维护（新增工具时追加条目并更新其 lastmod），后续若再有全站级变更，同步批量刷新 lastmod。
- 等价证据：改后 XML 解析通过、74 条 loc 与改前逐项相同、仅 lastmod 行变化（74 增 74 删）；页面代码未动，构建产物仅 sitemap.xml 变化。

## R12e 落地（2026-11-28，JSON-LD 结构化数据按页同步）

R12 小盘点续项：R12b/R12c 已把 canonical、og:url 与分享文案按页同步，但 `index.html` 的静态 JSON-LD 从未更新——url 与 description 恒为首页值。渲染型爬虫执行 JS 后读到的结构化数据，等于 72 个工具页全被描述成首页的 WebApplication，与按页 URL 自相矛盾。

- 处理：路由守卫新增 `syncJsonLd(to, url)`，在 `syncCanonical` 内一并调用——已知路由把 JSON-LD 的 url 改写为当前页规范地址、description 改写为当前页描述，其余字段（@type/name/offers/author）保留站点级口径；NotFound 移除整段 script（不给不存在的页面宣称结构化数据），离开 404 时用首次捕获的原文模板恢复重建。`index.html` 的 script 补 `id="edt-jsonld"` 便于稳定定位（按 type 兜底查询保留）。
- 边界：模板解析失败时保持原文、不阻断导航；恢复模板取首次同步前捕获的原文，后续改写不污染模板。
- 等价证据：无头 Chrome 冒烟逐页核对——工具页 JSON-LD url/description 为该页值且其余字段完整、首页为根地址、404 时整段移除、从 404 返回首页后恢复且 url 为根地址，桌面/390px 无溢出、无 pageerror。

## R12f 落地（2026-11-28，keywords 按页同步防残留）

R12 小盘点续项：R12b/R12c/R12e 已把 canonical、分享文案与 JSON-LD 按页同步，但路由守卫对 `meta[name=keywords]` 仍是「有才写、无则不动」——72 个工具页与关于页都有各自 keywords，首页 route meta 与 NotFound 没有。从工具页 SPA 跳转到未知路径时，404 页会残留上一个工具的关键词（如在 JSON 页点到坏链接，404 顶着「JSON格式化,…」），与 R12c 修过的分享文案残留同族；直接打开 404 时则是 index.html 的首页关键词，同样不是 404 自身的。

- 处理：守卫 keywords 分支补 else——目标路由无 keywords 时移除该 meta 标签，不给无关键词的页面顶着上一页的值。
- 边界：首页 route meta 虽无 keywords，但 Home 挂载后 useSeo 会按其专属口径重新写入首页关键词（守卫在挂载前运行、移除后由 useSeo 新建，最终值与旧版一致）；工具/关于页由守卫直接写入各自 keywords 不变。
- 等价证据：无头 Chrome 冒烟逐页核对——工具页 keywords 为该页值、SPA 跳另一工具跟随、跳 404 后 keywords 标签已移除且标题/描述为 404 自身、从 404 回首页后 keywords 恢复为首页专属值、桌面/390px 无溢出、无 pageerror。

## R12g 落地（2026-11-28，404 页 robots 改 noindex）

R12 小盘点续项：R12b/R12c/R12e/R12f 已把 canonical、分享文案、JSON-LD 与 keywords 按页同步，但 `meta[name=robots]` 仍恒为 index.html 写死的 `index, follow`，路由守卫从不改它。本站是纯前端 SPA：静态托管对未知路径以 SPA 兜底返回应用页（软 404），404 页顶着 `index, follow` 等于明确邀请爬虫收录不存在的页面，与 R12b 给 404 移除 canonical 是同一类问题。

- 处理：守卫新增 `syncRobots(to)`，在 `syncCanonical` 内一并调用——已知路由保持 `index, follow`（与 index.html 静态值一致），NotFound 改为 `noindex, follow`（不收录、但仍跟随页内链接回正常页面）；标签不存在时新建。
- 边界：useSeo 不写 robots、无覆盖冲突；从 404 返回已知路由时守卫恢复 `index, follow`，不残留 noindex。
- 等价证据：无头 Chrome 冒烟逐页核对——首页/工具页/关于页 robots 为 `index, follow`、SPA 跳 404 后为 `noindex, follow`、从 404 回首页恢复 `index, follow`，桌面/390px 无溢出、无 pageerror。

## R12h 落地（2026-11-28，useSeo 元标签同步修复）

R12 小盘点续项：R12b/R12c 让路由守卫按页同步 canonical/og:url 与分享文案，但 Home/About 挂载后运行的 `useSeo` 会再改一轮，且有两处与守卫冲突——实测（本地静态服务 + 无头 Chrome 探针）复现：

- **About 的 og:url 被当前地址覆盖**：About 调用 useSeo 时未传 canonical，旧版回退 `window.location.href`，挂载后 og:url 变成当前地址（本地探针为 `http://127.0.0.1:<端口>/about`；线上即测试/生产域名 + 实际路径，还会带查询串/锚点），把守卫刚写好的正式域名地址覆盖掉，与同页 canonical 自相矛盾。
- **twitter 标签出现两份且值分叉**：index.html 的 twitter 标签用 `property=`，useSeo 旧版按 `name=` 查询、查不到就新建一份。首页实测 twitter:title 同时存在 property 版（守卫写的路由标题）与 name 版（useSeo 的专属长标题）两份、值不一致，twitter:card/description/image 同样成双，平台读到哪份不确定。

- 处理（仅改 `src/composables/useSeo.js`）：①`setMetaTag` 改为同时查询 `property=` 与 `name=` 两种同名标签、全部同步为同一值，历史残留两份时只保留第一份删多余，一个都没有时才按指定属性新建（与守卫 setMetaAll 同口径）；②og:url 未传 canonical 时回退为正式域名 + 当前路由路径（只取路径），不再用 `window.location.href`。
- 边界：Home/About 挂载后以专属长文案覆盖分享标题的既有口径不变（R12c），只是不再产生第二份标签；工具页不走 useSeo、守卫值即最终值，不受影响。
- 等价证据：无头 Chrome 冒烟逐页核对——首页/关于页 og:url 为正式域名对应路径、twitter:title/card/description/image 均为单份且首页 twitter:title 与 og:title 一致、SPA 首页→关于 og:url 仍为正式域名、工具页无回归，桌面/390px 无溢出、无 pageerror。

## R12i 落地（2026-11-28，index.html 无效 meta 清理）

R12 小盘点续项：`index.html` 还留着两条不被任何主流搜索引擎采用的 meta——`revisit-after`（Google/Bing 均明确表示忽略，爬虫回访节奏由 sitemap 与服务器响应决定，写了也不会按 7 天回来）与 `name="language"`（非标准标签，语言信息已由 `<html lang="zh-CN">` 与 `og:locale=zh_CN` 以标准方式表达）。与 R12a 删除虚假 aggregateRating、清理 robots.txt 无效指令同族：留着无收益，还会让后来维护者误以为它们在起作用。

- 处理：删除上述两行；`author`/`robots`/`title` 等其余 meta 未动（robots 由 R12g 守卫按页同步、title 由 R12c 守卫同步，均在实际生效链路上）。
- 边界：全仓检索确认无代码读取这两条 meta，删除不影响任何运行时行为；页面语言声明走 html lang 这一标准位置，不受影响。
- 等价证据：构建产物 index.html 中两条 meta 清零、其余 meta 逐项不变；无头 Chrome 冒烟核对首页/工具页/404 的标题、canonical、robots 与 JSON-LD 同步无回归。

## R12j 落地（2026-11-28，twitter 元标签改标准 name 属性）

R12 小盘点续项：`index.html` 的五条 twitter:* 元标签（card/url/title/description/image）一直用 Open Graph 的 `property=` 属性写，而 Twitter 卡片规范写法是 `name=`（og:* 才用 property=）。不执行 JS 的分享爬虫按规范以 name= 读取时可能读不到这五条，卡片只能退回 og:* 兜底；R12h 已让运行时代码同时兼容两种属性，但静态 HTML 本身仍是非标准写法。

- 处理：index.html 五条 twitter:* 统一改 `name=`；路由守卫在 404 移除 twitter:url 后重建该标签时，新建属性同步改 `name=`（此前默认 property=，会把刚改正的写法又写回去）。守卫与 useSeo 的查询仍同时覆盖 property/name 两种，历史残留不会漏同步。
- 边界：og:* 的 property= 是其规范写法，未动；标签的 content 值一字未改。
- 等价证据：构建产物中 twitter:* 的 property= 形式清零、name= 形式五条齐全；无头 Chrome 冒烟逐页核对——首页/工具页 twitter:* 均为 name= 单份且值随页同步、404 时 twitter:url 移除、从 404 返回后以 name= 重建，桌面/390px 无溢出、无 pageerror。

## R12k 落地（2026-11-28，分享图结构化属性补全）

R12 小盘点续项：`index.html` 的分享图只有 `og:image` / `twitter:image` 两个 URL，没有尺寸、类型与替代文本。实测两张图均为 1200×630 的 PNG（R11e 已无损重压缩、像素未动，尺寸可直接采信）；Open Graph 规范为 og:image 定义了结构化属性 `og:image:type` / `og:image:width` / `og:image:height` / `og:image:alt`，Twitter 卡片对应 `twitter:image:alt`。缺失时，分享爬虫必须回源抓图本体才能知道尺寸与类型，部分平台在抓取完成前无法预排版大图卡片，图片加载失败时也没有任何替代文本。

- 处理：`og:image` 后按规范顺序紧跟四条结构化属性（type=image/png、width=1200、height=630、alt=站点标题文案），`twitter:image` 后补一条 `twitter:image:alt`（同文案）。两张图全站共用、尺寸与内容不随页面变化，这些属性是站点级常量，无需路由守卫或 useSeo 按页同步——它们既不被守卫改写、也不会残留上一页的值。
- 边界：og:image 与 twitter:image 的 URL、content 一字未改；若将来更换分享图尺寸或格式，必须同步更新这四条属性（已在本节留痕）。
- 等价证据：构建产物中五条新属性齐全且值与实测图属性一致；无头 Chrome 冒烟逐页核对——首页/工具页/404 后新属性均为单份且值不变、原分享文案按页同步无回归，桌面/390px 无溢出、无 pageerror。

## R12l 落地（2026-11-28，og:image 补 secure_url）

R12 小盘点续项：R12k 已给 `og:image` 补 type/width/height/alt 四条结构化属性，但 Open Graph 规范为 https 页面还定义了 `og:image:secure_url`——内容须为该图的 https 地址，供在 https 页面下抓取分享图的平台优先使用。本站页面与分享图均为 https，`og:image` 本身已是 https 地址，却没有声明 secure_url，严格按规范读取结构化属性的爬虫拿不到这一项。

- 处理：`og:image` 后、其余结构化属性之前，按规范顺序补一条 `og:image:secure_url`，值与 `og:image` 逐字相同（同一张图的 https 地址）。该图全站共用、地址不随页面变化，属站点级常量，无需路由守卫或 useSeo 按页同步。
- 边界：`og:image` 与 R12k 四条属性的 URL、content 一字未改；twitter:image 无对应的 secure_url 规范项，未动。若将来分享图改走 http 地址或更换 URL，必须同步更新本条。
- 等价证据：构建产物中该属性单条齐全且值与 og:image 一致；无头 Chrome 冒烟逐页核对——首页/工具页/404 后该属性均为单份且值不变、原分享文案与结构化属性按页同步无回归，桌面/390px 无溢出、无 pageerror。

## R12m 落地（2026-11-28，doctype 回到文件首字节）

R12 小盘点续项：`index.html` 文件开头有一段编辑器自动生成的模板注释（作者/日期/「Do not edit」/Windows 风格的 `\easy-dev-tools\index.html` 路径），位于 `<!doctype html>` 之前。HTML 规范要求 doctype 位于文档最前面以确保标准渲染模式；现代解析器对 doctype 前的注释尚能容忍，但严格解析器、校验工具与部分旧引擎存在被前置内容影响渲染模式判定的风险，且这段注释对访客与维护均无信息价值、还随构建产物逐字发给每一位访客（185 B）。

- 处理：整段删除该模板注释，文件首字节即 `<!doctype html>`；注释之后的全部内容（head 元标签、主题防闪脚本、正文）一字未动。
- 边界：作者署名仍在仓库提交历史与站点页脚等正式位置，本删除不影响任何版权口径；文件内其余注释（Primary Meta Tags 等分节注释）均在 doctype 之后、属正常文档注释，未动。
- 等价证据：构建产物 index.html 首字节为 doctype、模板注释清零；无头 Chrome 冒烟逐页核对 document.compatMode 仍为 CSS1Compat（标准模式）、标题与按页元标签同步无回归，桌面/390px 无溢出、无 pageerror。

## R12n 落地（2026-11-28，noscript 无 JS 兜底）

R12 小盘点续项：本站是纯前端 SPA，`index.html` 的 body 只有一个空的 `#app` 挂载点——禁用 JavaScript 的浏览器、脚本被拦截/加载失败的环境、以及不执行 JS 的抓取工具打开任何页面都只会看到一片空白，连「本站是什么、为什么打不开」都无从得知。与 R12a 修 robots 屏蔽渲染资源同族，都是页面在非常规读取方式下不可达的问题。

- 处理：body 内 `#app` 后补一段 `<noscript>` 静态兜底——标题说明本站需要启用 JavaScript、正文列明工具均在本地运行需 JS 才能工作、并重申数据不上传服务器的产品口径，引导用户启用 JS 后刷新。样式全部内联（无 JS 时本站的 JS 注入样式链路不可靠依赖），不依赖任何外部资源。
- 边界：JS 正常启用时 `<noscript>` 内容不渲染、不占布局，对现有用户零影响；文案为站点级说明、不随页面变化，无需路由守卫按页同步。
- 等价证据：无头 Chrome 双模式冒烟——禁用 JS 时兜底文案可见且页面非空白；启用 JS 时首页/工具页正常渲染、noscript 不显示、标题与按页元标签同步无回归，桌面/390px 无溢出、无 pageerror。

## R12o 落地（2026-11-28，图标 link sizes 声明补全）

R12 小盘点续项：`index.html` 的两条图标 link 都没有 `sizes` 声明——`apple-touch-icon` 指向的实测为 180×180 PNG（R11e 已无损重压缩、尺寸可直接采信），`favicon.svg` 是可任意缩放的 SVG。HTML 规范用 `sizes` 让浏览器在下载/解析前就知道图标的适用尺寸：位图缺声明时浏览器只能先取回文件才知道它是不是自己需要的尺寸，SVG 缺 `sizes="any"` 时则没有「任意尺寸可用」的明确声明。与 R12k 给分享图补尺寸结构化属性同族，都是把实测尺寸写回声明。

- 处理：`apple-touch-icon` 补 `sizes="180x180"`（与实测尺寸逐字一致），SVG favicon 补 `sizes="any"`；两条 link 的 href 与 type 一字未改。
- 边界：图标文件本身未动；若将来更换 apple-touch-icon 尺寸，必须同步更新本声明（已在本节留痕）。全仓无代码读取这两条 link 的 sizes，不影响任何运行时行为。
- 等价证据：构建产物中两条 sizes 声明齐全且值与实测一致；无头 Chrome 冒烟逐页核对——首页/工具页图标 link 声明正确、标题与按页元标签同步无回归，桌面/390px 无溢出、无 pageerror。

## R12p 落地（2026-11-28，显式 referrer 策略）

R12 小盘点续项：`index.html` 没有声明 `meta[name=referrer]`，页面跳转外站时发送多少 Referer 完全取决于各浏览器的默认策略——现代 Chromium 默认已是 strict-origin-when-cross-origin，但其他引擎与旧版本默认值并不一致，可能把工具页的完整路径（用户正在用哪个工具）随 Referer 发给外链站点。本站卖点是本地处理、数据不上传，来源信息也不应靠浏览器默认兜底。

- 处理：补一条 `<meta name="referrer" content="strict-origin-when-cross-origin" />`——同源请求保留完整地址、跨源只发源（协议+域名）、降级到 http 时不发送，与主流现代浏览器的推荐默认值逐字一致，显式化后全引擎口径统一。
- 边界：全站外链已有 `rel="noopener noreferrer"`（单链接级已不发送），本条是页面级兜底，覆盖将来新增的普通链接与导航，不改变任何现有链接行为；该策略为站点级常量、不随页面变化，无需路由守卫按页同步。
- 等价证据：构建产物中该 meta 单条齐全且值正确；无头 Chrome 冒烟逐页核对——首页/工具页/404 该 meta 均为单份且值不变、标题与按页元标签同步无回归，桌面/390px 无溢出、无 pageerror。

## R12q 落地（2026-11-28，补 favicon.ico 默认图标）

R12 小盘点续项：站点只声明了 SVG favicon 与 apple-touch-icon，`public/` 里没有 `favicon.ico`。实测线上（tools.test）请求 `/favicon.ico` 返回 200 但 Content-Type 是 text/html、内容是 SPA 兜底页（5,687 B）——不支持 SVG 图标的旧浏览器、以及只按默认路径 `/favicon.ico` 取图标的收藏夹/聚合/抓取服务，拿到的是一页 HTML 而不是图标，轻则无图标、重则解析报错。

- 处理：由现有 `favicon.svg` 原图渲染生成 `public/favicon.ico`（16×16 / 32×32 / 48×48 三尺寸 PNG 条目，4,891 B），放在站点根路径供默认请求命中；`index.html` 的图标 link 未动——现代浏览器继续用 SVG（矢量任意尺寸更清晰），ICO 只兜底默认路径与旧引擎。
- 边界：ICO 画面与 favicon.svg 为同一设计（紫色渐变圆角底 + 白色工具箱 + 黄色闪电，渲染后逐像素核对覆盖完整）；若将来更换 favicon.svg 设计，必须同步重渲染本文件（已在本节留痕）。
- 等价证据：ICO 文件头与三尺寸条目经解析校验齐全、各尺寸画面非空且底部/中心采样与原图一致；构建产物根目录含 favicon.ico 且字节与源文件一致；无头 Chrome 冒烟核对首页/工具页标题与按页元标签同步无回归、双视口无溢出；部署后线上 `/favicon.ico` 返回 image/x-icon 且哈希与本地一致（验收结果见台账）。

## R12r 落地（2026-11-28，README 工具列表与特性同步）

R12 小盘点续项：仓库 `README.md` 自初始提交后未随产品演进更新——工具列表仍只列最初的 15 个工具（文本 4 / 格式转换 3 / 生成器 4 / 加密 2 / 图片 2），而站内实际已有 72 个工具，公开仓访客从 README 得到的产品规模与能力图景只有真实情况的约两成；特性一节同样缺 R2–R5 已上线的首页搜索、收藏/最近使用、命令面板与暗色模式。与 R12a 删除无来源的虚假评分同族，都是对外陈述与产品实际不符，只是这次是少报而非虚报。

- 处理：工具列表按 `src/router/tools-config.js` 全量重写——五组分别标注数量（文本处理 27 / 格式转换 27 / 生成器 9 / 加密解密 6 / 图片工具 3，合计 72），组内逐个列出工具名并注明以该配置文件为准；特性补搜索发现、收藏/最近使用、Ctrl+K 命令面板与暗色三态四项；技术栈的二维码库由只写 qrcode 补为 qrcode / jsQR（生成与解码各一，与 package.json 依赖一致）。
- 边界：README 不进构建产物，本项不改变任何运行时行为；工具名逐字取自 tools-config，后续新增工具时应同步本列表（已在本节留痕）。快速开始、项目结构、许可证与作者等其余章节核对无误、未动。
- 等价证据：脚本以 tools-config 为准逐名核对 README，72 个工具名缺失为 0、分组计数与配置一致；test 构建 exit=0 且产物与改前同哈希（README 不入产物），页面冒烟无回归（验收结果见台账）。

## R12s 落地（2026-11-28，补 Web App Manifest）

R12 小盘点续项：站点没有任何 Web App Manifest——`index.html` 无 `rel="manifest"` 链接、`public/` 无 manifest 文件。移动端浏览器「添加到主屏幕」与桌面浏览器的安装入口只能靠页面标题与图标临场拼凑：主屏幕名称取长标题、图标只能挑到 favicon 或 apple-touch-icon（尺寸/用途未按 manifest 规范声明），主题色与启动背景也无从得知。与 R12o 给图标 link 补 sizes 同族，都是把站点身份信息按规范声明完整。

- 处理：新增 `public/site.webmanifest`（name=极速开发工具箱、short_name=开发工具箱、lang=zh-CN、start_url/scope 为根路径、display=standalone、theme_color/background_color 与亮色主题色 `#f8f9fa` 一致）；图标由现有 `favicon.svg` 原图渲染生成 192×192 与 512×512 两档 PNG（`public/icons/`），连同 SVG 本体一并写入 icons 数组，purpose 只声明 any（圆角透明底未经 maskable 安全区设计，不冒充 maskable）；`index.html` 补一条 `rel="manifest"` 链接。
- 边界：本项只补声明文件，不引入 Service Worker、不做离线缓存，不改变任何页面运行时行为；若将来更换 favicon 设计或亮色主题色，必须同步重渲染两档 PNG 与 theme_color（已在本节留痕）。
- 等价证据：manifest 经 JSON 解析校验、图标条目与实际文件尺寸逐项一致；构建产物含 manifest 与两档图标且字节与源文件一致；无头 Chrome 冒烟核对 manifest 可达且可解析、首页/工具页标题与按页元标签同步无回归（验收结果见台账）。

## R12t 落地（2026-11-28，Web App Manifest 标准 MIME 对齐）

R12 小盘点续项：R12s 上线后实测发现，测试环境返回 `/site.webmanifest` 时 Content-Type 为 `application/octet-stream`——站点服务器的默认 MIME 表没有 `.webmanifest` 扩展名映射。浏览器抓取 manifest 时虽可凭内容嗅探勉强解析，但按 Web App Manifest 规范，清单应以 `application/manifest+json` 返回；类型不符时部分浏览器的安装提示与清单校验工具会直接判不合格，嗅探行为也不保证跨引擎一致。

- 处理：测试环境站点配置为 `/site.webmanifest` 精确路径补 `default_type application/manifest+json`，配置校验通过后平滑 reload；仓库内的 manifest 文件内容与 `index.html` 的 `rel="manifest"` 链接一字未改。本节即本项在仓内的留痕。
- 边界：仅测试环境站点配置变更，生产环境未动；若将来把站点迁到其他静态托管，须确认新环境对 `.webmanifest` 的 MIME 映射同样为 `application/manifest+json`（已在本节留痕）。
- 等价证据：修复后实测 `/site.webmanifest` 返回 200 且 Content-Type 为 `application/manifest+json`、内容与源文件一致；首页/关于/工具页/图标/robots/sitemap 等其余路径状态码与类型无变化（验收结果见台账）。

## R12u 落地（2026-11-28，iOS 主屏幕 Web App 声明补全）

R12 小盘点续项：R12s 已补标准 Web App Manifest（display=standalone、short_name=开发工具箱），但 iOS Safari 不读取 manifest 的 display/short_name——它只认 Apple 私有的 `apple-mobile-web-app-*` 元标签。实测 index.html 这组标签为零：iPhone「添加到主屏幕」后打开仍带 Safari 浏览器界面、主屏幕名称只能取页面长标题，与 Android/桌面端已声明的 standalone 体验不一致。

- 处理：index.html 在 manifest 链接后补四条声明——`mobile-web-app-capable=yes`（标准/Chromium 口径）、`apple-mobile-web-app-capable=yes`（iOS 以 Web App 模式打开）、`apple-mobile-web-app-title=开发工具箱`（与 manifest short_name 逐字一致）、`apple-mobile-web-app-status-bar-style=default`（状态栏用默认样式，与亮色背景 `#f8f9fa` 协调；暗色模式下系统状态栏仍由页面 color-scheme 影响，本条不冒充 black-translucent）。
- 边界：manifest 文件一字未改；这四条是站点级常量、不随页面变化，无需路由守卫或 useSeo 按页同步。若将来改 manifest short_name，必须同步 apple-mobile-web-app-title。
- 等价证据：构建产物中四条标签单份齐全且标题与 short_name 一致；无头 Chrome 冒烟逐页核对——首页/工具页四条均为单份且值不变、标题与按页元标签同步无回归，桌面/390px 无溢出、无 pageerror（iOS 真机主屏幕模式待 morijiu 有空时确认）。

## R12v 落地（2026-11-28，Manifest 补 maskable 图标）

R12 小盘点续项：R12s 补 Web App Manifest 时，图标 purpose 只声明了 `any`——当时留痕「圆角透明底未经 maskable 安全区设计，不冒充 maskable」。但这也意味着 Android 自适应图标（圆形/水滴等系统遮罩裁切）拿不到专为裁切设计的图：现有 512 图四角透明、图形顶到画面边缘，被圆形遮罩裁切后会露透明边、边缘的速度线与闪电还可能被切掉。本轮把当时缺的设计真正补上，而不是改个声明了事。

- 处理：以 `favicon.svg` 为源做 maskable 变体——背景改为满幅渐变（去掉圆角、四角不透明），工具箱/闪电/速度线整体绕中心按 0.8 缩放收进中央 80% 直径的安全区，渲染为 `public/icons/icon-maskable-512.png`（512×512）；manifest icons 追加一条 `purpose: "maskable"` 条目，原有三条 `any` 图标一字未动。
- 边界：图形设计与配色和 favicon 完全同源，只是构图为裁切留白；安全区口径按 W3C maskable 规范（中央 80% 直径圆内须含全部关键图形）。若将来更换 favicon 设计，必须同步按本口径重渲染本文件（已在本节留痕）。
- 等价证据：渲染产物逐项程序校验——四角与四边中点像素均为不透明渐变色、全图白色/黄色图形像素采样无一落在安全区圆外、中心为工具箱白色；manifest 经 JSON 解析校验且新条目尺寸与实际文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、首页/工具页标题与按页元标签同步无回归（验收结果见台账）。

## R12w 落地（2026-11-28，maskable 图标无损重压缩）

R12 小盘点续项：R12v 新增的 `public/icons/icon-maskable-512.png`（40,018 B）由浏览器渲染截图落盘，PNG 编码未做优化；同批其余图标（icon-192/icon-512、og 图等）此前已是优化编码。实测同一像素数据以 PNG 优化编码（compress_level 9 + optimize）重写可降到 23,541 B（−16,477 B / −41.2%），且逐像素解码比对完全一致——与 R11e 给分享图做无损重压缩同族，只是这次对象是新图标的编码效率、不是像素或设计问题。

- 处理：仅重写该 PNG 的编码字节，像素、尺寸（512×512）、模式（RGB）与 manifest 中的 maskable 条目一字未改；R12v 的安全区校验结论因像素逐点一致而原样成立。
- 边界：其余图标同法实测无收益（icon-192/icon-512 重编码字节不变、apple-touch-icon 已是更优编码），未动；若将来重渲染 maskable 图标，落盘后须再做一次无损优化编码（已在本节留痕）。
- 等价证据：重压缩前后逐像素 RGB 比对全部 identical；构建产物中该图标字节与源文件一致、manifest 解析与 maskable 条目无回归；无头 Chrome 冒烟核对首页/工具页无回归（验收结果见台账）。

## R12x 落地（2026-11-28，补 LICENSE 使 MIT 声明落地）

R12 小盘点续项：`README.md` 的许可证一节自初始提交起就写着「MIT License」，但仓库里从来没有 `LICENSE` 文件、`package.json` 也没有 `license` 字段（`git log --all -- LICENSE` 为空、全仓检索无许可证全文）。公开仓访客与 GitHub 的许可证识别都无从落地：仓库页不会显示 MIT 标识，想按 README 声明使用代码的人也找不到授权全文与版权归属。与 R12a 删除无来源的虚假评分、R12r 补齐少报的工具列表同族，都是对外陈述与仓库实际不符，只是这次缺的是法律文本。

- 处理：新增仓库根 `LICENSE`——MIT 标准全文，版权行为 `Copyright (c) 2025 morijiu`（年份取初始提交年 2025、持有人取 README 作者 morijiu）；`package.json` 补 `"license": "MIT"` 与之对齐。README 的许可证一节原文即为 MIT、无需改动，本轮是给既有声明补齐依据而非变更许可口径。
- 边界：LICENSE 不进构建产物，本项不改变任何运行时行为；若将来变更许可证，须同步改 LICENSE 全文、package.json 的 license 字段与 README 一节三处。
- 等价证据：LICENSE 为 MIT 标准文本（与 SPDX MIT 模板逐段一致）；test 构建 exit=0 且产物与改前逐字相同（LICENSE/package.json 的 license 字段均不入产物）；页面冒烟无回归（验收结果见台账）。

## R12y 落地（2026-11-28，Manifest any 图标 zopfli 无损重压缩）

R12 小盘点续项：R12s 新增的 `public/icons/icon-512.png`（35,995 B）与 `icon-192.png`（10,674 B）由浏览器渲染截图落盘。R12w 当时以 PIL 优化编码实测这两图「重编码字节不变」，但那只是 PIL 编码器的结论；本轮改用 zopfli（与 R11e 给分享图重压缩同一工具）实测：icon-512 可降到 21,423 B（−14,572 B / −40.5%）、icon-192 可降到 8,982 B（−1,692 B / −15.9%），合计 −16,264 B。apple-touch-icon 与 og-image 同法实测为 0 收益，未动。

- 处理：仅以 zopfli 重写两图 PNG 编码字节，像素、尺寸（512×512 / 192×192）、模式（RGBA）与 manifest 中的 any 条目一字未改。
- 边界：maskable 图标已在 R12w 用 PIL 优化过，本轮未重复处理；若将来重渲染这两档图标，落盘后须再做一次 zopfli 无损重压缩（PIL optimize 对渲染截图的结论不可外推，已在本节留痕）。
- 等价证据：重压缩前后逐像素 RGBA 解码比对全部 identical、尺寸不变；构建产物中两图字节与源文件一致、manifest 解析与图标条目无回归；无头 Chrome 冒烟核对首页/工具页无回归（验收结果见台账）。

## R12z 落地（2026-11-28，Manifest maskable 图标 zopfli 无损重压缩）

R12 小盘点续项：R12v 新增的 maskable 图标在 R12w 只用 PIL 优化编码从 40,018 B 降到 23,541 B；R12y 已证明 PIL 的结论不可外推——any 图标 PIL 实测无收益、换 zopfli 却降了 40.5%/15.9%，但当时 maskable 图标未用 zopfli 复测。本轮补测：zopfli 对 maskable 图标可再降到 16,145 B（−7,396 B / −31.4%），其余五张 PNG（icon-512/icon-192/apple-touch-icon/og-image/twitter-image）同法实测均为 0 收益、未动。

- 处理：仅以 zopfli 重写 `public/icons/icon-maskable-512.png` 的 PNG 编码字节，像素、尺寸（512×512）、模式（RGB）与 manifest 中的 maskable 条目一字未改。
- 边界：R12v 的安全区校验结论因像素逐点一致而原样成立；若将来重渲染 maskable 图标，落盘后须依次做 PIL 优化与 zopfli 无损重压缩两步（已在本节留痕）。
- 等价证据：重压缩前后逐像素 RGB 解码比对全部 identical、尺寸不变；构建产物中该图标字节与源文件一致、manifest 解析与 maskable 条目无回归；无头 Chrome 冒烟核对首页/工具页无回归（验收结果见台账）。

## R12aa 落地（2026-11-28，favicon.svg 删除未引用渐变定义）

R12 小盘点续项：`public/favicon.svg` 的 `<defs>` 里定义了两条线性渐变，但全图只有背景矩形引用 `grad1`（`fill="url(#grad1)"`），`grad2`（青蓝渐变）在 favicon 内无任何引用、全仓检索也无其他文件引用它——是一条从未生效的死定义，随 favicon 逐字发给每一位访客（230 B，占该文件 17.0%）。

- 处理：仅删除 `grad2` 的 `<linearGradient>` 定义块，文件由 1,349 B 降到 1,119 B；`grad1`、全部图形、尺寸与 viewBox 一字未改，SVG 经 XML 解析校验通过。
- 边界：由 favicon.svg 派生渲染的 favicon.ico 与各档 PNG 图标（icon-192/icon-512/maskable/apple-touch-icon）因渲染像素逐点不变而原样成立，无需重渲染；若将来启用青蓝渐变，须按需重新定义，不得凭记忆假定 grad2 仍在。
- 等价证据：删除前后以无头 Chrome 把 favicon 以 512×512 渲染截图，逐像素比对全部 identical（像素数据 sha256 一致）；test 构建 exit=0、产物 favicon 与源文件一致；无头 Chrome 冒烟核对首页/工具页无回归（验收结果见台账）。

## R12ab 落地（2026-11-28，Manifest 补显式 id 稳定应用身份）

R12 小盘点续项：`public/site.webmanifest` 自 R12s 新增起就没有 `id` 字段。按 Web App Manifest 规范，`id` 是已安装 Web App 的身份标识；缺省时浏览器以 `start_url` 推导身份——将来若调整 `start_url`（例如改为某个常用工具页或带参数的入口），已安装应用会被当成另一个新应用（图标重复、安装状态与存储归属错位），用户与浏览器都无从知道它们是同一个应用。与 R12s/R12v 补齐 manifest 声明同族，这次缺的是身份稳定性声明。

- 处理：manifest 补 `"id": "/"`（与现有 `scope`、`start_url` 逐字一致，取根路径为稳定身份），文件 667→676 B（+9 B）；其余字段、图标条目与 `index.html` 的 `rel="manifest"` 链接一字未改。
- 边界：`id` 选定后即为应用身份锚点，若将来改 `start_url` 必须保留本 `id` 不变、不得随之改动（已在本节留痕）；本项不引入 Service Worker、不改任何运行时行为。
- 等价证据：manifest 经 JSON 解析校验通过且除 `id` 外字段与改前逐项相同；test 构建 exit=0、产物 manifest 与源文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、图标条目无回归、首页/工具页无回归（验收结果见台账）。

## R12ac 落地（2026-11-28，Manifest 补常用工具快捷方式）

R12 小盘点续项：`public/site.webmanifest` 自 R12s 新增起没有 `shortcuts` 字段，已安装应用的长按/右键菜单只能回到首页再找工具，高频工具没有直达入口。与 R12s/R12v/R12ab 补齐 manifest 能力同族，这次缺的是已安装应用的快捷方式声明。

- 处理：manifest 补 `shortcuts` 四条——JSON格式化（`/text/json-formatter`）、Base64编解码（`/text/base64`）、时间戳转换（`/converter/timestamp`）、UUID生成器（`/generator/uuid`），名称与站内工具名逐字一致、URL 与 sitemap/路由逐项核对一致；每条图标复用现有 `/icons/icon-192.png`（192×192 PNG），不新增图标文件。文件 676→1,205 B（+529 B），其余字段与图标条目未改。
- 边界：快捷方式只对已安装应用的系统菜单生效，不改任何页面内导航与运行时行为；将来工具改名或改路径时须同步改本字段（已在本节留痕）。
- 等价证据：manifest 经 JSON 解析校验通过、四条 URL 均在 sitemap 中存在；test 构建 exit=0、产物 manifest 与源文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、四条快捷方式齐全、四目标页可达且无回归（验收结果见台账）。

## R12ad 落地（2026-11-28，Manifest 补 categories 分类声明）

R12 小盘点续项：`public/site.webmanifest` 自 R12s 新增起没有 `categories` 字段。按 Web App Manifest 规范，`categories` 是应用所属分类列表，供应用商店、安装界面与系统分类展示使用；缺省时平台只能靠名称/描述猜测归类，开发者工具箱这类工具型应用容易被归到无关类别。与 R12s/R12ab/R12ac 补齐 manifest 声明同族，这次缺的是分类声明。

- 处理：manifest 补 `"categories": ["utilities", "productivity"]`（两项均为 W3C 规范登记的标准分类值：utilities 对应工具类、productivity 对应效率类，与本站定位逐项吻合），文件 1,205→1,247 B（+42 B）；其余字段、图标与 shortcuts 条目一字未改。
- 边界：categories 只供平台分类展示，不改任何页面内导航与运行时行为；将来产品定位变更时须同步复核本字段（已在本节留痕）。不使用未登记的自造分类值（如 developer 不在标准登记表中，未采用）。
- 等价证据：manifest 经 JSON 解析校验通过且除 categories 外字段与改前逐项相同；test 构建 exit=0、产物 manifest 与源文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、categories 两项齐全、图标/shortcuts 无回归、首页/工具页无回归（验收结果见台账）。

## R12ae 落地（2026-11-28，Manifest 补 dir 文本方向声明）

R12 小盘点续项：`public/site.webmanifest` 自 R12s 新增起有 `lang: "zh-CN"`，但没有 `dir` 字段。按 Web App Manifest 规范，`dir` 声明清单文本（name/short_name/description）的书写方向，供安装界面与平台展示清单文本时使用；缺省时平台只能靠语言标签猜测方向，个别展示端对中文文本的双向算法处理并不一致。与 R12ab 补 id、R12ac 补 shortcuts、R12ad 补 categories 同族，这次缺的是文本方向声明。

- 处理：manifest 补 `"dir": "ltr"`（中文为从左到右书写，与 `lang: "zh-CN"` 逐项吻合），文件 1,247→1,259 B（+12 B）；其余字段、图标与 shortcuts 条目一字未改。
- 边界：dir 只影响平台对清单文本的展示方向，不改任何页面内布局与运行时行为；将来若产品改为 RTL 语言版本，须同步改本字段（已在本节留痕）。
- 等价证据：manifest 经 JSON 解析校验通过且除 dir 外字段与改前逐项相同；test 构建 exit=0、产物 manifest 与源文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、dir 为 ltr、categories/icons/shortcuts 无回归、首页/工具页无回归（验收结果见台账）。

## R12af 落地（2026-11-28，Manifest 补 display_override 显示回退链）

R12 小盘点续项：`public/site.webmanifest` 自 R12s 新增起只有 `display: "standalone"`，没有 `display_override` 字段。按 Web App Manifest 规范，`display` 是单值声明：当运行平台不支持 standalone 时，浏览器只能按规范默认顺序（fullscreen → standalone → minimal-ui → browser）逐级回退，开发者无法表达自己的回退偏好——对本站而言，standalone 不可用时直接退到带完整浏览器界面的 browser 模式，已安装应用的沉浸感会断崖式丢失，而 minimal-ui（保留少量导航控件）才是更合适的次选。与 R12ab 补 id、R12ac 补 shortcuts、R12ad 补 categories、R12ae 补 dir 同族，这次缺的是显示模式回退链声明。

- 处理：manifest 在 `display` 后补 `"display_override": ["standalone", "minimal-ui"]`（首项与 display 一致、二项为次选 minimal-ui，均为规范登记的显示模式值），文件 1,259→1,306 B（+47 B）；其余字段、图标与 shortcuts 条目一字未改。
- 边界：display_override 只影响不支持首选模式的平台如何回退，不改支持 standalone 平台上的任何表现与运行时行为；将来若 display 改值，须同步复核本链首项（已在本节留痕）。
- 等价证据：manifest 经 JSON 解析校验通过且除 display_override 外字段与改前逐项相同；test 构建 exit=0、产物 manifest 与源文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、display_override 两项齐全、dir/categories/icons/shortcuts 无回归、首页/工具页无回归（验收结果见台账）。

## R12ag 落地（2026-11-28，Manifest 补 prefer_related_applications 显式声明）

R12 小盘点续项：`public/site.webmanifest` 自 R12s 新增起没有 `prefer_related_applications` 字段。按 Web App Manifest 规范，该字段声明是否希望平台优先推荐关联的原生应用；缺省时虽默认为 false，但安装提示与平台推荐逻辑在不同实现里对「未声明」的处理并不一致，本站并无任何关联原生应用，继续留空等于让平台替本站猜测。与 R12ab 补 id、R12ac 补 shortcuts、R12ad 补 categories、R12ae 补 dir、R12af 补 display_override 同族，这次缺的是关联应用偏好声明。

- 处理：manifest 补 `"prefer_related_applications": false`（明确不优先推荐原生应用、Web App 本身即正式入口），文件 1,306→1,342 B（+36 B）；其余字段、图标与 shortcuts 条目一字未改（脚本逐项比对除新增项外零变更）。
- 边界：该字段不引入任何原生应用关联（`related_applications` 仍不声明、无从填写平台与 id），不改任何页面内行为；将来若真推出关联原生应用，须同时补 `related_applications` 并把本字段改为 true，两处一并复核（已在本节留痕）。
- 等价证据：manifest 经 JSON 解析校验通过且除新增项外字段与改前逐项相同；test 构建 exit=0、产物 manifest 与源文件一致；无头 Chrome 冒烟核对 manifest 可达可解析、新字段为 false、dir/categories/display_override/icons/shortcuts 无回归、首页/工具页无回归（验收结果见台账）。
