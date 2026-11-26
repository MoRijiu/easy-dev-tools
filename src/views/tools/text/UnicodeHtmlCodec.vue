<template>
  <div class="unicode-html-codec">
    <h1>Unicode / HTML 实体编解码</h1>
    <p class="description">文本与 Unicode 转义、HTML 实体互转，支持命名/十进制/十六进制实体与代理对；全程本地处理，不上传服务器</p>

    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="swapContent" class="btn btn-info" :disabled="!outputText"><span class="icon">🔄</span> 交换</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputText"><span class="icon">📋</span> 复制结果</button>
      </ToolToolbar>

      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <div class="mode-row" role="tablist" aria-label="转换模式">
        <button v-for="m in modes" :key="m.id" class="mode-btn" :class="{ active: mode === m.id }" role="tab" :aria-selected="mode === m.id" @click="setMode(m.id)">{{ m.label }}</button>
      </div>

      <div v-if="mode === 'unicode-encode'" class="option-row">
        <label class="check-label">范围
          <select v-model="unicodeScope" class="small-select" aria-label="Unicode 编码范围" @change="convert">
            <option value="nonAscii">仅非 ASCII</option>
            <option value="all">全部字符</option>
          </select>
        </label>
        <label class="check-label">形式
          <select v-model="unicodeStyle" class="small-select" aria-label="Unicode 编码形式" @change="convert">
            <option value="escape">\uXXXX</option>
            <option value="brace">\u&#123;...&#125;</option>
          </select>
        </label>
      </div>
      <div v-if="mode === 'html-encode'" class="option-row">
        <label class="check-label">实体形式
          <select v-model="htmlMode" class="small-select" aria-label="HTML 实体形式" @change="convert">
            <option value="named">命名优先</option>
            <option value="decimal">十进制 &amp;#...;</option>
            <option value="hex">十六进制 &amp;#x...;</option>
          </select>
        </label>
      </div>
      <p v-if="mode === 'unicode-decode'" class="option-note">可识别 \uXXXX、\u&#123;...&#125; 与 \xXX，代理对会自动合并为完整字符。</p>
      <p v-if="mode === 'html-decode'" class="option-note">支持命名实体（如 &amp;copy;）、十进制与十六进制数字实体；未知实体会原样保留。</p>

      <ToolEditorLayout>
        <ToolEditorPanel title="输入内容" :info="inputText.length + ' 字符'">
          <textarea v-model="inputText" class="text-input" placeholder="在此输入要转换的文本或转义序列..." spellcheck="false" aria-label="输入内容" @input="convert"></textarea>
        </ToolEditorPanel>
        <ToolEditorPanel title="输出结果" :info="outputText.length + ' 字符'">
          <div class="text-output-wrapper">
            <pre v-if="outputText" class="text-output">{{ outputText }}</pre>
            <div v-else class="placeholder">转换结果将显示在这里</div>
          </div>
        </ToolEditorPanel>
      </ToolEditorLayout>

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
import ToolEditorLayout from '@/components/ToolEditorLayout.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { convertUnicodeHtml } from '@/utils/unicodeHtml.js';

const modes = [
  { id: 'unicode-encode', label: 'Unicode 编码' },
  { id: 'unicode-decode', label: 'Unicode 解码' },
  { id: 'html-encode', label: 'HTML 实体编码' },
  { id: 'html-decode', label: 'HTML 实体解码' }
];

const features = [
  { icon: '🔤', title: '四种转换', description: 'Unicode 转义编码/解码与 HTML 实体编码/解码一站完成' },
  { icon: '😀', title: '星平面字符', description: 'Emoji 等星平面字符自动处理代理对，也支持 \\u{...} 形式' },
  { icon: '🏷️', title: '命名实体表', description: '内置常用命名实体，编码可优先用 &copy; 这类可读形式' },
  { icon: '🔒', title: '纯本地处理', description: '文本不离开浏览器，不上传任何服务器' }
];

