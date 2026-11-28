<template>
  <div class="toml-json">
    <h1>TOML/JSON 互转</h1>
    <p class="description">TOML 与 JSON 一键互转：支持表、数组表、点分键、多行字符串、日期时间与内联表，错误定位到行，全程本地处理不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <div class="mode-switch" role="group" aria-label="转换方向">
          <button :class="['mode-btn', { active: mode === 'toml2json' }]" :aria-pressed="mode === 'toml2json'" @click="setMode('toml2json')">TOML → JSON</button>
          <button :class="['mode-btn', { active: mode === 'json2toml' }]" :aria-pressed="mode === 'json2toml'" @click="setMode('json2toml')">JSON → TOML</button>
        </div>
        <label v-if="mode === 'toml2json'" class="opt">JSON 缩进
          <select v-model.number="indent" class="select" @change="convert">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
            <option :value="0">压缩</option>
          </select>
        </label>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="swap" class="btn btn-secondary" :disabled="!outputText"><span class="icon" aria-hidden="true">🔄</span> 交换</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputText"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage id="toml-json-status" :message="statusMessage" :type="statusType" />
      <div class="panes">
        <textarea v-model="inputText" class="text-input" :placeholder="mode === 'toml2json' ? '粘贴 TOML，如：\ntitle = &quot;app&quot;\n[server]\nport = 8080' : '粘贴 JSON，如 {&quot;title&quot;:&quot;app&quot;,&quot;server&quot;:{&quot;port&quot;:8080}}'" spellcheck="false" aria-label="输入内容" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'toml-json-status' : undefined" @input="convert"></textarea>
        <textarea spellcheck="false" :value="outputText" class="text-input output" readonly :placeholder="mode === 'toml2json' ? 'JSON 结果会显示在这里' : 'TOML 结果会显示在这里'" aria-label="输出结果"></textarea>
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
import { ref, computed } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
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
  { question: '日期时间会做真假校验吗？', answer: '会。月份、每月天数（含闰年 2 月 29 日）、时分秒范围都会按日历校验，2023-02-30、25:00:00 这类不存在的日期时间会点名报错。用空格代替 T 的写法（1979-05-27 07:32:00）同样支持。' },
  { question: '数字写法有哪些讲究？', answer: '按 TOML 规范严格校验：整数不能有前导零（0123 不行）、下划线只能单个夹在数字之间（1_000 可以，1__000 与 100_ 不行）、十六/八/二进制整数不能带正负号、小数点两侧都必须有数字（.5 与 5. 都不行）。' },
  { question: '点分键或内联表建的表能再用 [表头] 补充吗？', answer: '不能。按 TOML 规范，a.b = 1 定义出的表 a、以及内联表 a = {…} 都是封闭的，之后再写 [a] 补键会报错；想分段写请一开始就用 [表头] 组织。同样 [a] 与 [[a]] 不能同名混用。' },
  { question: 'JSON 里有 null 怎么办？', answer: 'TOML 没有 null，本工具会报错并指出字段路径，请先删掉该字段或改成空字符串再转，避免悄悄丢数据。' },
  { question: 'JSON 顶层是数组能转吗？', answer: '不能。TOML 文档顶层必须是一张表（对象）。顶层数组请先包一层对象，如 {"items": [...]}，对象数组会自动输出为 [[items]] 数组表。' },
  { question: '输入大小有限制吗？', answer: '双向都限制在 100 万字符以内，超限会点名提示拆分；配置再大也建议拆成多个文件管理。' },
  { question: '我的配置会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];
const examples = [
  { mode: 'toml2json', input: 'title = "app"\n[server]\nport = 8080', output: '{\n  "title": "app",\n  "server": {\n    "port": 8080\n  }\n}', description: 'TOML 转 JSON' },
  { mode: 'json2toml', input: '{"title":"app","server":{"port":8080}}', output: 'title = "app"\n\n[server]\nport = 8080', description: 'JSON 转 TOML' },
  { mode: 'toml2json', input: 'created = 1979-05-27 07:32:00\nretries = 1_000', output: '{\n  "created": "1979-05-27 07:32:00",\n  "retries": 1000\n}', description: '空格分隔日期时间与下划线数字' }
];
const mode = ref('toml2json');
const indent = ref(2);
const inputText = ref('');
const outputText = ref('');
const stats = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const inputErrorText = ref('');
const setInputError = (msg) => { status.showError(msg); inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const countLines = (s) => (s ? s.split('\n').length : 0);
const convert = () => {
  if (!inputText.value.trim()) { outputText.value = ''; stats.value = ''; statusMessage.value = ''; return; }
  try {
    let out;
    if (mode.value === 'toml2json') {
      const r = tomlToJson(inputText.value);
      out = indent.value === 0 ? JSON.stringify(r.data) : JSON.stringify(r.data, null, indent.value);
    } else {
      out = jsonToToml(inputText.value).toml;
    }
    outputText.value = out;
    stats.value = '输入 ' + countLines(inputText.value) + ' 行 → 输出 ' + countLines(out) + ' 行';
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    // 出错保留上一次的成功结果，只更新状态提示
    setInputError('✗ ' + e.message);
  }
};
const setMode = (m) => { mode.value = m; convert(); };
const TOML_EXAMPLE = 'title = "my-app"\nversion = "1.2.0"\ndebug = false\ncreated = 2026-11-27T10:30:00Z\n\n[server]\nhost = "localhost"\nports = [8080, 9090]\n\n[[owners]]\nname = "张三"\nrole = "admin"\n\n[[owners]]\nname = "李四"\nrole = "ops"';
const JSON_EXAMPLE = '{\n  "title": "my-app",\n  "debug": false,\n  "server": { "host": "localhost", "ports": [8080, 9090] },\n  "owners": [{ "name": "张三", "role": "admin" }, { "name": "李四", "role": "ops" }]\n}';
const loadExample = () => { inputText.value = mode.value === 'toml2json' ? TOML_EXAMPLE : JSON_EXAMPLE; convert(); };
const useExample = (ex) => {
  mode.value = ex.mode || (ex.description.startsWith('JSON') ? 'json2toml' : 'toml2json');
  inputText.value = ex.input; convert();
};
const swap = () => {
  if (!outputText.value) return;
  inputText.value = outputText.value;
  mode.value = mode.value === 'toml2json' ? 'json2toml' : 'toml2json';
  convert();
};
const clearAll = () => { inputText.value = ''; outputText.value = ''; stats.value = ''; statusMessage.value = ''; };
const copyOutput = async () => clipboard.copyText(outputText.value, '✓ 结果已复制');
</script>

<style scoped>
.mode-switch { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mode-btn { padding: 6px 12px; border: none; background: var(--bg-soft); color: var(--text-2); font-size: 13px; cursor: pointer; }
.mode-btn.active { background: var(--accent-solid); color: #fff; }
.opt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { background: var(--bg-soft); }
.stats { margin: 10px 0 0; font-size: 13px; color: var(--text-2); }
</style>
