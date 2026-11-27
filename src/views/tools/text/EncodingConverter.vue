<template>
  <div class="enc-converter">
    <h1>编码转换</h1>
    <p class="description">文本与 Hex / Base32 / Base58 互转，按 UTF-8 字节编码，全程本地、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="swap" class="btn btn-secondary" :disabled="!output"><span class="icon" aria-hidden="true">🔄</span> 结果作输入</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!output"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="mode-row" role="group" aria-label="转换方向与格式">
        <div class="seg">
          <button :class="{ active: mode === 'encode' }" @click="mode = 'encode'">编码（文本 →）</button>
          <button :class="{ active: mode === 'decode' }" @click="mode = 'decode'">解码（→ 文本）</button>
        </div>
        <div class="seg">
          <button v-for="f in ENCODING_FORMATS" :key="f.id" :class="{ active: format === f.id }" @click="format = f.id">{{ f.name }}</button>
        </div>
        <label v-if="format === 'hex'" class="check"><input type="checkbox" v-model="hexUpper" /> 大写</label>
        <label v-if="format === 'hex'" class="check"><input type="checkbox" v-model="hexSpaced" /> 空格分隔</label>
      </div>
      <p class="hint">{{ currentFormat.hint }}</p>
      <div class="panels">
        <ToolEditorPanel :title="mode === 'encode' ? '输入文本' : '输入编码'" :info="input ? `${[...input].length} 字符` : ''">
          <textarea v-model="input" class="ta" rows="7" spellcheck="false" :placeholder="mode === 'encode' ? '输入要编码的文本，如 hello 世界' : '粘贴编码字符串，如 68656c6c6f'" aria-label="输入"></textarea>
        </ToolEditorPanel>
        <ToolEditorPanel :title="mode === 'encode' ? '编码结果' : '解码结果'" :info="info">
          <textarea :value="output" class="ta" rows="7" readonly spellcheck="false" placeholder="结果实时显示" aria-label="输出"></textarea>
        </ToolEditorPanel>
      </div>
      <p v-if="error" class="error" role="alert">✗ {{ error }}</p>
      <div v-if="mode === 'encode' && input && !error" class="all-row">
        <span class="all-title">一屏对照：</span>
        <button v-for="row in allRows" :key="row.id" class="all-chip" @click="pickFormat(row.id)" :title="'切换到 ' + row.name">{{ row.name }} <code>{{ row.value || '（空）' }}</code></button>
      </div>
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
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { ENCODING_FORMATS, encodeText, decodeText, encodeAll, textToBytes } from '@/utils/encodingConvert.js';
const features = [
  { icon: '🔣', title: '三种编码互转', description: 'Hex、Base32（RFC 4648）、Base58（Bitcoin 字母表）与 UTF-8 文本互转' },
  { icon: '🌏', title: '中文与 Emoji 安全', description: '先转 UTF-8 字节再编码，中文与 Emoji 不乱码、可完整还原' },
  { icon: '🎯', title: '错误精确定位', description: '非法字符指出位置，Hex 奇数长度、Base32 填充错误都有明确提示' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选择方向（编码/解码）与格式', '输入内容，结果实时生成', '编码时下方一屏对照可直接切换格式', '点「复制结果」带走，或「结果作输入」继续转换'];
const faqs = [
  { question: 'Base58 为什么没有 0、O、I、l？', answer: 'Base58（Bitcoin 字母表）特意去掉这四个易混字符，避免手抄与肉眼辨认出错；解码遇到它们会明确报错。' },
  { question: 'Base32 的 = 是什么？', answer: '是填充符：输出长度补齐到 8 的倍数。解码时可省略结尾填充；带填充时个数必须与数据长度匹配，且结尾多余比特须为 0（规范编码），不对会点名报错。' },
  { question: 'Hex 解码粘贴 0x 前缀或带空格可以吗？', answer: '可以，开头的 0x 前缀与空格会被忽略；下划线只能夹在两个数字之间（如 68_65），开头、结尾或连写的下划线会定位报错。报错位置按原文计算（含前缀与空格）。' },
  { question: '解码报错「不是合法的 UTF-8」是什么意思？', answer: '说明解出的字节不是文本（可能是二进制数据），或编码格式选错了，本工具面向文本互转。' },
  { question: '全角字符能解码吗？', answer: '能。中文输入法下粘来的全角字母数字（如 ６８６５、ＮＢＳＷ）会自动转半角再解码，三种格式都支持。' },
  { question: '输入长度有限制吗？', answer: 'Hex/Base32 上限 100 万字符；Base58 是平方级换算，上限 2 万字符（编码按 UTF-8 字节计），超限会点名报错而不是把页面算死。出错时保留上一次成功结果，不会清空。' }
];
const input = ref(''); const mode = ref('encode'); const format = ref('hex');
const hexUpper = ref(false); const hexSpaced = ref(false);
const statusMessage = ref(''); const statusType = ref('');
const currentFormat = computed(() => ENCODING_FORMATS.find((f) => f.id === format.value));
const output = ref(''); const error = ref('');
watch([input, mode, format, hexUpper, hexSpaced], () => {
  if (!input.value) { output.value = ''; error.value = ''; return; }
  try {
    output.value = mode.value === 'encode'
      ? encodeText(input.value, format.value, { uppercase: hexUpper.value, spaced: hexSpaced.value })
      : decodeText(input.value, format.value);
    error.value = '';
  } catch (e) { error.value = e.message; /* 出错保留旧结果 */ }
}, { immediate: true });
const info = computed(() => {
  if (!input.value || error.value) return '';
  if (mode.value === 'encode') return `${textToBytes(input.value).length} 字节 → ${output.value.length} 字符`;
  return `解出 ${textToBytes(output.value).length} 字节`;
});
const allRows = computed(() => {
  if (mode.value !== 'encode' || !input.value || error.value) return [];
  try {
    const all = encodeAll(input.value, { uppercase: hexUpper.value, spaced: hexSpaced.value });
    return ENCODING_FORMATS.map((f) => ({ id: f.id, name: f.name, value: all[f.id] }));
  } catch { return []; }
});
const pickFormat = (id) => { format.value = id; };
const loadExample = () => { input.value = mode.value === 'encode' ? 'hello 世界' : encodeText('hello 世界', format.value, { uppercase: hexUpper.value, spaced: hexSpaced.value }); };
const swap = () => { if (!output.value) return; input.value = output.value; mode.value = mode.value === 'encode' ? 'decode' : 'encode'; };
const clearAll = () => { input.value = ''; statusMessage.value = ''; };
const copyOutput = async () => { try { await navigator.clipboard.writeText(output.value); statusMessage.value = '✓ 已复制结果'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
</script>
<style scoped>
.enc-converter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.mode-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
.seg { display: flex; gap: 6px; flex-wrap: wrap; }
.seg button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.seg button.active { background: var(--accent, #4f46e5); color: #fff; border-color: transparent; }
.check { font-size: 13px; color: var(--text); display: inline-flex; gap: 4px; align-items: center; }
.hint { font-size: 13px; color: var(--text-2); margin: 4px 0 12px; }
.panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ta { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: ui-monospace, monospace; font-size: 13px; resize: vertical; word-break: break-all; }
.error { color: var(--danger, #dc2626); font-size: 14px; margin: 10px 0 0; }
.all-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
.all-title { font-size: 13px; color: var(--text-2); }
.all-chip { padding: 5px 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.all-chip code { font-family: ui-monospace, monospace; }
@media (max-width: 760px) { .panels { grid-template-columns: 1fr; } h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
