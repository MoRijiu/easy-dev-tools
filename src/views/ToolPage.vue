<template>
  <main class="tool-page">
    <header class="tool-header">
      <button
        class="back-button"
        @click="goBack"
        aria-label="返回首页"
      >
        ← 返回首页
      </button>
      <div class="tool-title">
        <span class="tool-icon" aria-hidden="true">{{ toolIcon }}</span>
        <h1>{{ toolName }}</h1>
      </div>
      <p class="tool-description">{{ toolDescription }}</p>
    </header>
    
    <section class="tool-content" role="main">
      <div class="placeholder">
        <p aria-label="工具开发中">🚧 工具开发中...</p>
        <p class="hint">此工具页面即将上线</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSeo, toolSeoConfig } from '../composables/useSeo'

const router = useRouter()
const route = useRoute()

const toolsMap = {
  'json-formatter': { name: 'JSON格式化', icon: '{ }', description: '格式化和验证JSON数据' },
  'base64': { name: 'Base64编解码', icon: '🔐', description: 'Base64编码和解码工具' },
  'url-encode': { name: 'URL编解码', icon: '🔗', description: 'URL编码和解码工具' },
  'markdown': { name: 'Markdown编辑器', icon: '📄', description: '实时预览的Markdown编辑器' },
  'timestamp': { name: '时间戳转换', icon: '⏰', description: '时间戳与日期时间互转' },
  'color-converter': { name: '颜色转换', icon: '🎨', description: 'RGB、HEX、HSL颜色转换' },
  'unit-converter': { name: '单位转换', icon: '📏', description: '长度、重量等单位转换' },
  'uuid': { name: 'UUID生成器', icon: '🆔', description: '生成UUID/GUID' },
  'qrcode': { name: '二维码生成', icon: '📱', description: '生成二维码图片' },
  'password': { name: '密码生成器', icon: '🔑', description: '生成安全的随机密码' },
  'lorem-ipsum': { name: '占位文本生成', icon: '📃', description: '生成Lorem Ipsum占位文本' },
  'hash': { name: '哈希计算', icon: '#️⃣', description: 'MD5、SHA1、SHA256等哈希计算' },
  'aes': { name: 'AES加解密', icon: '🛡️', description: 'AES对称加密解密' },
  'image-compress': { name: '图片压缩', icon: '📦', description: '在线压缩图片大小' },
  'image-converter': { name: '图片格式转换', icon: '🔄', description: '转换图片格式' }
}

const toolId = computed(() => route.params.id)
const currentTool = computed(() => toolsMap[toolId.value] || { name: '未知工具', icon: '❓', description: '' })
const toolName = computed(() => currentTool.value.name)
const toolIcon = computed(() => currentTool.value.icon)
const toolDescription = computed(() => currentTool.value.description)

// SEO 优化
const { updateMeta } = useSeo()

// 监听工具ID变化，更新SEO信息
watch(toolId, (newToolId) => {
  const seoConfig = toolSeoConfig[newToolId]
  if (seoConfig) {
    updateMeta({
      ...seoConfig,
      canonical: `https://easy-dev-tools.com/tools/${newToolId}`
    })
  }
}, { immediate: true })

const goBack = () => {
  router.push('/')
}
</script>

<style scoped>
.tool-page {
  max-width: 1200px;
  margin: 0 auto;
}

.tool-header {
  margin-bottom: 2rem;
}

.back-button {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  color: #495057;
  transition: all 0.2s;
  margin-bottom: 1.5rem;
}

.back-button:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.tool-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.tool-icon {
  font-size: 2.5rem;
}

.tool-title h1 {
  font-size: 2rem;
  color: #2c3e50;
  margin: 0;
}

.tool-description {
  font-size: 1.1rem;
  color: #7f8c8d;
  margin: 0;
}

.tool-content {
  background: #fff;
  border-radius: 12px;
  padding: 3rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  text-align: center;
  color: #7f8c8d;
}

.placeholder p:first-child {
  font-size: 3rem;
  margin: 0 0 1rem 0;
}

.placeholder .hint {
  font-size: 1.2rem;
  margin: 0;
}

@media (max-width: 768px) {
  .tool-title h1 {
    font-size: 1.5rem;
  }
  
  .tool-content {
    padding: 2rem 1rem;
  }
}
</style>