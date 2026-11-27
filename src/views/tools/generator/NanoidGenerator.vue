<template>
  <div class="nanoid-generator">
    <h1>Nano ID 生成器</h1>
    <p class="description">生成短小、URL 安全的随机 ID（默认 21 位约 126 位熵），支持自定义字母表与批量生成，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label class="field">字母表预设
          <select v-model="preset" aria-label="字母表预设" @change="applyPreset">
            <option v-for="(p, key) in ALPHABET_PRESETS" :key="key" :value="key">{{ p.label }}</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label class="field">长度<input v-model="sizeInput" type="text" inputmode="numeric" aria-label="ID 长度"></label>
        <label class="field">数量<input v-model="countInput" type="text" inputmode="numeric" aria-label="生成数量"></label>
        <label class="check"><input v-model="unique" type="checkbox"> 不重复</label>
      </div>
      <label class="block">字母表（{{ alphabetLength }} 个字符）
        <input v-model="alphabet" type="text" spellcheck="false" aria-label="字母表" @input="preset = 'custom'">
      </label>
      <p v-if="entropyText" class="summary">单条熵约 {{ entropyBitsValue }} 位 · {{ entropyDesc }}</p>
      <p v-if="notes.length" class="notes" role="status" aria-live="polite">{{ notes.join('；') }}</p>
      <p v-if="warnings.length" class="notes warn" role="status" aria-live="polite">{{ warnings.join('；') }}</p>
      <div class="row actions">
        <button class="btn" type="button" @click="generate">生成 Nano ID</button>
        <button class="btn ghost" type="button" @click="loadShort">示例：8 位短 ID</button>
        <button class="btn ghost" type="button" @click="loadBatch">示例：批量 50 个</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="results.length">
        <label class="block">结果（每行一个，共 {{ results.length }} 个）
          <textarea :value="resultText" rows="8" readonly spellcheck="false" aria-label="Nano ID 结果"></textarea>
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
import { ALPHABET_PRESETS, generateNanoidBatch, entropyBits, describeEntropy, validateAlphabet, collectNanoidNotes, alphabetWarnings, normalizeFullwidth, MAX_SIZE } from '@/utils/nanoid.js';
const features = [
  { icon: '🆔', title: '短小够强', description: '默认 21 位、64 字符字母表，熵约 126 位，与 UUID v4 相当但短得多' },
  { icon: '🎭', title: '无偏采样', description: '采用 nanoid 官方掩码步进算法，配合安全随机源，每个字符概率相同' },
  { icon: '🔤', title: '字母表可调', description: '六种预设（十六进制、无易混字符等）或完全自定义，并校验重复字符' },
  { icon: '🔒', title: '纯本地处理', description: 'ID 在浏览器内生成，不上传任何服务器' }
];
const usageSteps = ['选字母表预设、设长度与生成数量', '点「生成 Nano ID」，结果每行一个', '可整段复制或复制为逗号分隔，贴进代码或数据库种子'];
const faqs = [
  { question: 'Nano ID 和 UUID 怎么选？', answer: '需要跨系统通用、格式固定时用 UUID；自家业务想短一点、放进 URL 又不难看时用 Nano ID。默认 21 位 Nano ID 的碰撞强度与 UUID v4 相当。' },
  { question: '生成的 ID 能当密码或令牌吗？', answer: '熵足够时技术上可以，但 ID 与凭证语义不同：凭证还需要可撤销、过期与哈希存储。把 Nano ID 当公开标识用最稳妥。' },
  { question: '字母表为什么不能有重复字符？', answer: '重复字符会让该字符出现概率翻倍、实际熵低于估算值，且容易误以为更随机，所以本工具直接报错要求去重。' },
  { question: '长度和数量可以用全角数字吗？', answer: '可以：全角数字会自动按半角处理并给出提示。字母表开头的 BOM 也会自动忽略；但字母表中间的空白、重复与零宽等不可见字符会定位到第几个报错，因为它们会让生成的 ID 出问题。' },
  { question: '字母表用全角字符会怎样？', answer: '能生成，但 ID 里会是全角字符，放进 URL、代码或数据库字段里往往不方便，页面会给出警告。真要短小好用，建议换回半角字母表。' },
  { question: '生成报错后旧结果为什么还在？', answer: '这是有意保留的：报错只提示问题，不清掉上一次成功生成的结果，方便你对照着改参数；清空按钮可以手动清掉。' }
];
const preset = ref('default');
const alphabet = ref(ALPHABET_PRESETS.default.alphabet);
const sizeInput = ref('21');
const countInput = ref('10');
const unique = ref(true);
const results = ref([]);
const error = ref('');
const statusMessage = ref(''); const statusType = ref('');
const notes = ref([]);
const warnings = ref([]);
const alphabetLength = computed(() => [...alphabet.value.replace(/^\uFEFF/, '')].length);
const entropyBitsValue = computed(() => {
  // 与生成校验同口径：先全角转半角、必须纯数字且在 1–MAX_SIZE 内，字母表必须先通过校验，
  // 否则旧版会出现「1e2 显示 600 位熵却生成报错」「重复字母表按原始长度高估熵」的误导。
  const s = normalizeFullwidth(sizeInput.value).text.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_SIZE) return null;
  let alpha;
  try { alpha = validateAlphabet(alphabet.value); } catch { return null; }
  return entropyBits(n, [...alpha].length);
});
const entropyDesc = computed(() => (entropyBitsValue.value === null ? '' : describeEntropy(entropyBitsValue.value)));
const entropyText = computed(() => entropyBitsValue.value !== null);
const resultText = computed(() => results.value.join('\n'));
function applyPreset() {
  if (preset.value !== 'custom') alphabet.value = ALPHABET_PRESETS[preset.value].alphabet;
}
function generate() {
  error.value = ''; statusMessage.value = '';
  try {
    const out = generateNanoidBatch({ size: sizeInput.value, alphabet: alphabet.value, count: countInput.value, unique: unique.value });
    results.value = out;
    notes.value = collectNanoidNotes({ size: sizeInput.value, count: countInput.value, alphabet: alphabet.value });
    warnings.value = alphabetWarnings(alphabet.value);
  } catch (e) {
    notes.value = []; warnings.value = [];
    error.value = (e.message || String(e)) + (results.value.length ? '（已保留上一次结果）' : '');
  }
}
function loadShort() { sizeInput.value = '8'; countInput.value = '10'; generate(); }
function loadBatch() { sizeInput.value = '21'; countInput.value = '50'; generate(); }
function clearAll() { results.value = []; error.value = ''; notes.value = []; warnings.value = []; }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
generate();
</script>
<style scoped>
.nanoid-generator { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.notes { margin: 4px 0 10px; color: var(--text-2); font-size: 13px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
.notes.warn { background: var(--warn-soft); }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
.field input, .field select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; width: 170px; box-sizing: border-box; }
.field input { width: 110px; }
.check { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text); padding-bottom: 8px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
.block input, textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; box-sizing: border-box; }
textarea { resize: vertical; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.summary { font-size: 13px; margin: 4px 0 10px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .field select { width: 150px; } }
</style>
