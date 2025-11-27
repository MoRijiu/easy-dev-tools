import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import ToolPage from '../views/ToolPage.vue'
import About from '../views/About.vue'
import { generateRoutes } from './tools-config'

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

// 兜底路由 - 处理未实现的工具页面
const fallbackRoutes = [
  {
    path: '/:category/:toolId',
    name: 'Tool',
    component: ToolPage
  }
]

// 合并所有路由
const routes = [...baseRoutes, ...toolRoutes, ...fallbackRoutes]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else if (to.hash) {
      // 支持hash锚点跳转
      return {
        el: to.hash,
        behavior: 'smooth',
        top: 80 // 偏移量，避免被header遮挡
      }
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

export default router