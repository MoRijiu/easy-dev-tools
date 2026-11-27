<template>
  <div class="lorem-generator">
    <h1>📃 占位文本生成器</h1>
    <p class="description">生成 Lorem Ipsum 占位文本，用于设计和排版测试</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="generateText">
          <span class="icon" aria-hidden="true">🎲</span> 生成文本
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon" aria-hidden="true">📋</span> 复制全部
        </button>
        <button class="btn" @click="downloadOutput" :disabled="!outputText">
          <span class="icon" aria-hidden="true">⬇️</span> 下载 .txt
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 设置区域 -->
      <div class="settings-section">
        <div class="settings-grid">
          <div class="setting-item">
            <label>生成类型</label>
            <select aria-label="生成类型" v-model="options.type">
              <option value="paragraphs">段落</option>
              <option value="sentences">句子</option>
              <option value="words">单词</option>
            </select>
          </div>
          <div class="setting-item">
            <label>数量（1–{{ COUNT_LIMITS[options.type] }}）</label>
            <input aria-label="生成数量" type="text" inputmode="numeric" v-model="countRaw" @keyup.enter="generateText" />
          </div>
          <div class="setting-item">
            <label>文本风格</label>
            <select aria-label="文本风格" v-model="options.style">
              <option value="lorem">经典 Lorem Ipsum</option>
              <option value="chinese">中文占位文</option>
              <option value="hipster">Hipster Ipsum</option>
            </select>
          </div>
          <div class="setting-item checkbox-item">
            <label class="checkbox-label" :class="{ disabled: options.style !== 'lorem' }">
              <input type="checkbox" v-model="options.startWithLorem" :disabled="options.style !== 'lorem'" />
              <span>以 "Lorem ipsum" 开头（仅经典风格）</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 输出区域 -->
      <div class="output-section">
        <div class="output-header">
          <h2>生成的文本</h2>
          <span class="text-stats" v-if="outputText && stats">
            {{ stats.paragraphs }} 段 · {{ stats.sentences }} 句 · {{ stats.words }} {{ options.style === 'chinese' ? '字' : '词' }} · {{ stats.chars }} 字符 · {{ stats.bytes }} 字节（UTF-8）
          </span>
        </div>
        <div class="text-output-wrapper">
          <pre v-if="outputText" class="text-output">{{ outputText }}</pre>
          <div v-else class="placeholder">点击"生成文本"按钮生成占位文本</div>
        </div>
      </div>

      <!-- 使用示例 -->
      <ToolExamples :examples="examples" @use-example="useExample" />

      <!-- 功能特点 -->
      <ToolFeatures :features="features" />

      <!-- 使用说明 -->
      <ToolUsageGuide :steps="usageSteps" />

      <!-- 常见问题 -->
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import { generateLorem, COUNT_LIMITS, TYPE_LABELS } from "@/utils/lorem.js";

// 响应式状态
const outputText = ref("");
const stats = ref(null);
const statusMessage = ref("");
const statusType = ref("");
const countRaw = ref("3");

const options = ref({
  type: "paragraphs",
  style: "lorem",
  startWithLorem: true
});

// 生成文本：数量严格校验，出错保留上次结果
const generateText = () => {
  try {
    const result = generateLorem({
      type: options.value.type,
      count: countRaw.value,
      style: options.value.style,
      startWithLorem: options.value.startWithLorem
    });
    outputText.value = result.text;
    stats.value = result.stats;
    statusMessage.value = `✓ 已生成 ${countRaw.value.trim()} 个${TYPE_LABELS[options.value.type]}`;
    statusType.value = "success";
  } catch (e) {
    statusMessage.value = `✗ ${e.message}`;
    statusType.value = "error";
  }
};

// 复制
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
};

const copyOutput = async () => {
  if (!outputText.value) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  if (await copyToClipboard(outputText.value)) {
    statusMessage.value = "✓ 已复制文本";
    statusType.value = "success";
  }
};

