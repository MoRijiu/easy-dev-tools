<!--
 * @Author: zhengduo
 * @Date: 2025-12-05
 * @Description: 编辑器布局组件 - 双栏布局
-->
<template>
  <div class="editor-container">
    <slot></slot>
  </div>
</template>

<script setup>
// 编辑器布局组件 - 使用 slot 允许父组件自定义左右面板内容
</script>

<style scoped>
.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 40px;
}

/* 响应式设计 */
@media (max-width: 968px) {
  .editor-container {
    grid-template-columns: 1fr;
  }
}
</style>

