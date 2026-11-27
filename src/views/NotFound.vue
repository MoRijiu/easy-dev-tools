<template>
  <div class="not-found">
    <p class="code" aria-hidden="true">404</p>
    <h1>页面不存在</h1>
    <p class="desc">
      你访问的地址 <code class="path">{{ route.path }}</code> 没有对应的页面，可能是链接已变更、地址输错，或工具已下线。
    </p>
    <div class="actions">
      <router-link to="/" class="btn-primary">返回首页</router-link>
      <button type="button" class="btn-secondary" @click="openSearch">搜索工具（Ctrl+K）</button>
    </div>
    <nav class="popular" aria-label="常用工具">
      <h2>常用工具</h2>
      <ul>
        <li v-for="tool in popularTools" :key="tool.id">
          <router-link :to="tool.path"><span aria-hidden="true">{{ tool.icon }}</span> {{ tool.name }}</router-link>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { getAllTools } from '../router/tools-config'

const route = useRoute()

// 常用工具入口：按 id 从工具注册表取真实 path，避免写死路径与注册表脱节
const POPULAR_IDS = ['json-formatter', 'base64', 'timestamp', 'uuid', 'qrcode', 'regex-tester']
const allTools = getAllTools()
const popularTools = POPULAR_IDS.map(id => allTools.find(t => t.id === id)).filter(Boolean)

const openSearch = () => {
  window.dispatchEvent(new Event('edt:open-command-palette'))
}
</script>

<style scoped>
.not-found {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 0 1rem;
  text-align: center;
}
.code {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1;
  margin: 0 0 .5rem;
  color: var(--accent-text);
}
.not-found h1 {
  font-size: 1.5rem;
  margin: 0 0 .75rem;
  color: var(--text-strong);
}
.desc {
  color: var(--text-2);
  font-size: .95rem;
  line-height: 1.6;
  margin: 0 0 1.25rem;
}
.path {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: .05rem .35rem;
  font-size: .88em;
  word-break: break-all;
}
.actions {
  display: flex;
  gap: .6rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1.75rem;
}
.btn-primary, .btn-secondary {
  display: inline-block;
  padding: .5rem 1rem;
  border-radius: 8px;
  font-size: .9rem;
  cursor: pointer;
  text-decoration: none;
}
.btn-primary {
  background: var(--accent-solid);
  color: var(--on-accent);
  border: 1px solid var(--accent-solid);
}
.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}
.btn-secondary:hover { background: var(--bg-soft); }
.popular h2 {
  font-size: 1rem;
  margin: 0 0 .6rem;
  color: var(--text-strong);
}
.popular ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  justify-content: center;
}
.popular a {
  display: inline-block;
  padding: .4rem .75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text);
  text-decoration: none;
  font-size: .88rem;
}
.popular a:hover { border-color: var(--border-strong); background: var(--bg-soft); }
</style>
