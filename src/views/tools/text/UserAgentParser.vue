<template>
  <div class="ua-parser">
    <h1>User Agent解析</h1>
    <p class="description">把 User Agent 拆成浏览器、渲染引擎、操作系统与设备信息，全程本地解析、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="useCurrent" class="btn btn-secondary"><span class="icon">🖥️</span> 当前浏览器</button>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="copySummary" class="btn btn-success" :disabled="!result"><span class="icon">📋</span> 复制摘要</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="粘贴 User Agent，如 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 … Chrome/120.0 Safari/537.36" spellcheck="false" aria-label="User Agent输入" @input="parse"></textarea>
      <template v-if="result">
        <p class="summary">{{ result.summary }}<span v-if="result.isBot" class="bot-tag">机器人：{{ result.botName }}</span></p>
        <table class="kv" aria-label="解析结果">
          <tbody>
            <tr v-for="row in rows" :key="row.label"><th>{{ row.label }}</th><td><code>{{ row.value || '—' }}</code></td><td><button class="mini" :disabled="!row.value" @click="copyText(row.value)">复制</button></td></tr>
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
import { parseUserAgent } from '@/utils/userAgent.js';

const features = [
  { icon: '🌐', title: '浏览器识别', description: '区分 Edge/Opera/三星等 Chromium 衍生浏览器与微信/QQ 内置浏览器' },
  { icon: '📱', title: '设备识别', description: '手机/平板/桌面判定，安卓机型与厂商提取' },
  { icon: '🤖', title: '机器人识别', description: '常见搜索引擎爬虫与 HTTP 客户端标记' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴任意 User Agent，或点「当前浏览器」解析你自己的', '查看浏览器/引擎/系统/设备拆解表，逐项可复制', '点「复制摘要」得到一行简明结论'];
const faqs = [
  { question: 'Windows 版本为什么显示 10 / 11？', answer: 'Windows 10 与 11 的 UA 都写 Windows NT 10.0，单靠 UA 无法区分，所以合并显示。' },
  { question: '为什么 Chrome 的引擎是 Blink？', answer: 'Chrome、Edge、Opera 等 Chromium 系浏览器使用 Blink 引擎；Safari 用 WebKit，Firefox 用 Gecko。UA 里的 AppleWebKit 字样是历史兼容写法。' },
  { question: '解析结果准吗？', answer: 'UA 可以被任意伪造，结果只代表这段字符串自称的身份，适合调试与日志分析，不能当作设备真实性的证明。' }
];
const examples = [
  { input: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', output: 'Safari · iOS 17.2 · 手机', description: 'iPhone Safari' },
  { input: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', output: 'Chrome · Android 13 · 三星手机', description: '安卓 Chrome' }
];
const inputText = ref('');
const result = ref(null);
const statusMessage = ref('');
const statusType = ref('');
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
  } catch (e) { statusMessage.value = '✗ ' + e.message; statusType.value = 'error'; }
};
const useCurrent = () => { inputText.value = navigator.userAgent; parse(); };
const loadExample = () => { inputText.value = examples[0].input; parse(); };
const useExample = (ex) => { inputText.value = ex.input; parse(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
const copySummary = () => { if (result.value) copyText(result.value.summary); };
</script>

<style scoped>
.ua-parser { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.text-input { width: 100%; min-height: 72px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.summary { margin-top: 12px; font-size: 14px; font-weight: 600; color: var(--text-strong); }
.bot-tag { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; font-weight: 500; }
.kv { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 110px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; }
.kv code { word-break: break-all; color: var(--text); }
.mini { padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { width: 84px; } }
</style>
