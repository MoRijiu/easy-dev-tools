<template>
  <div class="uuid-parser">
    <h1>UUID 解析</h1>
    <p class="description">校验 UUID 并解析版本、变体与分段，v1 / v6 / v7 还能提取内嵌时间，支持大括号、URN 与无连字符写法，全程本地、不上传</p>
    <div class="tool-container">
      <label class="block">UUID
        <textarea v-model="input" rows="3" spellcheck="false" placeholder="粘贴 UUID，如 550e8400-e29b-41d4-a716-446655440000" aria-label="UUID"></textarea>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample(EXAMPLES[0])">示例 v4</button>
        <button class="chip" type="button" @click="loadExample(EXAMPLES[1])">示例 v1</button>
        <button class="chip" type="button" @click="loadExample(EXAMPLES[2])">示例 v7</button>
        <button class="chip" type="button" @click="loadExample(EXAMPLES[3])">示例 Max</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <span class="muted">输入后实时解析</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="error && result" class="muted">当前输入有误，下面保留的是上一次成功解析的结果。</p>
      <p v-for="note in (result?.notes || [])" :key="note" class="note">{{ note }}</p>
      <p v-for="warn in (result?.warnings || [])" :key="warn" class="warn">⚠ {{ warn }}</p>
      <template v-if="result">
        <p class="summary">合法 UUID · {{ result.versionName }} · 变体 {{ result.variant.label }}<span v-if="result.special"> · {{ result.special }}</span></p>
        <div class="table-wrap"><table><tbody>
          <tr v-for="row in outRows" :key="row.label"><th>{{ row.label }}</th><td class="mono">{{ row.value }}</td><td><button class="mini" type="button" @click="copyText(row.value)">复制</button></td></tr>
        </tbody></table></div>
        <div class="row actions">
          <button class="btn ghost" type="button" @click="copyText(summary)">复制摘要</button>
        </div>
        <h2 class="sub">分段结构</h2>
        <div class="table-wrap"><table><tbody>
          <tr v-for="seg in result.segments" :key="seg.label"><th>{{ seg.label }}</th><td class="mono">{{ seg.value }}</td></tr>
        </tbody></table></div>
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
import { parseUuid, buildUuidSummary } from '@/utils/uuidParse.js';
const features = [
  { icon: '✅', title: '格式校验', description: '校验长度、连字符分组与十六进制字符，错误精确定位到第几个字符' },
  { icon: '🧬', title: '版本与变体', description: '识别 v1–v8 版本与 NCS / RFC 9562 / Microsoft 变体，并识别 Nil 与 Max 特殊值' },
  { icon: '🕐', title: '时间提取', description: 'v1 / v6 按 Gregorian 历元、v7 按 Unix 毫秒提取内嵌时间，附时钟序列与节点' },
  { icon: '🔒', title: '纯本地处理', description: 'UUID 不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴 UUID（带不带连字符、大括号或 urn:uuid: 前缀都可以）', '实时查看版本、变体、分段与内嵌时间', '逐行复制标准形式 / 无连字符形式 / URN，或复制整段摘要'];
const faqs = [
  { question: '怎么看一个 UUID 是哪个版本？', answer: '看第三段的第一个十六进制字符：1–8 就是版本号。例如 550e8400-e29b-41d4-… 第三段以 4 开头，是 v4 随机型；以 7 开头是 v7 时间型。' },
  { question: 'v4 和 v7 该选哪个？', answer: 'v4 完全随机、无序，做主键时索引局部性差；v7 前 48 位是 Unix 毫秒时间戳，天然按时间递增、数据库索引更友好，新系统更推荐 v7（RFC 9562）。' },
  { question: 'v1 UUID 里的时间和节点安全吗？', answer: 'v1 内嵌生成时间与节点（历史上常用网卡 MAC 地址），会泄露生成时刻与设备信息，对外场景应避免 v1，改用 v4 / v7；随机生成的节点会把多播位置 1 以示区分。' },
  { question: '版本位是 9–15 或变体不是标准值，算合法 UUID 吗？', answer: '字符与分组都对时本工具会照常解析，但会给出提示：RFC 9562 只定义版本 0–8，9–15 为保留未分配；变体只有 10xx 才是标准变体，其余（NCS / Microsoft / 未来保留）多数 UUID 库会拒绝或区别对待，Max UUID（全 F）是特殊值、版本位不适用。' },
  { question: '粘贴时带空格、换行或全角字符能解析吗？', answer: '可以：从日志或表格复制时混入的空格、换行与全角字母数字会被自动容错并给出提示，大括号与 urn:uuid: 前缀任意嵌套顺序也能剥除；但一次只能解析一个 UUID，多行每行一个时会点名报错。输错时页面会保留上一次成功的结果，不会直接清空。' },
  { question: '为什么 v2 不提取时间？', answer: 'v2（DCE Security）把 v1 的时间低位与时钟序列的一部分换成了本地标识符（如 POSIX UID），字段已被覆盖、拼不出完整时间，所以本工具对 v2 只报版本与变体并给出提示。' }
];
const EXAMPLES = [
  '550e8400-e29b-41d4-a716-446655440000',
  '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  '018bcfe5-6800-7000-8000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff'
];
const input = ref(EXAMPLES[0]);
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => (input.value.trim() ? parseUuid(input.value) : null));
const lastValid = ref(null);
watch(parsed, (v) => { if (v && v.ok) lastValid.value = v; }, { immediate: true });
const result = computed(() => {
  if (!input.value.trim()) return null;
  if (parsed.value && parsed.value.ok) return parsed.value;
  return lastValid.value;
});
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
const summary = computed(() => buildUuidSummary(result.value));
const outRows = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  const rows = [
    { label: '标准形式', value: r.canonical },
    { label: '版本', value: r.versionName },
    { label: '变体', value: `${r.variant.label}（${r.variant.bits}）` }
  ];
  if (r.special) rows.push({ label: '特殊值', value: r.special });
  if (r.timestamp) rows.push({ label: '内嵌时间', value: `${r.timestamp.iso}（Unix 毫秒 ${r.timestamp.unixMs}）` });
  if (r.clockSeq !== null) rows.push({ label: '时钟序列', value: String(r.clockSeq) });
  if (r.node) rows.push({ label: '节点', value: `${r.node}${r.nodeIsRandom ? '（随机节点）' : ''}` });
  rows.push(
    { label: '无连字符', value: r.hex },
    { label: '大写形式', value: r.uppercaseForm },
    { label: 'URN 形式', value: r.urnForm }
  );
  return rows;
});
function loadExample(v) { input.value = v; }
function clearAll() { input.value = ''; lastValid.value = null; }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.uuid-parser { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.note { color: var(--info-text, var(--text-2)); font-size: 13px; margin: 6px 0; }
.warn { color: var(--warning-text, #b45309); font-size: 13px; margin: 6px 0; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.mini { padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.summary { font-size: 14px; margin: 10px 0 6px; color: var(--text); }
.sub { font-size: 15px; color: var(--text-strong); margin: 14px 0 6px; }
.table-wrap { overflow-x: auto; margin-bottom: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th { text-align: left; padding: 6px 8px; color: var(--text-2); font-weight: 600; white-space: nowrap; width: 150px; }
td { padding: 6px 8px; color: var(--text); }
td.mono { font-family: monospace; word-break: break-all; }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } th { width: 110px; } }
</style>
