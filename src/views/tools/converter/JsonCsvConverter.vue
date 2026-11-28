<template>
  <div class="json-csv">
    <h1>JSON/CSV 互转</h1>
    <p class="description">JSON 对象数组与 CSV 表格一键互转：嵌套值自动压平、RFC 4180 引号转义、CSV 转 JSON 可选类型推断，全程本地处理</p>
    <div class="tool-container">
      <ToolToolbar>
        <div class="mode-switch" role="group" aria-label="转换方向">
          <button :class="['mode-btn', { active: mode === 'json2csv' }]" :aria-pressed="mode === 'json2csv'" @click="setMode('json2csv')">JSON → CSV</button>
          <button :class="['mode-btn', { active: mode === 'csv2json' }]" :aria-pressed="mode === 'csv2json'" @click="setMode('csv2json')">CSV → JSON</button>
        </div>
        <label class="opt">分隔符
          <select v-model="delimiter" class="select" @change="convert">
            <option v-for="d in DELIMITERS" :key="d.id" :value="d.id">{{ d.label }}</option>
          </select>
        </label>
        <label v-if="mode === 'csv2json'" class="opt check"><input type="checkbox" v-model="inferTypes" @change="convert" /> 推断数字/布尔/null</label>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="swap" class="btn btn-secondary" :disabled="!outputText"><span class="icon" aria-hidden="true">🔄</span> 交换</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputText"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage id="json-csv-status" :message="statusMessage" :type="statusType" />
      <div class="panes">
        <textarea v-model="inputText" class="text-input" :placeholder="mode === 'json2csv' ? '粘贴 JSON 对象数组，如 [{&quot;name&quot;:&quot;张三&quot;,&quot;age&quot;:18}]' : '粘贴 CSV，第一行是表头，如 name,age\n张三,18'" spellcheck="false" aria-label="输入内容" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'json-csv-status' : undefined" @input="convert"></textarea>
        <textarea spellcheck="false" :value="outputText" class="text-input output" readonly :placeholder="mode === 'json2csv' ? 'CSV 结果会显示在这里' : 'JSON 结果会显示在这里'" aria-label="输出结果"></textarea>
      </div>
      <p v-if="stats" class="stats">{{ stats }}</p>
      <p v-if="warningText" class="warning" role="status" aria-live="polite">⚠ {{ warningText }}</p>
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
import { DELIMITERS, jsonToCsv, csvToJson } from '@/utils/jsonCsv.js';

const features = [
  { icon: '🔁', title: '双向互转', description: 'JSON 对象数组转 CSV、CSV 转 JSON，一页搞定' },
  { icon: '🧩', title: '表头并集', description: '各行字段不一致时自动取并集，缺失字段留空' },
  { icon: '🛡️', title: '规范转义', description: '按 RFC 4180 处理引号、逗号与换行，Excel 可直接打开' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选转换方向与分隔符（CSV 转 JSON 可勾选类型推断）', '粘贴 JSON 或 CSV，下方实时生成结果并显示行列统计', '点「复制结果」取走，或点「交换」把结果作为输入反向再转'];
const faqs = [
  { question: '嵌套对象或数组怎么转成 CSV？', answer: '会用 JSON.stringify 压平成单元格文本（如 {"a":1}）；转回 JSON 时它会是字符串，不会自动还原成对象。' },
  { question: 'CSV 里的数字为什么变成字符串？', answer: '默认保留原文字符串；勾选「推断数字/布尔/null」后，形如 18、3.14、true、null 的单元格会转成对应 JSON 类型，空单元格仍是空字符串。' },
  { question: '某一行列数和表头对不上会怎样？', answer: '列数多于表头会报错并指出行号（多出的内容不会被静默丢弃）；列数不足的行会补空字符串，并在结果下方给出提醒。' },
  { question: '从 Excel 导出的 CSV 第一列列名总带怪字符？', answer: '那是 Excel 常见的 UTF-8 BOM 标记，本工具会自动剥除，不会污染第一个表头名。' },
  { question: '我的数据会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];
const examples = [
  { mode: 'json2csv', input: '[{"name":"张三","age":18},{"name":"李四","city":"上海"}]', output: 'name,age,city\n张三,18,\n李四,,上海', description: 'JSON 转 CSV（表头并集）' },
  { mode: 'csv2json', input: 'name,age\n张三,18\n李四,20', output: '[\n  {\n    "name": "张三",\n    "age": "18"\n  },\n  {\n    "name": "李四",\n    "age": "20"\n  }\n]', description: 'CSV 转 JSON' }
];
const mode = ref('json2csv');
const delimiter = ref(',');
const inferTypes = ref(false);
const inputText = ref('');
const outputText = ref('');
const stats = ref('');
const warningText = ref('');
const statusMessage = ref('');
const statusType = ref('');
const inputErrorText = ref('');
const setInputError = (msg) => { statusMessage.value = msg; statusType.value = 'error'; inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const convert = () => {
  outputText.value = ''; stats.value = ''; warningText.value = '';
  if (!inputText.value.trim()) { statusMessage.value = ''; return; }
  try {
    if (mode.value === 'json2csv') {
      const r = jsonToCsv(inputText.value, delimiter.value);
      outputText.value = r.csv;
      stats.value = '共 ' + r.rowCount + ' 行 × ' + r.headers.length + ' 列（' + r.headers.join(' / ') + '）';
    } else {
      const r = csvToJson(inputText.value, { delimiter: delimiter.value, inferTypes: inferTypes.value });
      outputText.value = JSON.stringify(r.data, null, 2);
      stats.value = '共 ' + r.rowCount + ' 行 × ' + r.headers.length + ' 列（' + r.headers.join(' / ') + '）';
      if (r.warnings && r.warnings.length) warningText.value = r.warnings.join('；');
    }
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    setInputError('✗ ' + e.message);
  }
};
const setMode = (m) => { mode.value = m; convert(); };
const loadExample = () => {
  inputText.value = mode.value === 'json2csv'
    ? '[\n  { "name": "张三", "age": 18, "city": "北京" },\n  { "name": "李四", "age": 20, "note": "喜欢, 逗号" }\n]'
    : 'name,age,city\n张三,18,北京\n李四,20,上海';
  convert();
};
const useExample = (ex) => {
  mode.value = ex.mode || 'json2csv';
  inputText.value = ex.input; convert();
};
const swap = () => {
  if (!outputText.value) return;
  inputText.value = outputText.value;
  mode.value = mode.value === 'json2csv' ? 'csv2json' : 'json2csv';
  convert();
};
const clearAll = () => { inputText.value = ''; outputText.value = ''; stats.value = ''; warningText.value = ''; statusMessage.value = ''; };
const copyOutput = async () => {
  try { await navigator.clipboard.writeText(outputText.value); statusMessage.value = '✓ 结果已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.json-csv { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.mode-switch { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mode-btn { padding: 6px 12px; border: none; background: var(--bg-soft); color: var(--text-2); font-size: 13px; cursor: pointer; }
.mode-btn.active { background: var(--accent-solid); color: #fff; }
.opt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.opt.check { cursor: pointer; }
.select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { background: var(--bg-soft); }
.stats { margin: 10px 0 0; font-size: 13px; color: var(--text-2); }
.warning { margin: 6px 0 0; font-size: 13px; color: var(--warning-text); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
