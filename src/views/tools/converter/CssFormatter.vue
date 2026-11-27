<template>
  <div class="css-formatter">
    <h1>CSS格式化</h1>
    <p class="description">美化、压缩并校验 CSS：按嵌套缩进展开 @media/@keyframes，错误定位到行，注释与字符串原样保留，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="useOutputAsInput" class="btn btn-secondary" :disabled="!result"><span class="icon" aria-hidden="true">↩️</span> 结果作输入</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!result"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="options" aria-label="格式化选项">
        <label>模式
          <select v-model="mode" @change="process">
            <option value="format">美化</option>
            <option value="minify">压缩一行</option>
          </select>
        </label>
        <label v-if="mode === 'format'">缩进
          <select v-model.number="indentSize" @change="process">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
          </select>
        </label>
      </div>
      <div class="panes">
        <textarea v-model="inputText" class="text-input" placeholder="粘贴 CSS，如 .card{color:#333;margin:0 auto}" spellcheck="false" aria-label="输入 CSS" @input="process"></textarea>
        <textarea :value="result ? result.text : ''" class="text-input" placeholder="格式化结果将显示在这里" spellcheck="false" aria-label="格式化结果" readonly></textarea>
      </div>
      <p v-if="result" class="stats">✓ 校验通过 · {{ result.stats.rules }} 条规则 · {{ result.stats.declarations }} 条声明 · 最大嵌套 {{ result.stats.maxDepth }} 层 · 输出 {{ result.stats.lines }} 行<template v-if="mode === 'minify'"> · 体积减少约 {{ result.stats.saved }}%</template></p>
      <ToolExamples :examples="examples" @use-example="useExample" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { formatCss, minifyCss } from '@/utils/cssFormat.js';

const features = [
  { icon: '✅', title: '格式化即校验', description: '大括号不配平、声明缺冒号、字符串/注释未闭合都会报错并定位到行' },
  { icon: '🧱', title: '嵌套正确缩进', description: '@media、@keyframes、CSS 嵌套规则按层级缩进，选择器组合器与逗号规范排版' },
  { icon: '🗜️', title: '美化 / 压缩', description: '一键美化阅读，也可去掉注释与多余空白压缩成一行并给出体积减少比例' },
  { icon: '🔒', title: '纯本地处理', description: 'CSS 不离开浏览器，不上传任何服务器，可放心粘贴线上样式与内部代码' }
];
const usageSteps = ['粘贴 CSS 到左侧输入框', '右侧实时出美化结果并显示规则/声明统计', '报错时按提示的行号修正，或切到压缩模式生成单行 CSS'];
const faqs = [
  { question: '压缩会不会改坏 calc() 里的空格？', answer: '不会。压缩只折叠空白并去掉逗号、组合器旁的空格，calc(100% - 10px) 中运算符两侧的空格会保留，字符串内容也原样不动。' },
  { question: '它校验到什么程度？', answer: '校验结构良构：大括号配平、声明含冒号且有值、选择器非空、注释与字符串闭合。不校验属性名与取值是否符合 CSS 规范。' },
  { question: '支持 CSS 嵌套和 @media 吗？', answer: '支持。解析按通用块结构递归处理，@media/@supports/@keyframes 与原生嵌套规则都能正确分层缩进。' },
  { question: '用中文输入法粘贴的全角符号能处理吗？', answer: '能。字符串与注释之外，全角标点与字母数字（如 ｛｝：；ｒｅｄ）会自动转成半角再解析；字符串里的全角字符原样保留。' },
  { question: '只粘贴几条声明（如 color:red）可以吗？', answer: '可以。顶层裸声明片段末尾分号可省略；自定义属性（如 --empty:;）允许空值，这是合法 CSS，不会误报缺值。' },
  { question: '改错了为什么还显示旧结果？', answer: '报错时保留上一次成功结果方便对照行号修正，修正后会自动刷新；嵌套超过 100 层或输入超过 100 万字符会明确提示而非卡死。' }
];
const examples = [
  { input: '.card{color:#333;margin:0 auto;padding:8px 16px}.card:hover{color:#000}@media (max-width:600px){.card{margin:0;padding:4px}}', output: '.card {\n  color: #333;\n  margin: 0 auto;\n  padding: 8px 16px;\n}\n.card:hover {\n  color: #000;\n}\n@media (max-width:600px) {\n  .card {\n    margin: 0;\n    padding: 4px;\n  }\n}', description: '卡片样式美化（含 @media 嵌套）' },
  { input: '@keyframes fade{from{opacity:0}to{opacity:1}}.box{animation:fade .3s ease-in;content:"a;b"}', output: '@keyframes fade {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n.box {\n  animation: fade .3s ease-in;\n  content: "a;b";\n}', description: '关键帧动画（字符串里的分号不误拆）' }
];
const inputText = ref('');
const result = ref(null);
const statusMessage = ref('');
const statusType = ref('');
const mode = ref('format');
const indentSize = ref(2);
const process = () => {
  if (!inputText.value.trim()) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = mode.value === 'format'
      ? formatCss(inputText.value, { indentSize: indentSize.value })
      : minifyCss(inputText.value);
    statusMessage.value = '✓ 校验通过，处理完成';
    statusType.value = 'success';
  } catch (e) {
    // 出错保留上一次成功结果，方便对照行号修正输入
    statusMessage.value = '✗ ' + e.message + (result.value ? '（已保留上次结果）' : '');
    statusType.value = 'error';
  }
};
const loadExample = () => { inputText.value = examples[0].input; process(); };
const useExample = (ex) => { inputText.value = ex.input; process(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const useOutputAsInput = () => { if (result.value) { inputText.value = result.value.text; process(); } };
const copyOutput = async () => {
  if (!result.value) return;
  try { await navigator.clipboard.writeText(result.value.text); statusMessage.value = '✓ 已复制结果'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.css-formatter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.options { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; font-size: 13px; color: var(--text-2); }
.options select { margin-left: 4px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.stats { margin-top: 10px; font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
