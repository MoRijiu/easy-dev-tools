<template>
  <div class="password-strength">
    <h1>密码强度检查</h1>
    <p class="description">估算密码熵并检测常见弱口令、连续序列、键盘连排、重复与年份等模式，给出离线爆破耗时估算，全程本地、不上传也不保存</p>
    <div class="tool-container">
      <label class="block">密码
        <span class="input-row">
          <input v-model="input" :type="visible ? 'text' : 'password'" spellcheck="false" autocomplete="off" placeholder="输入要检查的密码" aria-label="密码" :aria-invalid="analysisError ? 'true' : undefined" :aria-describedby="analysisError ? 'password-strength-error' : undefined">
          <button class="mini" type="button" :aria-pressed="visible" :aria-label="visible ? '隐藏密码' : '显示密码'" @click="visible = !visible">{{ visible ? '隐藏' : '显示' }}</button>
        </span>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample(EXAMPLES[0])">示例 · 弱</button>
        <button class="chip" type="button" @click="loadExample(EXAMPLES[1])">示例 · 中</button>
        <button class="chip" type="button" @click="loadExample(EXAMPLES[2])">示例 · 强</button>
        <button class="chip" type="button" @click="loadExample(EXAMPLES[3])">示例 · leet 变体</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <span class="muted">输入后实时分析，本页不会保存或发送密码</span>
      </div>
      <template v-if="result">
        <div class="meter" role="img" :aria-label="`强度 ${result.level.label}`">
          <span v-for="i in 5" :key="i" class="seg" :class="{ on: i <= result.score + 1, ['lv' + result.score]: i <= result.score + 1 }"></span>
        </div>
        <p class="summary">强度：<strong>{{ result.level.label }}（{{ result.score }}/4）</strong> · {{ result.level.hint }} · 有效熵约 {{ result.effectiveEntropy }} 位</p>
        <div class="table-wrap"><table><tbody>
          <tr v-for="row in metricRows" :key="row.label"><th scope="row">{{ row.label }}</th><td>{{ row.value }}</td></tr>
        </tbody></table></div>
        <template v-if="result.findings.length > 0">
          <h2 class="sub">发现的问题</h2>
          <ul class="findings">
            <li v-for="(f, idx) in result.findings" :key="idx"><strong>{{ f.label }}</strong>：{{ f.detail }}</li>
          </ul>
        </template>
        <h2 class="sub">破解耗时估算（平均猜中所需）</h2>
        <div class="table-wrap"><table><tbody>
          <tr v-for="c in result.crackTimes" :key="c.id"><th scope="row">{{ c.label }}</th><td>{{ c.text }}</td></tr>
        </tbody></table></div>
        <h2 class="sub">改进建议</h2>
        <ul class="findings">
          <li v-for="(s, idx) in result.suggestions" :key="idx">{{ s }}</li>
        </ul>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(summary)">复制摘要</button>
        </div>
      </template>
      <p v-else-if="analysisError" id="password-strength-error" class="error-text" role="alert">{{ analysisError }}</p>
      <p v-else class="muted">在上方输入密码后，这里会显示强度、问题与破解耗时估算。</p>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { analyzePassword, buildStrengthSummary } from '@/utils/passwordStrength.js';
