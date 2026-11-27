<template>
  <div class="json-to-ts">
    <h1>JSON转TypeScript类型</h1>
    <p class="description">粘贴 JSON 自动生成 TypeScript interface：嵌套对象拆独立接口、数组元素合并推断，全程本地运行、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputText"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage id="json-to-ts-status" :message="statusMessage" :type="statusType" />
      <div class="options">
        <label>根类型名 <input v-model="rootName" class="name-input" placeholder="Root" spellcheck="false" aria-label="根类型名" :aria-invalid="rootErrorActive ? 'true' : undefined" :aria-describedby="rootErrorActive ? 'json-to-ts-status' : undefined" @input="convert" /></label>
        <label class="check"><input type="checkbox" v-model="useExport" @change="convert" /> 带 export</label>
        <span v-if="stats" class="stats">生成 {{ stats.interfaceCount }} 个 interface · {{ stats.fieldCount }} 个字段</span>
      </div>
      <div class="panes">
        <textarea v-model="inputText" class="io" placeholder="在此粘贴 JSON，如 {&quot;name&quot;:&quot;tom&quot;,&quot;age&quot;:18}" spellcheck="false" aria-label="JSON 输入" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'json-to-ts-status' : undefined" @input="convert"></textarea>
        <textarea v-model="outputText" class="io" placeholder="生成的 TypeScript 类型将显示在这里" spellcheck="false" readonly aria-label="TypeScript 输出"></textarea>
      </div>
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
import { jsonToTypeScript } from '@/utils/jsonToTs.js';

const features = [
  { icon: '🧩', title: '嵌套拆接口', description: '嵌套对象与对象数组自动拆成独立 interface，根类型在前、引用清晰' },
  { icon: '🔀', title: '数组合并推断', description: '对象数组取键并集生成一个接口，只在部分元素出现的键自动标为可选' },
  { icon: '♻️', title: '同形复用', description: '结构相同的对象复用同一个接口名，同名异形则自动加序号改名' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴任意 JSON（对象、数组或原始值均可）', '可改根类型名、开关 export，生成结果实时刷新', '点「复制结果」把类型定义贴回项目里使用'];
const faqs = [
  { question: '日期字符串为什么生成 string 而不是 Date？', answer: 'JSON 本身没有日期类型，字符串一律推断为 string，避免把普通文本误判成日期；需要 Date 可手动改。' },
  { question: '数组里有的键为什么带问号？', answer: '对象数组会合并所有元素的键，只在部分元素中出现的键在运行时可能缺失，因此标为可选（?）。' },
  { question: '空数组生成什么？', answer: '没有元素可供推断时生成 unknown[]，比 any 更安全，后续可手动收紧。' },
  { question: '根数组里混着对象和数字会生成什么？', answer: '元素对象生成「根名+Item」接口（如 RootItem），根名留给 type 别名：type Root = (RootItem | number)[]，不会出现 interface 与 type 同名冲突。' },
  { question: '输入太大或嵌套太深为什么报错？', answer: '输入上限 100 万字符、嵌套 100 层、节点 5 万个，超限会点名提示拆分；这是为了避免超深 JSON 把页面卡死。status、news 这类以 s 结尾但不是复数的词也不会被误改成单数名。' }
];
const examples = [
  {
    input: '{"id":1,"name":"tom","tags":["dev","ops"],"profile":{"city":"Tokyo"},"orders":[{"sku":"A1","qty":2},{"sku":"B2","qty":1,"note":"急"}]}',
    output: 'export interface Root {\n  id: number;\n  name: string;\n  tags: string[];\n  profile: Profile;\n  orders: Order[];\n}\n\nexport interface Profile {\n  city: string;\n}\n\nexport interface Order {\n  sku: string;\n  qty: number;\n  note?: string;\n}',
    description: '嵌套对象 + 对象数组（note 只出现一次标可选）'
  },
  {
    input: '[{"id":1},{"id":2,"name":"n"}]',
    output: 'export interface Root {\n  id: number;\n  name?: string;\n}\n\nexport type RootList = Root[];',
    description: '根数组（元素接口 + 列表别名）'
  },
  {
    input: '{"status":[{"code":200,"ok":true}],"total":1}',
    output: 'export interface Root {\n  status: Status[];\n  total: number;\n}\n\nexport interface Status {\n  code: number;\n  ok: boolean;\n}',
    description: 'status 不会被误改成单数名 Statu'
  }
];
const inputText = ref('');
const outputText = ref('');
const rootName = ref('Root');
const useExport = ref(true);
const stats = ref(null);
const statusMessage = ref('');
const statusType = ref('');
const inputErrorText = ref('');
const setInputError = (msg) => { statusMessage.value = msg; statusType.value = 'error'; inputErrorText.value = msg; };
const errorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const rootErrorActive = computed(() => errorActive.value && inputErrorText.value.includes('根类型名'));
const inputErrorActive = computed(() => errorActive.value && !inputErrorText.value.includes('根类型名'));
const convert = () => {
  if (!inputText.value.trim()) { outputText.value = ''; stats.value = null; statusMessage.value = ''; return; }
  try {
    const r = jsonToTypeScript(inputText.value, { rootName: rootName.value, useExport: useExport.value });
    outputText.value = r.code;
    stats.value = r;
    statusMessage.value = '✓ 生成完成';
    statusType.value = 'success';
  } catch (e) { setInputError('✗ ' + e.message); }
};
const loadExample = () => { inputText.value = examples[0].input; convert(); };
const useExample = (ex) => { inputText.value = ex.input; convert(); };
const clearAll = () => { inputText.value = ''; outputText.value = ''; stats.value = null; statusMessage.value = ''; };
const copyOutput = async () => {
  if (!outputText.value) return;
  try { await navigator.clipboard.writeText(outputText.value); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.json-to-ts { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.options { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-bottom: 10px; font-size: 13px; color: var(--text-2); }
.name-input { width: 130px; margin-left: 4px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; }
.check { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.stats { margin-left: auto; color: var(--text-2); }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.io { width: 100%; min-height: 260px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.55; box-sizing: border-box; resize: vertical; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } .stats { margin-left: 0; } }
</style>
