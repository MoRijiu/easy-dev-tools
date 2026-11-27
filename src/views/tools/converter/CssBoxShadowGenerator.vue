<template>
  <div class="cs-tool">
    <h1>CSS 阴影生成器</h1>
    <p class="description">可视化调 box-shadow：多层阴影、偏移 / 模糊 / 扩散 / 内阴影，实时预览并一键复制 CSS，全程本地、不上传</p>
    <div class="tool-container">
      <div class="preview">
        <div class="preview-box" :style="{ boxShadow: shadowCss || 'none' }">预览盒子</div>
      </div>
      <div class="layers-head">
        <span>阴影层（{{ form.layers.length }}）</span>
        <button class="btn ghost" :disabled="form.layers.length >= MAX_LAYERS" @click="addLayer">+ 添加一层</button>
      </div>
      <div v-for="(layer, i) in form.layers" :key="i" class="layer-card">
        <div class="layer-top">
          <span class="layer-name">第 {{ i + 1 }} 层</span>
          <label class="check"><input v-model="layer.inset" type="checkbox" /> 内阴影 inset</label>
          <input type="color" :value="pickerValue(layer.color)" aria-label="阴影颜色取色器" @input="onPick(i, $event.target.value)" />
          <input v-model="layer.color" type="text" class="color-text mono" aria-label="阴影颜色值" spellcheck="false" />
          <button class="del" :disabled="form.layers.length <= 1" aria-label="删除这一层" @click="removeLayer(i)">✕</button>
        </div>
        <div class="sliders">
          <label>水平偏移 {{ layer.offsetX }}px
            <span class="slider-row"><input v-model.number="layer.offsetX" type="range" min="-200" max="200" step="1" aria-label="水平偏移" /><input v-model.number="layer.offsetX" type="number" min="-200" max="200" class="num" aria-label="水平偏移数值" /></span>
          </label>
          <label>垂直偏移 {{ layer.offsetY }}px
            <span class="slider-row"><input v-model.number="layer.offsetY" type="range" min="-200" max="200" step="1" aria-label="垂直偏移" /><input v-model.number="layer.offsetY" type="number" min="-200" max="200" class="num" aria-label="垂直偏移数值" /></span>
          </label>
          <label>模糊半径 {{ layer.blur }}px
            <span class="slider-row"><input v-model.number="layer.blur" type="range" min="0" max="200" step="1" aria-label="模糊半径" /><input v-model.number="layer.blur" type="number" min="0" max="200" class="num" aria-label="模糊半径数值" /></span>
          </label>
          <label>扩散半径 {{ layer.spread }}px
            <span class="slider-row"><input v-model.number="layer.spread" type="range" min="-100" max="100" step="1" aria-label="扩散半径" /><input v-model.number="layer.spread" type="number" min="-100" max="100" class="num" aria-label="扩散半径数值" /></span>
          </label>
        </div>
      </div>
      <div class="examples"><span>预设：</span><button v-for="p in SHADOW_PRESETS" :key="p.name" class="chip" @click="applyPreset(p)">{{ p.name }}</button></div>
      <p v-if="notes.length" class="notes">{{ notes.join('；') }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="shadowCss">
        <div class="code-head"><span>CSS 代码</span>
          <span class="code-btns">
            <button class="copy" @click="copyText(shadowCss)">复制阴影值</button>
            <button class="copy" @click="copyText(snippet)">复制 box-shadow 声明</button>
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
import { MAX_LAYERS, SHADOW_PRESETS, buildShadow, buildCssSnippet, parseCssColor } from '@/utils/cssShadow.js';
import { toHexInput } from '@/utils/cssGradient.js';
const features = [
  { icon: '🧱', title: '多层阴影', description: '最多 8 层叠加，分层立体、双色发光、内外阴影混搭都能拼' },
  { icon: '🎚️', title: '四参数直调', description: '水平/垂直偏移、模糊、扩散都有滑杆加数字输入，颜色支持透明度' },
  { icon: '📋', title: '一键复制', description: '可复制阴影值本身，或完整的 box-shadow 声明，直接粘进样式表' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['先点一个预设打底，或直接拖第一层的滑杆', '按需增删阴影层，调偏移、模糊、扩散与颜色透明度', '看预览满意后，复制 box-shadow 声明到你的 CSS'];
const faqs = [
  { question: '模糊半径和扩散半径有什么区别？', answer: '模糊半径只决定阴影边缘的虚化程度，阴影大小不变；扩散半径会先把阴影形状整体放大（正值）或缩小（负值）再模糊。卡片投影常用负扩散收一收，避免阴影比元素还宽一圈。' },
  { question: '为什么推荐多层阴影？', answer: '真实光影有近处锐利、远处柔和的层次。叠一层小偏移小模糊加一层大偏移大模糊，比单层大模糊更自然，预设「分层立体」就是三层叠出来的。' },
  { question: '内阴影 inset 适合做什么？', answer: '凹陷的输入框、按下态按钮、内嵌面板。inset 让阴影落在元素内部，配合浅色高光边还能做出拟物凹凸感。' },
  { question: '数字框里能粘贴什么样的值？', answer: '只填纯数字即可（单位 px 已固定在代码里）：写 10px、0x10、10abc 都会点名报错；全角数字（如 １０）会自动转半角。清空数字框会提示不能为空，不会再静默当成 0。颜色支持 #hex、rgb()/rgba()、hsl()/hsla() 与常用英文名，全角写法也可。' },
  { question: '改错一层为什么预览还在？', answer: '出错时保留上一次成功的预览与 CSS 代码，方便对照着改；把报错的那一层改对后会自动恢复为最新结果。' }
];
const form = reactive({
  layers: [{ offsetX: 0, offsetY: 10, blur: 24, spread: -6, color: 'rgba(0, 0, 0, 0.25)', inset: false }]
});
const statusMessage = ref(''); const statusType = ref('');
const built = computed(() => buildShadow(form.layers));
const error = computed(() => (built.value.ok ? '' : built.value.error));
const notes = computed(() => (built.value.ok ? built.value.notes || [] : []));
// 出错保留上一次成功结果：改坏一层时预览与代码不消失，改对自动恢复
const lastGoodCss = ref('');
watch(built, (v) => { if (v.ok) lastGoodCss.value = v.css; }, { immediate: true });
const shadowCss = computed(() => (built.value.ok ? built.value.css : lastGoodCss.value));
const snippet = computed(() => (shadowCss.value ? buildCssSnippet(shadowCss.value) : ''));
const pickerValue = (color) => { const c = parseCssColor(color); return c.ok ? toHexInput(c) : '#000000'; };
const onPick = (i, value) => { form.layers[i].color = value; };
const addLayer = () => { form.layers.push({ offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: 'rgba(0, 0, 0, 0.15)', inset: false }); };
const removeLayer = (i) => { form.layers.splice(i, 1); };
const applyPreset = (p) => { form.layers = p.layers.map((l) => ({ ...l })); };
const copyText = async (txt) => { try { await navigator.clipboard.writeText(txt); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
</script>
<style scoped>
.cs-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.preview { display: flex; justify-content: center; padding: 36px 16px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; }
.preview-box { width: 220px; max-width: 70%; padding: 28px 0; text-align: center; background: var(--surface); color: var(--text); border-radius: 12px; font-size: 14px; }
.layers-head { display: flex; gap: 8px; align-items: center; margin: 6px 0 10px; font-size: 13px; color: var(--text-2); }
.layer-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.layer-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.layer-name { font-size: 13px; font-weight: 600; color: var(--text); }
.check { font-size: 13px; color: var(--text-2); display: flex; gap: 6px; align-items: center; }
.color-text { flex: 1; min-width: 140px; }
.sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
.sliders label { font-size: 13px; color: var(--text-2); display: flex; flex-direction: column; gap: 4px; }
.slider-row { display: flex; gap: 8px; align-items: center; }
.slider-row input[type="range"] { flex: 1; min-width: 0; }
.slider-row .num { width: 68px; flex: none; }
input[type="text"], input[type="number"] { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; }
input[type="color"] { width: 42px; height: 34px; padding: 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); cursor: pointer; flex: none; }
.btn { padding: 7px 12px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.del { width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; flex: none; }
.del:disabled { opacity: .4; cursor: not-allowed; }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.notes { color: var(--warning); font-size: 13px; }
.code-head { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px; font-size: 13px; color: var(--text-2); flex-wrap: wrap; gap: 8px; }
.code-btns { display: flex; gap: 6px; }
.code { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-size: 13px; color: var(--text); overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 0; }
.copy { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.mono { font-family: monospace; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .sliders { grid-template-columns: 1fr; } .preview { padding: 28px 12px; } }
</style>
