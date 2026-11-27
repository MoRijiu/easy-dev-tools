<template>
  <div class="jwt-decoder">
    <h1>JWT 解码工具</h1>
    <p class="description">在线解析 JWT（JSON Web Token）的 Header、Payload 与签名，校验过期时间；全程本地解码，不上传服务器</p>

    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary">
          <span class="icon">📝</span> 示例 Token
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon">🗑️</span> 清空
        </button>
        <button @click="copyPayload" class="btn btn-success" :disabled="!payloadText">
          <span class="icon">📋</span> 复制 Payload
        </button>
      </ToolToolbar>

      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <div class="input-section">
        <ToolEditorPanel title="输入 JWT" :info="inputToken.trim() ? `${inputToken.trim().length} 字符` : ''">
          <textarea
            v-model="inputToken"
            class="token-input"
            placeholder="粘贴 JWT，例如：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0...."
            spellcheck="false"
            aria-label="JWT 输入"
            @input="decode"
          ></textarea>
        </ToolEditorPanel>
      </div>

      <div v-if="decoded" class="claims-bar" role="status">
        <span class="claim-chip">算法：{{ decoded.header.alg || '未知' }}</span>
        <span class="claim-chip" v-if="decoded.header.typ">类型：{{ decoded.header.typ }}</span>
        <span class="claim-chip" :class="expiryClass">{{ expiryText }}</span>
        <span class="claim-chip" v-if="notBeforeText" :class="nbfClass">{{ notBeforeText }}</span>
        <span class="claim-chip" v-if="issuedText">签发：{{ issuedText }}</span>
      </div>

      <ul v-if="warnings.length" class="warnings-list">
        <li v-for="(w, i) in warnings" :key="i">⚠️ {{ w }}</li>
      </ul>
      <p v-if="notes.length" class="notes-line">输入已自动处理：{{ notes.join('；') }}</p>

      <ToolEditorLayout v-if="decoded">
        <ToolEditorPanel title="Header（头部）">
          <pre class="json-output"><code>{{ headerText }}</code></pre>
        </ToolEditorPanel>
        <ToolEditorPanel title="Payload（载荷）">
          <pre class="json-output"><code>{{ payloadText }}</code></pre>
        </ToolEditorPanel>
      </ToolEditorLayout>

      <div v-if="decoded" class="signature-section">
        <ToolEditorPanel title="Signature（签名，Base64URL 原文）">
          <code class="signature-value">{{ decoded.signature || '（无签名）' }}</code>
          <p class="signature-note">本工具仅解码查看内容，不验证签名真实性；请勿把敏感 Token 粘贴到任何在线网站——本工具纯本地运行，可放心使用。</p>
        </ToolEditorPanel>
      </div>

      <div v-if="claimRows.length" class="claims-section">
        <h2 class="claims-title">常用声明（Claims）</h2>
        <table class="claims-table">
          <tbody>
            <tr v-for="row in claimRows" :key="row.key">
              <th scope="row">{{ row.key }}</th>
              <td>{{ row.label }}</td>
              <td class="claim-value">{{ row.value }}</td>
            </tr>
          </tbody>
        </table>
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
import ToolEditorLayout from '@/components/ToolEditorLayout.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { parseJwt, analyzeTimeClaims, buildWarnings, formatClaimValue } from '@/utils/jwtDecode.js';

const features = [
  { icon: '🔍', title: '三段解析', description: '自动拆分 Header、Payload 与 Signature 并格式化展示' },
  { icon: '⏰', title: '时间校验', description: 'exp / iat / nbf 自动转成可读时间并提示是否已过期' },
  { icon: '🔒', title: '纯本地解码', description: 'Token 不离开浏览器，不上传任何服务器' },
  { icon: '⚠️', title: '错误定位', description: '段数不对、Base64URL 非法、JSON 无效都会给出明确提示' }
];

