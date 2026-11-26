<template>
  <Teleport to="body">
    <div v-if="open" class="palette-backdrop" @click.self="close">
      <div
        class="palette"
        role="dialog"
        aria-modal="true"
        aria-label="快速跳转工具"
      >
        <div class="palette-input-row">
          <span class="palette-icon" aria-hidden="true">⌕</span>
          <input
            ref="inputRef"
            v-model="query"
            class="palette-input"
            type="text"
            placeholder="搜索工具…（支持名称 / 英文 / 拼音）"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            :aria-activedescendant="activeId"
            aria-label="搜索工具"
            autocomplete="off"
            @keydown="onInputKeydown"
          />
          <kbd class="palette-kbd">Esc</kbd>
        </div>
        <ul
          v-if="entries.length"
          id="palette-list"
          class="palette-list"
          role="listbox"
          aria-label="工具列表"
        >
          <li
            v-for="(entry, i) in entries"
            :id="`palette-item-${i}`"
            :key="entry.key"
            class="palette-item"
            :class="{ active: i === activeIndex }"
            role="option"
            :aria-selected="i === activeIndex"
            @mouseenter="activeIndex = i"
            @click="choose(entry)"
          >
            <span class="item-icon" aria-hidden="true">{{ entry.icon }}</span>
            <span class="item-label">{{ entry.label }}</span>
            <span v-if="entry.tag" class="item-tag">{{ entry.tag }}</span>
            <span class="item-hint">{{ entry.hint }}</span>
          </li>
        </ul>
        <p v-else class="palette-empty">
          没有匹配「{{ query }}」的工具，试试 json / base64 / 颜色 等关键词。
        </p>
        <div class="palette-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 打开</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getAllTools, searchTools } from '../router/tools-config'
import { useToolPrefs } from '../composables/useToolPrefs'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { recentTools, favoriteTools } = useToolPrefs()
const { cycle: cycleTheme } = useTheme()

const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
let lastFocused = null

const ACTIONS = [
  { key: 'action:home', kind: 'action', icon: '🏠', label: '回到首页', hint: '页面', keywords: 'home shouye 首页 主页', run: () => router.push('/') },
  { key: 'action:about', kind: 'action', icon: '📖', label: '关于本站', hint: '页面', keywords: 'about guanyu 关于', run: () => router.push('/about') },
  { key: 'action:theme', kind: 'action', icon: '🌓', label: '切换主题（亮 / 暗 / 跟随系统）', hint: '操作', keywords: 'theme zhuti 主题 暗色 dark light', run: () => cycleTheme() }
]

// 把工具转成面板条目；tag 用于标记最近使用 / 已收藏
const toEntry = (tool, tag = '') => ({
  key: `tool:${tool.id}`,
  kind: 'tool',
  icon: tool.icon,
  label: tool.name,
  hint: tool.description,
  tag,
  path: tool.path
})

const entries = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    const seen = new Set()
    const list = []
    const push = (entry) => {
      if (seen.has(entry.key)) return
      seen.add(entry.key)
      list.push(entry)
    }
    recentTools.value.forEach(t => push(toEntry(t, '最近')))
    favoriteTools.value.forEach(t => push(toEntry(t, '收藏')))
    getAllTools().forEach(t => push(toEntry(t)))
    return [...ACTIONS, ...list]
  }
  const matchedActions = ACTIONS.filter(a =>
    a.label.toLowerCase().includes(q) || a.keywords.includes(q)
  )
  const matchedTools = searchTools(query.value).flatMap(g => g.tools.map(t => toEntry(t)))
  return [...matchedActions, ...matchedTools]
})

const activeId = computed(() =>
  entries.value.length ? `palette-item-${activeIndex.value}` : undefined
)

const openPalette = async () => {
  if (open.value) return
  lastFocused = document.activeElement
  query.value = ''
  activeIndex.value = 0
  open.value = true
  document.body.style.overflow = 'hidden'
  await nextTick()
  inputRef.value?.focus()
}

const close = () => {
  open.value = false
  document.body.style.overflow = ''
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus()
}

const choose = (entry) => {
  if (!entry) return
  close()
  if (entry.kind === 'tool') router.push(entry.path)
  else entry.run()
}

const onInputKeydown = (e) => {
  const len = entries.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (len) activeIndex.value = (activeIndex.value + 1) % len
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (len) activeIndex.value = (activeIndex.value - 1 + len) % len
  } else if (e.key === 'Enter') {
    e.preventDefault()
    choose(entries.value[activeIndex.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
  // 选项变化后确保高亮项滚动可见
  nextTick(() => {
    document.getElementById(activeId.value)?.scrollIntoView({ block: 'nearest' })
  })
}

const isEditableTarget = (el) => {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

const onGlobalKeydown = (e) => {
  // Ctrl+K / Cmd+K：任意位置开关命令面板
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (open.value) close()
    else openPalette()
    return
  }
  // 「/」：不在输入框内时打开命令面板
  if (e.key === '/' && !open.value && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditableTarget(e.target)) {
    e.preventDefault()
    openPalette()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('edt:open-command-palette', openPalette)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('edt:open-command-palette', openPalette)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.palette-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 21, 0.5);
  backdrop-filter: blur(2px);
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
}

.palette {
  width: 100%;
  max-width: 560px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  animation: palette-in 0.14s ease;
}

@keyframes palette-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.99); }
  to { opacity: 1; transform: none; }
}

.palette-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.palette-icon { font-size: 18px; color: var(--text-3); line-height: 1; }

.palette-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 15px;
}

.palette-input::placeholder { color: var(--text-3); }

.palette-kbd, .palette-footer kbd {
  font-family: inherit;
  font-size: 11px;
  color: var(--text-2);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 1px 5px;
}

.palette-list {
  list-style: none;
  max-height: min(46vh, 380px);
  overflow-y: auto;
  padding: 6px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text);
}

.palette-item.active { background: var(--accent-soft); }

.item-icon { width: 22px; text-align: center; flex-shrink: 0; font-size: 14px; }
.item-label { font-weight: 500; white-space: nowrap; }

.item-tag {
  font-size: 11px;
  color: var(--accent);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 16px;
  flex-shrink: 0;
}

.item-hint {
  margin-left: auto;
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 46%;
}

.palette-empty {
  padding: 18px 14px;
  color: var(--text-2);
  font-size: 13px;
  text-align: center;
}

.palette-footer {
  display: flex;
  gap: 14px;
  padding: 7px 12px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: 11px;
  background: var(--bg-softer);
}

.palette-footer span { display: inline-flex; align-items: center; gap: 3px; }

@media (max-width: 640px) {
  .palette-backdrop { padding-top: 8vh; }
  .item-hint { display: none; }
  .palette-footer { display: none; }
}
</style>
