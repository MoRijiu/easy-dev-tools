/*
 * @Author: morijiu
 * @Date: 2025-11-27 20:37:00
 * @LastEditors: Do not edit
 * @LastEditTime: 2025-11-27 22:40:31
 * @Description: SEO composable for dynamic meta tags
 * @FilePath: \easy-dev-tools\src\composables\useSeo.js
 */
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

export function useSeo(options = {}) {
  const route = useRoute()

  const updateMeta = (metaOptions) => {
    const {
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      canonical
    } = metaOptions

    // 更新标题
    if (title) {
      document.title = title
    }

    // 更新或创建 meta 标签的辅助函数
    const setMetaTag = (name, content, isProperty = false) => {
      if (!content) return

      const attribute = isProperty ? 'property' : 'name'
      let element = document.querySelector(`meta[${attribute}="${name}"]`)
      
      if (element) {
        element.setAttribute('content', content)
      } else {
        element = document.createElement('meta')
        element.setAttribute(attribute, name)
        element.setAttribute('content', content)
        document.head.appendChild(element)
      }
    }

    // 更新基本 meta 标签
    setMetaTag('description', description)
    setMetaTag('keywords', keywords)
    setMetaTag('title', title)

    // 更新 Open Graph 标签
    setMetaTag('og:title', ogTitle || title, true)
    setMetaTag('og:description', ogDescription || description, true)
    setMetaTag('og:image', ogImage || 'https://tools.morijiu.cn/og-image.png', true)
    setMetaTag('og:url', canonical || window.location.href, true)
    setMetaTag('og:type', 'website', true)
    setMetaTag('og:locale', 'zh_CN', true)
    setMetaTag('og:site_name', '极速开发工具箱', true)

    // 更新 Twitter 标签
    setMetaTag('twitter:card', 'summary_large_image')
    setMetaTag('twitter:title', ogTitle || title)
    setMetaTag('twitter:description', ogDescription || description)
    setMetaTag('twitter:image', ogImage || 'https://tools.morijiu.cn/twitter-image.png')

    // 更新 canonical 链接
    if (canonical) {
      let linkElement = document.querySelector('link[rel="canonical"]')
      if (linkElement) {
        linkElement.setAttribute('href', canonical)
      } else {
        linkElement = document.createElement('link')
        linkElement.setAttribute('rel', 'canonical')
        linkElement.setAttribute('href', canonical)
        document.head.appendChild(linkElement)
      }
    }
  }

  onMounted(() => {
    updateMeta(options)
  })

  // 监听路由变化
  watch(() => route.path, () => {
    if (options.dynamic) {
      updateMeta(options)
    }
  })

  return {
    updateMeta
  }
}
