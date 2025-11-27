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

// 工具页面的 SEO 配置
export const toolSeoConfig = {
  'json-formatter': {
    title: 'JSON格式化工具 - 在线JSON美化验证 | 极速开发工具箱',
    description: '免费在线JSON格式化工具，支持JSON美化、压缩、验证和语法高亮。快速格式化JSON数据，提升开发效率。',
    keywords: 'JSON格式化,JSON美化,JSON验证,JSON工具,在线JSON,JSON Formatter'
  },
  'base64': {
    title: 'Base64编解码工具 - 在线Base64加密解密 | 极速开发工具箱',
    description: '免费在线Base64编码解码工具，支持文本和图片的Base64转换。快速进行Base64加密解密操作。',
    keywords: 'Base64编码,Base64解码,Base64加密,Base64解密,Base64工具'
  },
  'url-encode': {
    title: 'URL编解码工具 - 在线URL编码解码 | 极速开发工具箱',
    description: '免费在线URL编码解码工具，支持URL参数编码和解码。快速处理URL特殊字符转换。',
    keywords: 'URL编码,URL解码,URL转码,URLEncode,URLDecode'
  },
  'markdown': {
    title: 'Markdown编辑器 - 在线Markdown实时预览 | 极速开发工具箱',
    description: '免费在线Markdown编辑器，支持实时预览、语法高亮和导出功能。轻松编写和预览Markdown文档。',
    keywords: 'Markdown编辑器,Markdown预览,在线Markdown,MD编辑器'
  },
  'timestamp': {
    title: '时间戳转换工具 - Unix时间戳转换 | 极速开发工具箱',
    description: '免费在线时间戳转换工具，支持Unix时间戳与日期时间互转。快速进行时间戳格式转换。',
    keywords: '时间戳转换,Unix时间戳,时间戳工具,日期转换'
  },
  'color-converter': {
    title: '颜色转换工具 - RGB HEX HSL颜色转换 | 极速开发工具箱',
    description: '免费在线颜色转换工具，支持RGB、HEX、HSL等多种颜色格式互转。快速进行颜色代码转换。',
    keywords: '颜色转换,RGB转换,HEX转换,HSL转换,颜色代码'
  },
  'unit-converter': {
    title: '单位转换工具 - 长度重量单位换算 | 极速开发工具箱',
    description: '免费在线单位转换工具，支持长度、重量、温度等多种单位换算。快速进行单位转换计算。',
    keywords: '单位转换,单位换算,长度转换,重量转换,单位计算器'
  },
  'uuid': {
    title: 'UUID生成器 - 在线UUID/GUID生成工具 | 极速开发工具箱',
    description: '免费在线UUID生成器，快速生成标准UUID/GUID。支持批量生成和多种UUID版本。',
    keywords: 'UUID生成器,GUID生成,UUID工具,唯一标识符'
  },
  'qrcode': {
    title: '二维码生成器 - 在线二维码制作工具 | 极速开发工具箱',
    description: '免费在线二维码生成器，快速生成二维码图片。支持文本、URL、名片等多种内容类型。',
    keywords: '二维码生成,二维码制作,QR码生成器,在线二维码'
  },
  'password': {
    title: '密码生成器 - 随机密码生成工具 | 极速开发工具箱',
    description: '免费在线密码生成器，生成安全的随机密码。支持自定义长度和字符类型，提升账户安全。',
    keywords: '密码生成器,随机密码,强密码生成,密码工具'
  },
  'lorem-ipsum': {
    title: '占位文本生成器 - Lorem Ipsum生成工具 | 极速开发工具箱',
    description: '免费在线Lorem Ipsum占位文本生成器，快速生成测试文本。支持段落、句子和单词生成。',
    keywords: 'Lorem Ipsum,占位文本,测试文本,假文生成器'
  },
  'hash': {
    title: '哈希计算工具 - MD5 SHA1 SHA256在线计算 | 极速开发工具箱',
    description: '免费在线哈希计算工具，支持MD5、SHA1、SHA256等多种哈希算法。快速计算文本哈希值。',
    keywords: '哈希计算,MD5计算,SHA1,SHA256,Hash工具'
  },
  'aes': {
    title: 'AES加解密工具 - 在线AES加密解密 | 极速开发工具箱',
    description: '免费在线AES加密解密工具，支持AES对称加密算法。快速进行数据加密和解密操作。',
    keywords: 'AES加密,AES解密,对称加密,加密工具'
  },
  'image-compress': {
    title: '图片压缩工具 - 在线图片压缩优化 | 极速开发工具箱',
    description: '免费在线图片压缩工具，快速压缩图片大小。支持JPG、PNG等格式，保持图片质量。',
    keywords: '图片压缩,图片优化,在线压缩,图片工具'
  },
  'image-converter': {
    title: '图片格式转换 - 在线图片格式转换工具 | 极速开发工具箱',
    description: '免费在线图片格式转换工具，支持JPG、PNG、WebP等多种格式互转。快速转换图片格式。',
    keywords: '图片转换,格式转换,JPG转PNG,图片格式'
  }
}