<template>
  <div class="date-calc">
    <h1>日期计算器</h1>
    <p class="description">计算两日期间隔（年/月/日、工作日/周末）或给日期加减天/周/月/年，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="swapDates" class="btn btn-secondary"><span class="icon" aria-hidden="true">🔄</span> 交换日期</button>
        <button @click="copySummary" class="btn btn-success" :disabled="!diff"><span class="icon" aria-hidden="true">📋</span> 复制摘要</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <section class="block">
        <h2>日期间隔</h2>
        <div class="row">
          <label>开始日期 <input type="date" v-model="startDate" @input="process" aria-label="开始日期" :aria-invalid="startFieldError ? 'true' : undefined" :aria-describedby="startFieldError ? 'date-diff-error' : undefined" /></label>
          <label>结束日期 <input type="date" v-model="endDate" @input="process" aria-label="结束日期" :aria-invalid="endFieldError ? 'true' : undefined" :aria-describedby="endFieldError ? 'date-diff-error' : undefined" /></label>
        </div>
        <div v-if="diff" class="grid">
          <div class="card"><span class="num">{{ fmtNum(diff.totalDays) }}</span><span class="label">相隔天数</span></div>
          <div class="card"><span class="num">{{ diff.breakdownText }}</span><span class="label">年月日分解</span></div>
          <div class="card"><span class="num">{{ diff.weeks }} 周 {{ diff.remainderDays }} 天</span><span class="label">周数分解</span></div>
          <div class="card"><span class="num">{{ fmtNum(diff.inclusiveDays) }}</span><span class="label">含首尾天数</span></div>
          <div class="card"><span class="num">{{ fmtNum(diff.workdays) }}</span><span class="label">工作日 (周一至周五)</span></div>
          <div class="card"><span class="num">{{ fmtNum(diff.weekends) }}</span><span class="label">周末天数</span></div>
        </div>
        <p v-if="diffError" id="date-diff-error" class="error-line" role="alert">✗ {{ diffError }}</p>
        <p v-if="diff" class="hint">{{ diff.from }}（{{ startInfo.weekday }}）到 {{ diff.to }}（{{ endInfo.weekday }}）<span v-if="diff.reversed"> · 已自动按先后排序</span></p>
      </section>
      <section class="block">
        <h2>日期加减</h2>
        <div class="row">
          <label>基准日期 <input type="date" v-model="baseDate" @input="process" aria-label="基准日期" :aria-invalid="baseFieldError ? 'true' : undefined" :aria-describedby="baseFieldError ? 'date-add-error' : undefined" /></label>
          <label>数量 <input type="text" inputmode="numeric" v-model="amount" @input="process" aria-label="数量" class="num-input" :aria-invalid="amountFieldError ? 'true' : undefined" :aria-describedby="amountFieldError ? 'date-add-error' : undefined" /></label>
          <label>单位
            <select v-model="unit" @change="process" aria-label="单位"><option value="days">天</option><option value="weeks">周</option><option value="months">月</option><option value="years">年</option></select>
          </label>
          <div class="quick"><button @click="setQuick(7,'days')">+7天</button><button @click="setQuick(30,'days')">+30天</button><button @click="setQuick(90,'days')">+90天</button><button @click="setQuick(1,'years')">+1年</button><button @click="setQuick(-30,'days')">-30天</button></div>
        </div>
        <p v-if="addError" id="date-add-error" class="error-line" role="alert">✗ {{ addError }}</p>
        <div v-if="added" class="result-line">结果：<strong>{{ added.date }}</strong>（{{ added.weekday }}） · 实际相隔 {{ fmtNum(added.deltaDays) }} 天 · ISO 第 {{ added.isoWeek }} 周 · 今年第 {{ added.dayOfYear }} 天 · Q{{ added.quarter }}{{ added.isLeap ? ' · 闰年' : '' }}</div>
      </section>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { diffDates, addToDate, dateInfo, parseDateInput, buildDiffSummary } from '@/utils/dateCalc.js';
