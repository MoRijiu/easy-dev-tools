<template>
  <div class="base64-encoder">
    <h1>Base64 编解码工具</h1>
    <p class="description">
      在线 Base64 编码和解码工具，支持文本和文件的快速转换
    </p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="encodeBase64">
          <span class="icon">🔒</span> 编码
        </button>
        <button class="btn btn-secondary" @click="decodeBase64">
          <span class="icon">🔓</span> 解码
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon">📋</span> 复制结果
        </button>
        <button class="btn btn-info" @click="swapContent">
          <span class="icon">🔄</span> 交换
        </button>
      </ToolToolbar>

      <!-- 编码选项 -->
      <div class="options-row">
        <div class="segmented" role="group" aria-label="编码字母表">
          <button type="button" :class="{ active: alphabet === 'standard' }" @click="alphabet = 'standard'">标准（+ /）</button>
          <button type="button" :class="{ active: alphabet === 'urlsafe' }" @click="alphabet = 'urlsafe'">URL-safe（- _）</button>
        </div>
        <label class="check-option">
          <input type="checkbox" v-model="withPadding" />
          编码时保留结尾填充 =
        </label>
        <span class="options-hint">解码会自动识别两种字母表，缺少填充也能解</span>
      </div>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <p v-if="statsText" class="stats-line">{{ statsText }}</p>

      <!-- 编辑器容器 -->
      <ToolEditorLayout>
        <ToolEditorPanel title="输入内容" :info="`${inputText.length} 字符`">
          <textarea aria-label="输入需要编码或解码的内容"
            v-model="inputText"
            class="text-input"
            placeholder="在此输入需要编码或解码的内容..."
          ></textarea>
        </ToolEditorPanel>

        <ToolEditorPanel title="输出结果" :info="`${outputText.length} 字符`">
          <div class="text-output-wrapper">
            <pre v-if="outputText" class="text-output">{{ outputText }}</pre>
            <div v-else class="placeholder">编码或解码后的结果将显示在这里</div>
          </div>
        </ToolEditorPanel>
      </ToolEditorLayout>

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
import ToolEditorLayout from "@/components/ToolEditorLayout.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";
import { encodeBase64Text, decodeBase64Text, base64GrowthText } from "@/utils/base64.js";

const inputText = ref("");
const outputText = ref("");
const statusMessage = ref("");
const statusType = ref("");
const alphabet = ref("standard");
const withPadding = ref(true);
const statsText = ref("");

// 功能特点数据
const features = [
  {
    icon: "🔒",
    title: "快速编码",
    description: "将文本快速转换为 Base64 格式",
  },
  {
    icon: "🔓",
    title: "安全解码",
    description: "将 Base64 字符串还原为原始文本",
  },
  {
    icon: "🌍",
    title: "Unicode 支持",
    description: "完美支持中文等多语言字符",
  },
  { icon: "⚡", title: "即时转换", description: "本地处理，无需上传服务器" },
  { icon: "🔄", title: "双向转换", description: "一键交换输入输出内容" },
  { icon: "📋", title: "一键复制", description: "快速复制转换结果到剪贴板" },
];

// 使用说明数据
const usageSteps = [
  "在左侧输入框中粘贴或输入需要处理的文本",
  '点击"编码"按钮将文本转换为 Base64 格式',
  '点击"解码"按钮将 Base64 字符串还原为原始文本',
  '使用"交换"按钮可以将输出结果移至输入框，方便连续操作',
  '点击"复制结果"按钮复制转换后的内容',
];

// 常见问题数据
const faqs = [
  {
    question: "什么是 Base64 编码？",
    answer:
      "Base64 是一种用 64 个可打印字符来表示二进制数据的编码方式。它常用于在文本协议中传输二进制数据，如在 HTML 中嵌入图片、在 URL 中传递参数等。",
  },
  {
    question: "Base64 编码是加密吗？",
    answer:
      "不是。Base64 只是一种编码方式，不是加密算法。任何人都可以轻松解码 Base64 字符串，因此不应该用它来保护敏感信息。",
  },
  {
    question: "为什么 Base64 编码后的数据变大了？",
    answer:
      "Base64 编码会将 3 个字节的数据转换为 4 个字符，因此编码后的数据大小约为原始数据的 4/3 倍（约增加 33%）。",
  },
  {
    question: "支持中文吗？",
    answer:
      "支持。本工具使用 UTF-8 编码处理文本，完美支持中文、日文、韩文等多语言字符。",
  },
  {
    question: "标准 Base64 和 URL-safe 有什么区别？",
    answer:
      "标准字母表用 + 和 /，放在 URL 参数里会被误解析；URL-safe 把它们换成 - 和 _，可以直接放进链接。解码时本工具会自动识别是哪一种，但两种不能混在同一串里。",
  },
  {
    question: "结尾的 = 是什么，能去掉吗？",
    answer:
      "= 是填充符，让总长度凑齐 4 的倍数，本身不携带数据。去掉也能解码（本工具会自动补齐），但有些严格的服务端会拒绝无填充的输入，拿不准时建议保留。",
  },
  {
    question: "解码提示「不是合法的 UTF-8 文本」是什么意思？",
    answer:
      "说明这段 Base64 编码的原始内容是图片、压缩包等二进制数据，而不是文本。它不是编码错了，只是没法当文字显示。",
  },
];

