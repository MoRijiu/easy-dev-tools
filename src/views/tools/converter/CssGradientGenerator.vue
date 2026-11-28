<template>
  <div class="cg-tool">
    <h1>CSS 渐变生成器</h1>
    <p class="description">可视化调线性 / 径向 / 锥形渐变：多色标、角度与重复条纹，实时预览并一键复制 CSS，全程本地、不上传</p>
    <div class="tool-container">
      <div class="preview" :style="{ background: gradientCss || 'transparent' }" role="img" aria-label="渐变预览"></div>
      <div class="row">
        <div class="seg" role="group" aria-label="渐变类型">
          <button v-for="t in GRADIENT_TYPES" :key="t.id" :class="{ active: form.type === t.id }" :aria-pressed="form.type === t.id" @click="form.type = t.id">{{ t.name }}</button>
        </div>
        <label class="check"><input v-model="form.repeating" type="checkbox" /> 重复渐变</label>
      </div>
      <div v-if="form.type === 'linear'" class="row">
        <label class="grow">方向角度 {{ form.angle }}°
          <input v-model.number="form.angle" type="range" min="0" max="360" step="1" aria-label="线性渐变角度" />
        </label>
        <label class="num">角度 <input v-model.number="form.angle" type="number" min="0" max="360" aria-label="角度数值" :aria-invalid="errorField === 'angle' ? 'true' : undefined" :aria-describedby="errorField === 'angle' ? 'css-gradient-error' : undefined" /></label>
        <div class="dirs">
          <button v-for="d in DIRECTIONS" :key="d.deg" class="chip" @click="form.angle = d.deg">{{ d.name }}</button>
        </div>
      </div>
      <div v-if="form.type === 'radial'" class="row">
        <label>形状
          <select v-model="form.shape" aria-label="径向形状"><option v-for="s in RADIAL_SHAPES" :key="s.id" :value="s.id">{{ s.name }}</option></select>
        </label>
        <label>大小
          <select v-model="form.size" aria-label="径向大小"><option v-for="s in RADIAL_SIZES" :key="s.id" :value="s.id">{{ s.name }}</option></select>
        </label>
        <label>中心位置
          <select v-model="form.position" aria-label="径向中心位置"><option v-for="p in POSITIONS" :key="p" :value="p">{{ p }}</option></select>
        </label>
      </div>
      <div v-if="form.type === 'conic'" class="row">
        <label class="grow">起始角度 {{ form.angle }}°
          <input v-model.number="form.angle" type="range" min="0" max="360" step="1" aria-label="锥形起始角度" />
        </label>
        <label class="num">角度 <input v-model.number="form.angle" type="number" min="0" max="360" aria-label="角度数值" :aria-invalid="errorField === 'angle' ? 'true' : undefined" :aria-describedby="errorField === 'angle' ? 'css-gradient-error' : undefined" /></label>
        <label>中心位置
          <select v-model="form.position" aria-label="锥形中心位置"><option v-for="p in POSITIONS" :key="p" :value="p">{{ p }}</option></select>
        </label>
      </div>
      <div class="stops-head">
        <span>色标（{{ form.stops.length }}）</span>
        <button class="btn ghost" :disabled="form.stops.length >= 12" @click="addStop">+ 添加色标</button>
        <button class="btn ghost" @click="reverseStops">反转</button>
      </div>
      <div v-for="(stop, i) in form.stops" :key="i" class="stop-row">
        <input type="color" :value="pickerValue(stop.color)" :aria-label="`第 ${i + 1} 个色标取色器`" @input="onPick(i, $event.target.value)" />
        <input v-model="stop.color" type="text" class="color-text mono" :aria-label="`第 ${i + 1} 个色标颜色值`" spellcheck="false" :aria-invalid="errorStopField(i, 'color') ? 'true' : undefined" :aria-describedby="errorStopField(i, 'color') ? 'css-gradient-error' : undefined" />
        <input v-model.number="stop.position" type="range" min="0" max="100" step="1" class="grow" :aria-label="`第 ${i + 1} 个色标位置`" :aria-invalid="errorStopField(i, 'position') ? 'true' : undefined" :aria-describedby="errorStopField(i, 'position') ? 'css-gradient-error' : undefined" />
        <input v-model.number="stop.position" type="number" min="0" max="100" class="pos-num" :aria-label="`第 ${i + 1} 个色标位置数值`" :aria-invalid="errorStopField(i, 'position') ? 'true' : undefined" :aria-describedby="errorStopField(i, 'position') ? 'css-gradient-error' : undefined" />
        <span class="pct">%</span>
        <button class="del" :disabled="form.stops.length <= 2" :aria-label="`删除第 ${i + 1} 个色标`" @click="removeStop(i)">✕</button>
      </div>
      <div class="examples"><span>预设：</span><button v-for="p in GRADIENT_PRESETS" :key="p.name" class="chip" @click="applyPreset(p)">{{ p.name }}</button></div>
      <p v-if="notes.length" class="notes" role="status" aria-live="polite">{{ notes.join('；') }}</p>
      <p v-if="error" id="css-gradient-error" class="error" role="alert">{{ error }}<span v-if="gradientCss">（已保留上一次成功结果）</span></p>
      <template v-if="gradientCss">
        <div class="code-head"><span>CSS 代码</span>
          <span class="code-btns">
            <button class="copy" @click="copyText(gradientCss)">复制渐变值</button>
            <button class="copy" @click="copyText(snippet)">复制 background 声明</button>
          </span>
        </div>
        <pre class="code mono">{{ snippet }}</pre>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { GRADIENT_TYPES, RADIAL_SHAPES, RADIAL_SIZES, POSITIONS, GRADIENT_PRESETS, buildGradient, buildCssSnippet, parseCssColor, toHexInput } from '@/utils/cssGradient.js';
