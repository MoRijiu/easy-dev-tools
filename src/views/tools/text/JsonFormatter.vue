<!--
 * @Author: zhengduo
 * @Date: 2025-12-01 14:10:02
 * @LastEditors: Do not edit
 * @LastEditTime: 2025-12-05 14:31:30
 * @Description: JSON 格式化工具
-->
<template>
  <div class="json-formatter">
    <h1>JSON 格式化工具</h1>
    <p class="description">在线 JSON 格式化、验证、压缩和美化工具，支持语法高亮和错误提示</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button @click="formatJson" class="btn btn-primary" :disabled="!inputJson.trim()">
          <span class="icon" aria-hidden="true">✨</span> 格式化
        </button>
        <button @click="minifyJson" class="btn btn-secondary" :disabled="!inputJson.trim()">
          <span class="icon" aria-hidden="true">📦</span> 压缩
        </button>
        <button @click="validateJson" class="btn btn-info" :disabled="!inputJson.trim()">
          <span class="icon" aria-hidden="true">✓</span> 验证
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputJson">
          <span class="icon" aria-hidden="true">📋</span> 复制结果
        </button>
        <button @click="useOutputAsInput" class="btn btn-secondary" :disabled="!outputJson">
          结果作输入
        </button>
        <button @click="downloadOutput" class="btn btn-secondary" :disabled="!outputJson">
          下载 .json
        </button>

        <div class="options">
          <label>
            <input type="checkbox" v-model="options.sortKeys"> 排序键名
          </label>
          <label>
            <input type="number" v-model.number="options.indent" min="2" max="8" style="width: 50px;"> 缩进空格
          </label>
        </div>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage id="json-formatter-status" :message="statusMessage" :type="statusType" />

      <!-- 错误定位详情 -->
      <div v-if="errorDetail" class="error-detail" role="alert">
        <div class="error-detail-head">
          <span v-if="errorDetail.line != null">第 {{ errorDetail.line }} 行第 {{ errorDetail.column }} 列（字符 {{ errorDetail.position }}）</span>
          <button class="mini-btn" @click="copyError">复制诊断</button>
        </div>
        <pre v-if="errorDetail.lineText" class="error-line">{{ errorDetail.lineText }}
{{ ' '.repeat(Math.max(0, errorDetail.column - 1)) }}↑ 出错位置</pre>
        <p v-for="(hint, i) in errorDetail.hints" :key="i" class="error-hint">可能原因：{{ hint }}</p>
      </div>

      <!-- 结构统计 -->
      <p v-if="statsSummary" class="stats-line">{{ statsSummary }}</p>

      <!-- 编辑器区域 -->
      <ToolEditorLayout>
        <!-- 输入区 -->
        <ToolEditorPanel title="输入 JSON" :info="`${inputJson.length} 字符`">
          <textarea aria-label="输入 JSON" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'json-formatter-status' : undefined"
            v-model="inputJson"
            class="json-input"
            placeholder='请输入 JSON 数据，例如：{"name": "张三", "age": 25}'
            spellcheck="false"
            @input="onInputChange"
          ></textarea>
        </ToolEditorPanel>

        <!-- 输出区 -->
        <ToolEditorPanel title="输出结果" :info="outputJson ? `${outputJson.length} 字符` : ''">
          <div class="json-output-wrapper">
            <pre v-if="outputJson" class="json-output"><code v-html="highlightedJson"></code></pre>
            <div v-else class="placeholder">格式化后的 JSON 将显示在这里</div>
          </div>
        </ToolEditorPanel>
      </ToolEditorLayout>

      <!-- 使用示例 -->
      <ToolExamples :examples="examples" @use-example="useExample" />

      <!-- 功能说明 -->
      <ToolFeatures :features="features" />

      <!-- 使用说明 -->
      <ToolUsageGuide :steps="usageSteps" />

      <!-- 常见问题 -->
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import ToolEditorLayout from '@/components/ToolEditorLayout.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { parseJsonDetailed, sortObjectKeys, jsonStats, buildJsonStatsSummary, buildJsonErrorSummary } from '@/utils/jsonFormat.js';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { useDownload } from '@/composables/useDownload.js';

