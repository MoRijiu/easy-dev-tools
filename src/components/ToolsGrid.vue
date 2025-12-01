<template>
  <div class="tools-section">
    <div class="container">
      <div class="section-header">
        <h1 class="title">开发工具集合</h1>
        <p class="subtitle">精选常用开发工具，提升您的工作效率</p>
      </div>
      
      <div class="tools-grid">
        <div
          class="tool-card"
          v-for="tool in tools"
          :key="tool.id"
          @click="navigateToTool(tool)"
          :class="{ 'tool-available': tool.route }"
        >
          <div class="tool-icon">{{ tool.icon }}</div>
          <h3 class="tool-name">{{ tool.name }}</h3>
          <p class="tool-desc">{{ tool.description }}</p>
          <button class="tool-btn" v-if="tool.route">使用工具</button>
          <button class="tool-btn tool-btn-disabled" v-else disabled>即将推出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const tools = ref([
  {
    id: 1,
    name: 'JSON格式化',
    icon: '📋',
    description: '格式化和验证JSON数据，支持压缩和美化',
    route: '/tools/json-formatter'
  },
  {
    id: 2,
    name: 'Base64编解码',
    icon: '🔐',
    description: '快速进行Base64编码和解码操作',
    route: '/text/base64'
  },
  {
    id: 3,
    name: 'URL编解码',
    icon: '🔗',
    description: 'URL参数编码解码，支持批量处理',
    route: null
  },
  {
    id: 4,
    name: '时间戳转换',
    icon: '⏰',
    description: '时间戳与日期时间相互转换工具',
    route: null
  },
  {
    id: 5,
    name: '颜色转换',
    icon: '🎨',
    description: 'RGB、HEX、HSL等颜色格式互转',
    route: null
  },
  {
    id: 6,
    name: 'MD5加密',
    icon: '🔒',
    description: '生成字符串的MD5哈希值',
    route: null
  },
  {
    id: 7,
    name: '正则测试',
    icon: '🔍',
    description: '在线测试和调试正则表达式',
    route: null
  },
  {
    id: 8,
    name: 'UUID生成',
    icon: '🆔',
    description: '快速生成UUID/GUID唯一标识符',
    route: null
  }
])

const navigateToTool = (tool) => {
  if (tool.route) {
    router.push(tool.route)
  }
}
</script>

<style scoped>
.tools-section {
  flex: 1;
  padding: 48px 0;
  background: #ffffff;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-header {
  text-align: center;
  margin-bottom: 48px;
}

.title {
  font-size: 36px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 12px 0;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.tool-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 32px 24px;
  transition: all 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.tool-card.tool-available:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
}

.tool-card:not(.tool-available) {
  opacity: 0.7;
  cursor: not-allowed;
}

.tool-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.tool-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.tool-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px 0;
  line-height: 1.6;
  flex: 1;
}

.tool-btn {
  background: #3b82f6;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.tool-btn:hover {
  background: #2563eb;
  transform: scale(1.02);
}

.tool-btn:active {
  transform: scale(0.98);
}

.tool-btn-disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.tool-btn-disabled:hover {
  background: #9ca3af;
  transform: none;
}

@media (max-width: 768px) {
  .tools-section {
    padding: 32px 0;
  }
  
  .container {
    padding: 0 16px;
  }
  
  .section-header {
    margin-bottom: 32px;
  }
  
  .title {
    font-size: 28px;
  }
  
  .subtitle {
    font-size: 14px;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .tool-card {
    padding: 24px 20px;
  }
}
</style>