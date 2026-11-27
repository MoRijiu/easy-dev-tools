<template>
  <div class="jsonpath-tool">
    <h1>JSONPath 查询</h1>
    <p class="description">用 JSONPath 表达式从 JSON 里提取数据：通配、递归、切片与过滤全支持，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="copyResults" class="btn btn-success" :disabled="!result || !result.matches.length"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
        <button @click="clearAll" class="btn btn-secondary"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="cols">
        <section class="block grow">
          <h2>JSON 数据</h2>
          <textarea v-model="jsonInput" rows="12" spellcheck="false" placeholder="粘贴 JSON，如 {&quot;store&quot;: {&quot;book&quot;: [...]}}" aria-label="JSON 数据" @input="process"></textarea>
          <p v-if="jsonError" class="error">✗ {{ jsonError }}</p>
        </section>
        <section class="block grow">
          <h2>查询结果 <span v-if="result" class="count">命中 {{ result.matches.length }} 条{{ result.truncated ? '（已达上限截断）' : '' }}</span></h2>
          <p v-if="pathError" class="error">✗ {{ pathError }}</p>
          <div v-if="result && result.matches.length" class="results">
            <div v-for="(m, i) in shownMatches" :key="i" class="match">
              <code class="mpath">{{ m.path }}</code>
              <pre class="mvalue">{{ formatValue(m.value) }}</pre>
              <button class="copy-one" :aria-label="`复制 ${m.path} 的值`" @click="copyOne(m)">复制</button>
            </div>
            <p v-if="result.matches.length > shownMatches.length" class="more">仅展示前 {{ shownMatches.length }} 条，复制结果可拿到全部命中摘要</p>
          </div>
          <p v-else-if="result && !pathError" class="empty">没有命中。换个表达式试试，如 $..* 看全部节点。</p>
          <p v-else class="empty">输入 JSON 与表达式后实时显示命中结果。</p>
        </section>
      </div>
      <section class="block">
        <h2>JSONPath 表达式</h2>
        <input v-model="exprInput" class="expr" spellcheck="false" placeholder="如 $.store.book[?(@.price < 10)].title" aria-label="JSONPath 表达式" @input="process" />
        <div class="quick">
          <button v-for="p in presets" :key="p.expr" @click="applyPreset(p.expr)">{{ p.label }}</button>
        </div>
      </section>
      <section class="block">
        <h2>语法速查</h2>
        <div class="cheat">
          <div v-for="c in cheat" :key="c.syntax" class="cheat-row"><code>{{ c.syntax }}</code><span>{{ c.desc }}</span></div>
        </div>
      </section>
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
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { queryJsonPath, buildJsonPathSummary } from '@/utils/jsonPath.js';
import { parseJsonDetailed, buildJsonErrorSummary } from '@/utils/jsonFormat.js';
const features = [
  { icon: '🧭', title: '完整常用语法', description: '子节点、通配、递归下降、切片、联合与 [?(...)] 过滤（含 && / || 与正则 =~）' },
  { icon: '📍', title: '带路径的结果', description: '每条命中都给出规范化路径，逐条复制值或一键复制全部摘要' },
  { icon: '⚠️', title: '友好报错', description: 'JSON 语法错误与表达式错误分别提示，表达式错误定位到具体位置' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = [
  { title: '粘贴 JSON', description: '把接口响应或配置文件粘到左侧，解析失败会给出原因' },
  { title: '写表达式', description: '从 $ 开始，用 .键名、[下标]、[*]、.. 与过滤拼出查询' },
  { title: '看结果', description: '命中实时刷新，点任意一条复制它的值' }
];
const faqs = [
  { question: '$..price 和 $.price 有什么区别？', answer: '.. 是递归下降：$..price 会找出文档里所有层级的 price；$.price 只取根对象直接的 price 字段。' },
  { question: '过滤 [?(@.price < 10)] 里的 @ 是什么？', answer: '@ 代表当前被检查的节点。过滤作用在数组上时逐个元素检查，@.price 就是元素的 price 字段；也可以直接写 @ > 3 过滤纯数字数组。' },
  { question: '支持哪些语法？有不支持的吗？', answer: '支持子节点/通配/递归/切片/联合/过滤（含正则 =~）。不支持脚本表达式 [(...)] 与自定义函数——这类语法各家实现差异大且有安全风险。' },
  { question: '键名是中文或带特殊字符怎么写？', answer: "中文等 Unicode 键名可以直接用点写法，如 $.用户.姓名；含空格、点号等特殊字符的键名用括号写法，如 $['my key']，两种写法等价。" },
  { question: '为什么 $.toString 在空对象上没有结果？', answer: '查询只认 JSON 数据自身的键，不会把 JavaScript 对象原型上的 toString、constructor 等当成数据命中，避免假结果。' },
  { question: '输入大小有限制吗？', answer: 'JSON 上限 100 万字符、表达式上限 1024 字符、命中上限 1000 条（递归遍历另有节点上限），超限会明确提示而不是卡死页面；输入出错时保留上一次的查询结果。' }
];
const cheat = [
  { syntax: '$.a.b', desc: '逐级取子字段' },
  { syntax: '$.a[0] / [-1]', desc: '数组下标，负数从末尾数' },
  { syntax: '$.a[*] / $.a.*', desc: '通配：数组全部元素或对象全部值' },
  { syntax: '$..price', desc: '递归下降：所有层级的 price' },
  { syntax: '$.a[1:4] / [::-1]', desc: '切片：起止与步长，语义同 Python' },
  { syntax: "$.a[0,2] / ['x','y']", desc: '联合：一次取多个下标或键' },
  { syntax: '$.a[?(@.price < 10)]', desc: '过滤：比较、存在判断、&& / ||' },
  { syntax: "$.a[?(@.name =~ /^A/)]", desc: '过滤：正则匹配字符串' }
];
const presets = [
  { label: '全部书名', expr: '$.store.book[*].title' },
  { label: '低于 10 元的书', expr: '$.store.book[?(@.price < 10)].title' },
  { label: '所有价格', expr: '$..price' },
  { label: '最后一本书', expr: '$.store.book[-1]' },
  { label: '数字大于 3', expr: '$.nums[?(@ > 3)]' }
];
const EXAMPLE_JSON = JSON.stringify({
  store: {
    book: [
      { title: '深入浅出 Node.js', price: 8.95, tags: ['后端', 'JavaScript'] },
      { title: 'Vue 设计与实现', price: 12.5, tags: ['前端'] },
      { title: '算法导论', price: 25, author: { name: 'Cormen' } }
    ],
    bicycle: { color: 'red', price: 19.95 }
  },
  nums: [1, 2, 3, 4, 5]
}, null, 2);
const jsonInput = ref('');
const exprInput = ref('$.store.book[*].title');
const result = ref(null);
const jsonError = ref('');
const pathError = ref('');
const statusMessage = ref('');
const statusType = ref('info');
const shownMatches = ref([]);
const MAX_JSON_LENGTH = 1000000;
const process = () => {
  jsonError.value = ''; pathError.value = '';
  if (!jsonInput.value.trim()) { result.value = null; shownMatches.value = []; return; }
  if (jsonInput.value.length > MAX_JSON_LENGTH) {
    jsonError.value = `JSON 过长（${jsonInput.value.length} 字符，上限 ${MAX_JSON_LENGTH}），已保留上次结果`;
    return;
  }
  const parsed = parseJsonDetailed(jsonInput.value);
  if (!parsed.ok) {
    // 出错保留旧结果，只更新错误提示（错误带行列定位与可能原因）
    jsonError.value = buildJsonErrorSummary(parsed.error).replace('\n', '；');
    return;
  }
  if (!exprInput.value.trim()) return;
  try {
    const r = queryJsonPath(parsed.value, exprInput.value);
    result.value = r;
    shownMatches.value = r.matches.slice(0, 100);
  } catch (e) { pathError.value = e.message; }
};
const formatValue = (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v));
const applyPreset = (expr) => { exprInput.value = expr; process(); };
const loadExample = () => { jsonInput.value = EXAMPLE_JSON; exprInput.value = '$.store.book[*].title'; process(); };
const clearAll = () => { jsonInput.value = ''; exprInput.value = '$'; process(); };
const copyText = async (text, okMsg) => {
  try { await navigator.clipboard.writeText(text); statusMessage.value = okMsg; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
const copyResults = () => { if (result.value) copyText(buildJsonPathSummary(exprInput.value, result.value), '✓ 已复制结果摘要'); };
const copyOne = (m) => copyText(formatValue(m.value), `✓ 已复制 ${m.path}`);
loadExample();
</script>
<style scoped>
.jsonpath-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.block { margin-bottom: 20px; } .block h2 { font-size: 16px; color: var(--text-strong); margin: 0 0 10px; }
.block h2 .count { font-size: 12px; color: var(--text-2); font-weight: 400; margin-left: 6px; }
.cols { display: flex; gap: 16px; flex-wrap: wrap; }
.cols .grow { flex: 1 1 320px; min-width: 0; }
textarea, .expr { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; font-family: ui-monospace, Menlo, Consolas, monospace; }
textarea { resize: vertical; }
.expr { font-size: 14px; }
.error { color: var(--danger-text); font-size: 13px; margin-top: 8px; word-break: break-word; }
.empty { color: var(--text-2); font-size: 13px; }
.results { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow: auto; }
.match { position: relative; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--bg-softer); }
.mpath { font-size: 12px; color: var(--accent-text); word-break: break-all; }
.mvalue { margin: 4px 0 0; font-size: 13px; color: var(--text); white-space: pre-wrap; word-break: break-word; max-height: 160px; overflow: auto; }
.copy-one { position: absolute; top: 6px; right: 6px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.more { font-size: 12px; color: var(--text-2); }
.quick { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.quick button { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.cheat { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 16px; }
.cheat-row { display: flex; gap: 10px; align-items: baseline; font-size: 13px; color: var(--text-2); }
.cheat-row code { font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--text); background: var(--bg-softer); border: 1px solid var(--border); border-radius: 6px; padding: 2px 6px; white-space: nowrap; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .cheat { grid-template-columns: 1fr; } }
</style>
