<template>
  <div class="html-formatter">
    <h1>HTML格式化</h1>
    <p class="description">美化、压缩并校验 HTML：按嵌套缩进展开，行内元素保持单行，script/style/pre 内容原样保留，标签不匹配等错误定位到行，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="useOutputAsInput" class="btn btn-secondary" :disabled="!result"><span class="icon" aria-hidden="true">↩️</span> 结果作输入</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!result"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage id="html-formatter-status" :message="statusMessage" :type="statusType" />
      <div class="options" role="group" aria-label="格式化选项">
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
        <label v-if="mode === 'minify'" class="check">
          <input type="checkbox" v-model="keepComments" @change="process" /> 保留注释
        </label>
      </div>
      <div class="panes">
        <textarea v-model="inputText" class="text-input" placeholder="粘贴 HTML，如 <div class=&quot;card&quot;><p>你好</p></div>" spellcheck="false" aria-label="输入 HTML" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'html-formatter-status' : undefined" @input="process"></textarea>
        <textarea :value="result ? result.text : ''" class="text-input" placeholder="格式化结果将显示在这里" spellcheck="false" aria-label="格式化结果" readonly></textarea>
      </div>
      <p v-if="result" class="stats">✓ 校验通过 · {{ result.stats.elements }} 个元素 · {{ result.stats.attributes }} 个属性 · 最大嵌套 {{ result.stats.maxDepth }} 层 · 输出 {{ result.stats.lines }} 行<template v-if="mode === 'minify'"> · 体积减少约 {{ result.stats.saved }}%</template></p>
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
import { formatHtml, minifyHtml } from '@/utils/htmlFormat.js';

const features = [
  { icon: '✅', title: '格式化即校验', description: '标签不匹配、未闭合、空元素误加结束标签等都会报错并定位到行' },
  { icon: '🧱', title: '结构清晰缩进', description: '块级元素逐层缩进，文本与行内元素保持单行，阅读结构一目了然' },
  { icon: '🛡️', title: '原始内容不动', description: 'script、style、pre、textarea 的内容原样保留，不重排不转义' },
  { icon: '🔒', title: '纯本地处理', description: 'HTML 不离开浏览器，不上传任何服务器，可放心粘贴线上页面源码' }
];
const usageSteps = ['粘贴 HTML 到左侧输入框', '右侧实时出美化结果并显示元素/属性统计', '报错时按提示的行号修正，或切到压缩模式生成单行 HTML'];
const faqs = [
  { question: '为什么 <p> 里的链接没有另起一行？', answer: 'a、span、strong 等行内元素与相邻文本会保持在同一行，符合 HTML 的排版语义；块级元素才会逐个换行缩进。' },
  { question: '压缩会改动 script 或 pre 里的内容吗？', answer: '不会。script、style、pre、textarea 属于原始文本元素，内容逐字保留；压缩只处理标签之间的空白与普通注释（条件注释始终保留）。' },
  { question: '它校验到什么程度？', answer: '校验标签嵌套匹配、未闭合标签/注释/属性引号、空元素（如 img、br）误写结束标签、同一标签内属性重复等结构问题，并定位到行；不校验标签名与属性是否符合 HTML 规范。' },
  { question: 'li、p 不写结束标签为什么不报错？', answer: 'HTML5 规范允许 li、p、dt/dd、td/th/tr、option 等元素的结束标签省略，遇到同类元素、块级元素或父元素闭合时会自动闭合，本工具按规范处理；div、span 等不可省略的元素未闭合仍会报错。' },
  { question: '从 Word 或中文文档粘来的 HTML 标点是全角的怎么办？', answer: '标签内的全角 ＝、＞、／ 与中文引号 “” ‘’ 会自动按半角符号识别；正文和属性值里的全角字、中文标点原样保留，不会被改动。' },
  { question: '报错后右侧结果为什么还在？', answer: '出错时保留上次成功的结果不清空，方便对照错误提示的行号修正输入；修正后结果会自动更新，清空输入则会一并清掉。' }
];
const examples = [
  { input: '<!DOCTYPE html><html><head><title>示例</title></head><body><div class="card"><h2>标题</h2><p>点 <a href="/x">这里</a> 继续</p><img src="a.png" alt="图"></div></body></html>', output: '<!DOCTYPE html>\n<html>\n  <head>\n    <title>示例</title>\n  </head>\n  <body>\n    <div class="card">\n      <h2>标题</h2>\n      <p>点 <a href="/x">这里</a> 继续</p>\n      <img src="a.png" alt="图">\n    </div>\n  </body>\n</html>', description: '完整页面美化（行内元素保持单行）' },
  { input: '<ul><li>一</li><li>二 <b>粗</b></li></ul><script>if (a < b) { go(); }<' + '/script>', output: '<ul>\n  <li>一</li>\n  <li>二 <b>粗</b></li>\n</ul>\n<script>if (a < b) { go(); }<' + '/script>', description: '列表与脚本（script 内容原样）' }
];
const inputText = ref('');
const result = ref(null);
const statusMessage = ref('');
const statusType = ref('');
const inputErrorText = ref('');
const setInputError = (msg) => { statusMessage.value = msg; statusType.value = 'error'; inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const mode = ref('format');
const indentSize = ref(2);
const keepComments = ref(false);
const process = () => {
  if (!inputText.value.trim()) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = mode.value === 'format'
      ? formatHtml(inputText.value, { indentSize: indentSize.value })
      : minifyHtml(inputText.value, { keepComments: keepComments.value });
    statusMessage.value = '✓ 校验通过，处理完成';
    statusType.value = 'success';
  } catch (e) {
    // 出错保留上次成功结果，方便对照错误行号修正输入
    setInputError('✗ ' + e.message);
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
.html-formatter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.options { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; font-size: 13px; color: var(--text-2); }
.options select { margin-left: 4px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options .check { display: inline-flex; align-items: center; gap: 4px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.stats { margin-top: 10px; font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
