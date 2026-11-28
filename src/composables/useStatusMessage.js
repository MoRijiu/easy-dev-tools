import { ref, onBeforeUnmount } from 'vue'

// 状态消息统一管理（R10b1）：收敛各工具手抄的 statusMessage/statusType 双 ref
// 与「先存 ownMsg、定时后比对仍是自己这条才清」的守卫写法（R9bl 口径）。
// 行为约定与迁移前保持一致：
// - 普通 set/show 不自动清除（由调用方或后续消息覆盖），也不取消先前待发的守卫定时器
//   （旧写法同样不清，靠文案比对守卫避免误清新消息）；
// - 带 autoClear 的消息在 ms 后仅当消息未被新消息替换时才清空文本（类型不动，与旧写法一致）；
// - 组件卸载时清掉未触发的自动清除定时器，避免卸载后写已失效 ref。
export function useStatusMessage() {
  const statusMessage = ref('')
  const statusType = ref('')
  const timers = new Set()

  const setStatus = (message, type = '') => {
    statusMessage.value = message
    statusType.value = type
  }

  const clearStatus = () => setStatus('', '')

  // 展示一条消息；autoClearMs > 0 时在该时长后守卫式清空（仍是这条才清）
  const showStatus = (message, type = '', autoClearMs = 0) => {
    setStatus(message, type)
    if (autoClearMs > 0 && message) {
      const ownMsg = message
      const timer = setTimeout(() => {
        timers.delete(timer)
        if (statusMessage.value === ownMsg) statusMessage.value = ''
      }, autoClearMs)
      timers.add(timer)
    }
  }

  const showSuccess = (message, autoClearMs = 0) => showStatus(message, 'success', autoClearMs)
  const showError = (message) => showStatus(message, 'error')
  const showInfo = (message, autoClearMs = 0) => showStatus(message, 'info', autoClearMs)

  onBeforeUnmount(() => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  })

  return { statusMessage, statusType, setStatus, clearStatus, showStatus, showSuccess, showError, showInfo }
}
