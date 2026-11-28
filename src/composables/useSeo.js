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

    // 更新或创建 meta 标签的辅助函数（R12h）：index.html 的 twitter
    // 标签用 property=、本函数旧版按 name= 查询，查不到就再新建一份，
    // 同一标签出现 property/name 两份且值还可能不一致（首页
    // twitter:title 即如此），平台读到哪份不确定。现两种属性的同名
    // 标签全部同步更新，一个都没有时才按指定属性新建，与路由守卫
    // setMetaAll 同口径。
    const setMetaTag = (name, content, isProperty = false) => {
      if (!content) return

      const found = document.querySelectorAll(
        `meta[property="${name}"], meta[name="${name}"]`
      )
      if (found.length) {
        found.forEach((el) => {
          // 若历史残留了两份同名标签，删多余的只留一份，避免值分叉
          if (el !== found[0]) el.remove()
          else el.setAttribute('content', content)
        })
        return
      }
      const element = document.createElement('meta')
      element.setAttribute(isProperty ? 'property' : 'name', name)
      element.setAttribute('content', content)
      document.head.appendChild(element)
    }

    // 更新基本 meta 标签
    setMetaTag('description', description)
    setMetaTag('keywords', keywords)
    setMetaTag('title', title)

    // 更新 Open Graph 标签
    setMetaTag('og:title', ogTitle || title, true)
    setMetaTag('og:description', ogDescription || description, true)
    setMetaTag('og:image', ogImage || 'https://tools.morijiu.cn/og-image.png', true)
    // og:url 未传 canonical 时旧版回退 window.location.href（R12h）：
    // About 未传 canonical，挂载后会把路由守卫刚同步好的正式域名
    // 地址覆盖成当前地址——测试环境是测试域名、带查询串/锚点时还会
    // 把参数带进去，与 canonical 自相矛盾。现回退为正式域名+当前
    // 路径（只取路径，与守卫 syncCanonical 同口径）。
    setMetaTag(
      'og:url',
      canonical ||
        `https://tools.morijiu.cn${route.path === '/' ? '/' : route.path}`,
      true
    )
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
