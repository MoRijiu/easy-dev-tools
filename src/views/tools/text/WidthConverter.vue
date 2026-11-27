<template>
  <div class="width-conv">
    <h1>全角半角转换</h1>
    <p class="description">全角字母数字标点与半角互转，可按数字 / 字母 / 标点 / 空格分类选择，清理中文输入法混入的全角字符，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row options">
        <label>方向
          <select v-model="direction" aria-label="转换方向">
            <option value="toHalf">全角 → 半角</option>
            <option value="toFull">半角 → 全角</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" v-model="opts.digits" /> 数字</label>
        <label class="check"><input type="checkbox" v-model="opts.letters" /> 字母</label>
        <label class="check"><input type="checkbox" v-model="opts.punctuation" /> 标点</label>
        <label class="check"><input type="checkbox" v-model="opts.space" /> 空格</label>
      </div>
      <label class="block">输入
        <textarea v-model="input" rows="6" spellcheck="false" placeholder="粘贴含全角字符的文本，如：Ｈｅｌｌｏ　２０２６！" aria-label="转换输入"></textarea>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample">示例（全→半）</button>
        <button class="chip" type="button" @click="loadFullExample">示例（半→全）</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <button class="btn ghost" type="button" :disabled="!result" @click="useAsInput">结果作输入并反向</button>
        <button class="btn" type="button" :disabled="!result" @click="copyText(result.text)">复制结果</button>
        <span class="muted">输入后实时转换</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="result && result.notes && result.notes.length" class="note" role="status" aria-live="polite">{{ result.notes.join('；') }}</p>
      <template v-if="result">
        <label class="block">输出
          <textarea :value="result.text" rows="6" readonly spellcheck="false" aria-label="转换输出"></textarea>
        </label>
        <p class="summary">共 {{ result.chars }} 字符 · 本次转换 {{ result.converted }} 个 · 输入中全角 {{ result.fullBefore }} / 半角 {{ result.halfBefore }}</p>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { convertWidth } from '@/utils/widthConvert.js';
const features = [
  { icon: '🔤', title: '分类可控', description: '数字、字母、标点、空格四类可分别开关：只转数字标点、保留全角空格排版等场景都能满足' },
  { icon: '⌨️', title: '清理混入全角', description: '中文输入法下敲出的全角逗号、括号、数字粘进代码或表单常报错，一键转回半角' },
  { icon: '📊', title: '转换统计', description: '显示本次实际转换的字符数与输入中的全 / 半角数量，结果可预期' },
  { icon: '🔒', title: '纯本地处理', description: '内容不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴要转换的文本', '选择方向（全→半或半→全），按需勾选要转换的字符类别', '点「复制结果」使用，或「结果作输入并反向」继续处理'];
const faqs = [
  { question: '全角和半角有什么区别？', answer: '半角字符占一个标准字符位（ASCII），全角字符占两个字符位宽，源于早期等宽排版。全角字母数字标点在代码、命令行和很多表单校验里会被当成不同字符，是常见的“看着一样却报错”来源。' },
  { question: '为什么只转了标点，中文没变？', answer: '汉字本身没有全 / 半角之分，不在转换范围内；本工具只处理全角 ASCII 区（U+FF01–U+FF5E）与全角空格。半角片假名与全角片假名不是简单偏移对应，也不在处理范围内。' },
  { question: '全角空格会变成什么？', answer: '全角 → 半角时全角空格（U+3000）变为普通空格；反向时普通空格变为全角空格。若想保留原空格排版，取消勾选「空格」即可。' },
  { question: '￥、￡ 这类全角符号会转吗？', answer: '会。全角符号区 U+FFE0–U+FFE6（￠￡￢￣￤￥￦）按标点类转换，对应半角为 ¢£¬¯¦¥₩，反向也能转回；旧版这几个字符既不转换也不计入统计，容易漏掉。' },
  { question: '为什么提示没有转换任何字符？', answer: '说明输入里没有当前方向可转的字符（可能已经是目标宽度），或可转字符所属类别没有勾选。未勾选类别残留的字符数、原样保留的半角片假名都会在结果上方点名提示，不再静默。' },
  { question: '改错了为什么旧结果还在？', answer: '未勾选任何类别或文本超限时保留上一次成功的结果，方便对照着改；修正后会自动刷新，清空输入则会一并清掉。字符上限按 Unicode 码点计，一个 Emoji 算 1 个字符。' }
];
const EXAMPLE = 'Ｈｅｌｌｏ　２０２６！订单号：ＡＢＣ－１２３，金额（９９．５０元），标价￥１２８';
const FULL_EXAMPLE = 'Hello 2026! Price: ¥128 / £99';
const input = ref(EXAMPLE);
const direction = ref('toHalf');
const opts = reactive({ digits: true, letters: true, punctuation: true, space: true });
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => (!input.value ? null : convertWidth(input.value, direction.value, { ...opts })));
const lastResult = ref(null);
watch(parsed, (p) => { if (p && p.ok) lastResult.value = p; else if (!p) lastResult.value = null; }, { immediate: true });
const result = computed(() => lastResult.value);
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
function resetOpts() { opts.digits = true; opts.letters = true; opts.punctuation = true; opts.space = true; }
function loadExample() { input.value = EXAMPLE; direction.value = 'toHalf'; resetOpts(); }
function loadFullExample() { input.value = FULL_EXAMPLE; direction.value = 'toFull'; resetOpts(); }
function clearAll() { input.value = ''; }
function useAsInput() {
  if (!result.value) return;
  input.value = result.value.text;
  direction.value = direction.value === 'toHalf' ? 'toFull' : 'toHalf';
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.width-conv { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.options .check { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; color: var(--text-2); }
.options select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options label { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.note { color: var(--text-2); font-size: 13px; margin: 4px 0; }
.summary { font-size: 13px; margin: 6px 0 10px; color: var(--text-2); }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
