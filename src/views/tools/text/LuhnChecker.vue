<template>
  <div class="luhn-tool">
    <h1>Luhn校验</h1>
    <p class="description">银行卡、IMEI 等号码的 Luhn（模 10）校验、校验位生成与批量校验，全程本地、不上传</p>
    <div class="tool-container">
      <label class="block">待校验号码
        <input v-model="input" type="text" inputmode="numeric" spellcheck="false" placeholder="如：4111 1111 1111 1111" aria-label="待校验号码" />
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample('4111111111111111')">Visa 示例</button>
        <button class="chip" type="button" @click="loadExample('490154203237518')">IMEI 示例</button>
        <button class="chip" type="button" @click="loadExample('4111111111111112')">错误示例</button>
        <button class="btn ghost" type="button" @click="input = ''">清空</button>
        <button class="btn" type="button" :disabled="!result" @click="copyText(summary)">复制摘要</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="error && result" class="muted">当前输入有误，下面保留的是上一次成功校验的结果。</p>
      <p v-for="note in (result ? result.notes || [] : [])" :key="note" class="note" role="status" aria-live="polite">{{ note }}</p>
      <p v-for="w in (result ? result.warnings || [] : [])" :key="w" class="warn" role="status" aria-live="polite">{{ w }}</p>
      <template v-if="result">
        <p class="verdict" :class="result.valid ? 'pass' : 'fail'">{{ result.valid ? '✓ Luhn 校验通过' : '✗ Luhn 校验不通过' }}</p>
        <table class="kv">
          <tbody>
            <tr><th>号码（分组）</th><td class="mono">{{ result.formatted }}</td></tr>
            <tr><th>位数</th><td>{{ result.length }} 位</td></tr>
            <tr><th>加权和</th><td>{{ result.sum }}（模 10 = {{ result.mod }}，为 0 才通过）</td></tr>
            <tr><th>校验位</th><td>末位 {{ result.checkDigit }}<span v-if="!result.valid">，按当前载荷应为 {{ result.expectedCheckDigit }}</span></td></tr>
            <tr v-if="result.issuers.length"><th>可能类型</th><td>{{ result.issuers.join('、') }}</td></tr>
          </tbody>
        </table>
        <details class="steps">
          <summary>计算过程（从右往左隔位翻倍）</summary>
          <p class="mono steps-line">{{ result.steps.map(s => s.doubled ? `${s.digit}×2→${s.value}` : `${s.digit}`).join(' + ') }} = {{ result.sum }}</p>
        </details>
      </template>

      <h2 class="section-title">生成校验位</h2>
      <label class="block">载荷号码（不含末位校验位）
        <input v-model="payload" type="text" inputmode="numeric" spellcheck="false" placeholder="如：7992739871" aria-label="载荷号码" />
      </label>
      <p v-if="payloadError" class="error">{{ payloadError }}</p>
      <p v-if="payloadError && completed" class="muted">当前载荷有误，下面保留的是上一次成功生成的结果。</p>
      <p v-for="note in (completed ? completed.notes || [] : [])" :key="note" class="note" role="status" aria-live="polite">{{ note }}</p>
      <p v-if="completed" class="complete-row">
        校验位 <strong class="mono">{{ completed.checkDigit }}</strong>，完整号码
        <strong class="mono">{{ completed.complete }}</strong>
        <button class="btn ghost small" type="button" @click="copyText(completed.complete)">复制</button>
        <button class="btn ghost small" type="button" @click="loadExample(completed.complete)">送去校验</button>
      </p>

      <h2 class="section-title">批量校验</h2>
      <label class="block">每行一个号码
        <textarea v-model="batch" rows="4" spellcheck="false" placeholder="每行一个号码" aria-label="批量校验输入"></textarea>
      </label>
      <template v-if="batchResult">
        <p class="summary">共 {{ batchResult.total }} 个 · 通过 {{ batchResult.validCount }} · 不通过 {{ batchResult.invalidCount }}<span v-if="batchResult.errorCount"> · 格式错误 {{ batchResult.errorCount }}</span></p>
        <ul class="batch-list">
          <li v-for="r in batchResult.results" :key="r.line">
            <span class="mono">{{ r.raw }}</span>
            <span v-if="!r.ok" class="fail-text">{{ r.error }}</span>
            <span v-else :class="r.valid ? 'pass-text' : 'fail-text'">{{ r.valid ? '✓ 通过' : '✗ 不通过' }}</span>
          </li>
        </ul>
      </template>
      <p v-if="batchError" class="error">{{ batchError }}</p>
      <p v-if="batchError && batchResult" class="muted">当前批量输入有误，上面保留的是上一次成功校验的结果。</p>

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
import { analyzeNumber, computeCheckDigit, validateBatch, buildSummary } from '@/utils/luhn.js';
const features = [
  { icon: '💳', title: '号码校验', description: '银行卡、IMEI 等采用 Luhn 模 10 校验的号码，粘贴即出结论与计算过程' },
  { icon: '🔢', title: '校验位生成', description: '输入不含末位的载荷号码，算出应追加的校验位并拼出完整号码' },
  { icon: '📋', title: '批量校验', description: '每行一个号码批量核对，汇总通过与不通过数量' },
  { icon: '🔒', title: '纯本地处理', description: '算法在浏览器内运行，卡号不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴号码（空格、连字符分组可直接粘贴）', '看结论：通过 / 不通过，不通过会给出正确的校验位', '需要拼号时用「生成校验位」，多个号码用「批量校验」'];
const faqs = [
  { question: 'Luhn 校验通过说明卡号是真的吗？', answer: '不能。Luhn 只能发现一位抄错或相邻两位抄反这类录入错误，校验通过只说明号码符合编号规则，不代表卡真实存在、有余额或能支付。' },
  { question: '哪些号码用 Luhn 校验？', answer: '主流银行卡（Visa、Mastercard、银联、运通、JCB 等）、移动设备 IMEI、部分会员卡与条码编号。中国居民身份证用的是 ISO 7064 MOD 11-2 校验，不是 Luhn。' },
  { question: '算法怎么算？', answer: '从右往左，校验位（最右一位）不变，其后隔一位翻倍，翻倍结果大于 9 时减 9（等同于各位相加），全部相加后能被 10 整除即通过。' },
  { question: '粘贴时要注意什么？', answer: '全角数字会自动按半角处理并给出提示；空格、换行、不换行空格、全角空格和连字符（包括 – / —）都可作分组分隔直接粘贴。字母等其他字符会按 Unicode 码点定位到第几个报错。批量校验中格式错误与 Luhn 不通过分开计数，孤 CR 换行也会分行。' },
  { question: '生成校验位时载荷可以多短、多长？', answer: '载荷不含校验位，1 位即可计算；完整号码上限 32 位，所以载荷最长 31 位，生成的完整号码能直接送回上方校验。' },
  { question: '输错了为什么还显示上一次的结果？', answer: '这是故意的：报错时页面保留上一次成功的结果并给出提示，方便对照修改，不会一输错就清空。清空输入会连保留结果一起清掉。单次输入上限 10 万字符，批量上限 1 万行。' }
];
const input = ref('4111 1111 1111 1111');
const payload = ref('7992739871');
const batch = ref('');
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => (!input.value ? null : analyzeNumber(input.value)));
const lastValid = ref(null);
watch(parsed, (v) => { if (v && v.ok) lastValid.value = v; }, { immediate: true });
const result = computed(() => (parsed.value && parsed.value.ok ? parsed.value : (parsed.value ? lastValid.value : null)));
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
const summary = computed(() => buildSummary(result.value));
const completedParsed = computed(() => (!payload.value ? null : computeCheckDigit(payload.value)));
const lastCompleted = ref(null);
watch(completedParsed, (v) => { if (v && v.ok) lastCompleted.value = v; }, { immediate: true });
const completed = computed(() => (completedParsed.value && completedParsed.value.ok ? completedParsed.value : (completedParsed.value ? lastCompleted.value : null)));
const payloadError = computed(() => (completedParsed.value && !completedParsed.value.ok ? completedParsed.value.error : ''));
const batchParsed = computed(() => (!batch.value ? null : validateBatch(batch.value)));
const lastBatch = ref(null);
watch(batchParsed, (v) => { if (v && v.ok) lastBatch.value = v; }, { immediate: true });
const batchResult = computed(() => (batchParsed.value && batchParsed.value.ok ? batchParsed.value : (batchParsed.value ? lastBatch.value : null)));
const batchError = computed(() => (batchParsed.value && !batchParsed.value.ok ? batchParsed.value.error : ''));
function loadExample(v) { input.value = v; }
async function copyText(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.luhn-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.section-title { font-size: 1.1rem; color: var(--text-strong); margin: 22px 0 10px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
input[type="text"], textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn.small { padding: 4px 10px; font-size: 12px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger-text); font-size: 14px; }
.muted { color: var(--text-2); font-size: 13px; }
.note { color: var(--text-2); font-size: 13px; }
.warn { color: var(--warning); font-size: 13px; }
.verdict { font-size: 15px; font-weight: 600; margin: 8px 0; }
.verdict.pass, .pass-text { color: var(--success-text); }
.verdict.fail, .fail-text { color: var(--danger-text); }
.kv { border-collapse: collapse; width: 100%; font-size: 13px; margin-bottom: 8px; }
.kv th { text-align: left; color: var(--text-2); font-weight: 500; padding: 5px 10px 5px 0; white-space: nowrap; vertical-align: top; }
.kv td { padding: 5px 0; color: var(--text); word-break: break-all; }
.mono { font-family: monospace; }
.steps { font-size: 13px; color: var(--text-2); margin-bottom: 6px; }
.steps-line { word-break: break-all; margin: 6px 0 0; }
.complete-row { font-size: 13px; color: var(--text); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.summary { font-size: 13px; margin: 6px 0; color: var(--text-2); }
.batch-list { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.batch-list li { display: flex; gap: 10px; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid var(--border); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { white-space: normal; } }
</style>
