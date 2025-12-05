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
          <span class="icon">✨</span> 格式化
        </button>
        <button @click="minifyJson" class="btn btn-secondary" :disabled="!inputJson.trim()">
          <span class="icon">📦</span> 压缩
        </button>
        <button @click="validateJson" class="btn btn-info" :disabled="!inputJson.trim()">
          <span class="icon">✓</span> 验证
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon">🗑️</span> 清空
        </button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!outputJson">
          <span class="icon">📋</span> 复制结果
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
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 编辑器区域 -->
      <ToolEditorLayout>
        <!-- 输入区 -->
        <ToolEditorPanel title="输入 JSON" :info="`${inputJson.length} 字符`">
          <textarea
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
import { ref, computed, watch } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import ToolEditorLayout from '@/components/ToolEditorLayout.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';

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
    answer: '常见错误包括：缺少引号、多余的逗号、括号不匹配等。使用验证功能可以快速定位错误位置。'
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
const statusMessage = ref('');
const statusType = ref(''); // 'success', 'error', 'info'
const options = ref({
  indent: 2,
  sortKeys: false
});

let debounceTimer = null;

// 输入变化时的处理
const onInputChange = () => {
  statusMessage.value = '';
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (inputJson.value.trim()) {
      validateJson();
    }
  }, 1000);
};

// 格式化 JSON
const formatJson = () => {
  try {
    const parsed = JSON.parse(inputJson.value);
    const sorted = options.value.sortKeys ? sortObjectKeys(parsed) : parsed;
    outputJson.value = JSON.stringify(sorted, null, options.value.indent);
    statusMessage.value = '✓ JSON 格式化成功！';
    statusType.value = 'success';
  } catch (error) {
    statusMessage.value = `✗ JSON 格式错误: ${error.message}`;
    statusType.value = 'error';
    outputJson.value = '';
  }
};

// 使用示例
const useExample = (example) => {
  inputJson.value = example.input;
  formatJson();
};

// 压缩 JSON
const minifyJson = () => {
  try {
    const parsed = JSON.parse(inputJson.value);
    outputJson.value = JSON.stringify(parsed);
    statusMessage.value = `✓ JSON 压缩成功！从 ${inputJson.value.length} 字符压缩到 ${outputJson.value.length} 字符`;
    statusType.value = 'success';
  } catch (error) {
    statusMessage.value = `✗ JSON 格式错误: ${error.message}`;
    statusType.value = 'error';
    outputJson.value = '';
  }
};

// 验证 JSON
const validateJson = () => {
  try {
    JSON.parse(inputJson.value);
    statusMessage.value = '✓ JSON 格式正确！';
    statusType.value = 'success';
    return true;
  } catch (error) {
    statusMessage.value = `✗ JSON 格式错误: ${error.message}`;
    statusType.value = 'error';
    return false;
  }
};

// 清空所有内容
const clearAll = () => {
  inputJson.value = '';
  outputJson.value = '';
  statusMessage.value = '';
};

// 复制输出结果
const copyOutput = async () => {
  try {
    await navigator.clipboard.writeText(outputJson.value);
    statusMessage.value = '✓ 已复制到剪贴板！';
    statusType.value = 'success';
    setTimeout(() => {
      statusMessage.value = '';
    }, 2000);
  } catch (error) {
    statusMessage.value = '✗ 复制失败，请手动复制';
    statusType.value = 'error';
  }
};

// 递归排序对象键
const sortObjectKeys = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortObjectKeys(obj[key]);
        return sorted;
      }, {});
  }
  return obj;
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

/* 语法高亮样式 */
:deep(.string) {
  color: #22863a;
}

:deep(.number) {
  color: #005cc5;
}

:deep(.boolean) {
  color: #d73a49;
}

:deep(.null) {
  color: #6f42c1;
}

:deep(.key) {
  color: #e36209;
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