const features = [
  { icon: '📅', title: '间隔分解', description: '总天数之外还给出年/月/日日历分解与周数分解' },
  { icon: '💼', title: '工作日统计', description: '按周一至周五统计间隔内工作日与周末天数' },
  { icon: '➕', title: '日期加减', description: '加减天/周/月/年，月末自动收敛到当月最后一天' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选择开始与结束日期查看间隔', '或在日期加减区输入数量与单位得到目标日期', '点「复制摘要」带走间隔结果'];
const faqs = [
  { question: '工作日怎么统计？', answer: '统计从开始日期（含）到结束日期（不含）之间的周一至周五天数，不含法定节假日。' },
  { question: '1 月 31 日加 1 个月是哪天？', answer: '收敛到 2 月最后一天：平年为 2 月 28 日，闰年为 2 月 29 日。' },
  { question: '含首尾天数是什么意思？', answer: '把开始和结束两天都算进去的天数，比相隔天数多 1，适合算请假、租期这类 inclusive 口径。' },
  { question: '日期可以手输哪些格式？', answer: '日期框选定的同时也接受粘贴手输：YYYY-MM-DD、YYYY/MM/DD、YYYY.MM.DD、YYYYMMDD 与「YYYY年M月D日」都会识别；月份或日期超出当月实际天数会点名报错，不会静默滚动到下个月。' },
  { question: '数量或结果超出范围会怎样？', answer: '数量必须是整数且有上限（天数约 ±365 万），结果日期须落在 0001-01-01 至 9999-12-31 之间，超出会点名提示并保留上一次的计算结果，不会清空。' },
  { question: '某一区输入有误会影响另一区吗？', answer: '不会。日期间隔与日期加减各自独立计算与报错，一区出错时另一区的结果照常保留显示。' }
];
const examples = [
  { input: '2026-01-01|2026-12-31', output: '相隔 364 天（11 个月 30 天），含首尾 365 天，工作日 260 天、周末 104 天', description: '一整年的间隔', snapshot: { start: '2026-01-01', end: '2026-12-31', base: '2026-01-01', amount: '30', unit: 'days' } },
  { input: '2024-02-29|2025-02-28', output: '相隔 365 天（1 年），含首尾 366 天，工作日 261 天、周末 104 天', description: '闰日出发满一年', snapshot: { start: '2024-02-29', end: '2025-02-28', base: '2024-02-29', amount: '1', unit: 'years' } },
  { input: '2025-01-31 + 1 个月', output: '加减结果 2025-02-28（月末收敛）；间隔 2025-01-31 到 2025-03-01 相隔 29 天（1 个月 1 天）', description: '月末加一个月收敛到 2 月末', snapshot: { start: '2025-01-31', end: '2025-03-01', base: '2025-01-31', amount: '1', unit: 'months' } }
];
const today = new Date(); const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const startDate = ref(fmt(today)); const endDate = ref(''); const baseDate = ref(fmt(today)); const amount = ref('30'); const unit = ref('days');
const diff = ref(null); const added = ref(null);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const diffError = ref(''); const addError = ref('');
// 逐字段错误归属：错误文案仍由整区计算给出，字段标记靠单独复核定位
const startFieldError = ref(false); const endFieldError = ref(false);
const baseFieldError = ref(false); const amountFieldError = ref(false);
const failsDateParse = (v) => { try { parseDateInput(v); return false; } catch { return true; } };
const fmtNum = (n) => Number(n).toLocaleString('en-US');
const startInfo = computed(() => { try { return dateInfo(parseDateInput(diff.value ? diff.value.from : startDate.value)); } catch { return { weekday: '' }; } });
const endInfo = computed(() => { try { return dateInfo(parseDateInput(diff.value ? diff.value.to : endDate.value)); } catch { return { weekday: '' }; } });
const process = () => {
  // 两区独立计算：一区出错只提示该区并保留其旧结果，不连累另一区
  if (startDate.value && endDate.value) {
    try { diff.value = diffDates(startDate.value, endDate.value); diffError.value = ''; startFieldError.value = false; endFieldError.value = false; }
    catch (e) { diffError.value = e.message; startFieldError.value = failsDateParse(startDate.value); endFieldError.value = failsDateParse(endDate.value); }
  } else { diff.value = null; diffError.value = ''; startFieldError.value = false; endFieldError.value = false; }
  if (baseDate.value) {
    try { added.value = addToDate(baseDate.value, amount.value, unit.value); addError.value = ''; baseFieldError.value = false; amountFieldError.value = false; }
    catch (e) { addError.value = e.message; baseFieldError.value = failsDateParse(baseDate.value); amountFieldError.value = !baseFieldError.value; }
  } else { added.value = null; addError.value = ''; baseFieldError.value = false; amountFieldError.value = false; }
  const err = diffError.value || addError.value;
  if (err) { statusMessage.value = '✗ ' + err; statusType.value = 'error'; }
  else { statusMessage.value = diff.value || added.value ? '✓ 计算完成' : ''; statusType.value = 'success'; }
};
const applySnapshot = (snap) => { startDate.value = snap.start; endDate.value = snap.end; baseDate.value = snap.base; amount.value = snap.amount; unit.value = snap.unit; process(); };
const loadExample = () => applySnapshot(examples[0].snapshot);
const useExample = (example) => { if (example && example.snapshot) applySnapshot(example.snapshot); else loadExample(); };
const swapDates = () => { [startDate.value, endDate.value] = [endDate.value, startDate.value]; process(); };
const setQuick = (a, u) => { amount.value = String(a); unit.value = u; process(); };
const copySummary = async () => { if (!diff.value) return; await clipboard.copyText(buildDiffSummary(diff.value), '✓ 已复制摘要'); };
process();
</script>
<style scoped>
.block { margin-bottom: 20px; } .block h2 { font-size: 16px; color: var(--text-strong); margin: 0 0 10px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
input, select { padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; }
.num-input { width: 90px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.card { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px 6px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
.num { font-size: 18px; font-weight: 700; color: var(--text-strong); } .label { font-size: 12px; color: var(--text-2); }
.hint { font-size: 13px; color: var(--text-2); margin-top: 10px; }
.error-line { font-size: 13px; color: var(--danger-text); margin-top: 10px; }
.quick { display: flex; gap: 6px; flex-wrap: wrap; } .quick button { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.result-line { margin-top: 12px; font-size: 14px; color: var(--text); background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
@media (max-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>
