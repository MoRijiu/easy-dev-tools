<template>
  <div class="tz-conv">
    <h1>时区转换</h1>
    <p class="description">输入某个时区的时间，一屏对照全球主要时区的对应时间，自动处理夏令时，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row options">
        <label>源时区
          <select v-model="fromZone" aria-label="源时区">
            <option v-for="z in TIMEZONES" :key="z.id" :value="z.id">{{ z.label }}（{{ z.id }}）</option>
          </select>
        </label>
        <label>时间
          <input class="dt" type="text" v-model="input" placeholder="2026-11-27 09:30" aria-label="源时间" />
        </label>
        <button class="chip" type="button" @click="useNow">当前时刻</button>
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <button class="btn" type="button" :disabled="!result" @click="copySummary">复制摘要</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="result">
        <p class="summary">{{ result.source.dateTime }} {{ result.source.weekday }}（{{ fromZone }}，{{ result.source.offset }}）= UTC {{ isoShort }}，共 {{ result.rows.length }} 个时区</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>时区</th><th>当地时间</th><th>星期</th><th>UTC 偏移</th><th>与源时区时差</th><th></th></tr></thead>
            <tbody>
              <tr v-for="row in result.rows" :key="row.timeZone" :class="{ self: row.timeZone === fromZone }">
                <td>{{ row.label }}<span class="muted"> {{ row.timeZone }}</span></td>
                <td class="mono">{{ row.dateTime }}<span v-if="row.dayDiff" class="daydiff">{{ row.dayDiff > 0 ? '（次日）' : '（前一日）' }}</span></td>
                <td>{{ row.weekday }}</td>
                <td class="mono">{{ row.offset }}</td>
                <td>{{ formatDiffHours(row.diffHours) }}</td>
                <td><button class="chip" type="button" @click="copyText(`${row.label} ${row.dateTime} ${row.weekday} ${row.offset}`)">复制</button></td>
              </tr>
            </tbody>
          </table>
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
import { TIMEZONES, convertTime, formatDiffHours } from '@/utils/timezoneConvert.js';
const features = [
  { icon: '🌍', title: '全球对照', description: '17 个常用时区一屏对照，含日期跨日标记与相对源时区的时差' },
  { icon: '☀️', title: '夏令时自动处理', description: '基于浏览器内置 IANA 时区数据库，纽约、伦敦、悉尼等地的夏令时切换自动生效' },
  { icon: '🧭', title: '半小时时区', description: '印度 UTC+05:30 等非整点偏移同样精确计算' },
  { icon: '🔒', title: '纯本地处理', description: '内容不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选源时区并输入该时区的时间（YYYY-MM-DD HH:mm）', '对照表实时给出各时区的当地时间、星期与 UTC 偏移', '点任意一行「复制」或顶部「复制摘要」带走结果'];
const faqs = [
  { question: '为什么同一城市冬天和夏天的时差不同？', answer: '纽约、伦敦、悉尼等地实行夏令时：夏季时钟拨快 1 小时。本工具用 IANA 规则按所输入的日期自动取当时生效的偏移，例如上海与纽约冬令时差 13 小时、夏令时差 12 小时。' },
  { question: '「次日 / 前一日」是什么意思？', answer: '表示该时区的日期比源时区晚一天或早一天。跨太平洋开会时最容易踩坑：上海周五上午 9 点，洛杉矶还是周四下午。' },
  { question: '时间戳工具和这个有什么区别？', answer: '时间戳转换处理 Unix 时间戳与本地时间；本工具处理「某个时区的墙上时间 → 其他时区墙上时间」，适合约跨国会议、看海外发布时间等场景。' }
];
const EXAMPLE = '2026-11-27 09:30';
const input = ref(EXAMPLE);
const fromZone = ref('Asia/Shanghai');
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => (!input.value.trim() ? null : convertTime(input.value, fromZone.value)));
const result = computed(() => (parsed.value && parsed.value.ok ? parsed.value : null));
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
const isoShort = computed(() => (result.value ? result.value.iso.replace('T', ' ').slice(0, 19) + 'Z' : ''));
function loadExample() { input.value = EXAMPLE; fromZone.value = 'Asia/Shanghai'; }
function clearAll() { input.value = ''; }
function useNow() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  input.value = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
  try { fromZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || fromZone.value; } catch { /* 保持原值 */ }
  if (!TIMEZONES.some((z) => z.id === fromZone.value)) fromZone.value = 'Asia/Shanghai';
}
function copySummary() {
  if (!result.value) return;
  const lines = result.value.rows.map((r) => `${r.label}：${r.dateTime} ${r.weekday}（${r.offset}）`);
  copyText(lines.join('\n'));
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.tz-conv { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.options label { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; }
.options select, .options .dt { padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options .dt { width: 160px; font-family: monospace; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.summary { font-size: 13px; margin: 6px 0 10px; color: var(--text-2); }
.muted { font-size: 12px; color: var(--text-2); }
.daydiff { color: var(--accent, #4f46e5); font-size: 12px; }
.mono { font-family: monospace; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 6px 8px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
tr.self td { font-weight: 600; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
