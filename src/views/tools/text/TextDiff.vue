<template>
  <div class="text-diff">
    <h1>文本对比工具</h1>
    <p class="description">对比两段文本的行级差异，修改行内高亮具体改动；全程本地运行，不上传服务器</p>

    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary">
          <span class="icon">📝</span> 示例
        </button>
        <button @click="swapTexts" class="btn btn-secondary" :disabled="!oldText && !newText">
          <span class="icon">⇄</span> 交换
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon">🗑️</span> 清空
        </button>
        <button @click="copyUnified" class="btn btn-success" :disabled="!rows.length">
          <span class="icon">📋</span> 复制对比结果
        </button>
      </ToolToolbar>

      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <div class="input-grid">
        <ToolEditorPanel title="原文" :info="oldText ? `${oldLines} 行` : ''">
          <textarea v-model="oldText" class="text-input" rows="8" placeholder="粘贴原文…" spellcheck="false" aria-label="原文输入"></textarea>
        </ToolEditorPanel>
        <ToolEditorPanel title="新文" :info="newText ? `${newLines} 行` : ''">
          <textarea v-model="newText" class="text-input" rows="8" placeholder="粘贴修改后的文本…" spellcheck="false" aria-label="新文输入"></textarea>
        </ToolEditorPanel>
      </div>

      <div class="options-row">
        <label class="opt-chip" :class="{ active: ignoreWhitespace }">
          <input type="checkbox" v-model="ignoreWhitespace" class="opt-check" /> 忽略空白差异
        </label>
        <label class="opt-chip" :class="{ active: ignoreCase }">
          <input type="checkbox" v-model="ignoreCase" class="opt-check" /> 忽略大小写
        </label>
        <label class="opt-chip" :class="{ active: onlyChanges }">
          <input type="checkbox" v-model="onlyChanges" class="opt-check" /> 只看差异行
        </label>
        <div class="view-switch" role="group" aria-label="视图模式">
          <button class="view-btn" :class="{ active: viewMode === 'unified' }" @click="viewMode = 'unified'">统一视图</button>
          <button class="view-btn" :class="{ active: viewMode === 'split' }" @click="viewMode = 'split'">双栏视图</button>
        </div>
      </div>

      <div v-if="hasBoth" class="result-section">
        <div class="stats-bar" role="status">
          <span class="stat add">+ {{ stats.added }} 新增</span>
          <span class="stat del">− {{ stats.deleted }} 删除</span>
          <span class="stat same">{{ stats.unchanged }} 未变</span>
          <span class="stat">相似度 {{ sim }}%</span>
          <span v-if="isIdentical" class="stat ok">两段文本完全一致 ✓</span>
        </div>
        <p v-if="truncated" class="limit-note">文本过长，仅对比前 {{ MAX_LINES }} 行。</p>
        <p v-if="fallback" class="limit-note">行数较多，已切换为按行号逐行对比模式。</p>

        <div v-if="viewMode === 'unified'" class="diff-box" aria-label="统一对比结果">
          <div v-for="(row, i) in visibleRows" :key="i" class="diff-line" :class="row.type">
            <span class="ln">{{ row.oldNo ?? '' }}</span>
            <span class="ln">{{ row.newNo ?? '' }}</span>
            <span class="sign">{{ row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ' }}</span>
            <span class="line-text">{{ row.text || ' ' }}</span>
          </div>
          <p v-if="!visibleRows.length" class="no-diff">没有差异行</p>
        </div>

        <div v-else class="diff-box split" aria-label="双栏对比结果">
          <div v-for="(pair, i) in visiblePairs" :key="i" class="split-row" :class="pair.type">
            <div class="split-cell left" :class="{ changed: pair.type === 'change' || pair.type === 'del' }">
              <span class="ln">{{ pair.left?.oldNo ?? '' }}</span>
              <span class="line-text"><template v-if="pair.left"><template v-for="(seg, si) in (pair.oldSegs || [{ type: pair.type === 'del' ? 'del' : 'same', text: pair.left.text }])" :key="si"><mark v-if="seg.type === 'del'" class="hl-del">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></template></span>
            </div>
            <div class="split-cell right" :class="{ changed: pair.type === 'change' || pair.type === 'add' }">
              <span class="ln">{{ pair.right?.newNo ?? '' }}</span>
              <span class="line-text"><template v-if="pair.right"><template v-for="(seg, si) in (pair.newSegs || [{ type: pair.type === 'add' ? 'add' : 'same', text: pair.right.text }])" :key="si"><mark v-if="seg.type === 'add'" class="hl-add">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></template></span>
            </div>
          </div>
          <p v-if="!visiblePairs.length" class="no-diff">没有差异行</p>
        </div>
      </div>
      <p v-else class="hint">在上方分别粘贴原文与新文，差异会实时显示。</p>

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
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { diffLines, pairRows, toUnifiedText, similarity, splitLines, MAX_LINES } from '@/utils/textDiff.js';

const features = [
  { icon: '📊', title: '行级对比', description: '基于最长公共子序列，准确识别新增、删除与未变行' },
  { icon: '🖍️', title: '行内高亮', description: '双栏视图下，修改行内具体增删的字符也会标出' },
  { icon: '🎛️', title: '对比选项', description: '可忽略空白/大小写差异，也可只看差异行' },
  { icon: '🔒', title: '纯本地运行', description: '文本不离开浏览器，不上传任何服务器' }
];

const usageSteps = [
  '把原文粘贴到左框、修改后的文本粘贴到右框',
  '下方实时显示行级差异：绿色为新增、红色为删除',
  '切到双栏视图可看到修改行内的字符级高亮',
  '点「复制对比结果」可把 +/- 格式的对比文本带走'
];

const faqs = [
  {
    question: '对比结果里的 + 和 − 是什么意思？',
    answer: '+ 表示新文中新增的行，− 表示原文中被删除的行，没有符号的是两边都有的未变行。'
  },
  {
    question: '一行只改了几个字，为什么显示成一删一增？',
    answer: '行级对比以整行为单位：修改过的行会成对出现为删除+新增。切到双栏视图，行内会高亮具体改动的字符。'
  },
  {
    question: '「忽略空白差异」有什么用？',
    answer: '开启后，行首行尾空白与连续空白会被折叠比较，适合对比只改了缩进或对齐的代码与配置。'
  },
  {
    question: '最多能对比多长文本？',
    answer: `单侧最多对比前 ${MAX_LINES} 行；行数特别多时会自动切换为按行号逐行对比，保证页面不卡顿。`
  }
];

const examples = [
  { input: '原文一行被修改', output: '双栏视图高亮改动的字', description: '修改行示例' },
  { input: '配置项增删', output: '新增行显示 +，删除行显示 −', description: '增删行示例' }
];

const oldText = ref('');
const newText = ref('');
const ignoreWhitespace = ref(false);
const ignoreCase = ref(false);
const onlyChanges = ref(false);
const viewMode = ref('unified');
const statusMessage = ref('');
const statusType = ref('');

const oldLines = computed(() => splitLines(oldText.value).length);
const newLines = computed(() => splitLines(newText.value).length);
const hasBoth = computed(() => oldText.value !== '' || newText.value !== '');

const result = computed(() => diffLines(oldText.value, newText.value, { ignoreWhitespace: ignoreWhitespace.value, ignoreCase: ignoreCase.value }));
const rows = computed(() => result.value.rows);
const stats = computed(() => result.value.stats);
const truncated = computed(() => result.value.truncated);
const fallback = computed(() => result.value.fallback);
const isIdentical = computed(() => hasBoth.value && stats.value.added === 0 && stats.value.deleted === 0 && rows.value.length > 0);
const sim = computed(() => similarity(stats.value, oldLines.value, newLines.value));
const visibleRows = computed(() => (onlyChanges.value ? rows.value.filter(r => r.type !== 'same') : rows.value));
const pairs = computed(() => pairRows(rows.value));
const visiblePairs = computed(() => (onlyChanges.value ? pairs.value.filter(p => p.type !== 'same') : pairs.value));

const loadExample = () => {
  oldText.value = '服务器配置\n端口: 8080\n超时: 30 秒\n重试次数: 3\n日志级别: info';
  newText.value = '服务器配置\n端口: 9090\n超时: 30 秒\n日志级别: debug\n缓存: 开启';
  statusMessage.value = '✓ 示例已载入';
  statusType.value = 'success';
};
const useExample = () => loadExample();
const swapTexts = () => { const t = oldText.value; oldText.value = newText.value; newText.value = t; };
const clearAll = () => { oldText.value = ''; newText.value = ''; statusMessage.value = ''; };
const copyUnified = async () => {
  try {
    await navigator.clipboard.writeText(toUnifiedText(rows.value));
    statusMessage.value = '✓ 对比结果已复制到剪贴板';
    statusType.value = 'success';
  } catch {
    statusMessage.value = '✗ 复制失败，请手动复制';
    statusType.value = 'error';
  }
};
</script>

<style scoped>
.text-diff { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
.text-input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.6; box-sizing: border-box; resize: vertical; }
.options-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; }
.opt-chip { position: relative; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; border: 1px solid var(--border); cursor: pointer; }
.opt-chip.active { color: var(--text-strong); border-color: var(--accent); background: var(--accent-soft); }
.opt-check { position: absolute; opacity: 0; width: 0; height: 0; }
.opt-chip:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.view-switch { display: inline-flex; margin-left: auto; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.view-btn { padding: 5px 12px; font-size: 13px; background: var(--bg-soft); color: var(--text-2); border: none; cursor: pointer; }
.view-btn.active { background: var(--accent-soft); color: var(--text-strong); }
.hint { color: var(--text-2); font-size: 14px; margin: 0 0 16px; }
.stats-bar { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
.stat.add { color: var(--success-text); }
.stat.del { color: var(--danger-text); }
.stat.ok { color: var(--success-text); font-weight: 600; }
.limit-note { color: var(--text-2); font-size: 13px; margin: 0 0 8px; }
.diff-box { border: 1px solid var(--border); border-radius: 8px; overflow-x: auto; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; margin-bottom: 16px; }
.diff-line { display: flex; gap: 8px; padding: 1px 10px 1px 6px; white-space: pre; color: var(--text); }
.diff-line.add { background: var(--success-soft); }
.diff-line.del { background: var(--danger-soft); }
.ln { flex: 0 0 34px; text-align: right; color: var(--text-3); user-select: none; }
.sign { flex: 0 0 12px; text-align: center; user-select: none; }
.line-text { white-space: pre-wrap; word-break: break-word; }
.split-row { display: grid; grid-template-columns: 1fr 1fr; }
.split-cell { display: flex; gap: 8px; padding: 1px 10px 1px 6px; color: var(--text); min-width: 0; }
.split-cell.left { border-right: 1px solid var(--border); }
.split-cell.left.changed { background: var(--danger-soft); }
.split-cell.right.changed { background: var(--success-soft); }
.hl-del { background: var(--danger-soft); color: var(--danger-text); border-radius: 2px; padding: 0 1px; }
.hl-add { background: var(--success-soft); color: var(--success-text); border-radius: 2px; padding: 0 1px; }
.no-diff { color: var(--text-2); font-size: 13px; padding: 10px; margin: 0; font-family: inherit; }
@media (max-width: 640px) {
  h1 { font-size: 2rem; }
  .tool-container { padding: 20px; }
  .input-grid { grid-template-columns: 1fr; }
  .split-row { grid-template-columns: 1fr; }
  .split-cell.left { border-right: none; border-bottom: 1px dashed var(--border); }
  .view-switch { margin-left: 0; }
}
</style>
