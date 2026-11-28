<template>
  <div class="cc-tool">
    <h1>颜色对比度检查</h1>
    <p class="description">按 WCAG 2.x 计算前景/背景对比度，判定普通文本与大字的 AA/AAA 是否达标，不达标可一键调整前景色，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label>前景色（文字）
          <span class="field"><input v-model="fgInput" type="text" placeholder="#1f2937" aria-label="前景色输入" :aria-invalid="error.startsWith('前景色') ? 'true' : undefined" :aria-describedby="error.startsWith('前景色') ? 'color-contrast-error' : undefined" /><input v-model="fgPicker" type="color" aria-label="前景色取色器" /></span>
        </label>
        <button class="btn ghost swap" @click="swap">⇄ 交换</button>
        <label>背景色
          <span class="field"><input v-model="bgInput" type="text" placeholder="#ffffff" aria-label="背景色输入" :aria-invalid="error.startsWith('背景色') ? 'true' : undefined" :aria-describedby="error.startsWith('背景色') ? 'color-contrast-error' : undefined" /><input v-model="bgPicker" type="color" aria-label="背景色取色器" /></span>
        </label>
        <button class="btn ghost" @click="clearAll">清空</button>
      </div>
      <div class="examples"><span>常用搭配：</span><button v-for="e in examples" :key="e.label" class="chip" @click="pick(e)">{{ e.label }}</button></div>
      <p v-if="error" id="color-contrast-error" class="error" role="alert">{{ error }}</p>
      <template v-if="result">
        <div class="preview" :style="{ background: result.bg.hex, color: result.fg.hex }">
          <p class="pv-normal">普通文本示例：快速的棕色狐狸跳过懒狗 0123456789（16px）</p>
          <p class="pv-large">大字示例：标题文字 The quick brown fox（24px）</p>
          <p class="pv-small">小字示例：辅助说明文字通常更难达标（12px）</p>
        </div>
        <p class="summary">对比度 <strong class="ratio">{{ result.ratioText }}:1</strong> · {{ result.grade }}<span v-if="result.composited" class="muted">（含透明度，已按白色底合成计算）</span></p>
        <div class="table-wrap"><table><tbody>
          <tr v-for="row in levelRows" :key="row.key"><th scope="row">{{ row.label }}</th><td>要求 ≥ {{ row.need }}:1</td><td :class="row.pass ? 'pass' : 'fail'">{{ row.pass ? '✓ 通过' : '✗ 未通过' }}</td></tr>
        </tbody></table></div>
        <div class="actions">
          <button v-if="!result.levels.normalAA" class="btn" @click="fixToAA">一键调整前景色到达 AA</button>
          <button v-if="!result.levels.normalAAA" class="btn ghost" @click="fixToAAA">调整到 AAA</button>
          <button class="btn ghost" @click="copyText(summary)">复制摘要</button>
        </div>
        <p v-if="fixNote" class="fix-note" role="status" aria-live="polite">{{ fixNote }}</p>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { checkContrast, adjustForeground, buildContrastSummary, parseColor, WCAG_THRESHOLDS } from '@/utils/colorContrast.js';
