<template>
  <main class="home">
    <section class="hero-section">
      <h1>极速开发工具箱</h1>
      <p>提供各类实用的开发工具，提升您的工作效率</p>
    </section>

    <!-- 弹幕区域 -->
    <Danmaku />

    <section class="tools-container">
      <article v-for="group in toolGroups" :key="group.id" class="tool-group">
        <header class="group-header">
          <div class="group-icon" :aria-label="group.name">{{ group.icon }}</div>
          <div class="group-info">
            <h2>{{ group.name }}</h2>
            <p>{{ group.description }}</p>
          </div>
        </header>
        <div class="tools-grid" role="list">
          <article
            v-for="tool in group.tools"
            :key="tool.id"
            class="tool-card"
            role="listitem"
            @click="navigateToTool(tool)"
            @keypress.enter="navigateToTool(tool)"
            tabindex="0"
            :aria-label="`${tool.name}: ${tool.description}`"
          >
            <div class="tool-icon" aria-hidden="true">{{ tool.icon }}</div>
            <h3>{{ tool.name }}</h3>
            <p>{{ tool.description }}</p>
          </article>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSeo } from '../composables/useSeo'
import Danmaku from '../components/Danmaku.vue'
import { toolGroups } from '../router/tools-config'

const router = useRouter()

// SEO 优化
useSeo({
  title: '极速开发工具箱 - 在线开发者工具集合 | JSON格式化、Base64编解码、UUID生成器',
  description: '极速开发工具箱提供丰富的在线开发工具，包括JSON格式化、Base64编解码、URL编解码、时间戳转换、UUID生成、二维码生成、密码生成、哈希计算、图片压缩等实用工具，提升开发效率。',
  keywords: '开发工具,在线工具,JSON格式化,Base64编码,URL编码,时间戳转换,UUID生成器,二维码生成,密码生成器,哈希计算,图片压缩,开发者工具箱',
  canonical: 'https://easy-dev-tools.com/'
})


const navigateToTool = (tool) => {
  if (tool.path) {
    router.push(tool.path)
  }
}
</script>

<style scoped>
.home {
  width: 100%;
}

.hero-section {
  text-align: center;
  padding: 3rem 1rem;
  margin-bottom: 2rem;
}

.hero-section h1 {
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.hero-section p {
  font-size: 1.2rem;
  color: #7f8c8d;
}

.tools-container {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.tool-group {
  background: #fff;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.group-icon {
  font-size: 2.5rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.group-info h2 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin: 0 0 0.25rem 0;
}

.group-info p {
  font-size: 0.95rem;
  color: #7f8c8d;
  margin: 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}

.tool-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
  background: #fff;
}

.tool-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.tool-card h3 {
  font-size: 1.1rem;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
}

.tool-card p {
  font-size: 0.9rem;
  color: #7f8c8d;
  margin: 0;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .hero-section h1 {
    font-size: 2rem;
  }
  
  .hero-section p {
    font-size: 1rem;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .tool-group {
    padding: 1.5rem;
  }
}
</style>