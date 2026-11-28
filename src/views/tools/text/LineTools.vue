<template>
  <div class="line-tools">
    <h1>文本行工具</h1>
    <p class="description">按行批量处理文本：排序、去重、删空行、修剪、反转、加行号与前后缀，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="useOutputAsInput" class="btn btn-secondary" :disabled="!result"><span class="icon" aria-hidden="true">↩️</span> 结果作输入</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!result"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage id="line-tools-status" :message="statusMessage" :type="statusType" />
      <div class="options" role="group" aria-label="处理选项">
        <label>修剪
          <select v-model="options.trim" @change="process">
            <option value="both">首尾空格</option>
            <option value="start">仅行首</option>
            <option value="end">仅行尾</option>
            <option value="none">不修剪</option>
          </select>
        </label>
        <label>排序
          <select v-model="options.sort" @change="process">
            <option value="none">不排序</option>
            <option value="asc">升序（自然序）</option>
            <option value="desc">降序（自然序）</option>
            <option value="length-asc">按长度短→长</option>
            <option value="length-desc">按长度长→短</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" v-model="options.removeEmpty" @change="process" /> 删除空行</label>
        <label class="check"><input type="checkbox" v-model="options.dedupe" @change="process" /> 去除重复行</label>
        <label class="check"><input type="checkbox" v-model="options.dedupeIgnoreCase" :disabled="!options.dedupe" @change="process" /> 去重忽略大小写</label>
        <label class="check"><input type="checkbox" v-model="options.reverse" @change="process" /> 反转行序</label>
        <label class="check"><input type="checkbox" v-model="options.addNumbers" @change="process" /> 添加行号</label>
        <label v-if="options.addNumbers">起始 <input type="text" inputmode="numeric" v-model="options.numberStart" class="affix num-start" aria-label="行号起始" :aria-invalid="errorField === 'numberStart' ? 'true' : undefined" :aria-describedby="errorField === 'numberStart' ? 'line-tools-status' : undefined" @input="process" /></label>
        <label>行前缀 <input type="text" v-model="options.prefix" class="affix" placeholder="如 - " aria-label="行前缀" :aria-invalid="errorField === 'prefix' ? 'true' : undefined" :aria-describedby="errorField === 'prefix' ? 'line-tools-status' : undefined" @input="process" /></label>
        <label>行后缀 <input type="text" v-model="options.suffix" class="affix" placeholder="如 ;" aria-label="行后缀" :aria-invalid="errorField === 'suffix' ? 'true' : undefined" :aria-describedby="errorField === 'suffix' ? 'line-tools-status' : undefined" @input="process" /></label>
      </div>
      <div class="panes">
        <textarea v-model="inputText" class="text-input" placeholder="粘贴多行文本，一行一条，如名单、日志、清单…" spellcheck="false" aria-label="输入文本" :aria-invalid="errorField === 'input' ? 'true' : undefined" :aria-describedby="errorField === 'input' ? 'line-tools-status' : undefined" @input="process"></textarea>
        <textarea :value="result ? result.text : ''" class="text-input" placeholder="处理结果将显示在这里" spellcheck="false" aria-label="处理结果" readonly></textarea>
      </div>
      <p v-if="result" class="stats">输入 {{ result.stats.inputLines }} 行 / {{ result.stats.inputChars }} 字符（{{ result.stats.inputBytes }} 字节） → 输出 {{ result.stats.outputLines }} 行 / {{ result.stats.outputChars }} 字符<span v-if="result.stats.removedEmpty"> · 删空行 {{ result.stats.removedEmpty }}</span><span v-if="result.stats.removedDuplicates"> · 去重 {{ result.stats.removedDuplicates }}</span></p>
      <ToolExamples :examples="examples" @use-example="useExample" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { processLines } from '@/utils/lineTools.js';

