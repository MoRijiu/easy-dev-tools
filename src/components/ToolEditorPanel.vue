<!--
 * @Author: zhengduo
 * @Date: 2025-12-05
 * @Description: 编辑面板组件
-->
<template>
  <div class="editor-panel">
    <div :class="['panel-header', headerClass]">
      <h3>{{ title }}</h3>
      <span v-if="$slots.headerExtra" class="header-extra">
        <slot name="headerExtra"></slot>
      </span>
      <span v-else-if="info" class="char-count">{{ info }}</span>
    </div>
    <div class="panel-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  info: {
    type: String,
    default: ''
  },
  headerClass: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
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

.panel-header.preview-header {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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

.header-extra {
  font-size: 12px;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 输入框样式 */
:deep(.text-input),
:deep(.json-input),
:deep(.markdown-input) {
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

:deep(.text-input:focus),
:deep(.json-input:focus),
:deep(.markdown-input:focus) {
  outline: none;
  background: #fff;
}

/* 输出区样式 */
:deep(.text-output-wrapper),
:deep(.json-output-wrapper) {
  flex: 1;
  min-height: 400px;
  overflow: auto;
  background: #f8f9fa;
}

:deep(.text-output),
:deep(.json-output) {
  margin: 0;
  padding: 20px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: #f8f9fa;
}

:deep(.text-output) {
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.json-output code) {
  display: block;
}

:deep(.placeholder) {
  padding: 20px;
  color: #999;
  text-align: center;
  font-style: italic;
}

/* Markdown 预览区样式 */
:deep(.markdown-preview) {
  flex: 1;
  min-height: 500px;
  padding: 20px;
  overflow: auto;
  background: #fff;
  font-size: 15px;
  line-height: 1.8;
}

:deep(.markdown-input) {
  min-height: 500px;
  line-height: 1.8;
}

/* 同步滚动选项 */
:deep(.sync-scroll) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}

:deep(.sync-scroll input) {
  cursor: pointer;
}
</style>