// 功能特点数据
const features = [
  { icon: '✨', title: '智能格式化', description: '自动美化 JSON 数据，使其更易读' },
  { icon: '🔍', title: '语法验证', description: '实时检测 JSON 语法错误并提示' },
  { icon: '🎨', title: '语法高亮', description: '彩色显示不同类型的数据' },
  { icon: '📦', title: '压缩功能', description: '移除空格和换行，减小体积' },
  { icon: '🔤', title: '键名排序', description: '按字母顺序排列对象键名' },
  { icon: '⚡', title: '快速处理', description: '支持大文件快速格式化' }
];

// 使用说明数据
const usageSteps = [
  '在左侧输入框中粘贴或输入 JSON 数据',
  '点击"格式化"按钮美化 JSON，或点击"压缩"按钮压缩 JSON',
  '点击"验证"按钮检查 JSON 语法是否正确',
  '可选择"排序键名"选项对对象键进行排序',
  '调整缩进空格数来控制格式化的缩进级别',
  '点击"复制结果"按钮复制格式化后的 JSON'
];

// 常见问题数据
const faqs = [
  {
    question: '什么是 JSON？',
    answer: 'JSON (JavaScript Object Notation) 是一种轻量级的数据交换格式，易于人阅读和编写，同时也易于机器解析和生成。'
  },
  {
    question: 'JSON 格式化有什么用？',
    answer: '格式化可以使压缩的 JSON 数据变得易读，方便开发者调试和查看数据结构。压缩则可以减小数据体积，提高传输效率。'
  },
  {
    question: '如何修复 JSON 语法错误？',
    answer: '常见错误包括：缺少引号、多余的尾随逗号、括号不匹配等。本工具会在报错时标出第几行第几列、展示出错行并给出最可能的原因提示，照着改即可；诊断信息还能一键复制发给同事。'
  },
  {
    question: '是否支持大文件？',
    answer: '本工具支持处理较大的 JSON 文件，但建议单个文件不超过 10MB 以保证最佳性能。'
  }
];

// 使用示例数据
const examples = [
  {
    input: '{"name":"morijiu","site":"tools.morijiu.cn"}',
    output: '{\n  "name": "morijiu",\n  "site": "tools.morijiu.cn"\n}',
    description: '简单对象格式化',
  },
  {
    input: '["极速开发工具箱","JSON格式化","Base64编码"]',
    output: '[\n  "极速开发工具箱",\n  "JSON格式化",\n  "Base64编码"\n]',
    description: '数组格式化',
  },
  {
    input: '{"tools":[{"id":1,"name":"JSON格式化"},{"id":2,"name":"时间戳转换"}]}',
    output: '{\n  "tools": [\n    {\n      "id": 1,\n      "name": "JSON格式化"\n    },\n    {\n      "id": 2,\n      "name": "时间戳转换"\n    }\n  ]\n}',
    description: '嵌套结构格式化',
  },
];

const inputJson = ref('');
const outputJson = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const { copyText } = useClipboard(status);
const download = useDownload();
const errorDetail = ref(null);
const inputErrorText = ref('');
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const statsSummary = ref('');
const options = ref({
  indent: 2,
  sortKeys: false
});

let debounceTimer = null;

// 输入变化时的处理
const onInputChange = () => {
  statusMessage.value = '';
  errorDetail.value = null;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (inputJson.value.trim()) {
      validateJson();
    }
  }, 1000);
};

// 卸载时取消待发的防抖校验，避免离开页面后仍校验已卸载组件的输入
onBeforeUnmount(() => { clearTimeout(debounceTimer); debounceTimer = null; });

// 统一处理解析失败：状态行 + 定位详情面板
const applyError = (error) => {
  status.showError(`✗ JSON 格式错误: ${error.message}`);
  inputErrorText.value = statusMessage.value;
  errorDetail.value = error;
  statsSummary.value = '';
  outputJson.value = '';
};

