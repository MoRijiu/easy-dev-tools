<template>
  <div class="yaml-json">
    <h1>YAML/JSON 互转</h1>
    <p class="description">YAML 与 JSON 一键互转：支持嵌套映射/序列、流式写法、引号字符串、注释与块标量，全程本地处理不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <div class="mode-switch" role="tablist" aria-label="转换方向">
          <button :class="['mode-btn', { active: mode === 'yaml2json' }]" @click="setMode('yaml2json')">YAML → JSON</button>
          <button :class="['mode-btn', { active: mode === 'json2yaml' }]" @click="setMode('json2yaml')">JSON → YAML</button>
        </div>
        <label v-if="mode === 'yaml2json'" class="opt">JSON 缩进
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
        <textarea v-model="inputText" class="text-input" :placeholder="mode === 'yaml2json' ? '粘贴 YAML，如：\nname: app\nports:\n  - 80\n  - 443' : '粘贴 JSON，如 {&quot;name&quot;:&quot;app&quot;,&quot;ports&quot;:[80,443]}'" spellcheck="false" aria-label="输入内容" @input="convert"></textarea>
        <textarea :value="outputText" class="text-input output" readonly :placeholder="mode === 'yaml2json' ? 'JSON 结果会显示在这里' : 'YAML 结果会显示在这里'" aria-label="输出结果"></textarea>
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
import { jsonToYaml, yamlToJson } from '@/utils/yamlJson.js';

const features = [
  { icon: '🔁', title: '双向互转', description: 'YAML 转 JSON、JSON 转 YAML，一页搞定' },
  { icon: '🧩', title: '常见子集全支持', description: '嵌套映射/序列、流式 [ ] { }、引号字符串、注释、| 与 > 块标量' },
  { icon: '🎯', title: '错误定位到行', description: '缩进、引号未闭合、Tab 缩进等问题直接指出行号' },
  { icon: '🔒', title: '纯本地处理', description: '配置常含敏感信息，全部在浏览器本地转换，不上传服务器' }
];
const usageSteps = ['选转换方向（YAML → JSON 可选输出缩进）', '粘贴 YAML 或 JSON，下方实时生成结果', '点「复制结果」取走，或点「交换」把结果作为输入反向再转'];
const faqs = [
  { question: '支持哪些 YAML 写法？', answer: '支持日常配置的绝大多数写法：缩进映射与序列、序列里嵌映射、[1, 2] 与 {a: 1} 流式写法、单/双引号字符串、# 注释、| 与 > 块标量（含 |- 去尾换行、|+ 保留空行）、--- 文档标记。锚点(&)、别名(*)与标签(!)暂不支持，遇到会明确报错而不是悄悄转错。' },
  { question: 'YAML 里的 007 转成 JSON 变字符串了？', answer: '是故意的：007、0123 这类带前导零的值在 YAML 里容易被误读成八进制，本工具按字符串保留原文，避免配置悄悄变值。0xFF 这类明确的十六进制写法会转成数字 255。' },
  { question: '重复键和多个文档会怎样？', answer: '同一映射里出现重复键会点名报错并指出两次定义的行号，不会像旧版那样静默用后一个值覆盖；一份输入里有多个 --- 文档也会报错，本工具只转单文档，请拆开逐个转换。' },
  { question: '块标量结尾的换行怎么算？', answer: '按 YAML 规范：| 默认保留一个结尾换行（clip），|- 去掉结尾换行，|+ 连文末空行一并保留；> 折叠时段内换行变空格、空行仍保留为换行。' },
  { question: '我的配置会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];
const examples = [
  { mode: 'yaml2json', input: 'name: app\nports:\n  - 80\n  - 443', output: '{"name":"app","ports":[80,443]}', description: 'YAML 转 JSON' },
  { mode: 'json2yaml', input: '{"name":"app","debug":true}', output: 'name: app\ndebug: true', description: 'JSON 转 YAML' },
  { mode: 'yaml2json', input: 'note: |-\n  第一行\n  第二行', output: '{"note":"第一行\\n第二行"}', description: '块标量 |- 去尾换行' }
];
const mode = ref('yaml2json');
const indent = ref(2);
const inputText = ref('');
const outputText = ref('');
const stats = ref('');
const statusMessage = ref('');
const statusType = ref('');
const countLines = (s) => (s ? s.split('\n').length : 0);
const convert = () => {
  if (!inputText.value.trim()) { outputText.value = ''; stats.value = ''; statusMessage.value = ''; return; }
  try {
    if (mode.value === 'yaml2json') {
      const r = yamlToJson(inputText.value);
      outputText.value = indent.value === 0 ? JSON.stringify(r.data) : JSON.stringify(r.data, null, indent.value);
      stats.value = '顶层为' + r.topType + ' · 输入 ' + countLines(inputText.value) + ' 行 → 输出 ' + countLines(outputText.value) + ' 行';
    } else {
      const r = jsonToYaml(inputText.value);
      outputText.value = r.yaml;
      stats.value = '顶层为' + r.topType + ' · 输入 ' + countLines(inputText.value) + ' 行 → 输出 ' + countLines(outputText.value) + ' 行';
    }
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    statusMessage.value = '✗ ' + e.message;
    statusType.value = 'error';
  }
};
const setMode = (m) => { mode.value = m; convert(); };
const YAML_EXAMPLE = 'name: my-app\nversion: 1.2.0\ndebug: false\nserver:\n  host: localhost\n  ports:\n    - 8080\n    - 9090\ntags: [dev, test]\nowner:\n  name: 张三\n  roles:\n    - admin\n    - ops';
const JSON_EXAMPLE = '{\n  "name": "my-app",\n  "version": "1.2.0",\n  "debug": false,\n  "server": { "host": "localhost", "ports": [8080, 9090] },\n  "owner": { "name": "张三", "roles": ["admin", "ops"] }\n}';
const loadExample = () => { inputText.value = mode.value === 'yaml2json' ? YAML_EXAMPLE : JSON_EXAMPLE; convert(); };
const useExample = (ex) => {
  mode.value = ex.mode || (ex.description.startsWith('JSON') ? 'json2yaml' : 'yaml2json');
  inputText.value = ex.input; convert();
};
const swap = () => {
  if (!outputText.value) return;
  inputText.value = outputText.value;
  mode.value = mode.value === 'yaml2json' ? 'json2yaml' : 'yaml2json';
  convert();
};
const clearAll = () => { inputText.value = ''; outputText.value = ''; stats.value = ''; statusMessage.value = ''; };
const copyOutput = async () => {
  try { await navigator.clipboard.writeText(outputText.value); statusMessage.value = '✓ 结果已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.yaml-json { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
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