const usageSteps = [
  '把完整的 JWT 粘贴到输入框（通常以 eyJ 开头）',
  '工具会自动解码 Header 与 Payload，无需点按钮',
  '查看常用声明表核对 sub、exp 等字段，留意过期提示',
  '需要时点「复制 Payload」把载荷 JSON 复制走'
];

const faqs = [
  {
    question: 'JWT 由哪几部分组成？',
    answer: 'JWT 由 Header（算法与类型）、Payload（声明数据）、Signature（签名）三段 Base64URL 编码字符串以点号连接而成。'
  },
  {
    question: '这个工具会验证签名吗？',
    answer: '不会。解码只是把 Base64URL 还原成 JSON，任何人都能读；签名验证需要密钥，应在服务端完成。本工具适合调试时查看 Token 内容。'
  },
  {
    question: '把真实 Token 粘贴进来安全吗？',
    answer: '本工具纯前端运行，Token 不会上传服务器。但仍建议避免在公共场合展示完整 Token，调试完及时清空。'
  },
  {
    question: '为什么提示已过期？',
    answer: 'Payload 里的 exp 是过期时间戳（秒）。当前时间超过 exp 时 Token 即失效，服务端会拒绝该 Token。'
  },
  {
    question: '粘贴时带着 Bearer 前缀或换行能解析吗？',
    answer: '可以。从请求头复制的「Bearer eyJ...」前缀、以及粘贴过程中混入的换行和空格都会被自动清理，页面会提示做过哪些处理；清理只在本地进行。'
  },
  {
    question: 'alg 显示 none 是什么意思？',
    answer: 'alg=none 表示该 Token 没有签名保护，任何人都能伪造内容，服务端不应信任这类 Token。页面会对此给出醒目警告；同样，有算法但签名段为空也会被点名提示。'
  },
  {
    question: 'nbf 未生效是什么意思？',
    answer: 'nbf（Not Before）是 Token 的生效时间戳。当前时间早于 nbf 时 Token 尚未生效，服务端应拒绝使用；本工具会在声明栏里标出该状态。'
  }
];

const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjQxMDI0NDQ4MDB9.4Adcj3UFYzPUVaVF43FmMabRlaR_wAnDqriZjwfQK8A';

const examples = [
  {
    input: SAMPLE_TOKEN,
    output: '{ "sub": "1234567890", "name": "John Doe", "iat": 1516239022, "exp": 4102444800 }',
    description: '经典示例 Token（jwt.io）'
  }
];

const inputToken = ref('');
const decoded = ref(null);
const notes = ref([]);
const warnings = ref([]);
const statusMessage = ref('');
const statusType = ref('');

const headerText = computed(() => decoded.value ? JSON.stringify(decoded.value.header, null, 2) : '');
const payloadText = computed(() => decoded.value ? JSON.stringify(decoded.value.payload, null, 2) : '');

const formatTs = (sec) => {
  const d = new Date(sec * 1000);
  return Number.isNaN(d.getTime()) ? String(sec) : d.toLocaleString('zh-CN', { hour12: false });
};

const timeInfo = computed(() => decoded.value ? analyzeTimeClaims(decoded.value.payload) : null);

const expiryText = computed(() => {
  const exp = decoded.value?.payload?.exp;
  if (exp === undefined) return '无 exp（不过期声明）';
  if (typeof exp !== 'number') return 'exp 不是数字时间戳';
  return timeInfo.value.expState === 'expired' ? `已过期（exp：${formatTs(exp)}）` : `未过期（exp：${formatTs(exp)}）`;
});
const expiryClass = computed(() => {
  if (!timeInfo.value) return '';
  if (timeInfo.value.expState === 'expired' || timeInfo.value.expState === 'invalid') return 'chip-danger';
  if (timeInfo.value.expState === 'valid') return 'chip-success';
  return '';
});
const notBeforeText = computed(() => {
  const nbf = decoded.value?.payload?.nbf;
  if (typeof nbf !== 'number') return '';
  return timeInfo.value.nbfState === 'pending' ? `尚未生效（nbf：${formatTs(nbf)}）` : `已生效（nbf：${formatTs(nbf)}）`;
});
const nbfClass = computed(() => timeInfo.value?.nbfState === 'pending' ? 'chip-danger' : 'chip-success');
const issuedText = computed(() => {
  const iat = decoded.value?.payload?.iat;
  return typeof iat === 'number' ? formatTs(iat) : '';
});

