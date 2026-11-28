<template>
  <div class="url-parser">
    <h1>URL解析</h1>
    <p class="description">把 URL 拆成协议、主机、路径与查询参数，参数可直接编辑并实时重组新 URL，全程本地处理</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyRebuilt" class="btn btn-success" :disabled="!rebuilt"><span class="icon" aria-hidden="true">📋</span> 复制重组URL</button>
      </ToolToolbar>
      <ToolStatusMessage id="url-parser-status" :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="粘贴 URL，如 https://example.com:8080/path?a=1&amp;b=2#top（可省略协议）" spellcheck="false" aria-label="URL输入" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'url-parser-status' : undefined" @input="parse"></textarea>
      <template v-if="result">
        <p v-for="(w, i) in result.warnings" :key="i" class="warn" role="status" aria-live="polite">⚠ {{ w }}</p>
        <table class="kv" aria-label="URL组件">
          <tbody>
            <tr v-for="row in rows" :key="row.label"><th scope="row">{{ row.label }}</th><td><code>{{ row.value || '—' }}</code></td><td><button class="mini" :disabled="!row.value" :aria-label="`复制${row.label}`" @click="copyText(row.value)">复制</button></td></tr>
          </tbody>
        </table>
        <h2 class="sub">查询参数（{{ editableParams.length }} 个，可编辑）</h2>
        <table v-if="editableParams.length" class="kv params" aria-label="查询参数">
          <tbody>
            <tr v-for="(p, i) in editableParams" :key="i">
              <td><input v-model="p.key" class="cell" :aria-label="`第 ${i + 1} 个参数名`" @input="rebuild" /></td>
              <td><input v-model="p.value" class="cell" :aria-label="`第 ${i + 1} 个参数值`" @input="rebuild" /></td>
              <td><button class="mini" :aria-label="`删除第 ${i + 1} 个参数`" @click="removeParam(i)">删除</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">该 URL 没有查询参数，可点下方按钮添加。</p>
        <button class="btn btn-secondary" @click="addParam">+ 添加参数</button>
        <h2 class="sub">重组 URL</h2>
        <textarea spellcheck="false" :value="rebuilt" class="text-input output" readonly aria-label="重组URL"></textarea>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { parseUrl, buildUrl } from '@/utils/urlParse.js';

