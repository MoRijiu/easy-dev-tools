<template>
  <div class="cu-tool">
    <h1>CSS 单位换算</h1>
    <p class="description">px、rem、em、%、vw/vh 与 pt/in/cm 等 CSS 长度单位互转，相对单位按可调的根字号、父字号与视口计算，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label>CSS 长度
          <input v-model="input" type="text" placeholder="如 16px / 1.5rem / 2vw" aria-label="CSS 长度输入" :aria-invalid="error && !errorCtxField ? 'true' : undefined" :aria-describedby="error && !errorCtxField ? 'css-unit-error' : undefined" @keyup.enter="analyze" />
        </label>
        <label class="unit-label">无单位时按
          <select v-model="defaultUnit" aria-label="默认单位"><option v-for="u in unitSymbols" :key="u" :value="u">{{ u }}</option></select>
        </label>
        <button class="btn" @click="analyze">换算</button>
        <button class="btn ghost" @click="clearAll">清空</button>
      </div>
      <div class="examples"><span>示例：</span><button v-for="e in examples" :key="e" class="chip" @click="pick(e)">{{ e }}</button></div>
      <div class="ctx-row">
        <label>根字号 rem <input v-model="ctxForm.rootFontSize" type="text" inputmode="decimal" aria-label="根字号" :aria-invalid="errorCtxField === 'rootFontSize' ? 'true' : undefined" :aria-describedby="errorCtxField === 'rootFontSize' ? 'css-unit-error' : undefined" @change="analyze" /></label>
        <label>父字号 em <input v-model="ctxForm.parentFontSize" type="text" inputmode="decimal" aria-label="父元素字号" :aria-invalid="errorCtxField === 'parentFontSize' ? 'true' : undefined" :aria-describedby="errorCtxField === 'parentFontSize' ? 'css-unit-error' : undefined" @change="analyze" /></label>
        <label>% 基准 <input v-model="ctxForm.percentBase" type="text" inputmode="decimal" aria-label="百分比基准" :aria-invalid="errorCtxField === 'percentBase' ? 'true' : undefined" :aria-describedby="errorCtxField === 'percentBase' ? 'css-unit-error' : undefined" @change="analyze" /></label>
        <label>视口宽 <input v-model="ctxForm.viewportWidth" type="text" inputmode="decimal" aria-label="视口宽度" :aria-invalid="errorCtxField === 'viewportWidth' ? 'true' : undefined" :aria-describedby="errorCtxField === 'viewportWidth' ? 'css-unit-error' : undefined" @change="analyze" /></label>
        <label>视口高 <input v-model="ctxForm.viewportHeight" type="text" inputmode="decimal" aria-label="视口高度" :aria-invalid="errorCtxField === 'viewportHeight' ? 'true' : undefined" :aria-describedby="errorCtxField === 'viewportHeight' ? 'css-unit-error' : undefined" @change="analyze" /></label>
      </div>
      <p v-if="error" id="css-unit-error" class="error" role="alert">{{ error }}</p>
      <p v-if="notes.length" class="note" role="status" aria-live="polite">{{ notes.join('；') }}</p>
      <template v-if="parsed">
        <p class="summary">{{ summary }}</p>
        <div class="table-wrap"><table><tbody>
          <tr v-for="row in rows" :key="row.symbol"><th scope="row">{{ row.symbol }} <span class="muted">{{ row.name }}</span></th><td class="mono">{{ row.css }}</td><td><button class="copy" :aria-label="`复制 ${row.symbol} 换算结果`" @click="copyText(row.css)">复制</button></td></tr>
        </tbody></table></div>
        <button class="btn ghost" @click="copyText(summary)">复制摘要</button>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, reactive } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { parseCssLength, convertCssLength, normalizeContext, buildCssSummary, CSS_UNITS, DEFAULT_CONTEXT } from '@/utils/cssUnits.js';