const features = [
  { icon: '📐', title: 'WCAG 标准算法', description: '按 WCAG 2.x 相对亮度公式计算对比度，与浏览器无障碍审计口径一致' },
  { icon: '✅', title: '四档判定', description: '普通文本与大字（≥24px 或粗体 ≥18.66px）的 AA/AAA 一次看清' },
  { icon: '🪄', title: '一键达标', description: '不达标时沿加深/提亮方向微调前景色，给出刚好达标的最近颜色' },
  { icon: '🔒', title: '纯本地处理', description: '颜色不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['输入前景与背景颜色（支持 #hex、rgb()、hsl()、取色器）', '看预览区与四档判定，红色未通过即需要调整', '不达标时点「一键调整前景色」，或手动换色后复查'];
const faqs = [
  { question: 'AA 和 AAA 有什么区别？', answer: 'AA 是 WCAG 的常规达标线：普通文本对比度 ≥ 4.5:1、大字 ≥ 3:1；AAA 更严格：普通文本 ≥ 7:1、大字 ≥ 4.5:1。多数产品以 AA 为验收标准。' },
  { question: '什么算「大字」？', answer: 'WCAG 定义大字为 ≥ 24px 的常规字重，或 ≥ 18.66px（约 14pt）的粗体字。大字对对比度要求更低，因为笔画更粗更易辨认。' },
  { question: '灰色文字为什么总不达标？', answer: '#767676 在白底上是 4.54:1，刚好压线 AA；再浅一点的 #999999 只有 2.85:1，连大字都不达标。浅灰小字是无障碍审计最常见的问题。' },
  { question: '支持哪些颜色写法？', answer: '支持 #rgb/#rgba/#rrggbb/#rrggbbaa、rgb()/rgba()（含百分比与空格斜杠写法）、hsl()/hsla()（色相可带 deg、负数与超 360 按色环归一）、常用英文名与 transparent；整段全角输入（如 ＃ＦＦ００００）会自动转半角识别。通道带多余字符（如 10abc）会点名报错，不会静默截断。' },
  { question: '输入写错时为什么还显示上一次结果？', answer: '出错时保留上次有效的预览与判定、只更新红色错误提示，方便对照着改；改对后结果自动刷新。半透明色会按白色底合成后计算，摘要处会注明。' }
];
const examples = [
  { label: '黑 / 白', fg: '#000000', bg: '#ffffff' },
  { label: '正文灰 / 白', fg: '#1f2937', bg: '#ffffff' },
  { label: '浅灰 / 白（不达标）', fg: '#999999', bg: '#ffffff' },
  { label: '白 / 品牌蓝', fg: '#ffffff', bg: '#2563eb' },
  { label: '白 / 深灰底', fg: '#f9fafb', bg: '#111827' }
];
const fgInput = ref('#999999'); const bgInput = ref('#ffffff');
const fixNote = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const syncPicker = (inputRef) => { const p = parseColor(inputRef.value); return p.ok ? p.hex : '#000000'; };
const fgPicker = ref(syncPicker(fgInput)); const bgPicker = ref(syncPicker(bgInput));
watch(fgPicker, (v) => { fgInput.value = v; });
watch(bgPicker, (v) => { bgInput.value = v; });
const fixApplying = ref(false);
watch(fgInput, (v) => { const p = parseColor(v); if (p.ok) fgPicker.value = p.hex; if (!fixApplying.value) fixNote.value = ''; });
watch(bgInput, (v) => { const p = parseColor(v); if (p.ok) bgPicker.value = p.hex; if (!fixApplying.value) fixNote.value = ''; });
const result = ref(null); const error = ref('');
watch([fgInput, bgInput], () => {
  if (!fgInput.value.trim() && !bgInput.value.trim()) { result.value = null; error.value = ''; return; }
  const r = checkContrast(fgInput.value, bgInput.value);
  if (r.ok) { result.value = r; error.value = ''; } else { error.value = r.error; } // 出错保留上次有效结果，不清空预览与判定
}, { immediate: true });
const levelRows = computed(() => (result.value ? [
  { key: 'nAA', label: '普通文本 AA', need: WCAG_THRESHOLDS.normalAA, pass: result.value.levels.normalAA },
  { key: 'nAAA', label: '普通文本 AAA', need: WCAG_THRESHOLDS.normalAAA, pass: result.value.levels.normalAAA },
  { key: 'lAA', label: '大字 AA', need: WCAG_THRESHOLDS.largeAA, pass: result.value.levels.largeAA },
  { key: 'lAAA', label: '大字 AAA', need: WCAG_THRESHOLDS.largeAAA, pass: result.value.levels.largeAAA }
] : []));
const summary = computed(() => buildContrastSummary(result.value));
const pick = (e) => { fgInput.value = e.fg; bgInput.value = e.bg; };
const swap = () => { const t = fgInput.value; fgInput.value = bgInput.value; bgInput.value = t; };
const clearAll = () => { fgInput.value = ''; bgInput.value = ''; fixNote.value = ''; };
const applyFix = (target, label) => {
  const r = adjustForeground(fgInput.value, bgInput.value, target);
  if (!r.ok) { fixNote.value = r.error; return; }
  if (!r.changed) { fixNote.value = `当前已达到 ${label}，无需调整`; return; }
  fixApplying.value = true;
  fgInput.value = r.color.hex;
  fixNote.value = `已${r.direction}前景色为 ${r.color.hex}，对比度 ${r.ratio.toFixed(2)}:1，达到 ${label}`;
  setTimeout(() => { fixApplying.value = false; }, 0);
};
const fixToAA = () => applyFix(WCAG_THRESHOLDS.normalAA, 'AA');
const fixToAAA = () => applyFix(WCAG_THRESHOLDS.normalAAA, 'AAA');
const copyText = (txt) => clipboard.copyText(txt, '✓ 已复制');
</script>
<style scoped>
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); flex: 1; min-width: 200px; }
.field { display: flex; gap: 6px; }
.field input[type="text"] { flex: 1; }
.field input[type="color"] { width: 42px; padding: 2px; height: 36px; cursor: pointer; }
input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.preview { border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-top: 16px; }
.pv-normal { font-size: 16px; margin: 0 0 8px; }
.pv-large { font-size: 24px; margin: 0 0 8px; font-weight: 600; }
.pv-small { font-size: 12px; margin: 0; }
.summary { font-size: 14px; color: var(--text-strong); margin: 14px 0 8px; }
.ratio { font-size: 20px; }
.muted { color: var(--text-2); font-size: 12px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--text); }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); }
th { white-space: nowrap; color: var(--text-2); font-weight: 600; }
.pass { color: var(--success-text); white-space: nowrap; }
.fail { color: var(--danger-text); white-space: nowrap; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.fix-note { font-size: 13px; color: var(--text); margin-top: 10px; }
@media (max-width: 640px) { .swap { order: 3; } }
</style>