const features = [
  { icon: '🧩', title: '组件拆解', description: '协议、主机、端口、路径段、锚点一屏看清' },
  { icon: '✏️', title: '参数可编辑', description: '改/删/加查询参数，实时重组出新 URL' },
  { icon: '🔁', title: '重复参数', description: '同名参数多值完整保留，不丢不合并' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴 URL（可省略协议，自动补 https://）', '查看组件拆解表，逐项可复制', '在参数表里修改、删除或添加参数，下方实时生成重组 URL'];
const faqs = [
  { question: '不写协议能解析吗？', answer: '可以。输入 example.com/a?x=1 会自动补 https:// 再解析；localhost:8080/api、127.0.0.1:3000 这类「主机:端口」写法也能正确识别，不会把主机误当协议。' },
  { question: '密码部分会显示吗？', answer: 'URL 里带的用户信息（user:pass@）会拆在组件表里，仅在你本地浏览器显示，不会发送到任何服务器；重组 URL 会原样保留用户信息，分享前请先删掉密码部分。' },
  { question: '重组 URL 和原 URL 为什么可能不完全一样？', answer: '重组会用标准编码重新编码参数（如空格变 +），语义等价；协议、主机（含用户信息）、路径与锚点都会保留。' },
  { question: '端口报错或 % 转义报错是什么意思？', answer: '端口必须是 0–65535 的数字，写了非数字或超范围会点名报错；% 后必须跟两位十六进制（如 %20），%ZZ、%2 这类残缺转义会指出第几个字符有问题，而不是静默保留。' },
  { question: 'mailto: 这类地址为什么解析不了？', answer: 'mailto:/tel: 等是非层级 URL，没有主机与查询参数可拆，本工具会点名说明；它解析的是 http/https 等带 // 主机的 URL。' },
  { question: '没写端口时实际用哪个端口？', answer: '按协议默认端口：http/ws 为 80、https/wss 为 443、ftp 为 21。结果里会给出「有效端口」并提示这是默认端口。' }
];
const examples = [
  { input: 'https://example.com:8080/shop/list?tag=phone&tag=pad&page=2#top', output: 'https://example.com:8080/shop/list?tag=phone&tag=pad&page=2#top', description: '带端口与重复参数的 URL' },
  { input: 'localhost:3000/api/users?active=true', output: 'https://localhost:3000/api/users?active=true', description: '主机:端口写法（自动补 https://）' },
  { input: 'example.com/search?q=%E4%BD%A0%E5%A5%BD', output: 'https://example.com/search?q=%E4%BD%A0%E5%A5%BD', description: '省略协议 + 中文参数（已编码）' }
];
const inputText = ref('');
const result = ref(null);
const editableParams = ref([]);
const rebuilt = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const inputErrorText = ref('');
const setInputError = (msg) => { status.showError(msg); inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const rows = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  return [
    { label: '协议', value: r.protocol }, { label: '主机', value: r.host },
    { label: '域名', value: r.hostname }, { label: '端口', value: r.port || (r.defaultPort ? `（默认 ${r.defaultPort}）` : '') },
    { label: '有效端口', value: r.effectivePort },
    { label: '路径', value: r.pathname }, { label: '路径（解码）', value: r.pathnameDecoded },
    { label: '路径段', value: r.segments.join(' / ') },
    { label: '用户名', value: r.username }, { label: '密码', value: r.password },
    { label: '锚点', value: r.hash }, { label: '锚点（解码）', value: r.hashDecoded },
    { label: '源站 Origin', value: r.origin }
  ];
});
const rebuild = () => {
  if (!result.value) { rebuilt.value = ''; return; }
  try { rebuilt.value = buildUrl(result.value, editableParams.value); } catch (e) { rebuilt.value = ''; }
};
const parse = () => {
  result.value = null; rebuilt.value = ''; editableParams.value = [];
  if (!inputText.value.trim()) { statusMessage.value = ''; return; }
  try {
    result.value = parseUrl(inputText.value);
    editableParams.value = result.value.params.map(p => ({ ...p }));
    rebuild();
    statusMessage.value = '✓ 解析成功' + (result.value.autoProtocol ? '（已自动补 https://）' : '');
    statusType.value = 'success';
  } catch (e) { setInputError('✗ ' + e.message); }
};
const addParam = () => { editableParams.value.push({ key: '', value: '' }); rebuild(); };
const removeParam = (i) => { editableParams.value.splice(i, 1); rebuild(); };
const loadExample = () => { inputText.value = 'https://example.com:8080/shop/list?tag=phone&tag=pad&page=2#top'; parse(); };
const useExample = (ex) => { inputText.value = ex.input; parse(); };
const clearAll = () => { inputText.value = ''; result.value = null; rebuilt.value = ''; editableParams.value = []; statusMessage.value = ''; };
const copyText = async (t) => clipboard.copyText(t, '✓ 已复制');
const copyRebuilt = () => copyText(rebuilt.value);
</script>

<style scoped>
.warn { margin: 10px 0 0; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--warn-soft); color: var(--warning-text); font-size: 13px; }
.text-input { width: 100%; min-height: 64px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { min-height: 52px; background: var(--bg-soft); }
.kv { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 110px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; }
.mini { padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
.cell { width: 100%; padding: 5px 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; box-sizing: border-box; }
.sub { font-size: 1rem; color: var(--text-strong); margin: 16px 0 6px; }
.hint { font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { .kv th { width: 84px; } }
</style>
