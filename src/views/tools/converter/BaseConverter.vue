<template>
  <div class="base-converter">
    <h1>进制转换工具</h1>
    <p class="description">二进制、八进制、十进制、十六进制乃至 36 进制互转，支持大整数与小数；全程本地计算，不上传服务器</p>

    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary">
          <span class="icon">📝</span> 示例
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon">🗑️</span> 清空
        </button>
        <button @click="copyAll" class="btn btn-success" :disabled="!results">
          <span class="icon">📋</span> 复制全部结果
        </button>
      </ToolToolbar>

      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <div class="input-section">
        <ToolEditorPanel title="输入数值" :info="results ? `整数位长 ${bits} bit` : ''">
          <div class="input-row">
            <input
              v-model="inputValue"
              class="base-input"
              placeholder="例如：255、0xFF、0b11111111，支持负数与小数"
              spellcheck="false"
              aria-label="待转换数值"
              @input="convert"
            />
            <label class="base-select-label">
              源进制
              <select v-model.number="fromBase" class="base-select" aria-label="源进制" @change="convert">
                <option v-for="b in baseOptions" :key="b" :value="b">{{ b }} 进制</option>
              </select>
            </label>
          </div>
          <div class="option-row">
            <label class="check-label">
              <input type="checkbox" v-model="grouped" /> 分组显示（二/十六进制按 4 位）
            </label>
            <label class="custom-base-label">
              自定义目标进制
              <select v-model.number="customBase" class="base-select small" aria-label="自定义目标进制" @change="convert">
                <option v-for="b in allBases" :key="b" :value="b">{{ b }}</option>
              </select>
            </label>
          </div>
        </ToolEditorPanel>
      </div>

      <div v-if="results" class="results-section">
        <table class="results-table">
          <thead>
            <tr><th scope="col">进制</th><th scope="col">结果</th><th scope="col" class="copy-col">复制</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in resultRows" :key="row.base" :class="{ 'is-source': row.base === fromBase }">
              <th scope="row">{{ row.base }} 进制<span v-if="row.base === fromBase" class="src-tag">源</span></th>
              <td><code class="result-value">{{ displayValue(row) }}</code><span v-if="!row.exact" class="approx-tag" title="小数部分为近似展开">≈ 近似</span></td>
              <td class="copy-col"><button class="copy-btn" @click="copyOne(row)" :aria-label="`复制 ${row.base} 进制结果`">📋</button></td>
            </tr>
          </tbody>
        </table>
        <p class="results-note">小数部分最多展开 32 位，循环小数会标注「近似」；整数部分用任意精度计算，再大的数也不会丢精度。下划线可作分隔符输入，会被自动忽略。</p>
      </div>

      <div class="presets">
        <button v-for="p in presets" :key="p.label" class="preset-chip" @click="usePreset(p)">{{ p.label }} <code>{{ p.value }}</code></button>
      </div>

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
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { COMMON_BASES, convertBase, groupDigits, bitLength } from '@/utils/baseConvert.js';

const features = [
  { icon: '🔢', title: '2–36 进制互转', description: '常用二/八/十/十六/三十六进制一屏对照，另可任选自定义目标进制' },
  { icon: '🧮', title: '任意精度整数', description: '基于大整数计算，64 位以上的大数也不丢精度' },
  { icon: '🔣', title: '支持小数与负数', description: '小数部分自动展开，循环小数标注近似；负数与 0x/0b/0o 前缀都能识别' },
  { icon: '🔒', title: '纯本地计算', description: '数值不离开浏览器，不上传任何服务器' }
];

const usageSteps = [
  '输入数值并选择源进制，输入即转换',
  '在结果表里对照各进制的值，点行尾按钮单独复制',
  '需要其他进制时，在「自定义目标进制」里任选 2–36',
  '二进制/十六进制结果可勾选分组显示，按 4 位一段更易读'
];

const faqs = [
  {
    question: '支持多大的数？',
    answer: '整数部分用任意精度（大整数）计算，几百位也没有问题；小数部分最多展开 32 位，无法整除时会标注「近似」。'
  },
  {
    question: '0xFF 这样的前缀能直接粘贴吗？',
    answer: '可以。当源进制选 16 时自动识别 0x、选 8 时识别 0o、选 2 时识别 0b；下划线分隔符（如 1111_1111）也会被忽略。'
  },
  {
    question: '36 进制里的字母怎么算？',
    answer: '10–35 依次用 a–z 表示（不区分大小写），例如 36 进制的 zz 等于十进制 1295。'
  },
  {
    question: '负数怎么表示？',
    answer: '采用符号位表示法：结果带前导负号，如十进制 -255 的二进制是 -11111111，不做补码展开。'
  },
  {
    question: '粘贴 0xFF 却报「x 不是合法数字」怎么办？',
    answer: '说明源进制没选对：0x 是 16 进制前缀、0b 是 2 进制、0o 是 8 进制。现在工具会直接点名检测到的前缀与应切换的进制，按提示切换即可；报错里的字符位置按原文计算（含符号与前缀）。'
  },
  {
    question: '下划线分隔符有什么规则？',
    answer: '下划线只能夹在两个数字之间（如 1111_1111、ff_ff），开头、结尾、紧挨小数点或连续两个下划线都会报错并定位；整数与小数合计最多 4096 位。'
  }
];