const usageSteps = [
  '先在上方选择转换模式：Unicode 编码 / 解码或 HTML 实体编码 / 解码',
  '在左侧输入文本，右侧实时显示转换结果',
  '编码时可调整范围与实体形式；点「交换」可把结果送回输入继续转换',
  '点「复制结果」一键复制输出'
];

const faqs = [
  { question: 'Unicode 编码里的 \\uD83D\\uDE00 是什么？', answer: '这是代理对：超出基本平面的字符（如 Emoji）用两个 \\uXXXX 表示。解码时本工具会自动把代理对合并回完整字符，也支持 ES6 的 \\u{1f600} 写法。' },
  { question: 'HTML 命名、十进制、十六进制实体有什么区别？', answer: '同一个字符可以写成 &copy;、&#169; 或 &#xA9;，浏览器渲染结果一致。命名形式最易读，但只有部分字符有名字；没有命名实体的字符会回退为十进制数字实体。' },
  { question: '解码时遇到不认识的实体会怎样？', answer: 'HTML 解码会把未知实体原样保留，不会丢内容；Unicode 解码遇到不完整或越界的转义会给出具体位置的错误提示。' },
  { question: '我的文本会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];

const examples = [
  { input: '中文', output: '\\u4E2D\\u6587', description: 'Unicode 编码示例' },
  { input: '&copy; 2026', output: '© 2026', description: 'HTML 实体解码示例' },
  { input: '<b>加粗</b>', output: '&lt;b&gt;加粗&lt;/b&gt;', description: 'HTML 实体编码示例' }
];

const mode = ref('unicode-encode');
const unicodeScope = ref('nonAscii');
const unicodeStyle = ref('escape');
const htmlMode = ref('named');
const inputText = ref('');
const outputText = ref('');
const statusMessage = ref('');
const statusType = ref('');

const convert = () => {
  outputText.value = '';
  if (!inputText.value) { statusMessage.value = ''; return; }
  try {
    outputText.value = convertUnicodeHtml(inputText.value, mode.value, {
      scope: unicodeScope.value, style: unicodeStyle.value, mode: htmlMode.value
    });
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    statusMessage.value = '✗ ' + e.message;
    statusType.value = 'error';
  }
};

const setMode = (m) => { mode.value = m; convert(); };
const loadExample = () => { inputText.value = '你好 © 2026 😀'; if (mode.value.endsWith('decode')) mode.value = 'unicode-encode'; convert(); };
const useExample = (ex) => {
  inputText.value = ex.input;
  if (ex.description.includes('解码')) mode.value = 'html-decode';
  else if (ex.description.includes('HTML')) mode.value = 'html-encode';
  else mode.value = 'unicode-encode';
  convert();
};
const clearAll = () => { inputText.value = ''; outputText.value = ''; statusMessage.value = ''; };
const swapContent = () => { if (!outputText.value) return; inputText.value = outputText.value; convert(); };
const copyOutput = async () => {
  try { await navigator.clipboard.writeText(outputText.value); statusMessage.value = '✓ 结果已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.unicode-html-codec { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.mode-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.mode-btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-soft); color: var(--text); font-size: 13px; cursor: pointer; }
.mode-btn:hover { border-color: var(--accent); }
.mode-btn.active { background: var(--accent); color: var(--on-accent, #fff); border-color: var(--accent); }
.option-row { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
.check-label { display: flex; align-items: center; gap: 6px; color: var(--text-2); font-size: 13px; }
.small-select { padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.option-note { color: var(--text-2); font-size: 13px; margin: 0 0 12px; }
.text-input { width: 100%; min-height: 180px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; box-sizing: border-box; resize: vertical; }
.text-output-wrapper { min-height: 180px; }
.text-output { margin: 0; white-space: pre-wrap; word-break: break-all; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; color: var(--text); }
.placeholder { color: var(--text-2); font-size: 14px; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
