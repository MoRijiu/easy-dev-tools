<template>
  <div class="home">
    <section class="hero-section">
      <h1>极速开发工具箱</h1>
      <p>提供各类实用的开发工具，提升您的工作效率</p>
      <p class="stats">共 {{ totalCount }} 个工具 · {{ toolGroups.length }} 个分类 · 全部本地运行，数据不上传</p>
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input v-model="query" type="search" class="search-input" placeholder="搜索工具：试试 json、二维码、md5、geshihua…" aria-label="搜索工具" @keydown.esc="query = ''" />
        <button v-if="query" class="search-clear" type="button" aria-label="清空搜索" @click="query = ''">✕</button>
      </div>
      <nav class="cat-nav" aria-label="分类快速导航">
        <button type="button" class="cat-chip" :class="{ active: activeGroup === 'all' }" :aria-pressed="activeGroup === 'all'" @click="activeGroup = 'all'">全部</button>
        <button v-for="g in toolGroups" :key="g.id" type="button" class="cat-chip" :class="{ active: activeGroup === g.id }" :aria-pressed="activeGroup === g.id" @click="activeGroup = g.id"><span aria-hidden="true">{{ g.icon }}</span> {{ g.name }} <span class="cat-count">{{ g.tools.length }}</span></button>
      </nav>
    </section>

    <Danmaku />

    <p v-if="query || activeGroup !== 'all'" class="result-hint" role="status">找到 {{ filteredCount }} 个工具<button type="button" class="reset-link" @click="resetFilter">清除筛选</button></p>

    <template v-if="!query && activeGroup === 'all'">
      <section v-if="favoriteTools.length" class="pref-section" aria-label="我的收藏">
        <h2 class="pref-title"><span aria-hidden="true">★</span> 我的收藏 <span class="pref-count">{{ favoriteTools.length }}</span></h2>
        <div class="pref-chips">
          <span v-for="t in favoriteTools" :key="t.id" class="pref-chip-wrap">
            <button type="button" class="cat-chip" @click="navigateToTool(t)"><span aria-hidden="true">{{ t.icon }}</span> {{ t.name }}</button>
            <FavoriteButton :tool-id="t.id" :tool-name="t.name" />
          </span>
        </div>
      </section>
      <section v-if="recentTools.length" class="pref-section" aria-label="最近使用">
        <h2 class="pref-title"><span aria-hidden="true">🕘</span> 最近使用 <span class="pref-count">{{ recentTools.length }}</span><button type="button" class="reset-link" @click="clearRecent">清空历史</button></h2>
        <div class="pref-chips">
          <button v-for="t in recentTools" :key="t.id" type="button" class="cat-chip" @click="navigateToTool(t)"><span aria-hidden="true">{{ t.icon }}</span> {{ t.name }}</button>
        </div>
      </section>
    </template>

    <section v-if="visibleGroups.length" class="tools-container">
      <article v-for="group in visibleGroups" :key="group.id" class="tool-group">
        <header class="group-header">
          <div class="group-icon" aria-hidden="true">{{ group.icon }}</div>
          <div class="group-info">
            <h2>{{ group.name }}</h2>
            <p>{{ group.description }} · {{ group.tools.length }} 个工具</p>
          </div>
        </header>
        <div class="tools-grid" role="list">
          <article v-for="tool in group.tools" :key="tool.id" class="tool-card" role="listitem">
            <div class="card-top"><div class="tool-icon" aria-hidden="true">{{ tool.icon }}</div><span class="fav-wrap"><FavoriteButton :tool-id="tool.id" :tool-name="tool.name" /></span></div>
            <h3><router-link class="tool-card-link" :to="tool.path" :aria-label="`${tool.name}：${tool.description}`">{{ tool.name }}</router-link></h3>
            <p>{{ tool.description }}</p>
          </article>
        </div>
      </article>
    </section>

    <section v-else class="empty-state" role="status">
      <p class="empty-title">没有找到「{{ query }}」相关的工具</p>
      <p class="empty-desc">换个关键词试试，或看看这些常用工具：</p>
      <div class="empty-suggest">
        <button v-for="t in popularTools" :key="t.id" type="button" class="cat-chip" @click="navigateToTool(t)"><span aria-hidden="true">{{ t.icon }}</span> {{ t.name }}</button>
      </div>
      <button type="button" class="reset-link" @click="resetFilter">清除搜索，浏览全部工具</button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSeo } from '../composables/useSeo'
import Danmaku from '../components/Danmaku.vue'
import FavoriteButton from '../components/FavoriteButton.vue'
import { useToolPrefs } from '../composables/useToolPrefs'
import { toolGroups, searchTools, totalToolCount, getAllTools } from '../router/tools-config'

const { favoriteTools, recentTools, clearRecent } = useToolPrefs()

