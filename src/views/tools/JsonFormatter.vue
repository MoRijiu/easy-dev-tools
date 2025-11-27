<template>
  <div class="json-formatter">
    <h1>JSON 格式化工具</h1>
    <p class="description">在线 JSON 格式化、验证、压缩和美化工具，支持语法高亮和错误提示</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <div class="toolbar">
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
      </div>

      <!-- 状态信息 -->
      <div v-if="statusMessage" :class="['status-message', statusType]">
        {{ statusMessage }}
      </div>

      <!-- 编辑器区域 -->
      <div class="editor-container">
        <!-- 输入区 -->
        <div class="editor-panel">
          <div class="panel-header">
            <h3>输入 JSON</h3>
            <span class="char-count">{{ inputJson.length }} 字符</span>
          </div>
          <textarea
            v-model="inputJson"
            class="json-input"
            placeholder='请输入 JSON 数据，例如：{"name": "张三", "age": 25}'
            spellcheck="false"
            @input="onInputChange"
          ></textarea>
        </div>

        <!-- 输出区 -->
        <div class="editor-panel">
          <div class="panel-header">
            <h3>输出结果</h3>
            <span v-if="outputJson" class="char-count">{{ outputJson.length }} 字符</span>
          </div>
          <div class="json-output-wrapper">
            <pre v-if="outputJson" class="json-output"><code v-html="highlightedJson"></code></pre>
            <div v-else class="placeholder">格式化后的 JSON 将显示在这里</div>
          </div>
        </div>
      </div>

      <!-- 功能说明 -->
      <div class="features">
        <h2>功能特点</h2>
        <div class="feature-grid">
          <div class="feature-item">
            <span class="feature-icon">✨</span>
            <h3>智能格式化</h3>
            <p>自动美化 JSON 数据，使其更易读</p>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🔍</span>
            <h3>语法验证</h3>
            <p>实时检测 JSON 语法错误并提示</p>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <h3>语法高亮</h3>
            <p>彩色显示不同类型的数据</p>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📦</span>
            <h3>压缩功能</h3>
            <p>移除空格和换行，减小体积</p>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🔤</span>
            <h3>键名排序</h3>
            <p>按字母顺序排列对象键名</p>
          </div>
          <div class="feature-item">
            <span class="feature-icon">⚡</span>
            <h3>快速处理</h3>
            <p>支持大文件快速格式化</p>
          </div>
        </div>
      </div>

      <!-- 使用说明 -->
      <div class="usage-guide">
        <h2>使用说明</h2>
        <ol>
          <li>在左侧输入框中粘贴或输入 JSON 数据</li>
          <li>点击"格式化"按钮美化 JSON，或点击"压缩"按钮压缩 JSON</li>
          <li>点击"验证"按钮检查 JSON 语法是否正确</li>
          <li>可选择"排序键名"选项对对象键进行排序</li>
          <li>调整缩进空格数来控制格式化的缩进级别</li>
          <li>点击"复制结果"按钮复制格式化后的 JSON</li>
        </ol>
      </div>

      <!-- 常见问题 -->
      <div class="faq">
        <h2>常见问题</h2>
        <details>
          <summary>什么是 JSON？</summary>
          <p>JSON (JavaScript Object Notation) 是一种轻量级的数据交换格式，易于人阅读和编写，同时也易于机器解析和生成。</p>
        </details>
        <details>
          <summary>JSON 格式化有什么用？</summary>
          <p>格式化可以使压缩的 JSON 数据变得易读，方便开发者调试和查看数据结构。压缩则可以减小数据体积，提高传输效率。</p>
        </details>
        <details>
          <summary>如何修复 JSON 语法错误？</summary>
          <p>常见错误包括：缺少引号、多余的逗号、括号不匹配等。使用验证功能可以快速定位错误位置。</p>
        </details>
        <details>
          <summary>是否支持大文件？</summary>
          <p>本工具支持处理较大的 JSON 文件，但建议单个文件不超过 10MB 以保证最佳性能。</p>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

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

/* 工具栏 */
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

.options {
  display: flex;
  gap: 15px;
  margin-left: auto;
  align-items: center;
}

.options label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

.options input[type="checkbox"] {
  cursor: pointer;
}

.options input[type="number"] {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
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

.json-input {
  flex: 1;
  min-height: 400px;
  padding: 20px;
  border: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: #f8f9fa;
}

.json-input:focus {
  outline: none;
  background: #fff;
}

.json-output-wrapper {
  flex: 1;
  min-height: 400px;
  overflow: auto;
  background: #f8f9fa;
}

.json-output {
  margin: 0;
  padding: 20px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: #f8f9fa;
}

.json-output code {
  display: block;
}

.placeholder {
  padding: 20px;
  color: #999;
  text-align: center;
  font-style: italic;
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

/* 功能特点 */
.features {
  margin-top: 50px;
  padding-top: 40px;
  border-top: 2px solid #f0f0f0;
}

.features h2 {
  font-size: 2rem;
  color: #2c3e50;
  margin-bottom: 30px;
  text-align: center;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
}

.feature-item {
  text-align: center;
  padding: 25px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
  transition: transform 0.3s;
}

.feature-item:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 15px;
}

.feature-item h3 {
  font-size: 1.2rem;
  color: #2c3e50;
  margin-bottom: 10px;
}

.feature-item p {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.6;
}

/* 使用说明 */
.usage-guide {
  margin-top: 40px;
  padding: 30px;
  background: #f8f9fa;
  border-radius: 12px;
}

.usage-guide h2 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin-bottom: 20px;
}

.usage-guide ol {
  padding-left: 25px;
}

.usage-guide li {
  margin-bottom: 12px;
  color: #555;
  line-height: 1.8;
}

/* 常见问题 */
.faq {
  margin-top: 40px;
}

.faq h2 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin-bottom: 20px;
}

.faq details {
  margin-bottom: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  background: white;
}

.faq summary {
  font-weight: 600;
  color: #2c3e50;
  cursor: pointer;
  user-select: none;
}

.faq summary:hover {
  color: #667eea;
}

.faq p {
  margin-top: 10px;
  color: #666;
  line-height: 1.8;
}

/* 响应式设计 */
@media (max-width: 968px) {
  .editor-container {
    grid-template-columns: 1fr;
  }
  
  .toolbar {
    justify-content: center;
  }
  
  .options {
    margin-left: 0;
    width: 100%;
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
  
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>