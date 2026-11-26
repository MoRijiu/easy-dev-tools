import { ref, computed } from 'vue'
import { getAllTools, getToolByPath } from '../router/tools-config'

// 收藏与最近使用：纯本地 localStorage 存储，不上传服务器。
// 模块级单例状态，多个组件共享同一份响应式数据。
const FAV_KEY = 'edt:favorites'
const RECENT_KEY = 'edt:recent'
const RECENT_MAX = 8

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : fallback
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 隐私模式等场景静默失败 */ }
}

const favoriteIds = ref(load(FAV_KEY, []))
const recentIds = ref(load(RECENT_KEY, []))

export function useToolPrefs() {
  const favoriteTools = computed(() =>
    favoriteIds.value.map(id => getAllTools().find(t => t.id === id)).filter(Boolean)
  )
  const recentTools = computed(() =>
    recentIds.value.map(id => getAllTools().find(t => t.id === id)).filter(Boolean)
  )

  const isFavorite = (id) => favoriteIds.value.includes(id)

  const toggleFavorite = (id) => {
    favoriteIds.value = isFavorite(id)
      ? favoriteIds.value.filter(x => x !== id)
      : [id, ...favoriteIds.value]
    save(FAV_KEY, favoriteIds.value)
    return isFavorite(id)
  }

  // 记录一次工具访问（按路径），最近使用置顶去重并截断
  const recordVisit = (path) => {
    const tool = getToolByPath(path)
    if (!tool) return
    recentIds.value = [tool.id, ...recentIds.value.filter(x => x !== tool.id)].slice(0, RECENT_MAX)
    save(RECENT_KEY, recentIds.value)
  }

  const clearRecent = () => {
    recentIds.value = []
    save(RECENT_KEY, recentIds.value)
  }

  return { favoriteIds, recentIds, favoriteTools, recentTools, isFavorite, toggleFavorite, recordVisit, clearRecent }
}
