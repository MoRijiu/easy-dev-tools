<template>
  <div class="json-escape">
    <h1>JSON 字符串转义</h1>
    <p class="description">普通文本与 JSON 字符串互转：转义引号、反斜杠与换行，或把带转义的 JSON 字符串还原成原文，全程本地、不上传</p>
    <div class="tool-container">
      <div class="mode-row" role="tablist" aria-label="转换模式">
        <button class="mode-btn" :class="{ active: mode === 'escape' }" role="tab" :aria-selected="mode === 'escape'" type="button" @click="mode = 'escape'">转义</button>
        <button class="mode-btn" :class="{ active: mode === 'unescape' }" role="tab" :aria-selected="mode === 'unescape'" type="button" @click="mode = 'unescape'">去转义</button>
      </div>
      <div v-if="mode === 'escape'" class="row options">
        <label class="check"><input type="checkbox" v-model="unicode" /> 非 ASCII 转 \uXXXX</label>
        <label class="check"><input type="checkbox" v-model="escapeSlash" /> 转义正斜杠 /</label>
        <label class="check"><input type="checkbox" v-model="withQuotes" /> 输出带外层引号</label>
      </div>
      <p v-else class="muted">去转义支持带引号的完整 JSON 字符串，也支持不带引号的转义内容；非法转义会定位报错。</p>
      <label class="block">输入
        <textarea v-model="input" rows="7" spellcheck="false" :placeholder="mode === 'escape' ? '粘贴普通文本，如带引号、换行或中文的内容' : '粘贴 JSON 字符串，如 &quot;hello\\nworld&quot;'" aria-label="输入"></textarea>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <button class="btn ghost" type="button" :disabled="!result" @click="useOutput">结果作输入</button>
        <button class="btn" type="button" :disabled="!result" @click="copyText(output)">复制结果</button>
        <span class="muted">输入后实时转换</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="error && result" class="muted">当前输入有误，下面保留的是上一次成功转换的结果。</p>
      <p v-if="result && result.notes && result.notes.length" class="note" role="status" aria-live="polite">{{ result.notes.join('；') }}</p>
      <template v-if="result">
        <label class="block">输出
          <textarea :value="output" rows="7" readonly spellcheck="false" aria-label="输出"></textarea>
        </label>
        <p class="summary">输入 {{ inputCount }} 字符 → 输出 {{ outputCount }} 字符 · 转义序列 {{ result.escapeCount }} 处</p>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(summary)">复制摘要</button>
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
import { ref, computed, watch } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { escapeJsonString, unescapeJsonString, buildJsonEscapeSummary, countCodePoints } from '@/utils/jsonEscape.js';
const features = [
  { icon: '🔤', title: '标准转义', description: '按 RFC 8259 处理引号、反斜杠与全部控制字符，可选非 ASCII 转 \\uXXXX 与正斜杠转义' },
  { icon: '🎯', title: '错误定位', description: '去转义时逐字扫描，非法转义、未闭合引号、裸控制字符都会指出具体位置' },
  { icon: '↔️', title: '双向互转', description: '转义与去转义一键切换，结果可直接作输入继续处理，往返不丢字符' },
  { icon: '🔒', title: '纯本地处理', description: '文本不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选择「转义」把普通文本变成可嵌入 JSON 的字符串，或选「去转义」还原', '粘贴内容后实时得到结果，按需勾选 Unicode / 正斜杠 / 外层引号选项', '复制结果，或用「结果作输入」继续反向处理'];
const faqs = [
  { question: '什么时候需要转义 JSON 字符串？', answer: '把一段带引号、换行或制表符的文本手工塞进 JSON 配置、接口调试工具或代码字符串时，必须先把 " 写成 \\"、换行写成 \\n，否则 JSON 解析会直接报错。本工具就是做这一步。' },
  { question: '中文要不要转成 \\uXXXX？', answer: '不需要。JSON 允许直接放 UTF-8 中文，只有个别老系统或纯 ASCII 通道才要求全转义；勾选「非 ASCII 转 \\uXXXX」即可，Emoji 会输出成代理对两段 \\uXXXX，这是 UTF-16 表示的标准做法。' },
  { question: '去转义时一定要带外层引号吗？', answer: '不一定。带引号时按完整 JSON 字符串校验；不带引号时按转义内容解析，适合处理从日志或代码里单独抠出来的一段转义文本。' },
  { question: '粘贴时要注意什么？', answer: '带引号的字符串结束后若还有其他内容会点名报错（一次只能处理一个字符串）；不带引号的内容首尾空格属于原文、会原样保留；中文输入法误入的全角反斜杠 ＼ 会按半角处理并给出提示。字符数按 Unicode 码点计，一个 Emoji 算 1 个字符。' },
  { question: '\\uD800 这类转义为什么报错？', answer: '\\uD800–\\uDBFF 是高代理、\\uDC00–\\uDFFF 是低代理，必须成对出现才能表示一个字符（如 \\uD83D\\uDE00 是 😀）。落单的代理转义会被严格的 JSON 解析器替换成 �，本工具会定位报错；反过来转义普通文本时，原文里的孤立代理字符会按 \\uXXXX 输出，与格式良好的 JSON.stringify 一致。' },
  { question: '输错了为什么还显示上一次的结果？', answer: '这是故意的：报错时页面保留上一次成功转换的结果并给出提示，方便对照修改，不会一输错就把之前的结果清空。点「清空」会连保留结果一起清掉。输入上限为 100 万字符。' }
];
const EXAMPLE_ESCAPE = '他说："你好，世界！"\n第二行\t带制表符，路径 C:\\temp\\a.txt';
const EXAMPLE_UNESCAPE = '"\\u4ed6\\u8bf4\\uff1a\\"\\u4f60\\u597d\\"\\n\\u7b2c\\u4e8c\\u884c"';
const mode = ref('escape');
const unicode = ref(false);
const escapeSlash = ref(false);
const withQuotes = ref(true);
const input = ref(EXAMPLE_ESCAPE);
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => {
  if (!input.value) return null;
  return mode.value === 'escape'
    ? escapeJsonString(input.value, { unicode: unicode.value, escapeSlash: escapeSlash.value, withQuotes: withQuotes.value })
    : unescapeJsonString(input.value);
});
const lastValid = ref(null);
watch(parsed, (v) => { if (v && v.ok) lastValid.value = v; }, { immediate: true });
const result = computed(() => {
  if (!input.value) return null;
  if (parsed.value && parsed.value.ok) return parsed.value;
  return lastValid.value;
});
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
const output = computed(() => (result.value ? result.value.output : ''));
const inputCount = computed(() => countCodePoints(input.value));
const outputCount = computed(() => countCodePoints(output.value));
const summary = computed(() => buildJsonEscapeSummary(mode.value, input.value, result.value));
function loadExample() { input.value = mode.value === 'escape' ? EXAMPLE_ESCAPE : EXAMPLE_UNESCAPE; }
function clearAll() { input.value = ''; lastValid.value = null; }
function useOutput() { if (result.value) { input.value = result.value.output; mode.value = mode.value === 'escape' ? 'unescape' : 'escape'; } }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.json-escape { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.mode-row { display: flex; gap: 6px; margin-bottom: 10px; }
.mode-btn { padding: 6px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.mode-btn.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.options .check { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; color: var(--text-2); }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger-text); font-size: 14px; }
.note { font-size: 13px; color: var(--info-text, var(--text-2)); margin: 6px 0; }
.summary { font-size: 13px; margin: 6px 0 10px; color: var(--text-2); }
.muted { font-size: 12px; color: var(--text-2); margin-bottom: 10px; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
