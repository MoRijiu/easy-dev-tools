<template>
  <div class="hmac-tool">
    <h1>HMAC 签名生成</h1>
    <p class="description">用密钥对消息做 HMAC 签名（SHA-256/512/384/1），密钥与消息支持 UTF-8 / Hex / Base64 输入，结果一键复制，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label>签名算法
          <select v-model="algorithm" aria-label="签名算法"><option v-for="a in HMAC_ALGS" :key="a.id" :value="a.id">{{ a.label }}</option></select>
        </label>
        <label>密钥编码
          <select v-model="keyEncoding" aria-label="密钥编码"><option v-for="e in INPUT_ENCODINGS" :key="e.id" :value="e.id">{{ e.label }}</option></select>
        </label>
        <label>消息编码
          <select v-model="messageEncoding" aria-label="消息编码"><option v-for="e in INPUT_ENCODINGS" :key="e.id" :value="e.id">{{ e.label }}</option></select>
        </label>
      </div>
      <label class="block">密钥（Key）
        <span class="secret-wrap"><input v-model="keyText" :type="showKey ? 'text' : 'password'" placeholder="输入密钥" aria-label="密钥" autocomplete="off" /><button class="mini" type="button" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button></span>
      </label>
      <label class="block">消息（Message）
        <textarea v-model="messageText" rows="4" spellcheck="false" placeholder="输入要签名的消息" aria-label="消息"></textarea>
      </label>
      <div class="row actions">
        <button class="btn" type="button" :disabled="busy" @click="generate">{{ busy ? '计算中…' : '生成签名' }}</button>
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <span class="muted">改动输入后自动重新计算</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="result">
        <p class="summary">{{ result.label }} · 密钥 {{ result.keyBytes }} 字节 · 消息 {{ result.messageBytes }} 字节 · 签名 {{ result.digestBytes }} 字节</p>
        <div class="table-wrap"><table><tbody>
          <tr v-for="row in outRows" :key="row.key"><th>{{ row.label }}</th><td class="mono">{{ row.value }}</td><td><button class="mini" type="button" :aria-label="`复制${row.label}`" @click="copyText(row.value)">复制</button></td></tr>
        </tbody></table></div>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(summary)">复制摘要</button>
        </div>
        <div class="verify-box">
          <label class="block">验签：粘贴期望签名（可选）
            <span class="secret-wrap"><input v-model="expectedText" placeholder="粘贴对方给出的签名，自动与上方结果比对" aria-label="期望签名" autocomplete="off" spellcheck="false" />
            <select v-model="expectedEncoding" aria-label="期望签名编码"><option v-for="e in EXPECTED_ENCODINGS" :key="e.id" :value="e.id">{{ e.label }}</option></select></span>
          </label>
          <p v-if="verifyError" class="error">{{ verifyError }}</p>
          <p v-else-if="verifyResult" :class="verifyResult.match ? 'verify-ok' : 'verify-bad'">{{ verifyResult.match ? '✓ 签名一致，验签通过' : `✕ ${verifyResult.reason}` }}</p>
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
import { HMAC_ALGS, INPUT_ENCODINGS, EXPECTED_ENCODINGS, computeHmac, buildHmacSummary, verifyHmacSignature } from '@/utils/hmac.js';
const features = [
  { icon: '🔏', title: '四种算法', description: 'HMAC-SHA-256 / SHA-512 / SHA-384 / SHA-1，走浏览器 Web Crypto 原生实现' },
  { icon: '🧩', title: '多编码输入', description: '密钥与消息都可按 UTF-8 文本、Hex 或 Base64 输入，适配二进制密钥与接口签名调试' },
  { icon: '📋', title: '三格式输出', description: 'Hex、Base64、Base64URL 一屏对照，逐行或整段摘要一键复制' },
  { icon: '🔒', title: '纯本地处理', description: '密钥与消息不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选算法，填密钥与消息（注意两边编码与服务端约定一致）', '点「生成签名」或改动输入自动计算', '复制 Hex / Base64 结果与服务端或文档核对'];
const faqs = [
  { question: 'HMAC 和普通哈希有什么区别？', answer: '普通哈希（如 SHA-256）谁都能算；HMAC 在哈希里混入密钥，只有持有密钥的人才能生成或验证签名，常用于接口签名、Webhook 回调验签与防篡改。' },
  { question: '签名对不上最常见的原因是什么？', answer: '多半是编码不一致：服务端把密钥当 Hex/Base64 解码后再用，而这里按 UTF-8 文本用（或反过来）；其次是消息末尾多了换行、参数排序/拼接规则不同。本工具可切换密钥与消息的输入编码逐项排查。' },
  { question: 'SHA-1 还能用吗？', answer: 'HMAC-SHA-1 目前没有实用的伪造攻击，但新系统应优先 SHA-256 及以上；SHA-1 仅建议用于对接只支持它的旧系统。' },
  { question: '怎么验签？', answer: '把对方给出的签名粘到结果下方的验签框并选对编码（Hex / Base64 / Base64URL），工具会用当前算法、密钥与消息重算后逐字节比对；长度对不上会直接提示应有字节数。' },
  { question: 'Hex / Base64 输入有哪些讲究？', answer: 'Hex 的下划线只能夹在两个数字之间，全角字符会自动转半角，报错位置按原文计算；Base64 会校验填充个数与末尾未用比特，缺填充可自动补齐。UTF-8 输入若含未配对的代理字符（粘贴损坏）会点名报错，不会静默按替换字符签名。' },
  { question: '输入改错了为什么还留着上次结果？', answer: '改动后计算失败时保留上一次成功结果并显示错误，方便对照排查；修正输入后会自动刷新。密钥上限 100,000 字符、消息上限 1,000,000 字符。' }
];
const EXAMPLE = { algorithm: 'SHA-256', key: 'key', message: 'The quick brown fox jumps over the lazy dog' };
const algorithm = ref(EXAMPLE.algorithm);
const keyEncoding = ref('utf8');
const messageEncoding = ref('utf8');
const keyText = ref(EXAMPLE.key);
const messageText = ref(EXAMPLE.message);
const showKey = ref(false);
const busy = ref(false);
const result = ref(null);
const error = ref('');
const statusMessage = ref(''); const statusType = ref('');
const summary = computed(() => buildHmacSummary(result.value));
const outRows = computed(() => (result.value ? [
  { key: 'hex', label: 'Hex', value: result.value.hex },
  { key: 'base64', label: 'Base64', value: result.value.base64 },
  { key: 'base64Url', label: 'Base64URL', value: result.value.base64Url }
] : []));
const expectedText = ref('');
const expectedEncoding = ref('hex');
const verifyResult = ref(null);
const verifyError = ref('');
let seq = 0;
let vseq = 0;
async function generate() {
  const my = ++seq;
  busy.value = true;
  const r = await computeHmac({ algorithm: algorithm.value, keyText: keyText.value, keyEncoding: keyEncoding.value, messageText: messageText.value, messageEncoding: messageEncoding.value });
  if (my !== seq) return;
  busy.value = false;
  if (r.ok) { result.value = r; error.value = ''; } else { error.value = r.error; }
  runVerify();
}
async function runVerify() {
  if (!expectedText.value.trim()) { verifyResult.value = null; verifyError.value = ''; return; }
  const my = ++vseq;
  const v = await verifyHmacSignature({ algorithm: algorithm.value, keyText: keyText.value, keyEncoding: keyEncoding.value, messageText: messageText.value, messageEncoding: messageEncoding.value, expectedText: expectedText.value, expectedEncoding: expectedEncoding.value });
  if (my !== vseq) return;
  if (v.ok) { verifyResult.value = v; verifyError.value = ''; } else { verifyResult.value = null; verifyError.value = v.error; }
}
watch([algorithm, keyEncoding, messageEncoding, keyText, messageText], () => { generate(); });
watch([expectedText, expectedEncoding], () => { runVerify(); });
generate();
function loadExample() {
  algorithm.value = EXAMPLE.algorithm; keyEncoding.value = 'utf8'; messageEncoding.value = 'utf8';
  keyText.value = EXAMPLE.key; messageText.value = EXAMPLE.message;
}
function clearAll() { seq += 1; vseq += 1; busy.value = false; keyText.value = ''; messageText.value = ''; expectedText.value = ''; result.value = null; error.value = ''; verifyResult.value = null; verifyError.value = ''; }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.hmac-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 10px; }
.row label, .block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
.block { margin-bottom: 10px; }
.secret-wrap { display: flex; gap: 6px; }
.secret-wrap input { flex: 1; }
input, select, textarea { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; }
textarea { width: 100%; font-family: monospace; font-size: 13px; resize: vertical; }
.mini { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.actions { align-items: center; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .6; cursor: wait; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger-text); font-size: 14px; }
.summary { font-size: 14px; margin: 10px 0 6px; color: var(--text); }
.table-wrap { overflow-x: auto; margin-bottom: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th { text-align: left; padding: 6px 8px; color: var(--text-2); font-weight: 600; white-space: nowrap; width: 90px; }
td { padding: 6px 8px; color: var(--text); }
td.mono { font-family: monospace; word-break: break-all; }
.muted { font-size: 12px; color: var(--text-2); }
.verify-box { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.verify-ok { color: var(--success-text); font-size: 14px; }
.verify-bad { color: var(--danger-text); font-size: 14px; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
