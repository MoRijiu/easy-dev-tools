<template>
  <div class="cidr-calculator">
    <h1>CIDR子网计算器</h1>
    <p class="description">输入 IPv4 地址与前缀，算出网络地址、广播地址、可用主机范围与掩码，全程本地计算、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copySummary" class="btn btn-success" :disabled="!result"><span class="icon" aria-hidden="true">📋</span> 复制摘要</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <input v-model="inputText" class="text-input" placeholder="如 192.168.1.10/24，也支持 /255.255.255.0 掩码写法或纯 IP" spellcheck="false" aria-label="CIDR 输入" @input="calculate" />
      <div class="prefix-row" aria-label="常用前缀">
        <span>常用前缀：</span>
        <button v-for="p in [8, 16, 24, 25, 26, 27, 28, 29, 30, 32]" :key="p" class="chip" :class="{ active: result && result.prefix === p }" :aria-pressed="!!result && result.prefix === p" @click="applyPrefix(p)">/{{ p }}</button>
      </div>
      <ul v-if="result && result.warnings.length" class="warnings-list" role="status" aria-live="polite">
        <li v-for="(w, i) in result.warnings" :key="i">⚠️ {{ w }}</li>
      </ul>
      <template v-if="result">
        <p class="summary">网段 {{ result.cidr }} · {{ result.scope }} · 可用主机 {{ result.usableHostsFormatted }} 个</p>
        <table class="kv" aria-label="子网计算结果">
          <tbody>
            <tr v-for="row in rows" :key="row.label"><th>{{ row.label }}</th><td><code>{{ row.value }}</code></td><td><button class="mini" @click="copyText(row.value)">复制</button></td></tr>
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
import { parseCidr } from '@/utils/cidr.js';

const features = [
  { icon: '🧮', title: '完整子网信息', description: '网络/广播地址、可用范围、掩码与反掩码、主机总数一屏算清' },
  { icon: '🏷️', title: '地址性质判定', description: '区分私有、环回、链路本地、组播与公网地址，并给出 A-E 类别' },
  { icon: '🔢', title: '多进制对照', description: '同时给出 IP 的十进制整数、十六进制与二进制形式' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['输入 IP/前缀，如 192.168.1.10/24（也支持点分掩码写法）', '结果实时计算，点常用前缀 chips 可快速换前缀试算', '逐项复制，或点「复制摘要」得到一行结论'];
const faqs = [
  { question: '/31 为什么可用主机是 2 个？', answer: '按 RFC 3021，/31 用于点对点链路时两端地址都可分配主机，不再保留网络与广播地址；/32 则只有 1 个地址。' },
  { question: '可用主机数为什么比总数少 2？', answer: '常规网段里网络地址标识网段本身、广播地址用于广播，两者不能分给主机，所以可用数 = 总数 − 2。输入的 IP 若正好是网络或广播地址，页面会给出警告。' },
  { question: '支持 IPv6 吗？', answer: '暂不支持。本工具只处理 IPv4 CIDR，输入 IPv6 地址会给出明确提示。' },
  { question: '输入带空格可以吗？', answer: '首尾空格与 / 两侧的空格（如 192.168.1.10 / 24）会自动容忍；IP 内部出现空格会报错，避免把两段无关文本拼在一起误算。' },
  { question: '0.x、198.18.x 这类地址是什么性质？', answer: '0.0.0.0/8 是本网络地址段，198.18.0.0/15 是 RFC 2544 基准测试段，192.0.0.0/24 是 IETF 协议分配段——都不是普通公网或私网地址，本工具会单独点名并给出提示。' }
];
const examples = [
  { input: '192.168.1.10/24', output: '网段 192.168.1.0/24 · 可用 192.168.1.1 – 192.168.1.254', description: '家庭/办公常见网段' },
  { input: '10.20.30.40/22', output: '网段 10.20.28.0/22 · 可用 1,022 个', description: '非整字节前缀' },
  { input: '192.168.1.10/255.255.255.128', output: '网段 192.168.1.0/25 · 可用 126 个', description: '点分掩码写法，等价 /25' },
  { input: '192.168.1.0/24', output: '网段 192.168.1.0/24 · 提示：输入正好是网络地址', description: '网络地址会触发警告' }
];
const inputText = ref('');
const result = ref(null);
const statusMessage = ref('');
const statusType = ref('');
const rows = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  return [
    { label: 'IP 地址', value: r.ip },
    { label: '所属网段', value: r.cidr },
    { label: '子网掩码', value: `${r.netmask}（/${r.prefix}）` },
    { label: '反掩码', value: r.wildcard },
    { label: '网络地址', value: r.network },
    { label: '广播地址', value: r.broadcast },
    { label: '可用范围', value: `${r.firstUsable} – ${r.lastUsable}` },
    { label: '地址总数', value: r.totalHostsFormatted },
    { label: '可用主机', value: r.usableHostsFormatted },
    { label: '地址类别', value: `${r.ipClass} 类` },
    { label: '地址性质', value: r.scope },
    { label: '整数形式', value: r.ipInteger },
    { label: '十六进制', value: r.ipHex },
    { label: '二进制 IP', value: r.ipBinary },
    { label: '二进制掩码', value: r.maskBinary }
  ];
});
const calculate = () => {
  if (!inputText.value.trim()) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = parseCidr(inputText.value);
    statusMessage.value = '✓ 计算完成';
    statusType.value = 'success';
  } catch (e) { statusMessage.value = '✗ ' + e.message; statusType.value = 'error'; }
};
const applyPrefix = (p) => {
  const ipPart = inputText.value.trim().split('/')[0].trim();
  if (!ipPart) { statusMessage.value = '✗ 请先输入一个 IPv4 地址'; statusType.value = 'error'; return; }
  try { parseCidr(ipPart); } catch (e) { statusMessage.value = '✗ ' + e.message; statusType.value = 'error'; return; }
  inputText.value = `${ipPart}/${p}`;
  calculate();
};
const loadExample = () => { inputText.value = examples[0].input; calculate(); };
const useExample = (ex) => { inputText.value = ex.input; calculate(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
const copySummary = () => {
  if (!result.value) return;
  const r = result.value;
  copyText(`${r.cidr} 掩码 ${r.netmask}，可用 ${r.firstUsable} – ${r.lastUsable}（${r.usableHostsFormatted} 个），广播 ${r.broadcast}`);
};
</script>

<style scoped>
.cidr-calculator { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.warnings-list { margin: 12px 0 0; padding: 10px 14px 10px 30px; background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; line-height: 1.7; }
.text-input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; box-sizing: border-box; }
.prefix-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.chip { padding: 3px 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; }
.chip.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.summary { margin-top: 12px; font-size: 14px; font-weight: 600; color: var(--text-strong); }
.kv { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 110px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; }
.kv code { word-break: break-all; color: var(--text); }
.mini { padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { width: 84px; } }
</style>
