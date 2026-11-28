<template>
  <div class="ulid-tool">
    <h1>ULID 生成/解析</h1>
    <p class="description">ULID 是按时间可排序的唯一 ID：26 位 Crockford Base32，前段是毫秒时间戳、后段是 80 位随机数，字典序即时间序，全程本地、不上传</p>
    <div class="tool-container">
      <h2 class="section-title">生成</h2>
      <div class="row">
        <label class="field grow">时间戳（毫秒，留空 = 当前时间）
          <input v-model="genTimeInput" type="text" inputmode="numeric" spellcheck="false" placeholder="如 1700000000000" aria-label="生成时间戳" :aria-invalid="genErrorField === 'time' ? 'true' : undefined" :aria-describedby="genErrorField === 'time' ? 'ulid-gen-error' : undefined">
        </label>
        <label class="field">数量<input v-model="countInput" type="text" inputmode="numeric" aria-label="生成数量" :aria-invalid="genErrorField === 'count' ? 'true' : undefined" :aria-describedby="genErrorField === 'count' ? 'ulid-gen-error' : undefined"></label>
        <label class="check"><input v-model="monotonic" type="checkbox"> 同毫秒单调递增</label>
      </div>
      <div class="row actions">
        <button class="btn" type="button" @click="generate">生成 ULID</button>
        <button class="btn ghost" type="button" @click="generateNow">用当前时间</button>
        <button class="btn ghost" type="button" @click="clearGenerated">清空</button>
      </div>
      <p v-if="genNotes.length" class="notes" role="status" aria-live="polite">{{ genNotes.join('；') }}</p>
      <p v-if="genError" id="ulid-gen-error" class="error" role="alert">{{ genError }}</p>
      <template v-if="results.length">
        <label class="block">结果（每行一个，共 {{ results.length }} 个，本身已按时间有序）
          <textarea :value="resultText" rows="6" readonly spellcheck="false" aria-label="ULID 结果"></textarea>
        </label>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(resultText)">复制全部</button>
          <button class="btn ghost" type="button" @click="sendFirstToParser">解析第一个</button>
          <button class="btn ghost" type="button" @click="generate">再生成一组</button>
        </div>
      </template>

      <h2 class="section-title">解析</h2>
      <label class="block">输入 ULID（不区分大小写）
        <input v-model="parseInput" type="text" spellcheck="false" placeholder="如 01ARZ3NDEKTSV4RRFFQ69G5FAV" aria-label="待解析的 ULID" :aria-invalid="parseError ? 'true' : undefined" :aria-describedby="parseError ? 'ulid-parse-error' : undefined">
      </label>
      <p v-if="parseError" id="ulid-parse-error" class="error" role="alert">{{ parseError }}</p>
      <p v-if="parsed?.notes?.length" class="notes" role="status" aria-live="polite">{{ parsed.notes.join('；') }}</p>
      <p v-if="parsed?.warnings?.length" class="notes warn" role="status" aria-live="polite">{{ parsed.warnings.join('；') }}</p>
      <table v-if="parsed" class="kv">
        <tbody>
          <tr><th scope="row">规范形式</th><td class="mono">{{ parsed.ulid }}</td><td><button class="btn ghost sm" type="button" aria-label="复制规范形式" @click="copyText(parsed.ulid)">复制</button></td></tr>
          <tr><th scope="row">内嵌时间</th><td class="mono">{{ parsed.iso }}</td><td><button class="btn ghost sm" type="button" aria-label="复制内嵌时间" @click="copyText(parsed.iso)">复制</button></td></tr>
          <tr><th scope="row">时间戳（毫秒）</th><td class="mono">{{ parsed.timestampMs }}</td><td><button class="btn ghost sm" type="button" aria-label="复制时间戳（毫秒）" @click="copyText(String(parsed.timestampMs))">复制</button></td></tr>
          <tr><th scope="row">本地时间</th><td class="mono">{{ localTime }}</td><td></td></tr>
          <tr><th scope="row">时间段（10 位）</th><td class="mono">{{ parsed.timeSegment }}</td><td></td></tr>
          <tr><th scope="row">随机段（16 位 / 80 bit）</th><td class="mono">{{ parsed.randomSegment }}</td><td></td></tr>
          <tr><th scope="row">随机段十六进制</th><td class="mono">{{ parsed.randomnessHex }}</td><td><button class="btn ghost sm" type="button" aria-label="复制随机段十六进制" @click="copyText(parsed.randomnessHex)">复制</button></td></tr>
        </tbody>
      </table>
      <div v-if="parsed" class="row actions">
        <button class="btn ghost" type="button" @click="copyText(summary)">复制解析摘要</button>
      </div>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { generateUlidBatch, parseUlid, buildSummary, collectGenerateNotes } from '@/utils/ulid.js';
