<!--
 * @Author: zhengduo
 * @Date: 2025-12-05
 * @Description: 状态消息组件
-->
<template>
  <Transition name="fade">
    <div
      v-if="message"
      :id="id"
      :class="['status-message', type]"
      :role="type === 'error' ? 'alert' : 'status'"
      :aria-live="type === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  // 可选：给状态节点一个稳定 id，供出错控件以 aria-describedby 关联（R9bb 起）
  id: {
    type: String,
    default: undefined
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['success', 'error', 'info'].includes(value)
  }
});
</script>

<style scoped>
.status-message {
  padding: 12px 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;
}

.status-message.success {
  background: var(--success-soft);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

.status-message.error {
  background: var(--danger-soft);
  color: var(--danger-text);
  border: 1px solid var(--danger-border);
}

.status-message.info {
  background: var(--info-soft);
  color: var(--info-text);
  border: 1px solid var(--info-border);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

