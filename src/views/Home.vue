<template>
  <main class="home">
    <section class="hero-section">
      <h1>极速开发工具箱</h1>
      <p>提供各类实用的开发工具，提升您的工作效率</p>
      <p class="stats" aria-label="工具统计">共 {{ totalCount }} 个工具 · {{ toolGroups.length }} 个分类 · 全部本地运行，数据不上传</p>
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input v-model="query" type="search" class="search-input" placeholder="搜索工具：试试 json、二维码、md5、geshihua…" aria-label="搜索工具" @keydown.esc="query = ''" />
        <button v-if="query" class="search-clear" type="button" aria-label="清空搜索" @click="query = ''">✕</button>
      </div>
      <nav class="cat-nav" aria-label="分类快速导航">
        <button type="button" class="cat-chip" :class="{ active: activeGroup === 'all' }" @click="activeGroup = 'all'">全部</button>
        <button v-for="g in toolGroups" :key="g.id" type="button" class="cat-chip" :class="{ active: activeGroup === g.id }" @click="activeGroup = g.id">{{ g.icon }} {{ g.name }} <span class="cat-count">{{ g.tools.length }}</span></button>
      </nav>
    </section>

    <Danmaku />

    <p v-if="query || activeGroup !== 'all'" class="result-hint" role="status">找到 {{ filteredCount }} 个工具<button type="button" class="reset-link" @click="resetFilter">清除筛选</button></p>

    <section v-if="visibleGroups.length" class="tools-container">
      <article v-for="group in visibleGroups" :key="group.id" class="tool-group">
        <header class="group-header">
          <div class="group-icon" :aria-label="group.name">{{ group.icon }}</div>
          <div class="group-info">
            <h2>{{ group.name }}</h2>
            <p>{{ group.description }} · {{ group.tools.length }} 个工具</p>
          </div>
        </header>
        <div class="tools-grid" role="list">
          <article v-for="tool in group.tools" :key="tool.id" class="tool-card" role="listitem" @click="navigateToTool(tool)" @keypress.enter="navigateToTool(tool)" tabindex="0" :aria-label="`${tool.name}: ${tool.description}`">
            <div class="tool-icon" aria-hidden="true">{{ tool.icon }}</div>
            <h3>{{ tool.name }}</h3>
            <p>{{ tool.description }}</p>
          </article>
        </div>
      </article>
    </section>

    <section v-else class="empty-state" role="status">
      <p class="empty-title">没有找到「{{ query }}」相关的工具</p>
      <p class="empty-desc">换个关键词试试，或看看这些常用工具：</p>
      <div class="empty-suggest">
        <button v-for="t in popularTools" :key="t.id" type="button" class="cat-chip" @click="navigateToTool(t)">{{ t.icon }} {{ t.name }}</button>
      </div>
      <button type="button" class="reset-link" @click="resetFilter">清除搜索，浏览全部工具</button>
    </section>
  </main>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSeo } from '../composables/useSeo'
import Danmaku from '../components/Danmaku.vue'
import { toolGroups, searchTools, totalToolCount, getAllTools } from '../router/tools-config'

const router = useRouter()
useSeo({
  title: '极速开发工具箱 - 在线开发者工具集合 | JSON格式化、Base64编解码、UUID生成器',
  description: '极速开发工具箱提供丰富的在线开发工具，包括JSON格式化、Base64编解码、URL编解码、时间戳转换、UUID生成、二维码生成、密码生成、哈希计算、图片压缩等实用工具，提升开发效率。',
  keywords: '开发工具,在线工具,JSON格式化,Base64编码,URL编码,时间戳转换,UUID生成器,二维码生成,密码生成器,哈希计算,图片压缩,开发者工具箱',
  canonical: 'https://easy-dev-tools.com/'
})

const query = ref('')
const activeGroup = ref('all')
const totalCount = totalToolCount
const popularTools = computed(() => getAllTools().filter(t => ['json-formatter', 'base64', 'timestamp', 'uuid'].includes(t.id)))
const searchedGroups = computed(() => searchTools(query.value))
const visibleGroups = computed(() => activeGroup.value === 'all' ? searchedGroups.value : searchedGroups.value.filter(g => g.id === activeGroup.value))
const filteredCount = computed(() => visibleGroups.value.reduce((n, g) => n + g.tools.length, 0))
const resetFilter = () => { query.value = ''; activeGroup.value = 'all' }
const navigateToTool = (tool) => { if (tool.path) router.push(tool.path) }
</script>

<style scoped>
.home { width: 100%; }
.hero-section { text-align: center; padding: 1.75rem 1rem 1.25rem; margin-bottom: 1rem; }
.hero-section h1 { font-size: 2.25rem; color: #2c3e50; margin: 0 0 .5rem; }
.hero-section p { font-size: 1.05rem; color: #7f8c8d; margin: 0; }
.stats { font-size: .85rem !important; margin-top: .5rem !important; color: #95a5a6 !important; }
.search-box { display: flex; align-items: center; gap: .5rem; max-width: 560px; margin: 1rem auto 0; background: #fff; border: 2px solid #e5e7eb; border-radius: 10px; padding: .45rem .75rem; }
.search-box:focus-within { border-color: #667eea; }
.search-input { flex: 1; border: none; outline: none; font-size: .95rem; background: transparent; min-width: 0; }
.search-clear { border: none; background: #f1f5f9; border-radius: 999px; width: 22px; height: 22px; cursor: pointer; line-height: 1; }
.cat-nav { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; margin-top: .85rem; }
.cat-chip { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: .32rem .7rem; font-size: .85rem; cursor: pointer; }
.cat-chip:hover { border-color: #667eea; }
.cat-chip.active { background: #667eea; color: #fff; border-color: #667eea; }
.cat-count { opacity: .75; font-size: .78rem; }
.result-hint { text-align: center; color: #7f8c8d; font-size: .9rem; margin: .5rem 0 1rem; }
.reset-link { border: none; background: none; color: #667eea; cursor: pointer; font-size: .9rem; margin-left: .5rem; text-decoration: underline; }
.tools-container { display: flex; flex-direction: column; gap: 2rem; }
.tool-group { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
.group-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; padding-bottom: .85rem; border-bottom: 2px solid #f0f0f0; }
.group-icon { font-size: 2rem; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg,#667eea 0%,#764ba2 100%); border-radius: 12px; }
.group-info h2 { font-size: 1.35rem; color: #2c3e50; margin: 0 0 .25rem; }
.group-info p { font-size: .9rem; color: #7f8c8d; margin: 0; }
.tools-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(230px,1fr)); gap: 1rem; }
.tool-card { background: #f8f9fa; border-radius: 8px; padding: 1.15rem; cursor: pointer; transition: all .25s ease; border: 2px solid transparent; }
.tool-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,.15); border-color: #667eea; background: #fff; }
.tool-icon { font-size: 1.7rem; margin-bottom: .5rem; }
.tool-card h3 { font-size: 1.05rem; color: #2c3e50; margin: 0 0 .4rem; }
.tool-card p { font-size: .88rem; color: #7f8c8d; margin: 0; line-height: 1.4; }
.empty-state { text-align: center; background: #fff; border-radius: 12px; padding: 2rem 1rem; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.empty-title { font-size: 1.1rem; color: #2c3e50; margin: 0 0 .5rem; }
.empty-desc { color: #7f8c8d; margin: 0 0 1rem; font-size: .92rem; }
.empty-suggest { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
@media (max-width: 768px) { .hero-section h1 { font-size: 1.8rem; } .tools-grid { grid-template-columns: 1fr; } .tool-group { padding: 1.15rem; } }
</style>
