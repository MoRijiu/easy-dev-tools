<template>
  <div class="lorem-generator">
    <h1>📃 占位文本生成器</h1>
    <p class="description">生成 Lorem Ipsum 占位文本，用于设计和排版测试</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="generateText">
          <span class="icon">🎲</span> 生成文本
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon">📋</span> 复制全部
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 设置区域 -->
      <div class="settings-section">
        <div class="settings-grid">
          <div class="setting-item">
            <label>生成类型</label>
            <select v-model="options.type">
              <option value="paragraphs">段落</option>
              <option value="sentences">句子</option>
              <option value="words">单词</option>
            </select>
          </div>
          <div class="setting-item">
            <label>数量</label>
            <input type="number" v-model.number="options.count" min="1" max="100" />
          </div>
          <div class="setting-item">
            <label>文本风格</label>
            <select v-model="options.style">
              <option value="lorem">经典 Lorem Ipsum</option>
              <option value="chinese">中文占位文</option>
              <option value="hipster">Hipster Ipsum</option>
            </select>
          </div>
          <div class="setting-item checkbox-item">
            <label class="checkbox-label">
              <input type="checkbox" v-model="options.startWithLorem" />
              <span>以 "Lorem ipsum" 开头</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 输出区域 -->
      <div class="output-section">
        <div class="output-header">
          <h3>生成的文本</h3>
          <span class="text-stats" v-if="outputText">
            {{ wordCount }} 词 / {{ charCount }} 字符
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
import { ref, computed } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";

// 响应式状态
const outputText = ref("");
const statusMessage = ref("");
const statusType = ref("");

const options = ref({
  type: "paragraphs",
  count: 3,
  style: "lorem",
  startWithLorem: true
});

// 词库数据
const loremWords = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "vivamus", "vestibulum",
  "sagittis", "sapien", "cum", "sociis", "natoque", "penatibus", "magnis", "dis",
  "parturient", "montes", "nascetur", "ridiculus", "mus", "donec", "quam", "felis",
  "ultricies", "nec", "pellentesque", "eu", "pretium", "quis", "sem", "nulla",
  "consequat", "massa", "quis", "enim", "donec", "pede", "justo", "fringilla"
];

const chineseWords = [
  "天地玄黄", "宇宙洪荒", "日月盈昃", "辰宿列张", "寒来暑往", "秋收冬藏",
  "闰余成岁", "律吕调阳", "云腾致雨", "露结为霜", "金生丽水", "玉出昆冈",
  "剑号巨阙", "珠称夜光", "果珍李柰", "菜重芥姜", "海咸河淡", "鳞潜羽翔",
  "龙师火帝", "鸟官人皇", "始制文字", "乃服衣裳", "推位让国", "有虞陶唐",
  "吊民伐罪", "周发殷汤", "坐朝问道", "垂拱平章", "爱育黎首", "臣伏戎羌",
  "遐迩一体", "率宾归王", "鸣凤在竹", "白驹食场", "化被草木", "赖及万方"
];

const hipsterWords = [
  "artisan", "authentic", "biodiesel", "brooklyn", "cardigan", "craft", "crucifix",
  "distillery", "dreamcatcher", "ethical", "fixie", "flannel", "gastropub", "gentrify",
  "hashtag", "helvetica", "hoodie", "intelligentsia", "irony", "jean", "kale", "keytar",
  "kickstarter", "kinfolk", "knausgaard", "lomo", "marfa", "meditation", "microdosing",
  "mustache", "neutra", "organic", "paleo", "pitchfork", "polaroid", "portland",
  "poutine", "raw", "selvage", "semiotics", "skateboard", "slow", "snackwave",
  "sustainable", "synth", "tacos", "tattooed", "taxidermy", "tofu", "trust",
  "tumblr", "twee", "typewriter", "umami", "vegan", "vexillologist", "vinyl"
];

// 获取当前词库
const getWordList = () => {
  switch (options.value.style) {
    case "chinese": return chineseWords;
    case "hipster": return hipsterWords;
    default: return loremWords;
  }
};

// 随机获取单词
const getRandomWord = (words) => words[Math.floor(Math.random() * words.length)];

// 生成句子
const generateSentence = (words, minWords = 8, maxWords = 15) => {
  const wordCount = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
  const sentenceWords = [];
  for (let i = 0; i < wordCount; i++) {
    sentenceWords.push(getRandomWord(words));
  }
  let sentence = sentenceWords.join(options.value.style === "chinese" ? "" : " ");
  // 首字母大写
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return sentence + (options.value.style === "chinese" ? "。" : ".");
};

