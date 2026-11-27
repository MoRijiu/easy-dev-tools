<template>
  <div class="main-layout">
    <a href="#main-content" class="skip-link">跳到主要内容</a>
    <Header />
    <CommandPalette />
    <main id="main-content" class="main-content" tabindex="-1">
      <div v-if="currentTool" class="tool-bar">
        <router-link to="/" class="tool-bar-back">← 全部工具</router-link>
        <span class="tool-bar-name"><span aria-hidden="true">{{ currentTool.icon }}</span> {{ currentTool.name }}</span>
        <span class="tool-bar-fav"><FavoriteButton :tool-id="currentTool.id" :tool-name="currentTool.name" />{{ isFavorite(currentTool.id) ? '已收藏' : '收藏' }}</span>
      </div>
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
    <Footer />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import CommandPalette from '../components/CommandPalette.vue'
import FavoriteButton from '../components/FavoriteButton.vue'
import { getToolByPath } from '../router/tools-config'
import { useToolPrefs } from '../composables/useToolPrefs'

const route = useRoute()
const { isFavorite } = useToolPrefs()
const currentTool = computed(() => getToolByPath(route.path))
</script>

<style scoped>
.skip-link {
  position: absolute;
  left: 12px;
  top: -48px;
  z-index: 3000;
  background: var(--surface);
  color: var(--accent-text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  transition: top 0.15s ease;
}
.skip-link:focus-visible { top: 10px; }

.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.main-content {
  flex: 1;
  padding: 1.5rem;
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: .45rem .8rem;
  margin-bottom: 1rem;
  font-size: .9rem;
}
.tool-bar-back { color: var(--accent-text); text-decoration: none; white-space: nowrap; }
.tool-bar-back:hover { text-decoration: underline; }
.tool-bar-name { color: var(--text-strong); font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-bar-fav { display: inline-flex; align-items: center; gap: .15rem; color: var(--text-2); white-space: nowrap; }

.page-enter-active, .page-leave-active { transition: opacity .16s ease, transform .16s ease; }
.page-enter-from { opacity: 0; transform: translateY(4px); }
.page-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .main-content {
    padding: 1rem .85rem;
  }
  .tool-bar { padding: .4rem .65rem; gap: .5rem; font-size: .85rem; margin-bottom: .85rem; }
}
</style>