const features = [
  { icon: '↕️', title: '自然排序', description: '数字按数值大小排，item2 排在 item10 前面，支持按长度排序' },
  { icon: '🧹', title: '去重删空', description: '重复行只保留首次出现，可忽略大小写；空行一键清除' },
  { icon: '🔢', title: '行号与前后缀', description: '批量加行号、行首行尾标记，整理清单与代码片段更方便' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴多行文本到左侧输入框', '勾选需要的处理：修剪、删空行、去重、排序等，右侧实时出结果', '点「复制结果」，或「结果作输入」继续下一轮处理'];
const faqs = [
  { question: '自然排序和普通排序有什么区别？', answer: '自然排序把连续数字当数值比较，所以 file2 会排在 file10 前面；普通字典序则会把 file10 排在 file2 前面。' },
  { question: '去重时保留哪一条？', answer: '保留首次出现的那一行，后面重复出现的会被删掉；统计行会告诉你一共去掉了多少行。' },
  { question: '处理顺序是怎样的？', answer: '固定顺序：修剪 → 删空行 → 去重 → 排序 → 反转 → 前后缀 → 行号，结果可预期、可复现。' },
  { question: '字符数和按长度排序怎么算 Emoji？', answer: '统一按 Unicode 码点计：一个 Emoji 算 1 个字符（UTF-8 占 4 字节，统计行会另列字节数），不会像 String.length 那样把一个 Emoji 算成 2。' },
  { question: '行号可以从别的值开始吗？', answer: '勾选「添加行号」后可改起始值（-999999 到 999999 的整数）；正数起始会自动零填充对齐位数，输错会点名报错并保留上一次结果。' },
  { question: '一次能处理多少行？', answer: '输入上限 100 万字符 / 10 万行，前后缀各最多 100 个字符；超限会明确提示并保留上一次结果，请分批处理。' }
];
const DEFAULT_OPTIONS = { trim: 'both', removeEmpty: true, dedupe: true, dedupeIgnoreCase: false, sort: 'asc', reverse: false, prefix: '', suffix: '', addNumbers: false, numberStart: 1 };
const examples = [
  { input: 'banana\napple\n\nbanana\n  Cherry  \napple', output: 'apple\nbanana\nCherry', description: '去重 + 删空行 + 升序', options: { ...DEFAULT_OPTIONS } },
  { input: 'item10\nitem2\nitem1', output: 'item1\nitem2\nitem10', description: '自然排序', options: { ...DEFAULT_OPTIONS, removeEmpty: false, dedupe: false } },
  { input: '任务一\n任务二\n任务三', output: '08. 任务一\n09. 任务二\n10. 任务三', description: '从 8 开始加行号（正数自动零填充对齐）', options: { ...DEFAULT_OPTIONS, removeEmpty: false, dedupe: false, sort: 'none', addNumbers: true, numberStart: 8 } }
];
const inputText = ref('');
const result = ref(null);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const inputErrorText = ref('');
const setInputError = (msg) => { status.showError(msg); inputErrorText.value = msg; };
// 错误文案自带字段名，按字段名归属：行号起始/行前缀/行后缀归对应选项框，输入超限归主文本域
const errorField = computed(() => {
  if (statusType.value !== 'error' || !inputErrorText.value || statusMessage.value !== inputErrorText.value) return '';
  const m = inputErrorText.value;
  if (m.includes('行号起始')) return 'numberStart';
  if (m.includes('行前缀')) return 'prefix';
  if (m.includes('行后缀')) return 'suffix';
  if (m.includes('输入最多')) return 'input';
  return '';
});
const options = reactive({ ...DEFAULT_OPTIONS });
const process = () => {
  if (!inputText.value) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = processLines(inputText.value, { ...options });
    statusMessage.value = '✓ 处理完成';
    statusType.value = 'success';
  } catch (e) {
    // 出错保留上一次结果，只报点名错误（与全站打磨口径一致）
    setInputError(`✗ ${e.message}`);
  }
};
const applyExample = (ex) => {
  if (ex.options) Object.assign(options, { ...DEFAULT_OPTIONS, ...ex.options });
  inputText.value = ex.input;
  process();
};
const loadExample = () => applyExample(examples[0]);
const useExample = (ex) => applyExample(ex);
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const useOutputAsInput = () => { if (result.value) { inputText.value = result.value.text; process(); } };
const copyOutput = async () => {
  if (!result.value) return;
  await clipboard.copyText(result.value.text, '✓ 已复制结果');
};
</script>

<style scoped>
.options .num-start { width: 56px; }
.options { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; font-size: 13px; color: var(--text-2); }
.options select, .options .affix { margin-left: 4px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options .affix { width: 72px; }
.options .check { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.stats { margin-top: 10px; font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { .panes { grid-template-columns: 1fr; } }
</style>