// 生成段落
const generateParagraph = (words, sentenceCount = 5) => {
  const count = Math.floor(Math.random() * 3) + sentenceCount;
  const sentences = [];
  for (let i = 0; i < count; i++) {
    sentences.push(generateSentence(words));
  }
  return sentences.join(" ");
};

// 生成文本
const generateText = () => {
  const words = getWordList();
  let result = [];

  if (options.value.type === "words") {
    for (let i = 0; i < options.value.count; i++) {
      result.push(getRandomWord(words));
    }
    outputText.value = result.join(options.value.style === "chinese" ? "" : " ");
  } else if (options.value.type === "sentences") {
    for (let i = 0; i < options.value.count; i++) {
      result.push(generateSentence(words));
    }
    outputText.value = result.join(" ");
  } else {
    for (let i = 0; i < options.value.count; i++) {
      result.push(generateParagraph(words));
    }
    outputText.value = result.join("\n\n");
  }

  // 如果需要以 Lorem ipsum 开头
  if (options.value.startWithLorem && options.value.style === "lorem") {
    outputText.value = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
      outputText.value.substring(outputText.value.indexOf(". ") + 2);
  }

  statusMessage.value = `✓ 已生成 ${options.value.count} ${getTypeLabel()}`;
  statusType.value = "success";
};

const getTypeLabel = () => {
  const labels = { paragraphs: "个段落", sentences: "个句子", words: "个单词" };
  return labels[options.value.type];
};

// 统计
const wordCount = computed(() => {
  if (!outputText.value) return 0;
  if (options.value.style === "chinese") {
    return outputText.value.replace(/[。，、；：""''！？\s\n]/g, "").length;
  }
  return outputText.value.split(/\s+/).filter(w => w).length;
});

const charCount = computed(() => outputText.value.length);

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

// 清空
const clearAll = () => {
  outputText.value = "";
  statusMessage.value = "";
};

// 使用示例
const useExample = (example) => {
  options.value = { ...options.value, ...example.options };
  generateText();
};

// 功能特点
const features = [
  { icon: "📝", title: "多种风格", description: "支持经典 Lorem、中文和 Hipster 风格" },
  { icon: "📊", title: "灵活生成", description: "可按段落、句子或单词数量生成" },
  { icon: "🔢", title: "实时统计", description: "显示生成文本的词数和字符数" },
  { icon: "📋", title: "一键复制", description: "快速复制生成的占位文本" },
  { icon: "🎯", title: "自定义开头", description: "可选择是否以经典开头开始" },
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
  { question: "中文占位文有什么特点？", answer: "中文占位文使用经典的《千字文》文本，既有传统文化气息，又能很好地展示中文排版效果。" },
  { question: "Hipster Ipsum 是什么？", answer: "Hipster Ipsum 是一种有趣的占位文本变体，使用时髦的流行词汇，为设计增添一些现代感和幽默感。" },
];

// 使用示例
const examples = [
  { input: "3段产品描述", output: "Lorem ipsum...", description: "工具介绍文案", options: { type: "paragraphs", count: 3, style: "lorem" } },
  { input: "5句功能说明", output: "极速开发工具箱...", description: "中文功能文案", options: { type: "sentences", count: 5, style: "chinese" } },
  { input: "10个关键词", output: "morijiu, tools...", description: "SEO关键词", options: { type: "words", count: 10, style: "lorem" } },
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
  color: #2c3e50;
  margin-bottom: 10px;
  text-align: center;
}

.description {
  text-align: center;
  color: #666;
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.tool-container {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* 设置区域 */
.settings-section {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  margin: 20px 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.setting-item label {
  display: block;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
}

.setting-item select,
.setting-item input[type="number"] {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  background: white;
  box-sizing: border-box;
}

.setting-item select:focus,
.setting-item input:focus {
  outline: none;
  border-color: #667eea;
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

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* 输出区域 */
.output-section {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.output-header h3 {
  margin: 0;
  color: #2c3e50;
}

.text-stats {
  color: #666;
  font-size: 14px;
}

.text-output-wrapper {
  background: white;
  border: 2px solid #e0e0e0;
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
  color: #2c3e50;
  white-space: pre-wrap;
  word-break: break-word;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #999;
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