const CLAIM_LABELS = {
  iss: '签发者', sub: '主题/用户', aud: '受众', exp: '过期时间', nbf: '生效时间', iat: '签发时间', jti: 'Token ID'
};
const claimRows = computed(() => {
  if (!decoded.value) return [];
  return Object.keys(CLAIM_LABELS)
    .filter(k => decoded.value.payload[k] !== undefined)
    .map(k => ({
      key: k,
      label: CLAIM_LABELS[k],
      value: ['exp', 'nbf', 'iat'].includes(k) && typeof decoded.value.payload[k] === 'number'
        ? `${decoded.value.payload[k]}（${formatTs(decoded.value.payload[k])}）`
        : formatClaimValue(decoded.value.payload[k])
    }));
});

const decode = () => {
  decoded.value = null;
  notes.value = [];
  warnings.value = [];
  if (!inputToken.value.trim()) { statusMessage.value = ''; return; }
  try {
    const result = parseJwt(inputToken.value);
    decoded.value = result;
    notes.value = result.notes;
    warnings.value = buildWarnings(result.header, result.payload, result.signature, analyzeTimeClaims(result.payload));
    statusMessage.value = '✓ 解码成功';
    statusType.value = 'success';
  } catch (e) {
    statusMessage.value = `✗ 解码失败：${e.message}`;
    statusType.value = 'error';
  }
};

const loadExample = () => { inputToken.value = SAMPLE_TOKEN; decode(); };
const useExample = (example) => { inputToken.value = example.input; decode(); };
const clearAll = () => { inputToken.value = ''; decoded.value = null; notes.value = []; warnings.value = []; statusMessage.value = ''; };
const copyPayload = async () => {
  try {
    await navigator.clipboard.writeText(payloadText.value);
    statusMessage.value = '✓ Payload 已复制到剪贴板';
    statusType.value = 'success';
  } catch {
    statusMessage.value = '✗ 复制失败，请手动复制';
    statusType.value = 'error';
  }
};
</script>

<style scoped>
.jwt-decoder { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.input-section { margin-bottom: 16px; }
.token-input { width: 100%; min-height: 110px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; word-break: break-all; resize: vertical; box-sizing: border-box; }
.claims-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.warnings-list { margin: 0 0 12px; padding: 10px 14px 10px 30px; background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; line-height: 1.7; }
.notes-line { margin: 0 0 12px; color: var(--text-2); font-size: 13px; }
.claim-chip { padding: 4px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--text); font-size: 13px; border: 1px solid var(--border); }
.chip-success { background: var(--success-soft); color: var(--success-text); border-color: var(--success-border); }
.chip-danger { background: var(--danger-soft); color: var(--danger-text); border-color: var(--danger-border); }
.json-output { margin: 0; padding: 12px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; min-height: 120px; }
.signature-section { margin-bottom: 16px; }
.signature-value { display: block; padding: 12px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; word-break: break-all; }
.signature-note { margin: 10px 0 0; color: var(--text-2); font-size: 13px; }
.claims-section { margin-bottom: 8px; }
.claims-title { color: var(--text-strong); font-size: 1.1rem; margin: 8px 0 12px; }
.claims-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.claims-table th, .claims-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; color: var(--text); }
.claims-table th { width: 70px; color: var(--text-strong); background: var(--bg-soft); }
.claim-value { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; word-break: break-all; }
@media (max-width: 640px) {
  h1 { font-size: 2rem; }
  .tool-container { padding: 20px; }
}
</style>
