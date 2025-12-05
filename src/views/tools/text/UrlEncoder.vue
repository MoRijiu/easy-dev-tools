<template>
  <div class="url-encoder">
    <h1>URL 编解码工具</h1>
    <p class="description">
      在线 URL 编码和解码工具，支持 URL 参数的快速转换
    </p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="encodeUrl">
          <span class="icon">🔒</span> 编码
        </button>
        <button class="btn btn-secondary" @click="decodeUrl">
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

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 编辑器区域 -->
      <ToolEditorLayout>
        <ToolEditorPanel title="输入内容" :info="`${inputText.length} 字符`">
          <textarea
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

const inputText = ref("");
const outputText = ref("");
const statusMessage = ref("");
const statusType = ref("");

// 功能特点数据
const features = [
  {
    icon: "🔒",
    title: "快速编码",
    description: "将特殊字符转换为 URL 安全格式",
  },
  {
    icon: "🔓",
    title: "安全解码",
    description: "将 URL 编码字符串还原为原始文本",
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
  "在左侧输入框中粘贴或输入需要处理的文本或 URL",
  '点击"编码"按钮将特殊字符转换为 URL 编码格式（如空格变为 %20）',
  '点击"解码"按钮将 URL 编码字符串还原为原始文本',
  '使用"交换"按钮可以将输出结果移至输入框，方便连续操作',
  '点击"复制结果"按钮复制转换后的内容',
];

// 常见问题数据
const faqs = [
  {
    question: "什么是 URL 编码？",
    answer:
      "URL 编码（也称为百分号编码）是一种将特殊字符转换为可在 URL 中安全传输格式的编码方式。例如，空格会被编码为 %20，中文字符会被编码为 %XX%XX%XX 的形式。",
  },
  {
    question: "为什么需要 URL 编码？",
    answer:
      "URL 中只能使用有限的字符集（字母、数字和少数特殊字符）。当 URL 包含中文、空格或其他特殊字符时，必须进行编码才能正确传输和解析。",
  },
  {
    question: "encodeURI 和 encodeURIComponent 有什么区别？",
    answer:
      "encodeURI 用于编码完整的 URL，会保留 URL 结构字符（如 :/?#）。encodeURIComponent 用于编码 URL 参数，会编码所有非字母数字字符。本工具使用 encodeURIComponent 进行完整编码。",
  },
  {
    question: "支持中文吗？",
    answer:
      "支持。本工具使用 UTF-8 编码处理文本，完美支持中文、日文、韩文等多语言字符。",
  },
];

// 使用示例数据
const examples = [
  {
    input: "极速开发工具箱",
    output: "%E6%9E%81%E9%80%9F%E5%BC%80%E5%8F%91%E5%B7%A5%E5%85%B7%E7%AE%B1",
    description: "中文编码示例",
  },
  {
    input: "tool=morijiu&type=encoder",
    output: "tool%3Dmorijiu%26type%3Dencoder",
    description: "URL 参数编码",
  },
  {
    input: "https://tools.morijiu.cn/search?q=开发工具",
    output: "https%3A%2F%2Ftools.morijiu.cn%2Fsearch%3Fq%3D%E5%BC%80%E5%8F%91%E5%B7%A5%E5%85%B7",
    description: "完整 URL 编码",
  },
];

// URL 编码
const encodeUrl = () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要编码的内容";
    statusType.value = "error";
    return;
  }
  try {
    const encoded = encodeURIComponent(inputText.value);
    outputText.value = encoded;
    statusMessage.value = `✓ 编码成功！从 ${inputText.value.length} 字符转换为 ${encoded.length} 字符`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 编码失败: ${error.message}`;
    statusType.value = "error";
    outputText.value = "";
  }
};

// 使用示例
const useExample = (example) => {
  inputText.value = example.input;
  encodeUrl();
};

// URL 解码
const decodeUrl = () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要解码的 URL 编码字符串";
    statusType.value = "error";
    return;
  }
  try {
    const decoded = decodeURIComponent(inputText.value);
    outputText.value = decoded;
    statusMessage.value = `✓ 解码成功！从 ${inputText.value.length} 字符转换为 ${decoded.length} 字符`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 解码失败: ${error.message}`;
    statusType.value = "error";
    outputText.value = "";
  }
};

// 清空内容
const clearAll = () => {
  inputText.value = "";
  outputText.value = "";
  statusMessage.value = "";
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
  statusMessage.value = "✓ 输入输出内容已交换";
  statusType.value = "info";
};
</script>

<style scoped>
.url-encoder {
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
