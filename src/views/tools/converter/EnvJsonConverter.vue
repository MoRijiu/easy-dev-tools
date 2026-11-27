<template>
  <div class="env-json">
    <h1>.env/JSON 互转</h1>
    <p class="description">.env 环境变量与 JSON 一键互转：支持 export 前缀、注释、单/双引号与多行值，重复键会提示，全程本地处理不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <div class="mode-switch" role="tablist" aria-label="转换方向">
          <button :class="['mode-btn', { active: mode === 'env2json' }]" @click="setMode('env2json')">.env → JSON</button>
          <button :class="['mode-btn', { active: mode === 'json2env' }]" @click="setMode('json2env')">JSON → .env</button>
        </div>
        <label v-if="mode === 'env2json'" class="opt">JSON 缩进
          <select v-model.number="indent" class="select" @change="convert"><option :value="2">2 空格</option><option :value="4">4 空格</option><option :value="0">压缩</option></select>
        </label>
        <label v-else class="opt">引号
          <select v-model="quote" class="select" @change="convert"><option value="auto">按需加</option><option value="always">总是加</option><option value="never">不加</option></select>
        </label>
        <label v-if="mode === 'json2env'" class="opt"><input type="checkbox" v-model="sortKeys" @change="convert" /> 键排序</label>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="swap" class="btn btn-secondary" :disabled="!outputText"><span class="icon" aria-hidden="true">🔄</span> 交换</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputText"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="panes">
        <textarea v-model="inputText" class="text-input" :placeholder="mode === 'env2json' ? '粘贴 .env，如：\nAPP_NAME=demo\nPORT=8080' : '粘贴 JSON，如 {&quot;APP_NAME&quot;:&quot;demo&quot;,&quot;PORT&quot;:8080}'" spellcheck="false" aria-label="输入内容" @input="convert"></textarea>
        <textarea :value="outputText" class="text-input output" readonly :placeholder="mode === 'env2json' ? 'JSON 结果会显示在这里' : '.env 结果会显示在这里'" aria-label="输出结果"></textarea>
      </div>
      <p v-if="notes.length" class="notes">{{ notes.join('；') }}</p>
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
import { envToJson, jsonToEnv } from '@/utils/envJson.js';