const router = useRouter()
useSeo({
  title: '极速开发工具箱 - 在线开发者工具集合 | JSON格式化、Base64编解码、UUID生成器',
  description: '极速开发工具箱提供丰富的在线开发工具，包括JSON格式化、Base64编解码、URL编解码、时间戳转换、UUID生成、二维码生成、密码生成、哈希计算、图片压缩等实用工具，提升开发效率。',
  keywords: '开发工具,在线工具,JSON格式化,Base64编码,URL编码,时间戳转换,UUID生成器,二维码生成,密码生成器,哈希计算,图片压缩,开发者工具箱',
  canonical: 'https://tools.morijiu.cn/'
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
.hero-section h1 { font-size: 2.25rem; color: var(--text-strong); margin: 0 0 .5rem; }
.hero-section p { font-size: 1.05rem; color: var(--text-2); margin: 0; }
.stats { font-size: .85rem !important; margin-top: .5rem !important; color: var(--text-3) !important; }
.search-box { display: flex; align-items: center; gap: .5rem; max-width: 560px; margin: 1rem auto 0; background: var(--surface); border: 2px solid var(--border); border-radius: 10px; padding: .45rem .75rem; }
.search-box:focus-within { border-color: var(--accent); }
.search-input { flex: 1; border: none; outline: none; font-size: .95rem; background: transparent; min-width: 0; }
.search-clear { border: none; background: var(--bg-soft); border-radius: 999px; width: 24px; height: 24px; cursor: pointer; line-height: 1; }
.cat-nav { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; margin-top: .85rem; }
.cat-chip { border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: .32rem .7rem; font-size: .85rem; cursor: pointer; }
.cat-chip:hover { border-color: var(--accent); }
.cat-chip.active { background: var(--accent-solid); color: #fff; border-color: var(--accent); }
.cat-count { opacity: .75; font-size: .78rem; }
.result-hint { text-align: center; color: var(--text-2); font-size: .9rem; margin: .5rem 0 1rem; }
.reset-link { border: none; background: none; color: var(--accent-text); cursor: pointer; font-size: .9rem; margin-left: .5rem; text-decoration: underline; display: inline-flex; align-items: center; min-height: 24px; padding: 1px 4px; }
.tools-container { display: flex; flex-direction: column; gap: 1.5rem; }
.tool-group { background: var(--surface); border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadow-sm); }
.group-header { display: flex; align-items: center; gap: .85rem; margin-bottom: 1rem; padding-bottom: .7rem; border-bottom: 1px solid var(--border); }
.group-icon { font-size: 1.6rem; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg,var(--accent) 0%,var(--accent-2) 100%); border-radius: 10px; }
.group-info h2 { font-size: 1.2rem; color: var(--text-strong); margin: 0 0 .15rem; }
.group-info p { font-size: .88rem; color: var(--text-2); margin: 0; }
.tools-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(210px, 100%),1fr)); gap: .85rem; }
.tool-card { position: relative; min-width: 0; background: var(--bg); border-radius: 8px; padding: 1rem; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease; border: 1px solid var(--border); }
.tool-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); border-color: var(--accent); background: var(--surface-hover); }
.tool-card:active { transform: translateY(0); }
.tool-card:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.tool-card-link { color: inherit; text-decoration: none; }
.tool-card-link::after { content: ""; position: absolute; inset: 0; border-radius: 8px; }
.tool-card-link:focus-visible { outline: none; }
.fav-wrap { position: relative; z-index: 1; }
.tool-icon { font-size: 1.5rem; margin-bottom: .45rem; }
.tool-card h3 { font-size: 1rem; color: var(--text-strong); margin: 0 0 .35rem; }
.tool-card p { font-size: .86rem; color: var(--text-2); margin: 0; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.empty-state { text-align: center; background: var(--surface); border-radius: 12px; padding: 2rem 1rem; box-shadow: var(--shadow-card); }
.empty-title { font-size: 1.1rem; color: var(--text-strong); margin: 0 0 .5rem; }
.empty-desc { color: var(--text-2); margin: 0 0 1rem; font-size: .92rem; }
.empty-suggest { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; }
.card-top .tool-icon { margin-bottom: .5rem; }
.pref-section { background: var(--surface); border-radius: 12px; padding: 1rem 1.25rem; box-shadow: var(--shadow-card); margin-bottom: 1rem; }
.pref-title { font-size: 1rem; color: var(--text-strong); margin: 0 0 .6rem; display: flex; align-items: center; gap: .4rem; }
.pref-count { color: var(--text-3); font-size: .82rem; font-weight: normal; }
.pref-chips { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.pref-chip-wrap { display: inline-flex; align-items: center; }
@media (max-width: 768px) {
  .hero-section { padding: 1.25rem .5rem .9rem; margin-bottom: .75rem; }
  .hero-section h1 { font-size: 1.6rem; }
  .hero-section p { font-size: .95rem; }
  .tools-grid { grid-template-columns: repeat(2, 1fr); gap: .65rem; }
  .tool-group { padding: 1rem .85rem; }
  .group-icon { width: 38px; height: 38px; font-size: 1.35rem; }
  .group-info h2 { font-size: 1.05rem; }
  .tool-card { padding: .8rem; }
  .tool-icon { font-size: 1.3rem; margin-bottom: .35rem; }
  .tool-card h3 { font-size: .92rem; }
  .tool-card p { font-size: .8rem; }
  .pref-section { padding: .85rem .9rem; }
  .empty-state { padding: 1.5rem .85rem; }
}
</style>