const features = [
  { icon: '📐', title: '熵估算', description: '按字符集大小与长度计算原始熵，再按可猜测模式扣分得到有效熵' },
  { icon: '🕵️', title: '模式检测', description: '识别常见弱口令（含 leet 变体与全角归一化）、abc/123 连续序列、qwerty 横行与 1qaz 纵列连排、重复字符、整体重复、年份与完整日期' },
  { icon: '⏱️', title: '破解耗时', description: '按在线限速 / 在线不限速 / 离线慢哈希 / 离线快速哈希四种速率估算平均爆破时间' },
  { icon: '🔒', title: '纯本地处理', description: '密码只在浏览器内分析，不上传、不保存，关掉页面即消失' }
];
const usageSteps = ['在输入框粘贴或输入要检查的密码（可点「显示」核对）', '查看强度等级、有效熵与发现的问题', '参考破解耗时估算与改进建议调整密码，或复制摘要留存'];
const faqs = [
  { question: '有效熵是怎么算的？', answer: '先按字符集大小 × 长度算原始熵（每位 log₂(字符集)），再对连续序列、键盘连排、重复、常见词、年份等可预测模式扣分，整体重复与常见弱口令还会直接压低上限。这是启发式估算，用于横向比较与发现问题，不是密码学承诺。' },
  { question: '为什么长密码也可能被判弱？', answer: '长度只在内容不可预测时才贡献强度。abcabcabc 这类整体重复、qwerty2024 这类键盘连排加年份，攻击者会优先按模式尝试，实际组合数远小于同长度随机密码。' },
  { question: '哪种破解场景最值得参考？', answer: '密码数据库泄露后攻击者在本机离线爆破最常见：网站若用 bcrypt 等慢哈希，看「离线慢哈希」一行；若只是 MD5/明文存储，看「离线快速哈希」。同一个密码在慢哈希下能多撑很多个数量级。' },
  { question: '检查结果会被保存吗？', answer: '不会。分析全部在浏览器本地完成，密码不发送到任何服务器，也不写入本地存储；但仍建议不要在公共设备上输入真实密码。' },
  { question: 'p@55w0rd 这类符号变体安全吗？', answer: '不安全。把 a 换成 @、o 换成 0、s 换成 5 这类 leet 替换是公开规则，爆破工具会先还原再套字典。本工具检测时会把 leet 变体还原后按原样弱口令判定。' },
  { question: '全角字母和空格算强度吗？', answer: '全角 ａｂｃ 与半角 abc 等价，攻击者归一化后没有区别，本工具按半角口径检测；空格只是分隔符，字符集只按 1 个字符计，不会按符号虚增强度——口令短语的强度来自词数与不可预测性。' },
  { question: '为什么姓名加生日被判中？', answer: '完整日期（YYYYMMDD、MMDDYYYY 等排列）会被识别并重扣分：生日是公开或半公开信息，攻击者会优先按各种日期排列组合尝试，只按年份扣分会明显高估这类密码。' }
];
const EXAMPLES = ['qwerty2024', 'BlueSky2024', 'Tr7$kQ9!mZ2#xW', 'p@55w0rd'];
const input = ref('');
const visible = ref(false);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);

const parsed = computed(() => {
  if (!input.value) return { result: null, error: '' };
  try { return { result: analyzePassword(input.value), error: '' }; }
  catch (e) { return { result: null, error: e.message || '分析失败' }; }
});
const result = computed(() => parsed.value.result);
const analysisError = computed(() => parsed.value.error);
const summary = computed(() => buildStrengthSummary(result.value, result.value ? result.value.length : 0));
const classNames = computed(() => {
  if (!result.value) return '';
  const c = result.value.classes;
  const names = [];
  if (c.lower) names.push('小写');
  if (c.upper) names.push('大写');
  if (c.digit) names.push('数字');
  if (c.symbol) names.push('符号');
  if (c.space) names.push('空格');
  if (c.other) names.push('其他（中文等）');
  return names.join('、');
});
const metricRows = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  return [
    { label: '长度', value: `${r.length} 位` },
    { label: '字符类型', value: `${classNames.value}（${r.classCount} 类）` },
    { label: '字符集大小', value: String(r.poolSize) },
    { label: '原始熵', value: `约 ${r.rawEntropy} 位` },
    { label: '模式扣分', value: r.penalty > 0 ? `−${r.penalty} 位` : '无' },
    { label: '有效熵', value: `约 ${r.effectiveEntropy} 位` }
  ];
});
function loadExample(v) { input.value = v; }
function clearAll() { input.value = ''; }
async function copyText(text) {
  await clipboard.copyText(text, '已复制到剪贴板', { failMsg: '复制失败，请手动选择复制' });
}
</script>
<style scoped>
.error-text { font-size: 13px; color: var(--danger-text); margin: 10px 0; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
.input-row { display: flex; gap: 8px; }
input { flex: 1; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; box-sizing: border-box; min-width: 0; }
.mini { padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.meter { display: flex; gap: 4px; margin: 12px 0 6px; }
.seg { flex: 1; height: 8px; border-radius: 4px; background: var(--bg-softer); border: 1px solid var(--border); }
.seg.on.lv0 { background: var(--danger); border-color: var(--danger); }
.seg.on.lv1 { background: #e67e22; border-color: #e67e22; }
.seg.on.lv2 { background: #f1c40f; border-color: #f1c40f; }
.seg.on.lv3 { background: #2ecc71; border-color: #2ecc71; }
.seg.on.lv4 { background: var(--success); border-color: var(--success); }
.summary { font-size: 14px; margin: 10px 0 6px; color: var(--text); }
.sub { font-size: 15px; color: var(--text-strong); margin: 14px 0 6px; }
.table-wrap { overflow-x: auto; margin-bottom: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th { text-align: left; padding: 6px 8px; color: var(--text-2); font-weight: 600; white-space: nowrap; width: 220px; }
td { padding: 6px 8px; color: var(--text); }
.findings { margin: 0 0 10px; padding-left: 18px; font-size: 13px; color: var(--text); }
.findings li { margin-bottom: 4px; }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { th { width: 150px; } }
</style>
