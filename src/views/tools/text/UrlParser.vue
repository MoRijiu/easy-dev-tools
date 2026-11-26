<template>
  <div class="url-parser">
    <h1>URL解析</h1>
    <p class="description">把 URL 拆成协议、主机、路径与查询参数，参数可直接编辑并实时重组新 URL，全程本地处理</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="copyRebuilt" class="btn btn-success" :disabled="!rebuilt"><span class="icon">📋</span> 复制重组URL</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="粘贴 URL，如 https://example.com:8080/path?a=1&amp;b=2#top（可省略协议）" spellcheck="false" aria-label="URL输入" @input="parse"></textarea>
      <template v-if="result">
        <table class="kv" aria-label="URL组件">
          <tbody>
            <tr v-for="row in rows" :key="row.label"><th>{{ row.label }}</th><td><code>{{ row.value || '—' }}</code></td><td><button class="mini" :disabled="!row.value" @click="copyText(row.value)">复制</button></td></tr>
          </tbody>
        </table>
        <h2 class="sub">查询参数（{{ editableParams.length }} 个，可编辑）</h2>
        <table v-if="editableParams.length" class="kv params" aria-label="查询参数">
          <tbody>
            <tr v-for="(p, i) in editableParams" :key="i">
              <td><input v-model="p.key" class="cell" aria-label="参数名" @input="rebuild" /></td>
              <td><input v-model="p.value" class="cell" aria-label="参数值" @input="rebuild" /></td>
              <td><button class="mini" @click="removeParam(i)">删除</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">该 URL 没有查询参数，可点下方按钮添加。</p>
        <button class="btn btn-secondary" @click="addParam">+ 添加参数</button>
        <h2 class="sub">重组 URL</h2>
        <textarea :value="rebuilt" class="text-input output" readonly aria-label="重组URL"></textarea>
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
import { parseUrl, buildUrl } from '@/utils/urlParse.js';

const features = [
  { icon: '🧩', title: '组件拆解', description: '协议、主机、端口、路径段、锚点一屏看清' },
  { icon: '✏️', title: '参数可编辑', description: '改/删/加查询参数，实时重组出新 URL' },
  { icon: '🔁', title: '重复参数', description: '同名参数多值完整保留，不丢不合并' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴 URL（可省略协议，自动补 https://）', '查看组件拆解表，逐项可复制', '在参数表里修改、删除或添加参数，下方实时生成重组 URL'];
const faqs = [
  { question: '不写协议能解析吗？', answer: '可以。输入 example.com/a?x=1 会自动补 https:// 再解析，并在结果中按补全后的地址拆解。' },
  { question: '密码部分会显示吗？', answer: 'URL 里带的用户信息（user:pass@）会拆在组件表里，仅在你本地浏览器显示，不会发送到任何服务器；分享重组 URL 时请注意它不含用户信息。' },
  { question: '重组 URL 和原 URL 为什么可能不完全一样？', answer: '重组会用标准编码重新编码参数（如空格变 +），语义等价；用户信息不带入重组结果。' }
];
const examples = [
  { input: 'https://example.com:8080/shop/list?tag=phone&tag=pad&page=2#top', output: '参数 tag×2、page…', description: '带重复参数的 URL' },
  { input: 'example.com/search?q=你好 世界', output: '含空格会提示改用编码', description: '省略协议（示例含空格将报错提示）' }
];
const inputText = ref('');
const result = ref(null);
const editableParams = ref([]);
const rebuilt = ref('');
const statusMessage = ref('');
const statusType = ref('');
const rows = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  return [
    { label: '协议', value: r.protocol }, { label: '主机', value: r.host },
    { label: '域名', value: r.hostname }, { label: '端口', value: r.port },
    { label: '路径', value: r.pathname }, { label: '路径段', value: r.segments.join(' / ') },
    { label: '用户名', value: r.username }, { label: '锚点', value: r.hash },
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
  } catch (e) { statusMessage.value = '✗ ' + e.message; statusType.value = 'error'; }
};
const addParam = () => { editableParams.value.push({ key: '', value: '' }); rebuild(); };
const removeParam = (i) => { editableParams.value.splice(i, 1); rebuild(); };
const loadExample = () => { inputText.value = 'https://example.com:8080/shop/list?tag=phone&tag=pad&page=2#top'; parse(); };
const useExample = (ex) => { inputText.value = ex.input; parse(); };
const clearAll = () => { inputText.value = ''; result.value = null; rebuilt.value = ''; editableParams.value = []; statusMessage.value = ''; };
const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
const copyRebuilt = () => copyText(rebuilt.value);
</script>

<style scoped>
.url-parser { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.text-input { width: 100%; min-height: 64px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { min-height: 52px; background: var(--bg-soft); }
.kv { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 110px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; }
.kv code { word-break: break-all; color: var(--text); }
.mini { padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
.cell { width: 100%; padding: 5px 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; box-sizing: border-box; }
.sub { font-size: 1rem; color: var(--text-strong); margin: 16px 0 6px; }
.hint { font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { width: 84px; } }
</style>
