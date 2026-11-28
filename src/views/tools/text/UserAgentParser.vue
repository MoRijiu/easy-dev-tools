<template>
  <div class="ua-parser">
    <h1>User Agent解析</h1>
    <p class="description">把 User Agent 拆成浏览器、渲染引擎、操作系统与设备信息，全程本地解析、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="useCurrent" class="btn btn-secondary"><span class="icon" aria-hidden="true">🖥️</span> 当前浏览器</button>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copySummary" class="btn btn-success" :disabled="!result"><span class="icon" aria-hidden="true">📋</span> 复制摘要</button>
      </ToolToolbar>
      <ToolStatusMessage id="user-agent-status" :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="粘贴 User Agent，如 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 … Chrome/120.0 Safari/537.36" spellcheck="false" aria-label="User Agent输入" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'user-agent-status' : undefined" @input="parse"></textarea>
      <template v-if="result">
        <p class="summary">{{ result.summary }}<span v-if="result.isBot" class="bot-tag">机器人：{{ result.botName }}</span></p>
        <ul v-if="result.notes && result.notes.length" class="notes" role="status" aria-live="polite">
          <li v-for="(n, i) in result.notes" :key="i">⚠ {{ n }}</li>
        </ul>
        <table class="kv" aria-label="解析结果">
          <tbody>
            <tr v-for="row in rows" :key="row.label"><th scope="row">{{ row.label }}</th><td><code>{{ row.value || '—' }}</code></td><td><button class="mini" :disabled="!row.value" :aria-label="`复制${row.label}`" @click="copyText(row.value)">复制</button></td></tr>
          </tbody>
        </table>
      </template>
      <ToolExamples :examples="examples" @use-example="useExample" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { parseUserAgent } from '@/utils/userAgent.js';

const features = [
  { icon: '🌐', title: '浏览器识别', description: '区分 Edge/Opera/三星等 Chromium 衍生浏览器与微信/QQ 内置浏览器' },
  { icon: '📱', title: '设备识别', description: '手机/平板/桌面判定，安卓机型与厂商提取' },
  { icon: '🤖', title: '机器人识别', description: '常见搜索引擎爬虫、HTTP 客户端与 HeadlessChrome 自动化标记' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴任意 User Agent，或点「当前浏览器」解析你自己的', '查看浏览器/引擎/系统/设备拆解表，逐项可复制', '点「复制摘要」得到一行简明结论'];
const faqs = [
  { question: 'Windows 版本为什么显示 10 / 11？', answer: 'Windows 10 与 11 的 UA 都写 Windows NT 10.0，单靠 UA 无法区分，所以合并显示。要区分需看 Client Hints 请求头 Sec-CH-UA-Platform-Version：小于 13.0.0 是 Windows 10，大于等于 13.0.0 是 Windows 11，它不在 UA 字符串里，本工具会在结果下方给出提示。' },
  { question: '为什么 Chrome 的引擎是 Blink？', answer: 'Chrome、Edge、Opera 等 Chromium 系浏览器使用 Blink 引擎；Safari 用 WebKit，Firefox 用 Gecko。UA 里的 AppleWebKit 字样是历史兼容写法。例外是 iOS：苹果要求所有 iOS 浏览器都用 WebKit，所以 iOS 上的 Chrome/Firefox 也显示 WebKit。' },
  { question: 'iPad 的 UA 为什么长得像 Mac？', answer: 'iPadOS 13 起默认「请求桌面网站」，UA 与 Mac 几乎一致，只多一个 Mobile/ 标记。本工具据此判定为 iPad 并给出提示；此时系统版本字段沿用的是 UA 里的 Mac OS X 版本号，并非真实 iPadOS 版本。' },
  { question: 'UA 里的信息越来越少是怎么回事？', answer: '出于隐私，Chrome 等浏览器正在冻结 UA：桌面端只保留大版本、移动端不再写具体机型。更精确的浏览器版本、机型与系统版本改由 User-Agent Client Hints（Sec-CH-UA-* 请求头或 navigator.userAgentData）提供，不在 UA 字符串内，单靠 UA 解析不到。' },
  { question: '解析结果准吗？', answer: 'UA 可以被任意伪造，结果只代表这段字符串自称的身份，适合调试与日志分析，不能当作设备真实性的证明。' }
];
const examples = [
  { input: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', output: 'Safari 17.2 · iOS 17.2 · 手机', description: 'iPhone Safari' },
  { input: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', output: 'Chrome 120.0.0.0 · Android 13 · 手机', description: '安卓 Chrome（三星机型）' },
  { input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', output: 'Safari 17.4 · iPadOS 10.15.7 · 平板', description: 'iPad 桌面模式 UA（像 Mac 但带 Mobile/ 标记）' },
  { input: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36', output: 'Chrome 120.0.0.0 · Linux · 桌面设备（机器人：HeadlessChrome 自动化）', description: '无头 Chrome 自动化 UA' }
];
const inputText = ref('');
const result = ref(null);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const inputErrorText = ref('');
const setInputError = (msg) => { status.showError(msg); inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const rows = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  return [
    { label: '浏览器', value: r.browser.name + (r.browser.version ? ' ' + r.browser.version : '') },
    { label: '渲染引擎', value: r.engine.name + (r.engine.version ? ' ' + r.engine.version : '') },
    { label: '操作系统', value: r.os.name + (r.os.version ? ' ' + r.os.version : '') },
    { label: '设备类型', value: r.device.typeLabel },
    { label: '设备厂商', value: r.device.vendor },
    { label: '设备型号', value: r.device.model },
    { label: 'CPU 架构', value: r.cpu.architecture },
    { label: '机器人', value: r.isBot ? r.botName : '' }
  ];
});
const parse = () => {
  result.value = null;
  if (!inputText.value.trim()) { statusMessage.value = ''; return; }
  try {
    result.value = parseUserAgent(inputText.value);
    statusMessage.value = '✓ 解析成功';
    statusType.value = 'success';
  } catch (e) { setInputError('✗ ' + e.message); }
};
const useCurrent = () => { inputText.value = navigator.userAgent; parse(); };
const loadExample = () => { inputText.value = examples[0].input; parse(); };
const useExample = (ex) => { inputText.value = ex.input; parse(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const copyText = async (t) => clipboard.copyText(t, '✓ 已复制');
const copySummary = () => { if (result.value) copyText(result.value.summary); };
</script>

<style scoped>
.notes { margin: 8px 0 0; padding: 8px 12px 8px 28px; background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; color: var(--warning-text); font-size: 12.5px; line-height: 1.6; }
.text-input { width: 100%; min-height: 72px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.summary { margin-top: 12px; font-size: 14px; font-weight: 600; color: var(--text-strong); }
.bot-tag { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; font-weight: 500; }
.kv { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 110px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; }
.kv code { word-break: break-all; color: var(--text); }
.mini { padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
@media (max-width: 640px) { .kv th { width: 84px; } }
</style>