// 格式化 JSON
const formatJson = () => {
  const result = parseJsonDetailed(inputJson.value);
  if (!result.ok) { applyError(result.error); return; }
  const sorted = options.value.sortKeys ? sortObjectKeys(result.value) : result.value;
  outputJson.value = JSON.stringify(sorted, null, options.value.indent);
  errorDetail.value = null;
  statsSummary.value = buildJsonStatsSummary(jsonStats(result.value));
  status.showSuccess('✓ JSON 格式化成功！');
};

// 使用示例
const useExample = (example) => {
  inputJson.value = example.input;
  formatJson();
};

// 压缩 JSON
const minifyJson = () => {
  const result = parseJsonDetailed(inputJson.value);
  if (!result.ok) { applyError(result.error); return; }
  outputJson.value = JSON.stringify(result.value);
  errorDetail.value = null;
  statsSummary.value = buildJsonStatsSummary(jsonStats(result.value));
  const ratio = inputJson.value.length ? Math.round((1 - outputJson.value.length / inputJson.value.length) * 100) : 0;
  status.showSuccess(`✓ JSON 压缩成功！从 ${inputJson.value.length} 字符压缩到 ${outputJson.value.length} 字符（-${ratio}%）`);
};

// 验证 JSON
const validateJson = () => {
  const result = parseJsonDetailed(inputJson.value);
  if (!result.ok) { applyError(result.error); return false; }
  errorDetail.value = null;
  statsSummary.value = buildJsonStatsSummary(jsonStats(result.value));
  status.showSuccess('✓ JSON 格式正确！');
  return true;
};

// 清空所有内容
const clearAll = () => {
  inputJson.value = '';
  outputJson.value = '';
  statusMessage.value = '';
  errorDetail.value = null;
  statsSummary.value = '';
};

// 结果作输入（便于二次格式化/改缩进/排序）
const useOutputAsInput = () => {
  if (!outputJson.value) return;
  inputJson.value = outputJson.value;
  status.showInfo('已把输出填回输入框');
};

// 下载输出为 .json 文件（纯本地生成）
const downloadOutput = () => {
  if (!outputJson.value) return;
  download.downloadText(outputJson.value, 'formatted.json', 'application/json');
};

// 复制错误诊断（原文行 + 位置 + 可能原因）
const copyError = async () => {
  await copyText(buildJsonErrorSummary(errorDetail.value), '✓ 诊断信息已复制');
};

// 复制输出结果
const copyOutput = async () => {
  await copyText(outputJson.value, '✓ 已复制到剪贴板！', { autoClearMs: 2000 });
};

// 语法高亮
const highlightedJson = computed(() => {
  if (!outputJson.value) return '';
  
  return outputJson.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
});

// 监听选项变化
watch(() => options.value.indent, () => {
  if (outputJson.value) {
    formatJson();
  }
});

watch(() => options.value.sortKeys, () => {
  if (outputJson.value) {
    formatJson();
  }
});
</script>

<style scoped>
.json-formatter {
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

.error-detail {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid var(--danger-border);
  background: var(--danger-soft);
  border-radius: 8px;
  font-size: 0.9rem;
}

.error-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--danger-text);
}

.mini-btn {
  padding: 2px 10px;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.error-line {
  margin: 8px 0 0;
  padding: 8px;
  background: var(--surface);
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text);
}

.error-hint {
  margin: 6px 0 0;
  color: var(--text-2);
}

.stats-line {
  margin: 10px 0 0;
  font-size: 0.9rem;
  color: var(--text-2);
}

/* 语法高亮样式 */
:deep(.string) {
  color: var(--syntax-string);
}

:deep(.number) {
  color: var(--syntax-number);
}

:deep(.boolean) {
  color: var(--syntax-boolean);
}

:deep(.null) {
  color: var(--syntax-null);
}

:deep(.key) {
  color: var(--syntax-key);
  font-weight: 600;
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