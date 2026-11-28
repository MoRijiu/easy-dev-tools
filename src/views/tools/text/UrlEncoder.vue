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
          <span class="icon" aria-hidden="true">🔒</span> 编码
        </button>
        <button class="btn btn-secondary" @click="decodeUrl">
          <span class="icon" aria-hidden="true">🔓</span> 解码
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon" aria-hidden="true">📋</span> 复制结果
        </button>
        <button class="btn btn-info" @click="swapContent">
          <span class="icon" aria-hidden="true">🔄</span> 交换
        </button>
      </ToolToolbar>

      <!-- 编码模式 -->
      <div class="options-row">
        <div class="segmented" role="group" aria-label="编码模式">
          <button type="button" :class="{ active: mode === 'component' }" :aria-pressed="mode === 'component'" @click="mode = 'component'">参数 encodeURIComponent</button>
          <button type="button" :class="{ active: mode === 'uri' }" :aria-pressed="mode === 'uri'" @click="mode = 'uri'">完整 URL encodeURI</button>
          <button type="button" :class="{ active: mode === 'form' }" :aria-pressed="mode === 'form'" @click="mode = 'form'">表单 form</button>
        </div>
        <label class="check-option">
          <input type="checkbox" v-model="plusAsSpace" />
          解码时把 + 当空格（查询字符串）
        </label>
        <span class="options-hint">{{ modeHint }}</span>
      </div>

      <!-- 状态信息 -->
      <ToolStatusMessage id="url-encoder-status" :message="statusMessage" :type="statusType" />
      <p v-if="statsText" class="stats-line">{{ statsText }}</p>

      <!-- 编辑器区域 -->
      <ToolEditorLayout>
        <ToolEditorPanel title="输入内容" :info="`${inputText.length} 字符`">
          <textarea aria-label="输入需要编码或解码的内容" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'url-encoder-status' : undefined"
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
import { ref, computed } from "vue";
import { encodeUrlText, decodeUrlText } from "@/utils/urlCodec.js";
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
const inputErrorText = ref("");
const setInputError = (msg) => { statusMessage.value = msg; statusType.value = "error"; inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === "error" && inputErrorText.value !== "" && statusMessage.value === inputErrorText.value);
const mode = ref("component");
const plusAsSpace = ref(false);
const statsText = ref("");

const modeHint = computed(() => {
  if (mode.value === "uri") return "保留 : / ? # & = 等结构字符，只编码非法字符，整段链接用这个";
  if (mode.value === "form") return "按表单提交规则编码：空格变 +，其余同参数模式";
  return "连 & = 等结构字符也编码，放进查询参数的值用这个";
});

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
  "按用途选编码模式：参数值选「参数」、整段链接选「完整 URL」、模拟表单提交选「表单」",
  '点击"编码"按钮将特殊字符转换为 URL 编码格式（如空格变为 %20）',
  '点击"解码"按钮将 URL 编码字符串还原为原始文本；来源是查询字符串时可勾选「+ 当空格」；解码失败会指出第几个字符出错',
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
      "encodeURI 用于编码完整的 URL，会保留 URL 结构字符（如 :/?#）。encodeURIComponent 用于编码 URL 参数，会编码所有非字母数字字符。本工具上方可以切换两种模式：整段链接选「完整 URL」，参数值选「参数」。",
  },
  {
    question: "三种模式怎么选？",
    answer:
      "把一段文本放进查询参数或路径参数里，选「参数」模式；手头是整条链接、只想把里面的中文和空格处理掉，选「完整 URL」模式；模拟表单提交（application/x-www-form-urlencoded，空格变 +）选「表单」模式。",
  },
  {
    question: "解码时 + 号为什么有时是空格、有时是加号？",
    answer:
      "在查询字符串和表单编码里，+ 表示空格（真正的加号会写成 %2B）；但在路径等其他位置，+ 就是加号本身。解码来源是查询参数时，勾选「解码时把 + 当空格」即可。",
  },
  {
    question: "解码报错说 % 后面不是十六进制、或不是有效的 UTF-8，是什么意思？",
    answer:
      "百分号本身要写成 %25，后面只能跟两位十六进制数字；中文等字符的 %XX 字节连起来必须是完整的 UTF-8 序列。本工具会指出第几个字符出错：常见原因是编码被截断、把 GBK 编码的字节拿来按 UTF-8 解、或文本里混了没编码的 %。",
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
    setInputError("✗ 请输入需要编码的内容");
    return;
  }
  const result = encodeUrlText(inputText.value, { mode: mode.value });
  if (!result.ok) {
    setInputError(`✗ 编码失败：${result.error.message}`);
    outputText.value = "";
    statsText.value = "";
    return;
  }
  outputText.value = result.output;
  statusMessage.value = "✓ 编码成功！";
  statusType.value = "success";
  statsText.value = `输入 ${result.inputChars} 字符 · UTF-8 ${result.bytes} 字节 · 转义 ${result.escapes} 处 · 输出 ${result.outputChars} 字符`;
};

// 使用示例
const useExample = (example) => {
  mode.value = "component";
  inputText.value = example.input;
  encodeUrl();
};

// URL 解码
const decodeUrl = () => {
  if (!inputText.value.trim()) {
    setInputError("✗ 请输入需要解码的 URL 编码字符串");
    return;
  }
  const result = decodeUrlText(inputText.value, {
    mode: mode.value === "uri" ? "uri" : "component",
    plusAsSpace: plusAsSpace.value,
  });
  if (!result.ok) {
    setInputError(`✗ 解码失败：${result.error.message}`);
    outputText.value = "";
    statsText.value = "";
    return;
  }
  outputText.value = result.output;
  statusMessage.value = "✓ 解码成功！";
  statusType.value = "success";
  const parts = [`转义 ${result.escapes} 处`, `输出 ${result.outputChars} 字符`];
  if (result.plusCount) parts.push(`+ 转空格 ${result.plusCount} 处`);
  if (result.keptEscapes) parts.push(`完整 URL 模式保留了 ${result.keptEscapes} 处结构字符转义未解开`);
  statsText.value = parts.join(" · ");
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
    const ownMsg = statusMessage.value;
    setTimeout(() => {
      if (statusMessage.value === ownMsg) statusMessage.value = "";
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
.url-encoder {
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
  flex-wrap: wrap;
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
  background: var(--accent-solid);
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
