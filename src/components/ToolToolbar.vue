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
  border-bottom: 2px solid var(--border);
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
  background: var(--btn-primary);
  color: var(--on-accent);
}

:deep(.btn-primary:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

:deep(.btn-secondary) {
  background: var(--btn-secondary);
  color: var(--on-accent);
}

:deep(.btn-secondary:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

:deep(.btn-info) {
  background: var(--btn-info);
  color: var(--on-accent);
}

:deep(.btn-info:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

:deep(.btn-success) {
  background: var(--btn-success);
  color: var(--on-accent);
}

:deep(.btn-success:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

:deep(.btn-danger) {
  background: var(--btn-danger);
  color: var(--on-accent);
}

:deep(.btn-danger:hover:not(:disabled)) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

:deep(.btn-tool) {
  padding: 8px 12px;
  background: var(--bg-soft);
  color: var(--text);
  font-weight: 600;
}

:deep(.btn-tool:hover) {
  background: var(--border);
}

:deep(.icon) {
  font-size: 16px;
}

:deep(.toolbar-divider) {
  width: 1px;
  height: 30px;
  background: var(--border-strong);
  margin: 0 10px;
}

:deep(.options) {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-left: auto;
  align-items: center;
}

:deep(.options label) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-2);
  cursor: pointer;
}

:deep(.options input[type="checkbox"]) {
  cursor: pointer;
}

:deep(.options input[type="number"]) {
  padding: 4px 8px;
  border: 1px solid var(--border);
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

