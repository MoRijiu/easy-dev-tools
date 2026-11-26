// 版本信息：构建时由 vite.config.js 注入 __APP_VERSION__ / __APP_ENV__
// 环境口径：prod 显示裸版本号、test 显示 _test 后缀、dev 显示 _dev 后缀
const rawVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
const rawEnv = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__ : 'dev'

export const APP_ENV = rawEnv
export const APP_VERSION = rawVersion

export function formatVersion() {
  if (rawEnv === 'prod') return `v${rawVersion}`
  if (rawEnv === 'test') return `v${rawVersion}_test`
  return `v${rawVersion}_dev`
}

export const DISPLAY_VERSION = formatVersion()
