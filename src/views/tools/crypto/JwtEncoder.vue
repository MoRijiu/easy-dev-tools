<template>
  <div class="jwt-tool">
    <h1>JWT 生成</h1>
    <p class="description">用 HMAC（HS256/HS384/HS512）在本地签名生成 JWT，密钥只在浏览器里参与计算、不上传服务器；解码已有 Token 请用「JWT 解码」</p>
    <div class="tool-container">
      <div class="row">
        <label>签名算法
          <select v-model="alg" aria-label="签名算法" @change="syncHeaderAlg"><option v-for="a in JWT_ALGS" :key="a.id" :value="a.id">{{ a.label }}</option></select>
        </label>
        <label class="secret-label">签名密钥（Secret）
          <span class="secret-wrap"><input v-model="secret" :type="showSecret ? 'text' : 'password'" placeholder="输入签名密钥" aria-label="签名密钥" autocomplete="off" /><button class="mini" type="button" @click="showSecret = !showSecret">{{ showSecret ? '隐藏' : '显示' }}</button></span>
        </label>
      </div>
      <div class="cols">
        <label>Header（JSON）
          <textarea v-model="headerText" rows="5" spellcheck="false" aria-label="Header JSON"></textarea>
        </label>
        <label>Payload（JSON）
          <textarea v-model="payloadText" rows="9" spellcheck="false" aria-label="Payload JSON"></textarea>
        </label>
      </div>
      <div class="row actions">
        <span class="ttl">快捷有效期：</span>
        <button v-for="t in ttlOptions" :key="t.sec" class="chip" type="button" @click="applyTtl(t.sec)">{{ t.label }}</button>
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="btn" type="button" @click="generate">生成 Token</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="result">
        <label class="out-label">生成的 JWT
          <textarea :value="result.token" rows="4" readonly spellcheck="false" aria-label="生成的 JWT"></textarea>
        </label>
        <p class="verify" :class="selfCheck?.valid ? 'ok' : 'bad'">签名自检：{{ selfCheckText }}</p>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(result.token)">复制 Token</button>
          <span class="muted">长度 {{ result.token.length }} 字符 · 签名段 {{ result.signature.length }} 字符</span>
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
import { ref } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { JWT_ALGS, signJwt, verifyJwtSignature, parseJsonObjectInput, applyTimeClaims } from '@/utils/jwtEncode.js';
const features = [
  { icon: '✍️', title: 'HMAC 签名', description: 'HS256/HS384/HS512 三种 HMAC 算法，Web Crypto 本地签名' },
  { icon: '✅', title: '生成即自检', description: '生成后立刻用同一密钥回验签名，确保 Token 可用' },
  { icon: '⏱️', title: '有效期快捷设置', description: '一键写入 iat 与 exp（1 小时 / 1 天 / 7 天 / 30 天）' },
  { icon: '🔒', title: '密钥不上传', description: '密钥与数据全程只在浏览器内存中，不经过任何服务器' }
];
const usageSteps = ['选择算法、填签名密钥，编辑 Header 与 Payload 的 JSON', '需要过期时间时点「快捷有效期」写入 iat/exp，再点「生成 Token」', '复制生成的 Token 到接口调试工具里使用，或粘到「JWT 解码」核对内容'];
const faqs = [
  { question: 'HS256 和 RS256 有什么区别？', answer: 'HS256 是对称签名：签发和验签用同一把密钥，适合自己签自己验的场景，密钥一旦泄露任何人都能伪造 Token。RS256 是非对称签名（私钥签、公钥验），适合第三方验签。本工具只做 HMAC 三种算法。' },
  { question: 'exp、iat 是秒还是毫秒？', answer: 'JWT 标准里时间类 claims（exp/iat/nbf）一律是秒级 Unix 时间戳。本工具的快捷有效期按当前秒数写入，不会误写成毫秒。' },
  { question: 'Payload 里能放密码等敏感信息吗？', answer: '不能。JWT 的 Header 与 Payload 只是 Base64URL 编码、任何人都能解开看，签名只保证没被篡改、不提供保密。别在 Payload 放密码、身份证号等敏感数据。' },
  { question: '密钥多长才安全？', answer: 'HS256 建议至少 32 字节（256 位）的随机密钥；太短的口令容易被离线爆破。生产环境请用随机生成的长密钥并妥善保管。' }
];
const ttlOptions = [{ label: '1 小时', sec: 3600 }, { label: '1 天', sec: 86400 }, { label: '7 天', sec: 604800 }, { label: '30 天', sec: 2592000 }];
const EXAMPLE_HEADER = '{\n  "alg": "HS256",\n  "typ": "JWT"\n}';
const EXAMPLE_PAYLOAD = '{\n  "sub": "user-1001",\n  "name": "张三",\n  "role": "admin"\n}';
const alg = ref('HS256');
const secret = ref('your-256-bit-secret');
const showSecret = ref(false);
const headerText = ref(EXAMPLE_HEADER);
const payloadText = ref(EXAMPLE_PAYLOAD);
const result = ref(null); const selfCheck = ref(null); const error = ref('');
const statusMessage = ref(''); const statusType = ref('');
const selfCheckText = ref('');
const syncHeaderAlg = () => {
  const p = parseJsonObjectInput(headerText.value, 'Header');
  if (p.ok) headerText.value = JSON.stringify({ ...p.value, alg: alg.value }, null, 2);
};
const applyTtl = (sec) => {
  const p = parseJsonObjectInput(payloadText.value, 'Payload');
  if (!p.ok) { error.value = p.error; return; }
  error.value = '';
  payloadText.value = JSON.stringify(applyTimeClaims(p.value, { ttlSec: sec }), null, 2);
};
const generate = async () => {
  const r = await signJwt({ headerText: headerText.value, payloadText: payloadText.value, secret: secret.value, alg: alg.value });
  if (!r.ok) { error.value = r.error; result.value = null; selfCheck.value = null; return; }
  error.value = ''; result.value = r;
  const v = await verifyJwtSignature(r.token, secret.value);
  selfCheck.value = v.ok ? v : null;
  selfCheckText.value = v.ok ? (v.valid ? `通过（${v.alg} 签名有效）` : '未通过：签名校验不一致') : `无法自检：${v.error}`;
};
const loadExample = () => { headerText.value = EXAMPLE_HEADER; payloadText.value = EXAMPLE_PAYLOAD; alg.value = 'HS256'; secret.value = 'your-256-bit-secret'; result.value = null; error.value = ''; };
const clearAll = () => { payloadText.value = ''; result.value = null; selfCheck.value = null; error.value = ''; };
const copyText = async (txt) => { try { await navigator.clipboard.writeText(txt); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
</script>
<style scoped>
.jwt-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 10px; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
.row label.secret-label { flex: 1; min-width: 220px; }
.secret-wrap { display: flex; gap: 6px; }
.secret-wrap input { flex: 1; }
input, select, textarea { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; }
textarea { width: 100%; font-family: monospace; font-size: 13px; resize: vertical; }
.mini { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.cols { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; margin-bottom: 10px; }
.cols label, .out-label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
.actions { align-items: center; }
.ttl { font-size: 13px; color: var(--text-2); }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.verify { font-size: 14px; margin: 10px 0 4px; }
.verify.ok { color: var(--success, #16a34a); }
.verify.bad { color: var(--danger, #dc2626); }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .cols { grid-template-columns: 1fr; } }
</style>
