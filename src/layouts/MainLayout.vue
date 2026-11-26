<template>
  <div class="main-layout">
    <Header />
    <main class="main-content">
      <div v-if="currentTool" class="tool-bar">
        <router-link to="/" class="tool-bar-back">← 全部工具</router-link>
        <span class="tool-bar-name">{{ currentTool.icon }} {{ currentTool.name }}</span>
        <span class="tool-bar-fav"><FavoriteButton :tool-id="currentTool.id" :tool-name="currentTool.name" />{{ isFavorite(currentTool.id) ? '已收藏' : '收藏' }}</span>
      </div>
      <router-view />
    </main>
    <Footer />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import FavoriteButton from '../components/FavoriteButton.vue'
import { getToolByPath } from '../router/tools-config'
import { useToolPrefs } from '../composables/useToolPrefs'

const route = useRoute()
const { isFavorite } = useToolPrefs()
const currentTool = computed(() => getToolByPath(route.path))
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  position: relative;
  z-index: 1;
}

.tool-bar {
  display: flex;
  align-items: center;
  gap: .75rem;
  background: #fff;
  border: 1px solid #eceef1;
  border-radius: 10px;
  padding: .45rem .8rem;
  margin-bottom: 1rem;
  font-size: .9rem;
}
.tool-bar-back { color: #667eea; text-decoration: none; white-space: nowrap; }
.tool-bar-back:hover { text-decoration: underline; }
.tool-bar-name { color: #2c3e50; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-bar-fav { display: inline-flex; align-items: center; gap: .15rem; color: #7f8c8d; white-space: nowrap; }

@media (max-width: 768px) {
  .main-content {
    padding: 1.5rem;
  }
}
</style>