const features = [
  { icon: '🌈', title: '三种渐变', description: '线性、径向、锥形全支持，径向可调形状/大小/中心，锥形可调起始角度' },
  { icon: '🎚️', title: '多色标编辑', description: '最多 12 个色标，取色器、文本与滑杆三种方式调颜色和位置，可反转与重复条纹' },
  { icon: '📋', title: '一键复制', description: '可复制渐变值本身，或完整的 background 声明，直接粘进样式表' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选渐变类型（线性/径向/锥形），调角度或形状', '在色标行里改颜色与位置，或点预设一键套用', '看预览满意后，复制 background 声明到你的 CSS'];
const faqs = [
  { question: '怎么做条纹效果？', answer: '勾选「重复渐变」，再让相邻色标同色同位置形成硬停靠（如蓝色 0–10%、深蓝 10–20%），渐变会按最后色标的位置周期重复，预设「条纹重复」就是现成例子。' },
  { question: '色标位置可以不按顺序填吗？', answer: '可以。本工具会自动按位置从小到大排序输出；CSS 规范里位置更小的后写色标会被钳制到前一色标位置，容易写出意料之外的硬边，排序输出更直观。' },
  { question: '锥形渐变适合做什么？', answer: '饼图、进度环、彩虹色轮与 conic 边框。把相邻色标设成同位置硬停靠即可分扇区，例如 0–25% 红、25–50% 蓝就是四等分的开始。' },
  { question: '颜色可以怎么写？', answer: '支持 #hex（3/4/6/8 位）、rgb()/rgba() 的逗号写法与现代空格写法（rgb(255 0 0 / 0.5)）、hsl()/hsla()（色相可写 deg 或 turn、饱和度与亮度须带 %），以及 yellow、rebeccapurple 等常用英文名。全角字符（如 ＃ＦＦ００００、ｒｇｂ（…））会自动转半角。分量带多余字符（如 10abc、0x10）会点名报错，不会静默算错。' },
  { question: '改错颜色后预览为什么还在？', answer: '出错时保留上一次成功生成的渐变与 CSS 代码，方便对照修改；把颜色或位置改回合法值后会自动更新。位置与角度留空不再静默当 0，会直接提示不能为空。' }
];
const DIRECTIONS = [
  { name: '→ 向右', deg: 90 }, { name: '↓ 向下', deg: 180 }, { name: '← 向左', deg: 270 }, { name: '↑ 向上', deg: 0 }, { name: '↘ 右下', deg: 135 }, { name: '↙ 左下', deg: 225 }
];
const form = reactive({
  type: 'linear', angle: 135, repeating: false, shape: 'ellipse', size: 'farthest-corner', position: 'center',
  stops: [{ color: '#ff9966', position: 0 }, { color: '#ff5e62', position: 55 }, { color: '#7b2ff7', position: 100 }]
});
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const built = computed(() => buildGradient(form));
const error = computed(() => (built.value.ok ? '' : built.value.error));
const errorTarget = computed(() => {
  const e = error.value;
  if (!e) return null;
  const stopPos = e.match(/^第 (\d+) 个色标的位置/);
  if (stopPos) return { kind: 'stop', index: Number(stopPos[1]) - 1, field: 'position' };
  const stopColor = e.match(/^第 (\d+) 个色标：/);
  if (stopColor) return { kind: 'stop', index: Number(stopColor[1]) - 1, field: 'color' };
  if (e.startsWith('角度') || e.startsWith('起始角度')) return { kind: 'angle' };
  return null;
});
const errorField = computed(() => (errorTarget.value && errorTarget.value.kind === 'angle' ? 'angle' : ''));
const errorStopField = (i, field) => {
  const t = errorTarget.value;
  return !!(t && t.kind === 'stop' && t.index === i && t.field === field);
};
const notes = computed(() => (built.value.ok ? built.value.notes || [] : []));
const lastGoodCss = ref('');
watch(built, (v) => { if (v.ok) lastGoodCss.value = v.css; }, { immediate: true });
const gradientCss = computed(() => (built.value.ok ? built.value.css : lastGoodCss.value));
const snippet = computed(() => (gradientCss.value ? buildCssSnippet(gradientCss.value) : ''));
const pickerValue = (color) => { const c = parseCssColor(color); return c.ok ? toHexInput(c) : '#000000'; };
const onPick = (i, value) => { form.stops[i].color = value; };
const addStop = () => {
  const sorted = [...form.stops].sort((a, b) => a.position - b.position);
  let best = { gap: -1, at: 50 };
  for (let i = 0; i + 1 < sorted.length; i++) {
    const gap = sorted[i + 1].position - sorted[i].position;
    if (gap > best.gap) best = { gap, at: Math.round((sorted[i].position + sorted[i + 1].position) / 2) };
  }
  form.stops.push({ color: sorted[sorted.length - 1].color, position: best.at });
};
const removeStop = (i) => { form.stops.splice(i, 1); };
const reverseStops = () => { form.stops = form.stops.map((s) => ({ color: s.color, position: 100 - s.position })).reverse(); };
const applyPreset = (p) => {
  const o = p.options;
  form.type = o.type; form.angle = o.angle ?? 0; form.repeating = !!o.repeating;
  form.shape = o.shape || 'ellipse'; form.size = o.size || 'farthest-corner'; form.position = o.position || 'center';
  form.stops = o.stops.map((s) => ({ ...s }));
};
const copyText = (txt) => clipboard.copyText(txt, '✓ 已复制');
</script>
<style scoped>
.notes { color: var(--warning-text); font-size: 13px; }
.preview { height: 180px; border-radius: 10px; border: 1px solid var(--border); margin-bottom: 16px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.row label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.row label.grow { flex: 1; min-width: 220px; }
.row label.num input { width: 72px; }
.row input[type="range"] { flex: 1; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { padding: 7px 14px; border: none; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.seg button.active { background: var(--accent-solid); color: #fff; }
.check { font-size: 13px; color: var(--text-2); display: flex; gap: 6px; align-items: center; }
.dirs { display: flex; gap: 6px; flex-wrap: wrap; }
input[type="text"], input[type="number"], select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; }
input[type="color"] { width: 42px; height: 34px; padding: 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); cursor: pointer; flex: none; }
.btn { padding: 7px 12px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.stops-head { display: flex; gap: 8px; align-items: center; margin: 14px 0 8px; font-size: 13px; color: var(--text-2); }
.stop-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.stop-row .color-text { width: 180px; }
.stop-row .grow { flex: 1; min-width: 80px; }
.stop-row .pos-num { width: 68px; }
.pct { font-size: 13px; color: var(--text-2); }
.del { width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; flex: none; }
.del:disabled { opacity: .4; cursor: not-allowed; }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.code-head { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px; font-size: 13px; color: var(--text-2); flex-wrap: wrap; gap: 8px; }
.code-btns { display: flex; gap: 6px; }
.code { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-size: 13px; color: var(--text); overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 0; }
.copy { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.mono { font-family: monospace; }
@media (max-width: 640px) { .preview { height: 130px; } .stop-row { flex-wrap: wrap; } .stop-row .color-text { flex: 1; width: auto; min-width: 0; } .stop-row .grow { order: 5; flex: 1 1 100%; } }
</style>
