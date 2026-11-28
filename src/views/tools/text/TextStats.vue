<template>
  <div class="text-stats">
    <h1>文本统计</h1>
    <p class="description">统计字数、词数、行数、段落、字节与阅读时长，并列出高频词，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copySummary" class="btn btn-success" :disabled="!stats"><span class="icon" aria-hidden="true">📋</span> 复制摘要</button>
      </ToolToolbar>
      <ToolStatusMessage id="text-stats-status" :message="statusMessage" :type="statusType" />
      <div class="panes">
        <textarea v-model="inputText" class="text-input" placeholder="粘贴或输入文本，右侧实时统计…" spellcheck="false" aria-label="输入文本" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'text-stats-status' : undefined" @input="process"></textarea>
        <div class="panel">
          <div v-if="stats" class="grid">
            <div class="card"><span class="num">{{ fmt(stats.chars) }}</span><span class="label">字符数</span></div>
            <div class="card"><span class="num">{{ fmt(stats.charsNoSpaces) }}</span><span class="label">不含空白</span></div>
            <div class="card"><span class="num">{{ fmt(stats.words) }}</span><span class="label">词数</span></div>
            <div class="card"><span class="num">{{ fmt(stats.cjkChars) }}</span><span class="label">中日韩字</span></div>
            <div class="card"><span class="num">{{ fmt(stats.englishWords) }}</span><span class="label">英文单词</span></div>
            <div class="card"><span class="num">{{ fmt(stats.lines) }}</span><span class="label">行数</span></div>
            <div class="card"><span class="num">{{ fmt(stats.paragraphs) }}</span><span class="label">段落数</span></div>
            <div class="card"><span class="num">{{ fmt(stats.sentences) }}</span><span class="label">句子数</span></div>
            <div class="card"><span class="num">{{ fmt(stats.bytes) }}</span><span class="label">字节 (UTF-8)</span></div>
            <div class="card"><span class="num">{{ fmt(stats.digits) }}</span><span class="label">数字</span></div>
            <div class="card"><span class="num">{{ fmt(stats.letters) }}</span><span class="label">英文字母</span></div>
            <div class="card"><span class="num">{{ fmt(stats.longestLine) }}</span><span class="label">最长行字符</span></div>
          </div>
          <p v-else class="empty">输入文本后这里会显示统计结果</p>
          <div v-if="stats" class="times">
            <span>预计阅读：{{ stats.readingText }}</span><span>预计朗读：{{ stats.speakingText }}</span><span>不重复词：{{ fmt(stats.uniqueWords) }}</span>
          </div>
          <div v-if="stats && stats.topWords.length" class="top">
            <h2>高频词 Top {{ stats.topWords.length }}</h2>
            <ol>
              <li v-for="w in stats.topWords" :key="w.word"><span class="word">{{ w.word }}</span><span class="count">{{ w.count }} 次 · {{ w.percent }}%</span></li>
            </ol>
          </div>
        </div>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { analyzeText, buildSummary, formatCount } from '@/utils/textStats.js';
const fmt = formatCount;

const features = [
  { icon: '🔢', title: '多维统计', description: '字符、词数、行段句、数字字母与 UTF-8 字节一屏看清' },
  { icon: '⏱️', title: '阅读时长', description: '按中文 400 字/分钟、英文 200 词/分钟估算阅读与朗读时长' },
  { icon: '📊', title: '高频词', description: '英文按单词、中文按双字组合统计出现频率' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴文本到左侧输入框，右侧实时出统计', '查看高频词与阅读时长', '点「复制摘要」把核心数字带走'];
const faqs = [
  { question: '词数怎么算？', answer: '词数 = 中日韩单字数 + 英文单词数，混合文本也能给出合理总数。' },
  { question: '字符数为什么和编辑器不一样？', answer: '本工具按 Unicode 码点计数，一个 Emoji 算 1 个字符；部分编辑器按 UTF-16 单元计数会算 2。' },
  { question: '高频词里的中文为什么是两个字？', answer: '中文没有空格分词，这里用双字组合近似统计高频搭配，适合快速看主题词。日语假名、韩语谚文同样按双字组合统计，与词数口径一致。' },
  { question: '句子数怎么算？', answer: '连续的终止标点（。！？.!?…）只算一处句末；数字间的小数点（如 3.14、版本号 1.0.0）不算句末；纯标点不算句子，没有标点结尾但有实际内容的残段算一句。英文缩写（如 e.g.）里的点仍会被计为句末，属已知近似。' },
  { question: '一次能统计多长的文本？', answer: '最多 100 万个字符（按 Unicode 码点计），超出会点名报错并保留上一次的统计结果。' }
];
const examples = [
  { input: 'Hello world. Hello tools!\n工具箱让开发更简单，工具虽小，效率很高。', output: '字符 46 · 词数 21 · 句子 3 · 行数 2', description: '中英混合示例' },
  { input: '圆周率约 3.14159，版本 1.0.0 已发布！真的吗？！是的……新功能包括 Faster loading 与 better search。', output: '字符 72 · 词数 29 · 句子 4 · 行数 1', description: '小数点/版本号不误判句末、连续标点只算一处' }
];
const inputText = ref('');
const stats = ref(null);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const inputErrorText = ref('');
const setInputError = (msg) => { status.showError(msg); inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const process = () => {
  if (!inputText.value) { stats.value = null; statusMessage.value = ''; return; }
  try {
    stats.value = analyzeText(inputText.value);
    statusMessage.value = '✓ 统计完成';
    statusType.value = 'success';
  } catch (e) {
    setInputError(`✗ ${e.message || '统计失败'}`);
  }
};
const loadExample = () => { inputText.value = examples[0].input; process(); };
const useExample = (ex) => { inputText.value = ex.input; process(); };
const clearAll = () => { inputText.value = ''; stats.value = null; statusMessage.value = ''; };
const copySummary = async () => {
  if (!stats.value) return;
  await clipboard.copyText(buildSummary(stats.value), '✓ 已复制摘要');
};
</script>

<style scoped>
.text-input { width: 100%; min-height: 260px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; line-height: 1.6; box-sizing: border-box; resize: vertical; }
.panel { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); padding: 12px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 6px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
.num { font-size: 20px; font-weight: 700; color: var(--text-strong); }
.label { font-size: 12px; color: var(--text-2); }
.empty { color: var(--text-2); font-size: 13px; text-align: center; padding: 32px 0; }
.times { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px; font-size: 13px; color: var(--text-2); }
.top { margin-top: 12px; } .top h2 { font-size: 14px; color: var(--text-strong); margin: 0 0 6px; }
.top ol { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-2); }
.top li { display: flex; justify-content: space-between; padding: 2px 0; }
.word { color: var(--text); font-weight: 600; }
@media (max-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>
