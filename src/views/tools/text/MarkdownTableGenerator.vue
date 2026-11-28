<template>
  <div class="md-table">
    <h1>Markdown 表格生成器</h1>
    <p class="description">粘贴 Excel / TSV / CSV 内容一键生成 Markdown 表格，自动对齐补齐、数字列右对齐、竖线转义，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row options">
        <label class="check"><input type="checkbox" v-model="hasHeader" /> 首行作表头</label>
        <label class="check"><input type="checkbox" v-model="pretty" /> 补齐对齐（美化）</label>
        <label>对齐
          <select v-model="align" aria-label="对齐方式">
            <option value="auto">自动（数字右对齐）</option>
            <option value="left">全部左对齐</option>
            <option value="center">全部居中</option>
            <option value="right">全部右对齐</option>
          </select>
        </label>
      </div>
      <label class="block">输入（每行一行，列间用 Tab、逗号或 | 分隔）
        <textarea v-model="input" rows="7" spellcheck="false" placeholder="从 Excel 复制粘贴，或输入逗号分隔的内容" aria-label="表格输入" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'markdown-table-error' : undefined"></textarea>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="chip" type="button" @click="loadCsvExample">CSV 示例</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <button class="btn" type="button" :disabled="!result" @click="copyText(result.markdown)">复制 Markdown</button>
        <span class="muted">输入后实时生成</span>
      </div>
      <p v-if="error" id="markdown-table-error" class="error" role="alert">{{ error }}</p>
      <p v-if="result && result.notes && result.notes.length" class="note" role="status" aria-live="polite">{{ result.notes.join('；') }}</p>
      <template v-if="result">
        <label class="block">Markdown 输出
          <textarea :value="result.markdown" rows="7" readonly spellcheck="false" aria-label="Markdown 输出"></textarea>
        </label>
        <p class="summary">{{ result.cols }} 列 · {{ result.dataRows }} 行数据</p>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { generateMarkdownTable } from '@/utils/markdownTable.js';
const features = [
  { icon: '📋', title: '粘贴即生成', description: '从 Excel、表格软件复制的内容是 Tab 分隔，粘贴进来即可；也支持 CSV（含引号）与已有的 Markdown 行' },
  { icon: '📐', title: '自动对齐补齐', description: '按视觉宽度补齐空格（中文计 2 宽），源码里也整齐；纯数字列自动右对齐，也可统一左/中/右' },
  { icon: '🛡️', title: '转义安全', description: '单元格里的 | 自动转义为 \\|，不会把表格撑破；缺列的行自动补空' },
  { icon: '🔒', title: '纯本地处理', description: '内容不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['从 Excel 复制区域，或手写 Tab / 逗号分隔的内容粘贴进来', '按需勾选首行表头、补齐对齐与对齐方式，输出实时更新', '点「复制 Markdown」粘贴到 README、文档或笔记里'];
const faqs = [
  { question: '从 Excel 复制过来是什么格式？', answer: '剪贴板里是 Tab 分隔的文本（TSV），本工具自动识别，不需要先另存为 CSV。含逗号的单元格若来自 CSV 文件，请保留引号，引号内的逗号不会被误拆。' },
  { question: '「自动」对齐是怎么判断的？', answer: '某一列的数据行全部是数字（允许千分位、百分号、正负号、小数与科学计数法如 1e5）时该列右对齐，其余列左对齐，与常见的表格阅读习惯一致。粘贴已有 Markdown 表格时，分隔行里写好的 :---:、---: 对齐会被保留。' },
  { question: '补齐对齐和紧凑模式有什么区别？', answer: '渲染效果完全一样。补齐模式会把源码用空格补到等宽，适合在源码里直接读；紧凑模式每行最短，适合表格很大时减小体积。' },
  { question: '粘贴内容有什么讲究？', answer: 'CSV 引号内的换行会被拼回同一单元格（输出为 <br>）；没有英文分隔符时，全角逗号/竖线（，｜）也能当分隔符；报错行号按原文物理行计，空行不影响定位。' },
  { question: '改错了为什么旧结果还在？', answer: '输入暂时不合法时保留上一次成功生成的结果，方便对照着改；修正输入后会自动刷新，清空输入则会一并清掉。' }
];
const EXAMPLE = '工具\t分类\t工具数\n文本处理\ttext\t21\n格式转换\tconverter\t23\n生成器\tgenerator\t6';
const CSV_EXAMPLE = '名称,说明,价格\n"键盘, 87 键",紧凑布局，适合桌面,299\n鼠标,"支持 2.4G / 蓝牙\n双模连接",159';
const input = ref(EXAMPLE);
const hasHeader = ref(true);
const pretty = ref(true);
const align = ref('auto');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const parsed = computed(() => (!input.value ? null : generateMarkdownTable(input.value, { hasHeader: hasHeader.value, pretty: pretty.value, align: align.value })));
const lastResult = ref(null);
watch(parsed, (p) => { if (p && p.ok) lastResult.value = p; else if (!p) lastResult.value = null; }, { immediate: true });
const result = computed(() => lastResult.value);
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
function loadExample() { input.value = EXAMPLE; }
function loadCsvExample() { input.value = CSV_EXAMPLE; }
function clearAll() { input.value = ''; }
async function copyText(text) {
  return clipboard.copyText(text, '已复制到剪贴板', { failMsg: '复制失败，请手动选择复制' });
}
</script>
<style scoped>
.md-table { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.options .check { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; color: var(--text-2); }
.options select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options label { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger-text); font-size: 14px; }
.note { color: var(--text-2); font-size: 13px; margin: 4px 0; }
.summary { font-size: 13px; margin: 6px 0 10px; color: var(--text-2); }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
