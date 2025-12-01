<script setup>
defineProps({
  steps: {
    type: Array,
    required: true,
    // 每个 step 是一个字符串
  }
});
</script>

<template>
  <div class="usage-guide">
    <h2>使用说明</h2>
    <ol>
      <li v-for="(step, index) in steps" :key="index">{{ step }}</li>
    </ol>
  </div>
</template>

<style scoped>
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
</style>

