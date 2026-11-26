<template>
  <div class="random-number">
    <h1>随机数生成器</h1>
    <p class="description">用浏览器安全随机源生成无偏随机整数或小数，支持不重复、排序与批量复制，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label class="field">类型
          <select v-model="mode" aria-label="随机数类型">
            <option value="integer">整数</option>
            <option value="float">小数</option>
          </select>
        </label>
        <label class="field">最小值<input v-model="minInput" type="text" inputmode="decimal" aria-label="最小值"></label>
        <label class="field">最大值<input v-model="maxInput" type="text" inputmode="decimal" aria-label="最大值"></label>
        <label class="field">数量<input v-model="countInput" type="text" inputmode="numeric" aria-label="生成数量"></label>
        <label v-if="mode === 'float'" class="field">小数位数<input v-model="decimalsInput" type="text" inputmode="numeric" placeholder="不限" aria-label="小数位数"></label>
        <label class="field">排序
          <select v-model="sort" aria-label="排序方式">
            <option value="none">生成顺序</option>
            <option value="asc">从小到大</option>
            <option value="desc">从大到小</option>
          </select>
        </label>
        <label v-if="mode === 'integer'" class="check"><input v-model="unique" type="checkbox"> 不重复</label>
      </div>
      <div class="row actions">
        <button class="btn" type="button" @click="generate">生成随机数</button>
        <button class="btn ghost" type="button" @click="loadDice">示例：掷骰子 6 次</button>
        <button class="btn ghost" type="button" @click="loadLottery">示例：1–100 抽 10 个</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="results.length">
        <p class="summary">已生成 {{ summary.count }} 个 · 最小 {{ summary.min }} · 最大 {{ summary.max }} · 平均 {{ averageText }}</p>
        <label class="block">结果（每行一个）
          <textarea :value="resultText" rows="8" readonly spellcheck="false" aria-label="随机数结果"></textarea>
        </label>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(resultText)">复制全部</button>
          <button class="btn ghost" type="button" @click="copyText(results.join(', '))">复制为逗号分隔</button>
          <button class="btn ghost" type="button" @click="generate">再生成一组</button>
        </div>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
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
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { generateRandomIntegers, generateRandomFloats, summarizeNumbers } from '@/utils/randomNumber.js';
const features = [
  { icon: '🎲', title: '安全随机源', description: '基于 Web Crypto 的 crypto.getRandomValues，不用可预测的 Math.random' },
  { icon: '⚖️', title: '无偏采样', description: '整数用拒绝采样消除取模偏差，范围内每个数出现概率相同' },
  { icon: '🔢', title: '整数与小数', description: '整数支持不重复抽取与排序，小数可指定 0–10 位小数' },
  { icon: '🔒', title: '纯本地处理', description: '随机数在浏览器内生成，不上传任何服务器' }
];
const usageSteps = ['选整数或小数，填最小值、最大值与生成数量', '需要抽签 / 抽奖时勾选「不重复」，再点生成', '结果可整段复制，或复制为逗号分隔方便贴进代码'];
const faqs = [
  { question: '为什么不用 Math.random？', answer: 'Math.random 不是密码学安全的随机源，结果可被预测，且直接对它取模会让小数字出现概率偏高。本工具用 crypto.getRandomValues 加拒绝采样，分布均匀、不可预测。' },
  { question: '「不重复」有什么限制？', answer: '不重复个数不能超过范围内的整数总数。例如 1–10 最多生成 10 个不重复数，超出会直接报错提示。' },
  { question: '小数会取到最大值吗？', answer: '原始小数取自 [最小值, 最大值) 区间；指定小数位数四舍五入后，个别结果可能恰好等于最大值，这是舍入结果。' }
];
const mode = ref('integer');
const minInput = ref('1');
const maxInput = ref('100');
const countInput = ref('10');
const decimalsInput = ref('2');
const sort = ref('none');
const unique = ref(false);
const results = ref([]);
const error = ref('');
const statusMessage = ref(''); const statusType = ref('');
const summary = computed(() => summarizeNumbers(results.value));
const averageText = computed(() => (summary.value ? Number(summary.value.average.toFixed(6)).toString() : ''));
const resultText = computed(() => results.value.join('\n'));
function generate() {
  error.value = ''; statusMessage.value = '';
  try {
    const common = { min: minInput.value, max: maxInput.value, count: countInput.value, sort: sort.value };
    results.value = mode.value === 'integer'
      ? generateRandomIntegers({ ...common, unique: unique.value })
      : generateRandomFloats({ ...common, decimals: decimalsInput.value === '' ? null : decimalsInput.value });
  } catch (e) {
    error.value = e.message || String(e);
    results.value = [];
  }
}
function loadDice() { mode.value = 'integer'; minInput.value = '1'; maxInput.value = '6'; countInput.value = '6'; unique.value = false; sort.value = 'none'; generate(); }
function loadLottery() { mode.value = 'integer'; minInput.value = '1'; maxInput.value = '100'; countInput.value = '10'; unique.value = true; sort.value = 'asc'; generate(); }
function clearAll() { results.value = []; error.value = ''; }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
generate();
</script>
<style scoped>
.random-number { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
.field input, .field select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; width: 130px; box-sizing: border-box; }
.check { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text); padding-bottom: 8px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.summary { font-size: 14px; margin: 10px 0 6px; color: var(--text); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .field input, .field select { width: 108px; } }
</style>
