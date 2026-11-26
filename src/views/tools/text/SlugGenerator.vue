<template>
  <div class="slug-gen">
    <h1>URL Slug 生成器</h1>
    <p class="description">把标题或短语转成 URL 友好的 slug：去重音、小写、分隔符合并，支持多行批量与重名加序号，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row options">
        <label>分隔符
          <select v-model="opts.separator" aria-label="分隔符">
            <option value="-">连字符 -</option>
            <option value="_">下划线 _</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" v-model="opts.lowercase" /> 转小写</label>
        <label class="check"><input type="checkbox" v-model="opts.keepUnicode" /> 保留中文等字母</label>
        <label class="check"><input type="checkbox" v-model="opts.dedupe" /> 重名加序号</label>
        <label>最大长度 <input class="num" type="number" v-model.number="opts.maxLength" min="0" max="500" aria-label="最大长度，0 不限" /></label>
      </div>
      <label class="block">输入（每行一条）
        <textarea v-model="input" rows="6" spellcheck="false" placeholder="如：Hello World! Café Guide 2026" aria-label="Slug 输入"></textarea>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <button class="btn ghost" type="button" :disabled="!result" @click="useAsInput">结果作输入</button>
        <button class="btn" type="button" :disabled="!result" @click="copyText(result.text)">复制全部</button>
        <span class="muted">输入后实时生成</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="result">
        <label class="block">输出
          <textarea :value="result.text" rows="6" readonly spellcheck="false" aria-label="Slug 输出"></textarea>
        </label>
        <p class="summary">共 {{ result.total }} 行 · 生成 {{ result.generated }} 条<span v-if="result.emptyCount"> · {{ result.emptyCount }} 行无可用字符已跳过</span><span v-if="result.removedTotal"> · 移除符号/非拉丁字符 {{ result.removedTotal }} 个</span></p>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
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
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { slugifyBatch } from '@/utils/slugify.js';
const features = [
  { icon: '🔗', title: 'URL 友好', description: '只保留字母数字与分隔符，空格、标点自动折叠，生成的 slug 可直接用于博客与文档站 URL' },
  { icon: '🔤', title: '去重音', description: 'Café、déjà 等带重音的拉丁字母自动转为 cafe、deja，避免 URL 编码后难读' },
  { icon: '📚', title: '批量与去重', description: '每行一条批量生成，开启「重名加序号」后重复 slug 自动追加 -2、-3' },
  { icon: '🔒', title: '纯本地处理', description: '内容不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴标题或短语（多行可批量）', '按需选分隔符、小写、保留中文与最大长度', '点「复制全部」把 slug 用到 URL、文件名或锚点里'];
const faqs = [
  { question: '中文标题为什么生成为空？', answer: 'Slug 的通用约定是 ASCII：中文没有可靠的无词库音译方案，默认移除并计数提示。若站点支持中文 URL，可勾选「保留中文等字母」，会原样保留中文字符。' },
  { question: '分隔符用 - 还是 _？', answer: '搜索引擎与主流博客系统普遍推荐连字符 -，单词边界识别更明确；下划线常用于文件名或代码标识符场景，按目标平台习惯选即可。' },
  { question: '最大长度截断会切断单词吗？', answer: '不会优先切断：截断点落在词中间时会回退到上一个分隔符处（除非首词本身过长），保证 slug 仍然可读。' }
];
const EXAMPLE = 'Hello World! Café Guide 2026\nVue 3 & TypeScript 入门指南\nHello World!';
const input = ref(EXAMPLE);
const opts = reactive({ separator: '-', lowercase: true, keepUnicode: false, dedupe: true, maxLength: 0 });
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => (!input.value ? null : slugifyBatch(input.value, { ...opts, maxLength: Number(opts.maxLength) || 0 })));
const result = computed(() => (parsed.value && parsed.value.ok ? parsed.value : null));
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
function loadExample() { input.value = EXAMPLE; }
function clearAll() { input.value = ''; }
function useAsInput() { if (result.value) input.value = result.value.text; }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.slug-gen { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.options .check { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; color: var(--text-2); }
.options select, .options .num { padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options .num { width: 70px; }
.options label { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.summary { font-size: 13px; margin: 6px 0 10px; color: var(--text-2); }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
