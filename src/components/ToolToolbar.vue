<!--
 * @Author: zhengduo
 * @Date: 2025-12-05
 * @Description: 工具栏组件
-->
<template>
  <div class="toolbar">
    <slot></slot>
  </div>
</template>

<script setup>
// 工具栏组件 - 使用 slot 允许父组件自定义按钮内容
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
  align-items: center;
}

/* 按钮基础样式 */
:deep(.btn) {
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

:deep(.btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.btn-primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

:deep(.btn-primary:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

:deep(.btn-secondary) {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

:deep(.btn-secondary:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
}

:deep(.btn-info) {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

:deep(.btn-info:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
}

:deep(.btn-success) {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

:deep(.btn-success:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(67, 233, 123, 0.4);
}

:deep(.btn-danger) {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
}

:deep(.btn-danger:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(250, 112, 154, 0.4);
}

:deep(.btn-tool) {
  padding: 8px 12px;
  background: #f5f5f5;
  color: #333;
  font-weight: 600;
}

:deep(.btn-tool:hover) {
  background: #e0e0e0;
}

:deep(.icon) {
  font-size: 16px;
}

:deep(.toolbar-divider) {
  width: 1px;
  height: 30px;
  background: #ddd;
  margin: 0 10px;
}

:deep(.options) {
  display: flex;
  gap: 15px;
  margin-left: auto;
  align-items: center;
}

:deep(.options label) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

:deep(.options input[type="checkbox"]) {
  cursor: pointer;
}

:deep(.options input[type="number"]) {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 968px) {
  .toolbar {
    justify-content: center;
  }

  :deep(.options) {
    margin-left: 0;
    width: 100%;
    justify-content: center;
  }

  :deep(.toolbar-divider) {
    display: none;
  }
}

@media (max-width: 640px) {
  :deep(.btn) {
    padding: 8px 16px;
    font-size: 13px;
  }

  :deep(.btn-tool) {
    padding: 6px 10px;
  }
}
</style>

