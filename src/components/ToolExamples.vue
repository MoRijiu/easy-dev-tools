<script setup>
defineProps({
  examples: {
    type: Array,
    required: true,
    // 每个 example 应包含 { input, output, description }
  }
});

const emit = defineEmits(['use-example']);

const handleUseExample = (example) => {
  emit('use-example', example);
};
</script>

<template>
  <div class="examples">
    <h2>📝 使用示例</h2>
    <div class="example-grid">
      <div 
        v-for="(example, index) in examples" 
        :key="index" 
        class="example-item"
      >
        <div class="example-header">
          <span class="example-number">示例 {{ index + 1 }}</span>
          <span class="example-desc">{{ example.description }}</span>
        </div>
        <div class="example-content">
          <div class="example-row">
            <span class="label">输入:</span>
            <code class="value input-value">{{ example.input }}</code>
          </div>
          <div class="example-row">
            <span class="label">输出:</span>
            <code class="value output-value">{{ example.output }}</code>
          </div>
        </div>
        <button class="use-btn" @click="handleUseExample(example)">
          🚀 使用此示例
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.examples {
  margin-top: 30px;
  padding: 25px;
  background: linear-gradient(135deg, #e8f4f8 0%, #f0f7fb 100%);
  border-radius: 12px;
  border: 1px solid #d1e7ed;
}

.examples h2 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 20px;
  text-align: center;
}

.example-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.example-item {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s, box-shadow 0.3s;
}

.example-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
}

.example-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.example-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.example-desc {
  color: #666;
  font-size: 14px;
}

.example-content {
  margin-bottom: 15px;
}

.example-row {
  display: flex;
  margin-bottom: 10px;
  align-items: flex-start;
}

.label {
  min-width: 45px;
  font-weight: 600;
  color: #555;
  font-size: 13px;
}

.value {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  word-break: break-all;
  white-space: pre-wrap;
}

.input-value {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  color: #333;
}

.output-value {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  color: #2e7d32;
}

.use-btn {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.use-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

@media (max-width: 640px) {
  .example-grid {
    grid-template-columns: 1fr;
  }
}
</style>

