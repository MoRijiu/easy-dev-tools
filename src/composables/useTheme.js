import { ref, computed, watch } from 'vue'

// 主题管理：light / dark / auto（跟随系统），持久化到 localStorage。
// 实际生效主题写入 <html data-theme="...">，样式层以 CSS 变量响应。
const STORAGE_KEY = 'edt:theme'
const MODES = ['light', 'dark', 'auto']

function loadMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(saved) ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

const mode = ref(loadMode())
const media =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
const systemDark = ref(media ? media.matches : false)

if (media) {
  const onChange = (e) => {
    systemDark.value = e.matches
  }
  if (media.addEventListener) media.addEventListener('change', onChange)
  else if (media.addListener) media.addListener(onChange)
}

const resolved = computed(() =>
  mode.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : mode.value
)

function apply() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved.value
    document.documentElement.style.colorScheme = resolved.value
  }
}

watch([mode, resolved], apply, { immediate: true })
watch(mode, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
})

export function useTheme() {
  const cycle = () => {
    const idx = MODES.indexOf(mode.value)
    mode.value = MODES[(idx + 1) % MODES.length]
  }
  return { mode, resolved, cycle }
}