const presets = [
  { label: '十进制 255', value: '255', base: 10 },
  { label: '十六进制 FF', value: 'FF', base: 16 },
  { label: '二进制 1010', value: '1010', base: 2 },
  { label: '小数 0.5', value: '0.5', base: 10 },
  { label: '大整数 2^64-1', value: '18446744073709551615', base: 10 }
];

const examples = [
  { input: '255（10 进制）', output: '十六进制 ff', description: '颜色值里最常见的 255', value: '255', base: 10 },
  { input: '0xFF（16 进制）', output: '十进制 255', description: '粘贴带 0x 前缀的值', value: '0xFF', base: 16 },
  { input: '0.5（10 进制）', output: '二进制 0.1', description: '小数转换示例', value: '0.5', base: 10 }
];

const allBases = Array.from({ length: 35 }, (_, i) => i + 2);
const baseOptions = allBases;

const inputValue = ref('');
const fromBase = ref(10);
const customBase = ref(36);
const grouped = ref(true);
const results = ref(null);
const bits = ref(0);
const statusMessage = ref('');
const statusType = ref('');

const resultRows = computed(() => {
  if (!results.value) return [];
  const rows = COMMON_BASES.map(b => ({ base: b, ...results.value[b] }));
  if (!COMMON_BASES.includes(customBase.value)) {
    try { rows.push({ base: customBase.value, ...convertBase(inputValue.value, fromBase.value, customBase.value) }); }
    catch { /* 输入非法时结果区已清空，不会走到这里 */ }
  }
  return rows.sort((a, b) => a.base - b.base);
});

const displayValue = (row) => (grouped.value && (row.base === 2 || row.base === 16) ? groupDigits(row.value, 4) : row.value);

const convert = () => {
  results.value = null;
  const raw = inputValue.value.trim();
  if (!raw) { statusMessage.value = ''; return; }
  try {
    const out = {};
    for (const b of COMMON_BASES) out[b] = convertBase(raw, fromBase.value, b);
    results.value = out;
    bits.value = bitLength(raw, fromBase.value);
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    statusMessage.value = `✗ ${e.message}`;
    statusType.value = 'error';
  }
};

const loadExample = () => { inputValue.value = '255'; fromBase.value = 10; convert(); };
const usePreset = (p) => { inputValue.value = p.value; fromBase.value = p.base; convert(); };
const useExample = (ex) => {
  if (ex && ex.value !== undefined) { inputValue.value = ex.value; fromBase.value = ex.base || 10; convert(); }
  else loadExample();
};
const clearAll = () => { inputValue.value = ''; results.value = null; statusMessage.value = ''; };

const copyText = async (text, okMsg) => {
  try {
    await navigator.clipboard.writeText(text);
    statusMessage.value = okMsg;
    statusType.value = 'success';
  } catch {
    statusMessage.value = '✗ 复制失败，请手动复制';
    statusType.value = 'error';
  }
};
const copyOne = (row) => copyText(row.value, `✓ ${row.base} 进制结果已复制`);
const copyAll = () => copyText(resultRows.value.map(r => `${r.base} 进制: ${r.value}`).join('\n'), '✓ 全部结果已复制到剪贴板');
</script>

<style scoped>
.base-converter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.input-section { margin-bottom: 12px; }
.input-row { display: flex; gap: 10px; flex-wrap: wrap; }
.base-input { flex: 1 1 260px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 15px; box-sizing: border-box; }
.base-select-label { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 14px; }
.base-select { padding: 10px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; }
.base-select.small { padding: 6px 6px; font-size: 13px; }
.option-row { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 10px; align-items: center; }
.check-label { display: flex; align-items: center; gap: 6px; color: var(--text-2); font-size: 13px; cursor: pointer; }
.custom-base-label { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 13px; }
.results-section { margin-bottom: 16px; }
.results-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.results-table th, .results-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; color: var(--text); }
.results-table thead th { background: var(--bg-soft); color: var(--text-strong); }
.results-table tbody th { width: 110px; color: var(--text-strong); background: var(--bg-soft); white-space: nowrap; }
.results-table tr.is-source tbody th, .results-table tr.is-source th { color: var(--accent); }
.src-tag { margin-left: 6px; font-size: 11px; color: var(--text-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 6px; }
.result-value { font-size: 14px; word-break: break-all; }
.approx-tag { margin-left: 8px; font-size: 12px; color: var(--warning-text, var(--text-2)); white-space: nowrap; }
.copy-col { width: 56px; text-align: center !important; }
.copy-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 14px; }
.copy-btn:hover { border-color: var(--accent); }
.results-note { margin: 8px 0 0; color: var(--text-2); font-size: 13px; }
.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.preset-chip { padding: 5px 10px; border-radius: 999px; background: var(--bg-soft); color: var(--text); font-size: 13px; border: 1px solid var(--border); cursor: pointer; }
.preset-chip:hover { border-color: var(--accent); }
.preset-chip code { color: var(--text-2); font-size: 12px; margin-left: 4px; }
@media (max-width: 640px) {
  h1 { font-size: 2rem; }
  .tool-container { padding: 20px; }
  .results-table tbody th { width: 84px; }
}
</style>