// 下载
const downloadOutput = () => {
  if (!outputText.value) return;
  const blob = new Blob([outputText.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lorem-ipsum.txt";
  a.click();
  URL.revokeObjectURL(url);
  statusMessage.value = "✓ 已下载 lorem-ipsum.txt";
  statusType.value = "success";
};

// 清空
const clearAll = () => {
  outputText.value = "";
  stats.value = null;
  statusMessage.value = "";
};

// 使用示例
const useExample = (example) => {
  options.value = { ...options.value, ...example.options };
  if (example.options.count !== undefined) countRaw.value = String(example.options.count);
  generateText();
};

// 功能特点
const features = [
  { icon: "📝", title: "多种风格", description: "支持经典 Lorem、中文和 Hipster 风格" },
  { icon: "📊", title: "灵活生成", description: "可按段落、句子或单词数量生成，数量严格校验" },
  { icon: "🔢", title: "真实统计", description: "按段/句/词与 Unicode 码点、UTF-8 字节统计" },
  { icon: "📋", title: "一键复制/下载", description: "快速复制生成的占位文本，或下载为 .txt 文件" },
  { icon: "🎯", title: "自定义开头", description: "经典风格可选择以 Lorem ipsum 标准句开头" },
  { icon: "⚡", title: "即时预览", description: "生成后立即显示预览效果" },
];

// 使用说明
const usageSteps = [
  "选择生成类型（段落/句子/单词）",
  "设置需要生成的数量",
  "选择文本风格",
  "点击「生成文本」按钮",
  "复制生成的文本使用",
];

// 常见问题
const faqs = [
  { question: "Lorem Ipsum 是什么？", answer: "Lorem Ipsum 是一种常用的占位文本，源自拉丁语，用于在设计和排版过程中作为临时文本，以便专注于视觉效果而非内容。" },
  { question: "为什么使用占位文本？", answer: "在设计阶段，使用占位文本可以帮助设计师专注于布局和视觉效果，而不会被具体内容分散注意力。" },
  { question: "中文占位文有什么特点？", answer: "中文占位文使用经典的《千字文》文本，既有传统文化气息，又能很好地展示中文排版效果。中文风格按「句」生成时每句由 3–6 个四字短语组成，统计按字数计。" },
  { question: "Hipster Ipsum 是什么？", answer: "Hipster Ipsum 是一种有趣的占位文本变体，使用时髦的流行词汇，为设计增添一些现代感和幽默感。" },
  { question: "数量填错会怎样？", answer: "数量必须是正整数：段落最多 50、句子最多 200、单词最多 1000。填小数、负数或超限会直接报错并指出上限，不会像旧版那样静默截断或生成错误数量，且出错时保留上一次生成结果。" },
  { question: "「以 Lorem ipsum 开头」对单词类型也生效吗？", answer: "生效：段落/句子类型会把第一句换成标准句「Lorem ipsum dolor sit amet, consectetur adipiscing elit.」，单词类型则以前五个经典词开头（数量不足 5 时只取前几个）。该选项仅对经典 Lorem 风格生效。" },
];

// 使用示例
const examples = [
  { input: "3段经典占位文", output: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. …", description: "工具介绍文案", options: { type: "paragraphs", count: 3, style: "lorem", startWithLorem: true } },
  { input: "5句中文占位文", output: "天地玄黄宇宙洪荒日月盈昃辰宿列张。…", description: "中文功能文案", options: { type: "sentences", count: 5, style: "chinese" } },
  { input: "10个单词", output: "lorem ipsum dolor sit amet …", description: "关键词占位", options: { type: "words", count: 10, style: "lorem", startWithLorem: true } },
];
</script>

<style scoped>
.lorem-generator {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 2.5rem;
  color: var(--text-strong);
  margin-bottom: 10px;
  text-align: center;
}

.description {
  text-align: center;
  color: var(--text-2);
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.tool-container {
  background: var(--surface);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--shadow-md);
}

/* 设置区域 */
.settings-section {
  background: var(--bg);
  border-radius: 10px;
  padding: 20px;
  margin: 20px 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: 20px;
}

.setting-item label {
  display: block;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 8px;
}

.setting-item select,
.setting-item input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 16px;
  background: var(--surface);
  color: var(--text-strong);
  box-sizing: border-box;
}

.setting-item select:focus,
.setting-item input:focus {
  border-color: var(--accent);
}

.checkbox-item {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal !important;
}

.checkbox-label.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* 输出区域 */
.output-section {
  background: var(--bg);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.output-header h2 {
  margin: 0;
  color: var(--text-strong);
}

.text-stats {
  color: var(--text-2);
  font-size: 14px;
}

.text-output-wrapper {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.text-output {
  margin: 0;
  padding: 16px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-strong);
  white-space: pre-wrap;
  word-break: break-word;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-3);
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