const features = [
  { icon: '🔤', title: '时间可排序', description: '时间戳在高位，字符串字典序与生成时间序一致，数据库索引友好' },
  { icon: '🎲', title: '80 位随机', description: '随机段 80 位由 Web Crypto 安全随机源生成，同毫秒单调模式下逐个 +1 不重复' },
  { icon: '🧩', title: '无连字符 26 位', description: 'Crockford Base32 去掉了易混的 I/L/O/U，比带连字符的 UUID 短且更易读' },
  { icon: '🔒', title: '纯本地处理', description: '生成与解析都在浏览器内完成，不上传任何服务器' }
];
const usageSteps = ['在「生成」区直接点生成，或填指定时间戳批量生成', '把任意 ULID 粘进「解析」区，立刻看到内嵌时间与随机段', '生成结果可整段复制，第一个结果可一键送去解析验证往返'];
const faqs = [
  { question: 'ULID 和 UUID v7 怎么选？', answer: '两者都是时间有序 ID。ULID 是 26 位无连字符文本、生态在服务端与前端库里很常见；UUID v7 保持标准 UUID 外形，适合已有 UUID 字段约束的系统。' },
  { question: '为什么字母表里没有 I、L、O、U？', answer: 'Crockford Base32 刻意去掉易与 1/0 混淆的 I、L、O，并去掉 U 以免随机拼出英文脏话。本工具对这四个字母会给出定位报错。' },
  { question: '「同毫秒单调递增」是什么意思？', answer: '批量生成共用同一时间戳时，随机段按 80 位整数逐个加一，保证整批严格递增、不重复；跨毫秒则由时间段自然保证顺序。' },
  { question: 'ULID 能用到哪一年？', answer: '48 位毫秒时间戳上限是 281474976710655 毫秒，约公元 10893 年，实际不用担心溢出；解析时首字符超过 7 会被判为溢出并报错。' },
  { question: '粘贴时有哪些容错？', answer: '全角字符会自动转半角；被空格或换行折断的单个 ULID 会拼回并提示；按 Crockford 解码规范，I/L 会读作 1、O 读作 0 并提示替换个数。多行粘贴多个 ULID 会点名一次只能解析一个。' },
  { question: '数量和时间戳为什么不能写 1e3 这类写法？', answer: '数量与时间戳只接受完整十进制整数：科学计数法、小数、千分位逗号都会点名报错，不再像旧版用 Number() 静默换算，以免生成出与预期不同的结果。' },
  { question: '生成或解析出错时，旧结果还在吗？', answer: '在。出错只显示错误提示，上一次成功生成的结果与解析结果会保留，不会因为改错一个数字就被清空。' }
];
const genTimeInput = ref('');
const countInput = ref('10');
const monotonic = ref(true);
const results = ref([]);
const genError = ref('');
const genNotes = ref([]);
const parseInput = ref('01ARZ3NDEKTSV4RRFFQ69G5FAV');
const parsed = ref(null);
const parseError = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);

const resultText = computed(() => results.value.join('\n'));
// 生成错误文案自带字段名（生成数量/时间戳），据此定位出错字段；环境类错误不归任何字段
const genErrorField = computed(() => {
  const e = genError.value;
  if (!e) return '';
  if (e.startsWith('生成数量')) return 'count';
  if (e.includes('时间戳')) return 'time';
  return '';
});
const localTime = computed(() => (parsed.value ? new Date(parsed.value.timestampMs).toLocaleString('zh-CN', { hour12: false }) : ''));
const summary = computed(() => (parsed.value ? buildSummary(parsed.value) : ''));
function generate() {
  genError.value = ''; statusMessage.value = '';
  const ts = genTimeInput.value.trim() === '' ? null : genTimeInput.value.trim();
  genNotes.value = collectGenerateNotes({ count: countInput.value, timestampMs: ts });
  try {
    results.value = generateUlidBatch({ count: countInput.value, timestampMs: ts, monotonic: monotonic.value });
  } catch (e) {
    genError.value = e.message || String(e);
    // 出错保留上一次成功结果，不清空
  }
}
function generateNow() { genTimeInput.value = ''; generate(); }
function clearGenerated() { results.value = []; genError.value = ''; genNotes.value = []; }
function sendFirstToParser() { if (results.value.length) parseInput.value = results.value[0]; }
function runParse() {
  parseError.value = '';
  if (!parseInput.value.trim()) { parsed.value = null; return; }
  try { parsed.value = parseUlid(parseInput.value); }
  catch (e) { parseError.value = e.message || String(e); /* 出错保留上一次成功结果 */ }
}
watch(parseInput, runParse);
async function copyText(text) {
  await clipboard.copyText(text, '已复制到剪贴板', { failMsg: '复制失败，请手动选择复制' });
}
generate();
runParse();
</script>
<style scoped>
.ulid-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.notes { margin: 10px 0 0; color: var(--text-2); font-size: 13px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
.notes.warn { background: var(--warn-soft); }
.section-title { font-size: 16px; color: var(--text-strong); margin: 18px 0 10px; }
.section-title:first-child { margin-top: 0; }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
.field input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; width: 110px; box-sizing: border-box; }
.field.grow { flex: 1; min-width: 200px; }
.field.grow input { width: 100%; }
.check { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text); padding-bottom: 8px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
.block input, textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; box-sizing: border-box; }
textarea { resize: vertical; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn.sm { padding: 4px 10px; font-size: 12px; }
.error { color: var(--danger-text); font-size: 14px; }
.kv { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; }
.kv th { text-align: left; color: var(--text-2); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; width: 170px; }
.kv td { padding: 6px 8px; border-bottom: 1px solid var(--border); color: var(--text); word-break: break-all; }
.mono { font-family: monospace; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { width: 120px; } }
</style>
