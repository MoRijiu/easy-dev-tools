<template>
  <div class="curl-parser">
    <h1>cURL 解析</h1>
    <p class="description">把 curl 命令拆成方法、URL、请求头、参数与 Body，并一键生成 fetch / Python requests 代码，全程本地处理不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="copyCode" class="btn btn-success" :disabled="!codeText"><span class="icon">📋</span> 复制代码</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="粘贴 curl 命令，如：&#10;curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{&quot;name&quot;:&quot;tom&quot;}'" spellcheck="false" aria-label="curl命令输入" @input="parse"></textarea>
      <template v-if="result">
        <p class="stats">{{ summary }}</p>
        <table class="kv" aria-label="请求概览">
          <tbody>
            <tr><th>方法</th><td><code>{{ result.method }}</code></td></tr>
            <tr><th>URL</th><td><code>{{ result.url }}</code></td></tr>
            <tr v-if="result.user"><th>Basic 认证</th><td><code>{{ result.user }}</code></td></tr>
            <tr v-if="result.bodyType !== 'none'"><th>Body 类型</th><td><code>{{ result.bodyType }}</code></td></tr>
          </tbody>
        </table>
        <template v-if="result.queryParams.length">
          <h2 class="sub">查询参数（{{ result.queryParams.length }}）</h2>
          <table class="kv" aria-label="查询参数"><tbody>
            <tr v-for="(p, i) in result.queryParams" :key="'q' + i"><th>{{ p.name }}</th><td><code>{{ p.value }}</code></td></tr>
          </tbody></table>
        </template>
        <template v-if="result.headers.length">
          <h2 class="sub">请求头（{{ result.headers.length }}）</h2>
          <table class="kv" aria-label="请求头"><tbody>
            <tr v-for="(h, i) in result.headers" :key="'h' + i"><th>{{ h.name }}</th><td><code>{{ h.value }}</code></td></tr>
          </tbody></table>
        </template>
        <template v-if="result.formFields.length">
          <h2 class="sub">表单字段（{{ result.formFields.length }}）</h2>
          <table class="kv" aria-label="表单字段"><tbody>
            <tr v-for="(f, i) in result.formFields" :key="'f' + i"><th>{{ f.name }}</th><td><code>{{ f.file ? '📎 本地文件 ' + f.file + (f.fileType ? '（' + f.fileType + '）' : '') : f.contentFile ? '📄 本地文件内容 ' + f.contentFile : f.value }}</code></td></tr>
          </tbody></table>
        </template>
        <template v-else-if="result.body">
          <h2 class="sub">请求 Body</h2>
          <textarea :value="prettyBody" class="text-input output" readonly aria-label="请求Body"></textarea>
        </template>
        <ul v-if="result.warnings.length" class="warnings-list">
          <li v-for="(w, i) in result.warnings" :key="i">⚠️ {{ w }}</li>
        </ul>
        <p v-if="result.ignored.length" class="hint">已忽略与请求内容无关的选项：{{ result.ignored.join('、') }}</p>
        <h2 class="sub">生成代码</h2>
        <div class="mode-switch" role="tablist" aria-label="代码类型">
          <button :class="['mode-btn', { active: codeKind === 'fetch' }]" @click="codeKind = 'fetch'">JavaScript fetch</button>
          <button :class="['mode-btn', { active: codeKind === 'python' }]" @click="codeKind = 'python'">Python requests</button>
        </div>
        <textarea :value="codeText" class="text-input output code" readonly aria-label="生成代码"></textarea>
      </template>
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
import { parseCurl, toFetch, toPython, buildCurlSummary } from '@/utils/curlParse.js';

