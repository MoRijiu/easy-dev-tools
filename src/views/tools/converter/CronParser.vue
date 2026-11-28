<template>
  <div class="cron-parser">
    <h1>Cron 表达式解析工具</h1>
    <p class="description">在线解析 Cron 定时表达式，逐字段说明含义并预览未来执行时间；全程本地计算，不上传服务器</p>

    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary">
          <span class="icon" aria-hidden="true">📝</span> 示例
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
        <button @click="copyNext" class="btn btn-success" :disabled="!runs.length">
          <span class="icon" aria-hidden="true">📋</span> 复制执行时间
        </button>
      </ToolToolbar>

      <ToolStatusMessage id="cron-parser-status" :message="statusMessage" :type="statusType" />

      <div class="input-section">
        <ToolEditorPanel title="Cron 表达式" :info="parsed ? (parsed.hasSeconds ? '含秒字段' : '标准 5 字段') : ''">
          <input
            v-model="inputExpr"
            class="cron-input"
            placeholder="例如：30 9 * * 1-5（工作日 9:30），支持 5/6/7 字段与 @daily 等别名"
            spellcheck="false"
            aria-label="Cron 表达式输入"
            :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'cron-parser-status' : undefined"
            @input="parse"
          />
          <div class="field-hint" aria-hidden="true">
            <span v-for="f in fieldHints" :key="f">{{ f }}</span>
          </div>
        </ToolEditorPanel>
      </div>

      <div class="presets">
        <button v-for="p in presets" :key="p.expr" class="preset-chip" @click="usePreset(p.expr)">{{ p.label }} <code>{{ p.expr }}</code></button>
      </div>

      <div v-if="parsed" class="desc-bar" role="status">
        <span class="desc-label">说明</span>
        <span class="desc-text">{{ description }}</span>
      </div>

      <ul v-if="parsed && parsed.warnings.length" class="warnings-list" role="status" aria-live="polite">
        <li v-for="(w, i) in parsed.warnings" :key="i">⚠️ {{ w }}</li>
      </ul>

      <div v-if="parsed" class="fields-section">
        <h2 class="section-title">字段解析</h2>
        <table class="fields-table">
          <thead>
            <tr><th scope="col">字段</th><th scope="col">原值</th><th scope="col">匹配值</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in parsed.fields" :key="f.key">
              <th scope="row">{{ f.label }}</th>
              <td><code>{{ f.raw }}</code></td>
              <td class="field-values">{{ f.isWildcard ? '任意（*）' : compressValues(f.values) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="fields-note">日与星期同时限定（都不是 *）时，按标准 Cron 语义取「或」：任一命中即执行。</p>
      </div>

      <div v-if="parsed" class="runs-section">
        <h2 class="section-title">未来 {{ runs.length }} 次执行（本地时间）</h2>
        <ol v-if="runs.length" class="runs-list">
          <li v-for="(t, i) in runs" :key="i"><code>{{ formatTime(t) }}</code><span class="run-week">周{{ weekLabel(t) }}</span></li>
        </ol>
        <p v-else class="runs-empty">没有找到未来的执行时间：该表达式可能永不执行（如 2 月 30 日不存在）或指定年份已过去，请看上方警告与字段解析。</p>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { parseCron, nextRuns, describeCron, compressValues } from '@/utils/cron.js';

const features = [
  { icon: '🔍', title: '逐字段解析', description: '每个字段的原值与匹配值一目了然，出错精确定位到字段' },
  { icon: '🗓️', title: '执行时间预览', description: '按本地时间算出未来 8 次执行时刻，含星期' },
  { icon: '⏱️', title: '多格式支持', description: '标准 5 字段、带秒 6 字段、Quartz 7 字段与 @daily 等别名' },
  { icon: '🔒', title: '纯本地计算', description: '表达式不离开浏览器，不上传任何服务器' }
];

const usageSteps = [
  '在输入框粘贴或输入 Cron 表达式，输入即解析',
  '看「说明」一句确认语义，再用字段表核对每个字段的匹配值',
  '用未来执行时间列表验证是否符合预期（注意本地时区）',
  '点常用预设可快速套用工作日、每月 1 号等常见节奏'
];

const faqs = [
  {
    question: 'Cron 表达式的字段顺序是什么？',
    answer: '标准 5 字段依次是：分钟 小时 日 月 星期。带秒时秒在最前（6 字段），Quartz 还可在最后加年份（7 字段）。'
  },
  {
    question: '星期里的 0 和 7 有什么区别？',
    answer: '两者都表示周日。1–6 依次是周一到周六，也可用 SUN、MON、TUE 等英文缩写。'
  },
  {
    question: '日和星期同时写会怎样？',
    answer: '按标准 Cron 语义取「或」：日期命中或星期命中都会执行。例如「0 0 1 * 1」表示每月 1 号以及每周一都执行。'
  },
  {
    question: '支持 @daily 这类别名吗？',
    answer: '支持 @yearly、@annually、@monthly、@weekly、@daily、@midnight、@hourly，会自动展开成标准表达式；@reboot 等系统别名不支持，拼错别名会明确报错。'
  },
  {
    question: '支持 Quartz 的 ?、L、W、# 吗？',
    answer: '不支持。这些是 Quartz 扩展符号（? 表示不指定、L 表示最后一天、W 表示最近工作日、# 表示第几个星期几），粘贴进来会明确报错并定位到字段；? 可先用 * 代替再按字段表核对语义。7 字段仅支持在最后加年份。'
  },
  {
    question: '为什么表达式合法却没有执行时间？',
    answer: '多半是日期组合不存在（如 2 月 30 日、4 月 31 日）或 7 字段的年份已过去，页面会在解析区上方给出「永不执行」警告；2 月 29 日则只在闰年执行，约每 4 年一次。'
  }
];

const presets = [
  { label: '每分钟', expr: '* * * * *' },
  { label: '每 15 分钟', expr: '*/15 * * * *' },
  { label: '每天 9:30', expr: '30 9 * * *' },
  { label: '工作日 9 点', expr: '0 9 * * 1-5' },
  { label: '每周一 10 点', expr: '0 10 * * 1' },
  { label: '每月 1 号零点', expr: '0 0 1 * *' },
  { label: '每天零点', expr: '@daily' }
];

const examples = presets.slice(2, 5).map(p => ({
  input: p.expr,
  output: p.label,
  description: `预设：${p.label}`
}));

const inputExpr = ref('');
const parsed = ref(null);
const runs = ref([]);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const inputErrorText = ref('');
const setInputError = (msg) => { status.showError(msg); inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);

const FIELD_HINT_SETS = {
  5: ['分钟', '小时', '日', '月', '星期'],
  6: ['秒', '分钟', '小时', '日', '月', '星期'],
  7: ['秒', '分钟', '小时', '日', '月', '星期', '年']
};
const fieldHints = computed(() => {
  const expr = inputExpr.value.trim();
  if (expr.startsWith('@')) return FIELD_HINT_SETS[5];
  const count = expr ? expr.split(/\s+/).length : 5;
  return FIELD_HINT_SETS[count] || FIELD_HINT_SETS[5];
});
const description = computed(() => (parsed.value ? describeCron(parsed.value) : ''));

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const weekLabel = (d) => WEEK[d.getDay()];
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const parse = () => {
  const expr = inputExpr.value.trim();
  parsed.value = null;
  runs.value = [];
  if (!expr) { statusMessage.value = ''; return; }
  try {
    parsed.value = parseCron(expr);
    runs.value = nextRuns(parsed.value, new Date(), 8);
    statusMessage.value = '✓ 解析成功';
    statusType.value = 'success';
  } catch (e) {
    setInputError(`✗ ${e.message}`);
  }
};

const loadExample = () => { inputExpr.value = '30 9 * * 1-5'; parse(); };
const usePreset = (expr) => { inputExpr.value = expr; parse(); };
const useExample = (example) => { inputExpr.value = example.input; parse(); };
const clearAll = () => { inputExpr.value = ''; parsed.value = null; runs.value = []; statusMessage.value = ''; };
const copyNext = async () => clipboard.copyText(runs.value.map(t => `${formatTime(t)}（周${weekLabel(t)}）`).join('\n'), '✓ 执行时间已复制到剪贴板');
</script>

<style scoped>
.warnings-list { margin: 0 0 12px; padding: 10px 14px 10px 30px; background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; line-height: 1.7; }
.input-section { margin-bottom: 12px; }
.cron-input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 15px; box-sizing: border-box; }
.field-hint { display: flex; gap: 18px; margin-top: 8px; color: var(--text-2); font-size: 12px; padding-left: 2px; }
.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.preset-chip { padding: 5px 10px; border-radius: 999px; background: var(--bg-soft); color: var(--text); font-size: 13px; border: 1px solid var(--border); cursor: pointer; }
.preset-chip:hover { border-color: var(--accent); }
.preset-chip code { color: var(--text-2); font-size: 12px; margin-left: 4px; }
.desc-bar { display: flex; gap: 10px; align-items: baseline; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--accent-soft); margin-bottom: 16px; }
.desc-label { font-size: 12px; color: var(--text-2); flex-shrink: 0; }
.desc-text { color: var(--text-strong); font-size: 15px; }
.section-title { color: var(--text-strong); font-size: 1.1rem; margin: 8px 0 12px; }
.fields-section { margin-bottom: 16px; }
.fields-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.fields-table th, .fields-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; color: var(--text); }
.fields-table thead th { background: var(--bg-soft); color: var(--text-strong); }
.fields-table tbody th { width: 70px; color: var(--text-strong); background: var(--bg-soft); }
.field-values { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; word-break: break-all; }
.fields-note { margin: 8px 0 0; color: var(--text-2); font-size: 13px; }
.runs-section { margin-bottom: 8px; }
.runs-list { margin: 0; padding-left: 22px; color: var(--text); font-size: 14px; }
.runs-list li { padding: 3px 0; }
.runs-list code { font-size: 14px; }
.run-week { margin-left: 10px; color: var(--text-2); font-size: 13px; }
.runs-empty { color: var(--danger-text); font-size: 14px; margin: 0; }
@media (max-width: 640px) {
  .field-hint { gap: 10px; }
}
</style>
