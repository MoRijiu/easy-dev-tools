<!--
 * @Author: zhengduo
 * @Date: 2025-12-01 14:07:31
 * @LastEditors: zhengduo
 * @LastEditTime: 2025-12-01 14:46:07
 * @Description: Do not edit
-->
<script setup>
defineProps({
  features: {
    type: Array,
    required: true,
    // 每个 feature 应包含 { icon, title, description }
  }
});
</script>

<template>
  <div class="features">
    <h2>功能特点</h2>
    <div class="feature-grid">
      <div v-for="(feature, index) in features" :key="index" class="feature-item">
        <span class="feature-icon" aria-hidden="true">{{ feature.icon }}</span>
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.features {
  margin-top: 32px;
  padding-top: 28px;
  border-top: 2px solid var(--border);
}

.features h2 {
  font-size: 1.3rem;
  color: var(--text-strong);
  margin-bottom: 16px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.feature-item {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, var(--bg-soft) 0%, var(--border) 100%);
  border-radius: 12px;
  transition: transform 0.3s;
}

.feature-item:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
}

.feature-item h3 {
  font-size: 1.05rem;
  color: var(--text-strong);
  margin-bottom: 6px;
}

.feature-item p {
  color: var(--text-2);
  font-size: 0.95rem;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>

