// 剪贴板复制统一入口（R10b1）：收敛各工具手抄的 navigator.clipboard.writeText
// + try/catch + 状态消息骨架。全仓口径保持不变：不做 execCommand 回退，
// 失败时提示用户手动复制。
// 传入 useStatusMessage() 的返回对象时，copyText 会按旧写法回写状态消息；
// 只需要布尔结果的场景用 copyToClipboard（不写状态）。
export function useClipboard(status = null) {
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  // 复制并回写状态：成功用 okMsg（可带 2 秒守卫清除），失败用 failMsg（不自动清除）
  const copyText = async (text, okMsg, { failMsg = '✗ 复制失败，请手动复制', autoClearMs = 0 } = {}) => {
    const ok = await copyToClipboard(text)
    if (status) {
      if (ok) status.showSuccess(okMsg, autoClearMs)
      else status.showError(failMsg)
    }
    return ok
  }

  return { copyToClipboard, copyText }
}
