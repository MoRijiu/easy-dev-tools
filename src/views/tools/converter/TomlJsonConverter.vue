<template>
  <div class="toml-json">
    <h1>TOML/JSON 互转</h1>
    <p class="description">TOML 与 JSON 一键互转：支持表、数组表、点分键、多行字符串、日期时间与内联表，错误定位到行，全程本地处理不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <div class="mode-switch" role="tablist" aria-label="转换方向">
          <button :class="['mode-btn', { active: mode === 'toml2json' }]" @click="setMode('toml2json')">TOML → JSON</button>
          <button :class="['mode-btn', { active: mode === 'json2toml' }]" @click="setMode('json2toml')">JSON → TOML</button>
        </div>
        <label v-if="mode === 'toml2json'" class="opt">JSON 缩进
          <select v-model.number="indent" class="select" @change="convert">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
            <option :value="0">压缩</option>
          </select>
        </label>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="swap" class="btn btn-secondary" :disabled="!outputText"><span class="icon">🔄</span> 交换</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputText"><span class="icon">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="panes">
        <textarea v-model="inputText" class="text-input" :placeholder="mode === 'toml2json' ? '粘贴 TOML，如：\ntitle = &quot;app&quot;\n[server]\nport = 8080' : '粘贴 JSON，如 {&quot;title&quot;:&quot;app&quot;,&quot;server&quot;:{&quot;port&quot;:8080}}'" spellcheck="false" aria-label="输入内容" @input="convert"></textarea>
        <textarea :value="outputText" class="text-input output" readonly :placeholder="mode === 'toml2json' ? 'JSON 结果会显示在这里' : 'TOML 结果会显示在这里'" aria-label="输出结果"></textarea>
      </div>
      <p v-if="stats" class="stats">{{ stats }}</p>
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
import { jsonToToml, tomlToJson } from '@/utils/tomlJson.js';

const features = [
  { icon: '🔁', title: '双向互转', description: 'TOML 转 JSON、JSON 转 TOML，一页搞定' },
  { icon: '🧩', title: '常见写法全支持', description: '[表]、[[数组表]]、点分键、多行字符串、十六进制整数、日期时间、内联表与数组' },
  { icon: '🎯', title: '错误定位到行', description: '重复键、重复表、字符串未闭合、无法识别的值都指出行号' },
  { icon: '🔒', title: '纯本地处理', description: '配置常含敏感信息，全部在浏览器本地转换，不上传服务器' }
];
const usageSteps = ['选转换方向（TOML → JSON 可选输出缩进）', '粘贴 TOML 或 JSON，下方实时生成结果', '点「复制结果」取走，或点「交换」把结果作为输入反向再转'];
const faqs = [
  { question: '日期时间转成 JSON 后是字符串？', answer: '是的。JSON 没有日期类型，TOML 的日期时间（如 2026-11-27T10:30:00Z）按原文以字符串保留，不丢信息；反向转换时它仍是普通字符串，会加引号输出。' },
  { question: 'JSON 里有 null 怎么办？', answer: 'TOML 没有 null，本工具会报错并指出字段路径，请先删掉该字段或改成空字符串再转，避免悄悄丢数据。' },
  { question: 'JSON 顶层是数组能转吗？', answer: '不能。TOML 文档顶层必须是一张表（对象）。顶层数组请先包一层对象，如 {"items": [...]}，对象数组会自动输出为 [[items]] 数组表。' },
  { question: '我的配置会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];
const examples = [
  { input: 'title = "app"\n[server]\nport = 8080', output: '{"title":"app","server":{"port":8080}}', description: 'TOML 转 JSON' },
  { input: '{"title":"app","server":{"port":8080}}', output: 'title = "app"\n\n[server]\nport = 8080', description: 'JSON 转 TOML' }
];
const mode = ref('toml2json');
const indent = ref(2);
const inputText = ref('');
const outputText = ref('');
const stats = ref('');
const statusMessage = ref('');
const statusType = ref('');
const countLines = (s) => (s ? s.split('\n').length : 0);
const convert = () => {
  outputText.value = ''; stats.value = '';
  if (!inputText.value.trim()) { statusMessage.value = ''; return; }
  try {
    if (mode.value === 'toml2json') {
      const r = tomlToJson(inputText.value);
      outputText.value = indent.value === 0 ? JSON.stringify(r.data) : JSON.stringify(r.data, null, indent.value);
    } else {
      outputText.value = jsonToToml(inputText.value).toml;
    }
    stats.value = '输入 ' + countLines(inputText.value) + ' 行 → 输出 ' + countLines(outputText.value) + ' 行';
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    statusMessage.value = '✗ ' + e.message;
    statusType.value = 'error';
  }
};
const setMode = (m) => { mode.value = m; convert(); };
const TOML_EXAMPLE = 'title = "my-app"\nversion = "1.2.0"\ndebug = false\ncreated = 2026-11-27T10:30:00Z\n\n[server]\nhost = "localhost"\nports = [8080, 9090]\n\n[[owners]]\nname = "张三"\nrole = "admin"\n\n[[owners]]\nname = "李四"\nrole = "ops"';
const JSON_EXAMPLE = '{\n  "title": "my-app",\n  "debug": false,\n  "server": { "host": "localhost", "ports": [8080, 9090] },\n  "owners": [{ "name": "张三", "role": "admin" }, { "name": "李四", "role": "ops" }]\n}';
const loadExample = () => { inputText.value = mode.value === 'toml2json' ? TOML_EXAMPLE : JSON_EXAMPLE; convert(); };
const useExample = (ex) => {
  mode.value = ex.description.startsWith('JSON') ? 'json2toml' : 'toml2json';
  inputText.value = ex.input; convert();
};
const swap = () => {
  if (!outputText.value) return;
  inputText.value = outputText.value;
  mode.value = mode.value === 'toml2json' ? 'json2toml' : 'toml2json';
  convert();
};
const clearAll = () => { inputText.value = ''; outputText.value = ''; stats.value = ''; statusMessage.value = ''; };
const copyOutput = async () => {
  try { await navigator.clipboard.writeText(outputText.value); statusMessage.value = '✓ 结果已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.toml-json { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.mode-switch { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mode-btn { padding: 6px 12px; border: none; background: var(--bg-soft); color: var(--text-2); font-size: 13px; cursor: pointer; }
.mode-btn.active { background: var(--accent); color: #fff; }
.opt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { background: var(--bg-soft); }
.stats { margin: 10px 0 0; font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