const features = [
  { icon: '📐', title: '相对单位可调', description: 'rem/em/%/vw 都依赖上下文，本工具把根字号、父字号、百分比基准与视口尺寸全部开放可调' },
  { icon: '🖨️', title: '印刷单位齐全', description: 'pt、pc、in、cm、mm、Q 按 1in = 96px 的 CSS 规范换算' },
  { icon: '📋', title: '逐项复制', description: '每个单位的结果都可一键复制为可直接粘贴的 CSS 值' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['输入数字加单位（如 16px、1.5rem），点「换算」或按回车', '如页面根字号不是 16px，先在上下文区改根字号/视口再看结果', '在对照表里逐项复制任意单位的结果'];
const faqs = [
  { question: 'rem 和 em 有什么区别？', answer: 'rem 相对根元素（html）的字号，em 相对当前元素父级的字号。em 会逐层叠加，嵌套深时容易失控；rem 全站统一，所以布局尺寸通常优先 rem，组件内部需要随字号缩放时才用 em。' },
  { question: 'font-size 的 % 是相对什么的？', answer: '相对父元素字号。例如父字号 16px 时，font-size: 150% 等于 24px。本工具的「% 基准」默认 16（与父字号一致），若你算的是宽度百分比，把基准改成容器宽度即可。' },
  { question: '设计稿是 750px 宽，怎么换算 vw？', answer: '把视口宽改成 750，输入设计稿上的 px 值，读 vw 行即可：100vw 就是整个视口宽，元素 vw = 元素 px ÷ 750 × 100。' },
  { question: '粘贴进来的数字有什么讲究？', answer: '全角数字/字母（如 １６ｐｘ）会自动转半角；逗号只认千分位分组（1,000 可以，1,5 会报错——小数请用点号 1.5，旧版会把 1,5 静默算成 15）；下划线只能单个夹在数字之间（1_000）；.5、5.、+5 等 CSS 合法写法均可直接输入。' },
  { question: '上下文参数填错或清空会怎样？', answer: '根字号等五项必须是大于 0 的纯数字（不要带 px 单位、不支持 0x 十六进制），范围 0.01–1000000，超出会点名报错；把输入框清空等于恢复默认值（根字号 16、视口 1920×1080）。' },
  { question: '改错输入后之前的结果还在吗？', answer: '在。输入或上下文出错时只显示错误提示，表格保留上一次成功换算的结果，不会被清空；修正输入重新点「换算」即可刷新。小于 1 的结果保留 10 位小数，避免小数值被四舍五入丢精度。' }
];
const examples = ['16px', '1.5rem', '24px', '2vw', '12pt', '50%', '.5rem', '1,000px'];
const unitSymbols = CSS_UNITS.map((u) => u.symbol);
const input = ref('16px'); const defaultUnit = ref('px');
const ctxForm = reactive({ ...DEFAULT_CONTEXT });
const parsed = ref(null); const activeCtx = ref({ ...DEFAULT_CONTEXT }); const error = ref(''); const notes = ref([]);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const CTX_LABELS = { rootFontSize: '根字号', parentFontSize: '父元素字号', percentBase: '百分比基准', viewportWidth: '视口宽度', viewportHeight: '视口高度' };
const errorCtxField = computed(() => {
  if (!error.value) return '';
  for (const [key, label] of Object.entries(CTX_LABELS)) if (error.value.startsWith(label)) return key;
  return '';
});
const rows = computed(() => (parsed.value ? convertCssLength(parsed.value, activeCtx.value) : []));
const summary = computed(() => buildCssSummary(parsed.value, rows.value, activeCtx.value));
const analyze = () => {
  // 出错时保留上一次成功结果（旧版直接清空 parsed），只更新错误提示
  const c = normalizeContext(ctxForm);
  if (!c.ok) { error.value = c.error; return; }
  const r = parseCssLength(input.value, defaultUnit.value);
  if (!r.ok) { error.value = r.error; return; }
  activeCtx.value = c.context;
  error.value = ''; notes.value = r.notes || []; parsed.value = r;
};
const pick = (e) => { input.value = e; analyze(); };
const clearAll = () => { input.value = ''; parsed.value = null; error.value = ''; notes.value = []; };
const copyText = (txt) => clipboard.copyText(txt, '✓ 已复制');
analyze();
</script>
<style scoped>
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); flex: 1; min-width: 200px; }
.row label.unit-label { flex: 0 1 140px; min-width: 120px; }
input, select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; width: 100%; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; font-family: monospace; }
.ctx-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.ctx-row label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.ctx-row input { width: 76px; }
.note { font-size: 13px; color: var(--info-text, var(--text-2)); margin: 6px 0; }
.summary { font-size: 14px; color: var(--text-strong); margin: 16px 0 8px; }
.table-wrap { overflow-x: auto; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--text); }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); }
th { white-space: nowrap; color: var(--text-2); font-weight: 600; }
.muted { font-weight: 400; font-size: 12px; }
td.mono { font-family: monospace; word-break: break-all; }
.copy { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
</style>
