<template>
  <div class="case-converter">
    <h1>命名格式转换</h1>
    <p class="description">变量名、函数名、文件名一键互转：camelCase、snake_case、kebab-case 等 12 种风格一屏对照；支持多行批量，全程本地处理</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyAll" class="btn btn-success" :disabled="!hasResult"><span class="icon" aria-hidden="true">📋</span> 复制全部</button>
      </ToolToolbar>
      <ToolStatusMessage id="case-converter-status" :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="输入标识符或短语，每行一个，如 user_name / getUserInfo / HTTP server config" spellcheck="false" aria-label="输入内容" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'case-converter-status' : undefined" @input="convert"></textarea>
      <p v-if="statsText" class="stats-line">{{ statsText }}</p>
      <p v-for="(w, i) in warnings" :key="i" class="warning-line" role="alert">⚠ {{ w }}</p>
      <div v-if="hasResult" class="result-list">
        <div v-for="row in results" :key="row.id" class="result-row">
          <span class="row-label">{{ row.label }}</span>
          <code class="row-value">{{ row.value }}</code>
          <button class="copy-btn" @click="copyOne(row)" :aria-label="'复制 ' + row.label">复制</button>
        </div>
      </div>
      <div v-else class="placeholder">输入后这里会同时列出 12 种命名风格的转换结果</div>
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
import { convertCase, analyzeCaseInput, MAX_INPUT_CHARS, MAX_INPUT_LINES } from '@/utils/caseConvert.js';

const features = [
  { icon: '🔤', title: '12 种风格', description: '驼峰、下划线、短横线、常量、标题、点分隔、路径等一屏对照' },
  { icon: '✂️', title: '智能拆词', description: '自动识别驼峰边界与 HTTPServer 这类缩略词边界' },
  { icon: '📚', title: '多行批量', description: '每行一个标识符，逐行转换不串行' },
  { icon: '🔒', title: '纯本地处理', description: '文本不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['在输入框粘贴标识符或短语（可多行，每行一个）', '下方实时列出 12 种命名风格的结果', '点某一行「复制」取单个结果，或「复制全部」带标签复制整表'];
const faqs = [
  { question: 'HTTPServer 为什么会拆成 HTTP + Server？', answer: '连续大写通常是缩略词（如 HTTP、URL、API），本工具会在缩略词与后续首字母大写单词之间切分，避免拼出 Httpserver 这类结果。' },
  { question: '数字和中文怎么处理？', answer: '数字会并入相邻单词（如 version2、sha256Hash 拆为 sha256 + Hash）。中文、带重音字母等 Unicode 字母会原样保留参与转换，不再被静默丢弃；下划线、连字符、空格、点、斜杠等符号按分隔符处理。' },
  { question: '某一行只有符号（如 !!!）会怎样？', answer: '这类行拆不出任何单词，结果为空行，页面会点名提示行号，不会再假报「转换成功」。多数语言的标识符也不能以数字开头，以数字开头的行同样会收到提示。' },
  { question: '我的文本会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];
const examples = [
  { input: 'user_name', output: 'userName / UserName / USER_NAME', description: '下划线转驼峰示例' },
  { input: 'getHTTPResponseCode', output: 'get_http_response_code', description: '驼峰含缩略词示例' },
  { input: 'my-component-name', output: 'myComponentName', description: '短横线转驼峰示例' },
  { input: 'café menu item', output: 'caféMenuItem / café_menu_item', description: '带重音字母原样保留示例' }
];
const inputText = ref('');
const results = ref([]);
const statusMessage = ref('');
const statusType = ref('');
const inputErrorText = ref('');
const setInputError = (msg) => { statusMessage.value = msg; statusType.value = 'error'; inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const statsText = ref('');
const warnings = ref([]);
const hasResult = computed(() => results.value.some(r => r.value.trim()));
const convert = () => {
  warnings.value = []; statsText.value = '';
  if (!inputText.value.trim()) { results.value = []; statusMessage.value = ''; return; }
  const info = analyzeCaseInput(inputText.value);
  if (info.tooLong || info.tooManyLines) {
    setInputError(`✗ 输入过大：最多 ${MAX_INPUT_CHARS} 个字符 / ${MAX_INPUT_LINES} 行，已保留上次结果`);
    return;
  }
  if (!info.wordCount) {
    results.value = [];
    setInputError('✗ 没有可转换的内容：输入里没有字母或数字（如纯符号行），请检查行 ' + info.emptyResultLines.join('、'));
    return;
  }
  results.value = convertCase(inputText.value);
  statsText.value = `${info.lineCount} 行 · 共识别 ${info.wordCount} 个单词`;
  if (info.emptyResultLines.length) warnings.value.push(`第 ${info.emptyResultLines.join('、')} 行只有符号、拆不出单词，结果中为空行`);
  if (info.leadingDigitLines.length) warnings.value.push(`第 ${info.leadingDigitLines.join('、')} 行以数字开头：多数语言的标识符不能以数字开头，转换结果仅供参考`);
  statusMessage.value = '✓ 转换成功';
  statusType.value = 'success';
};
const loadExample = () => { inputText.value = 'user_name\ngetHTTPResponseCode\nmy-component-name'; convert(); };
const useExample = (ex) => { inputText.value = ex.input; convert(); };
const clearAll = () => { inputText.value = ''; results.value = []; statusMessage.value = ''; statsText.value = ''; warnings.value = []; };
const copyText = async (text, okMsg) => {
  try { await navigator.clipboard.writeText(text); statusMessage.value = okMsg; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
const copyOne = (row) => copyText(row.value, '✓ 已复制 ' + row.label);
// 多行结果用「标签行 + 内容」分块，避免旧版 label: 后直接拼多行文本导致行与风格对不上
const copyAll = () => copyText(results.value.map(r => r.label.split(' ')[0] + ':\n' + r.value).join('\n\n'), '✓ 全部结果已复制');
</script>

<style scoped>
.case-converter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.stats-line { color: var(--text-2); font-size: 12px; margin: 0 0 6px; }
.warning-line { color: var(--warning-text); background: var(--warning-soft); font-size: 12px; margin: 0 0 6px; padding: 6px 8px; border-radius: 6px; }
.text-input { width: 100%; min-height: 96px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; box-sizing: border-box; resize: vertical; margin-bottom: 14px; }
.result-list { display: flex; flex-direction: column; gap: 6px; }
.result-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-soft); }
.row-label { flex: 0 0 168px; color: var(--text-2); font-size: 12px; }
.row-value { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all; font-size: 13px; color: var(--text); }
.copy-btn { flex: 0 0 auto; padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.copy-btn:hover { border-color: var(--accent); color: var(--accent-text); }
.placeholder { color: var(--text-2); font-size: 14px; padding: 12px 0; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .row-label { flex-basis: 118px; } }
</style>