const features = [
  { icon: '🔁', title: '双向互转', description: '.env 转 JSON、JSON 转 .env，一页搞定' },
  { icon: '🧩', title: '常见写法全支持', description: 'export 前缀、# 注释、单/双引号、双引号转义与引号多行值' },
  { icon: '🎯', title: '错误定位到行', description: '缺 =、键名不合法、引号未闭合等问题直接指出行号；重复键单独提示' },
  { icon: '🔒', title: '纯本地处理', description: '.env 常含密钥，全部在浏览器本地转换，不上传服务器' }
];
const usageSteps = ['选转换方向（JSON → .env 可选引号策略与键排序）', '粘贴 .env 或 JSON，下方实时生成结果', '点「复制结果」取走，或点「交换」把结果作为输入反向再转'];
const faqs = [
  { question: '.env 转 JSON 后数字都变成字符串了？', answer: '.env 本身没有类型，所有值都是字符串，所以 PORT=8080 转出的是 "8080"。反向时 JSON 的数字与布尔会写成 8080、true，null 写成空值。' },
  { question: '值里有空格或 # 怎么办？', answer: '用双引号包起来，如 GREETING="hello # world"；无引号值里空格后的 # 会被当作行尾注释。JSON 转 .env 时这类值会自动加双引号。' },
  { question: '嵌套对象能转成 .env 吗？', answer: '不能。.env 只能存扁平字符串，遇到对象或数组会明确报错指出键名，请先把该值压成 JSON 字符串再转。' },
  { question: '从文档粘来的全角等号、全角引号能认吗？', answer: '能。键名、等号与引号定界符位置的全角字符会按半角处理并给出提示；值内容里的全角字保持原样，不会被改动。单引号与双引号值都支持跨多行。' },
  { question: 'JSON 里同名键重复、数字写了 1e999 会怎样？', answer: '重复键会点名报错（JSON.parse 本会静默只留最后一个值）；1e999 这类溢出成无穷大的数值会被拒绝，超出安全范围的大整数会给出核对提醒。' },
  { question: '转换报错后之前的结果还在吗？', answer: '在。出错只更新上方的错误提示，上一次成功的结果与统计会保留，改好输入重新转换即可覆盖。' },
  { question: '我的 .env 会被上传吗？', answer: '不会。全部转换都在浏览器本地完成，不发送任何网络请求。' }
];
const examples = [
  { input: 'APP_NAME=demo\nPORT=8080\nDEBUG=true', output: '{"APP_NAME":"demo","PORT":"8080","DEBUG":"true"}', description: '.env 转 JSON' },
  { input: '{"APP_NAME":"demo","PORT":8080}', output: 'APP_NAME=demo\nPORT=8080', description: 'JSON 转 .env' }
];
const mode = ref('env2json');
const indent = ref(2);
const quote = ref('auto');
const sortKeys = ref(false);
const inputText = ref('');
const outputText = ref('');
const stats = ref('');
const notes = ref([]);
const statusMessage = ref('');
const statusType = ref('');
const countLines = (s) => (s ? s.split('\n').length : 0);
const convert = () => {
  if (!inputText.value.trim()) { outputText.value = ''; stats.value = ''; notes.value = []; statusMessage.value = ''; return; }
  try {
    if (mode.value === 'env2json') {
      const r = envToJson(inputText.value, indent.value);
      outputText.value = r.json;
      notes.value = r.notes || [];
      stats.value = `共 ${r.uniqueCount} 个键 · 输入 ${countLines(inputText.value)} 行 → 输出 ${countLines(outputText.value)} 行` + (r.duplicates.length ? ` · 重复键（后者生效）：${[...new Set(r.duplicates)].join(', ')}` : '');
    } else {
      const r = jsonToEnv(inputText.value, { quote: quote.value, sortKeys: sortKeys.value });
      outputText.value = r.env.replace(/\n$/, '');
      notes.value = r.warnings || [];
      stats.value = `共 ${r.count} 个键 · 输入 ${countLines(inputText.value)} 行 → 输出 ${r.count} 行`;
    }
    statusMessage.value = '✓ 转换成功';
    statusType.value = 'success';
  } catch (e) {
    // 出错保留上一次成功结果与统计，只更新错误提示
    statusMessage.value = '✗ ' + e.message;
    statusType.value = 'error';
  }
};
const setMode = (m) => { mode.value = m; convert(); };
const ENV_EXAMPLE = '# 应用配置\nAPP_NAME=my-app\nPORT=8080\nDEBUG=false\nexport API_KEY="sk-demo 123"\nGREETING=\'hello # world\'\nEMPTY=\nMULTI="第一行\\n第二行"';
const JSON_EXAMPLE = '{\n  "APP_NAME": "my-app",\n  "PORT": 8080,\n  "DEBUG": false,\n  "GREETING": "hello # world",\n  "EMPTY": null\n}';
const loadExample = () => { inputText.value = mode.value === 'env2json' ? ENV_EXAMPLE : JSON_EXAMPLE; convert(); };
const useExample = (ex) => { mode.value = ex.description.startsWith('JSON') ? 'json2env' : 'env2json'; inputText.value = ex.input; convert(); };
const swap = () => { if (!outputText.value) return; inputText.value = outputText.value; mode.value = mode.value === 'env2json' ? 'json2env' : 'env2json'; convert(); };
const clearAll = () => { inputText.value = ''; outputText.value = ''; stats.value = ''; notes.value = []; statusMessage.value = ''; };
const copyOutput = async () => {
  try { await navigator.clipboard.writeText(outputText.value); statusMessage.value = '✓ 结果已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.env-json { max-width: 1400px; margin: 0 auto; padding: 20px; }
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
.notes { margin: 10px 0 0; color: var(--text-2); font-size: 13px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