// 使用示例数据
const examples = [
  {
    input: "tools.morijiu.cn",
    output: "dG9vbHMubW9yaWppdS5jbg==",
    description: "网站域名编码",
  },
  {
    input: "极速开发工具箱",
    output: "5p6B6YCf5byA5Y+R5bel5YW3566x",
    description: "中文文本编码",
  },
  {
    input: '{"site":"morijiu","tool":"base64"}',
    output: "eyJzaXRlIjoibW9yaWppdSIsInRvb2wiOiJiYXNlNjQifQ==",
    description: "JSON 数据编码",
  },
];

// Base64 编码（分块处理，长文本也不会爆栈）
const encodeBase64 = () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要编码的内容";
    statusType.value = "error";
    statsText.value = "";
    return;
  }
  const result = encodeBase64Text(inputText.value, {
    urlSafe: alphabet.value === "urlsafe",
    padding: withPadding.value,
  });
  outputText.value = result.output;
  statusMessage.value = `✓ 编码成功（${result.alphabet}字母表）`;
  statusType.value = "success";
  statsText.value = `输入 ${result.inputChars} 字符 · UTF-8 ${result.bytes} 字节 · 输出 ${result.outputChars} 字符 · ${base64GrowthText(result.bytes, result.outputChars)}`;
};

// 使用示例
const useExample = (example) => {
  inputText.value = example.input;
  encodeBase64();
};

// Base64 解码（逐字校验，错误精确定位；解出非 UTF-8 会明确提示是二进制数据）
const decodeBase64 = () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要解码的 Base64 字符串";
    statusType.value = "error";
    statsText.value = "";
    return;
  }
  const result = decodeBase64Text(inputText.value);
  if (!result.ok) {
    statusMessage.value = `✗ 解码失败：${result.error.message}`;
    statusType.value = "error";
    outputText.value = "";
    statsText.value = "";
    return;
  }
  outputText.value = result.text;
  const warn = result.warnings.length ? `（${result.warnings.join("；")}）` : "";
  statusMessage.value = `✓ 解码成功（识别为 ${result.alphabet}字母表）${warn}`;
  statusType.value = "success";
  statsText.value = `输入 ${result.inputChars} 字符 · 解出 ${result.bytes} 字节 · 文本 ${result.text.length} 字符`;
};

// 清空内容
const clearAll = () => {
  inputText.value = "";
  outputText.value = "";
  statusMessage.value = "";
  statsText.value = "";
};

// 复制输出结果
const copyOutput = async () => {
  if (!outputText.value) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  try {
    await navigator.clipboard.writeText(outputText.value);
    statusMessage.value = "✓ 已复制到剪贴板！";
    statusType.value = "success";
    setTimeout(() => {
      statusMessage.value = "";
    }, 2000);
  } catch (error) {
    statusMessage.value = "✗ 复制失败，请手动复制";
    statusType.value = "error";
  }
};

// 交换输入输出
const swapContent = () => {
  if (!outputText.value) {
    statusMessage.value = "✗ 没有可交换的内容";
    statusType.value = "error";
    return;
  }
  const temp = outputText.value;
  outputText.value = inputText.value;
  inputText.value = temp;
  statsText.value = "";
  statusMessage.value = "✓ 输入输出内容已交换";
  statusType.value = "info";
};
</script>

<style scoped>
.base64-encoder {
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

.options-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-bottom: 12px;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.segmented button {
  padding: 6px 12px;
  font-size: 13px;
  background: var(--surface);
  color: var(--text-2);
  border: none;
  cursor: pointer;
}

.segmented button.active {
  background: var(--accent);
  color: #fff;
}

.check-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
}

.options-hint {
  font-size: 12px;
  color: var(--text-3, var(--text-2));
}

.stats-line {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-2);
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }
}
</style>
