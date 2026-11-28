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
