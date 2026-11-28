import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
// R10c 分块：Home 是首屏保持静态导入；About/NotFound 非首屏，改路由懒加载
// 移出主包，按需加载（行为等价，仅加载时机后移）
const NotFound = () => import('../views/NotFound.vue')
const About = () => import('../views/About.vue')
import { generateRoutes, getToolByPath } from './tools-config'
import { useToolPrefs } from '../composables/useToolPrefs'

// 基础路由
const baseRoutes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: {
      title: '开发者工具箱 - 免费在线开发工具集合',
      description: '提供JSON格式化、Base64编解码、URL编解码、时间戳转换等常用开发工具'
    }
  },
  {
    path: '/about',
    name: 'About',
    component: About,
    meta: {
      title: '关于我们 - 极速开发工具箱',
      description: '了解极速开发工具箱的开发初衷、技术栈和开源信息。一个为提高开发效率而生的在线工具集合。',
      keywords: '关于,开发工具,开源项目,Vue3,Vite,AI辅助开发'
    }
  }
]

// 从配置生成工具路由
const toolRoutes = generateRoutes()

// 兜底路由 - 未知路径一律落 404 页（R9ao）：旧版二段路径落「工具开发中」
// 占位页会把不存在误报成未上线，且占位页读错参数名（params.id 对 toolId）
// 永远显示「未知工具」；一段/三段以上路径则无任何路由命中、主区域白屏。
// 现统一 catch-all 到 NotFound，任何形状的未知路径都有明确出口。
const fallbackRoutes = [
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: {
      title: '页面不存在 - 极速开发工具箱',
      description: '访问的页面不存在，返回首页或搜索 72 个在线开发工具。'
    }
  }
]

// 合并所有路由
const routes = [...baseRoutes, ...toolRoutes, ...fallbackRoutes]

// 系统「减少动态效果」偏好（R9am）：全局 CSS 的减动效规则只能压缩 CSS
// 动画/过渡，管不到 JS 指定的平滑滚动——减动效时锚点滚动必须瞬时完成，
// 否则大幅平滑滚动仍会给前庭敏感用户带来不适（与 Danmaku 同口径）
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else if (to.hash) {
      // 支持hash锚点跳转。页面过渡是 out-in 模式：滚动行为执行时新页面
      // 还没挂载、锚点元素不存在，vue-router 会直接放弃滚动（旧版点
      // 「支持」链接到关于页后停在页首、#support 区根本不滚）。返回
      // Promise 等元素出现后再定位，最多等 1 秒，等不到则回页首。
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
      return new Promise((resolve) => {
        const started = Date.now()
        const tick = () => {
          let found = false
          try {
            found = !!document.querySelector(to.hash)
          } catch {
            found = false
          }
          if (found) {
            resolve({ el: to.hash, behavior, top: 80 }) // 偏移量，避免被header遮挡
          } else if (Date.now() - started > 1000) {
            resolve({ top: 0 })
          } else {
            setTimeout(tick, 30)
          }
        }
        tick()
      })
    } else {
      return { top: 0 }
    }
  }
})

// 全局路由守卫 - 设置页面标题和描述
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title
  }
  
  // 设置页面描述
  if (to.meta.description) {
    let descriptionMeta = document.querySelector('meta[name="description"]')
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta')
      descriptionMeta.name = 'description'
      document.head.appendChild(descriptionMeta)
    }
    descriptionMeta.content = to.meta.description
  }
  
  // 设置关键词
  if (to.meta.keywords) {
    let keywordsMeta = document.querySelector('meta[name="keywords"]')
    if (!keywordsMeta) {
      keywordsMeta = document.createElement('meta')
      keywordsMeta.name = 'keywords'
      document.head.appendChild(keywordsMeta)
    }
    keywordsMeta.content = to.meta.keywords
  }
  
  next()
})

// 访问工具页时记录「最近使用」（本地存储，不上传）
router.afterEach((to) => {
  if (getToolByPath(to.path)) {
    useToolPrefs().recordVisit(to.path)
  }
})

export default router