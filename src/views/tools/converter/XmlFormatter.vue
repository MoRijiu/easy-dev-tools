<template>
  <div class="xml-formatter">
    <h1>XML格式化</h1>
    <p class="description">美化、压缩并校验 XML：标签嵌套缩进、错误定位到行，注释与 CDATA 原样保留，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="useOutputAsInput" class="btn btn-secondary" :disabled="!result"><span class="icon">↩️</span> 结果作输入</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!result"><span class="icon">📋</span> 复制结果</button>
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
        <textarea v-model="inputText" class="text-input" placeholder="粘贴 XML，如 <note><to>Tom</to><body>Hi</body></note>" spellcheck="false" aria-label="输入 XML" @input="process"></textarea>
        <textarea :value="result ? result.text : ''" class="text-input" placeholder="格式化结果将显示在这里" spellcheck="false" aria-label="格式化结果" readonly></textarea>
      </div>
      <p v-if="result" class="stats">✓ 校验通过 · {{ result.stats.elements }} 个元素 · {{ result.stats.attributes }} 个属性 · 最大深度 {{ result.stats.maxDepth }} · 输出 {{ result.stats.lines }} 行</p>
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
import { formatXml, minifyXml } from '@/utils/xmlFormat.js';

const features = [
  { icon: '✅', title: '格式化即校验', description: '标签不匹配、未闭合、多根元素、属性缺引号都会报错并定位到行' },
  { icon: '🧱', title: '按嵌套缩进', description: '纯文本元素自动内联成一行，子元素逐层缩进，声明/注释/CDATA 各占一行' },
  { icon: '🗜️', title: '美化 / 压缩', description: '一键美化阅读，也可去掉标签间空白压缩成一行' },
  { icon: '🔒', title: '纯本地处理', description: 'XML 不离开浏览器，不上传任何服务器，可放心粘贴接口报文与配置' }
];
const usageSteps = ['粘贴 XML 到左侧输入框', '右侧实时出美化结果并显示校验统计', '报错时按提示的行号修正，或切到压缩模式生成单行 XML'];
const faqs = [
  { question: '它校验到什么程度？', answer: '校验良构性（well-formed）：标签嵌套匹配、单个根元素、属性引号闭合、注释/CDATA 闭合等。不做 DTD/XSD 模式校验。' },
  { question: '为什么提示多个根元素？', answer: '标准 XML 文档只能有一个根元素。接口返回的片段如果是多段，请先在外面包一层任意根标签再格式化。' },
  { question: 'CDATA 和注释会被改动吗？', answer: '不会。注释、CDATA、DOCTYPE 与处理指令在分词阶段整体保留，内容原样输出。' }
];
const examples = [
  { input: '<?xml version="1.0" encoding="UTF-8"?><note><to>Tom</to><from>Jerry</from><body lang="zh">Don\'t forget <b>this</b> weekend!</body><attach size="12"/></note>', output: '<?xml version="1.0" encoding="UTF-8"?>\n<note>\n  <to>Tom</to>\n  <from>Jerry</from>\n  <body lang="zh">\n    Don\'t forget\n    <b>this</b>\n    weekend!\n  </body>\n  <attach size="12"/>\n</note>', description: '便签 XML 美化（混合内容文本独立成行）' },
  { input: '<config><server host="localhost" port="8080"/><debug>true</debug></config>', output: '<config>\n  <server host="localhost" port="8080"/>\n  <debug>true</debug>\n</config>', description: '配置 XML（属性与自闭合标签）' }
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
      ? formatXml(inputText.value, { indentSize: indentSize.value })
      : minifyXml(inputText.value);
    statusMessage.value = '✓ 校验通过，处理完成';
    statusType.value = 'success';
  } catch (e) {
    result.value = null;
    statusMessage.value = '✗ ' + e.message;
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
.xml-formatter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.options { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; font-size: 13px; color: var(--text-2); }
.options select { margin-left: 4px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.stats { margin-top: 10px; font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
