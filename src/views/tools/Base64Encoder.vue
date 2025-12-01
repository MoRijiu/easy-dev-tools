<template>
  <div class="base64-encoder">
    <h1>Base64 编解码工具</h1>
    <p class="description">
      在线 Base64 编码和解码工具，支持文本和文件的快速转换
    </p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <div class="toolbar">
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
      </div>

      <!-- 状态信息 -->
      <div v-if="statusMessage" class="status-message" :class="statusType">
        {{ statusMessage }}
      </div>

      <!-- 编辑器容器 -->
      <div class="editor-container">
        <div class="editor-panel">
          <div class="panel-header">
            <h3>输入内容</h3>
            <span class="char-count">{{ inputText.length }} 字符</span>
          </div>
          <textarea
            v-model="inputText"
            class="text-input"
            placeholder="在此输入需要编码或解码的内容..."
          ></textarea>
        </div>

        <div class="editor-panel">
          <div class="panel-header">
            <h3>输出结果</h3>
            <span class="char-count">{{ outputText.length }} 字符</span>
          </div>
          <div class="text-output-wrapper">
            <pre v-if="outputText" class="text-output">{{ outputText }}</pre>
            <div v-else class="placeholder">编码或解码后的结果将显示在这里</div>
          </div>
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

const inputText = ref("");
const outputText = ref("");
const statusMessage = ref("");
const statusType = ref("");

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
];

// 使用示例数据
const examples = [
  {
    input: "Hello World",
    output: "SGVsbG8gV29ybGQ=",
    description: "英文文本编码",
  },
  {
    input: "你好世界",
    output: "5L2g5aW95LiW55WM",
    description: "中文文本编码",
  },
  {
    input: '{"name":"test","value":123}',
    output: "eyJuYW1lIjoidGVzdCIsInZhbHVlIjoxMjN9",
    description: "JSON 数据编码",
  },
];

// Base64 编码
const encodeBase64 = () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要编码的内容";
    statusType.value = "error";
    return;
  }
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(inputText.value);
    const base64 = btoa(String.fromCharCode(...data));
    outputText.value = base64;
    statusMessage.value = `✓ 编码成功！从 ${inputText.value.length} 字符转换为 ${base64.length} 字符`;
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
  encodeBase64();
};

// Base64 解码
const decodeBase64 = () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要解码的 Base64 字符串";
    statusType.value = "error";
    return;
  }
  try {
    const cleanInput = inputText.value.replace(/\s/g, "");
    const binaryString = atob(cleanInput);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    const decoded = decoder.decode(bytes);
    outputText.value = decoded;
    statusMessage.value = `✓ 解码成功！从 ${inputText.value.length} 字符转换为 ${decoded.length} 字符`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = "✗ 解码失败: 输入的不是有效的 Base64 字符串";
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
.base64-encoder {
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

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
  align-items: center;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
}

.btn-info {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.btn-info:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
}

.btn-success {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(67, 233, 123, 0.4);
}

.btn-danger {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(250, 112, 154, 0.4);
}

.icon {
  font-size: 16px;
}

/* 状态信息 */
.status-message {
  padding: 12px 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

/* 编辑器容器 */
.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 40px;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.char-count {
  font-size: 12px;
  opacity: 0.9;
}

.text-input {
  flex: 1;
  min-height: 400px;
  padding: 20px;
  border: none;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: #f8f9fa;
}

.text-input:focus {
  outline: none;
  background: #fff;
}

.text-output-wrapper {
  flex: 1;
  min-height: 400px;
  overflow: auto;
  background: #f8f9fa;
}

.text-output {
  margin: 0;
  padding: 20px;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.6;
  background: #f8f9fa;
  white-space: pre-wrap;
  word-break: break-all;
}

.placeholder {
  padding: 20px;
  color: #999;
  text-align: center;
  font-style: italic;
}

/* 响应式设计 */
@media (max-width: 968px) {
  .editor-container {
    grid-template-columns: 1fr;
  }

  .toolbar {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