const features = [
  { icon: '🧩', title: '结构化拆解', description: '方法、URL、查询参数、请求头、Body 类型一屏看清' },
  { icon: '🔁', title: '代码生成', description: '一键转 JavaScript fetch 与 Python requests 代码' },
  { icon: '🧾', title: '常用选项全覆盖', description: '-X/-H/-d/-F/-u/-A/-b/-G 与 --json、--url-query、--data-urlencode 等常用写法' },
  { icon: '🔒', title: '纯本地处理', description: '命令常含 Token 等敏感信息，全部在浏览器本地解析，不上传服务器' }
];
const usageSteps = ['从浏览器开发者工具或接口文档复制 curl 命令并粘贴', '查看拆解结果：方法、参数、请求头与 Body', '切换 fetch / Python 标签，点「复制代码」取走生成结果'];
const faqs = [
  { question: '支持哪些 curl 选项？', answer: '支持 -X、-H、-d/--data/--data-raw/--data-binary、--data-urlencode、--json、--url-query、-F/--form、-u、-A、-e、-b、-G、-I、--url 等常用选项；-s/-k/-v/-L/--compressed 等与请求内容无关的选项会被忽略并在页面提示。Windows 复制的 curl.exe 开头与文档里带 $ 提示符的命令也能直接粘贴。' },
  { question: '没写 -X 时方法怎么判断？', answer: '带 -d、--json 或 -F 时推断为 POST，带 -I 时为 HEAD，带 -G 时为 GET，其余为 GET；带 -G 时 -d 的内容会并入查询参数，与 curl 行为一致。--url-query 的参数则始终追加到 URL 查询串。' },
  { question: '--json 是什么写法？', answer: 'curl 7.82 起的快捷选项：--json \'{"a":1}\' 等价于 -d 数据并自动带上 Content-Type: application/json 与 Accept: application/json 两个请求头（已显式设置同名头时以显式为准），方法推断为 POST。' },
  { question: '-d @文件、-F 字段=@文件 是什么意思？', answer: '@ 开头表示数据来自本地文件（如 -d @data.json 从文件读 Body、-F file=@a.png 上传文件），<文件（如 -F note=<note.txt）表示把文件内容作为字段值。本工具在浏览器本地运行、读不到你的本地文件，会点名警告并保留占位：fetch 代码里留 TODO 替换点，Python 代码会生成 open(...) 读取写法。--data-raw 的 @ 是例外，按字面量处理。' },
  { question: 'URL 里带账号密码会怎样？', answer: '形如 https://user:pass@host 的内嵌用户信息会被提取为 Basic 认证并从 URL 中移除（fetch 不允许使用带凭据的 URL）：拆解表里显示在「Basic 认证」行，fetch 代码生成 Authorization 头、Python 代码生成 auth 参数；若同时写了 -u，以 -u 为准。生成代码含明文凭据，分享前请先脱敏。' },
  { question: '命令里的 Token 会被上传吗？', answer: '不会。解析与代码生成都在浏览器本地完成，不发送任何网络请求；但把生成代码分享给他人前，请先自行脱敏。' },
  { question: 'Windows cmd 里复制的命令能用吗？', answer: 'PowerShell / bash / zsh 复制的命令可直接粘贴（含反斜杠换行）。cmd 的 ^ 换行与双引号转义规则不同，可能需要先把 ^ 换成反斜杠或改成一行。' }
];
const examples = [
  { input: "curl -X POST https://api.example.com/v1/users -H 'Content-Type: application/json' -d '{\"name\":\"tom\"}'", output: 'POST · application/json', description: 'POST JSON 请求' },
  { input: "curl --json '{\"name\":\"tom\"}' https://api.example.com/v1/users", output: 'POST · application/json · 自动补 2 个请求头', description: '--json 快捷写法' },
  { input: "curl -G https://example.com/search -d 'q=hello' -d 'page=2'", output: 'GET · 查询参数 2 项', description: '-G 查询请求' },
  { input: "curl https://example.com/upload -F 'file=@avatar.png' -F 'desc=头像'", output: 'POST · multipart/form-data · 含本地文件字段', description: '文件上传（@ 表示本地文件）' }
];
const inputText = ref('');
const result = ref(null);
const codeKind = ref('fetch');
const statusMessage = ref('');
const statusType = ref('');
const summary = computed(() => (result.value ? buildCurlSummary(result.value) : ''));
const prettyBody = computed(() => {
  if (!result.value) return '';
  return result.value.bodyJson ? JSON.stringify(result.value.bodyJson, null, 2) : result.value.body;
});
const codeText = computed(() => {
  if (!result.value) return '';
  return codeKind.value === 'fetch' ? toFetch(result.value) : toPython(result.value);
});
const parse = () => {
  if (!inputText.value.trim()) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = parseCurl(inputText.value);
    statusMessage.value = '✓ 解析成功';
    statusType.value = 'success';
  } catch (e) { statusMessage.value = '✗ ' + e.message; statusType.value = 'error'; }
};
const EXAMPLE = "curl -X POST 'https://api.example.com/v1/users?page=1' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer demo-token' \\\n  -d '{\"name\":\"张三\",\"age\":18}'";
const loadExample = () => { inputText.value = EXAMPLE; parse(); };
const useExample = (ex) => { inputText.value = ex.input; parse(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const copyCode = async () => {
  try { await navigator.clipboard.writeText(codeText.value); statusMessage.value = '✓ 代码已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.curl-parser { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.text-input { width: 100%; min-height: 110px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { min-height: 72px; background: var(--bg-soft); }
.text-input.code { min-height: 180px; }
.kv { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 150px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; word-break: break-all; }
.kv code { word-break: break-all; color: var(--text); }
.sub { font-size: 1rem; color: var(--text-strong); margin: 16px 0 6px; }
.stats { margin: 10px 0 0; font-size: 13px; color: var(--text-2); word-break: break-all; }
.hint { font-size: 13px; color: var(--text-2); }
.warnings-list { margin: 12px 0 0; padding: 10px 14px 10px 30px; background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; line-height: 1.7; }
.mode-switch { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
.mode-btn { padding: 6px 12px; border: none; background: var(--bg-soft); color: var(--text-2); font-size: 13px; cursor: pointer; }
.mode-btn.active { background: var(--accent); color: #fff; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { width: 96px; } }
</style>
