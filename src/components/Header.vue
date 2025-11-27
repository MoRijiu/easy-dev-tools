<template>
  <header class="header">
    <div class="container">
      <div class="logo-section">
        <router-link to="/" class="logo">
          <img src="/favicon.svg" alt="极速开发工具箱" class="logo-icon" />
          <span class="logo-text">极速开发工具箱</span>
        </router-link>
        <div class="tools-dropdown" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
          <button class="tools-trigger" aria-label="全部工具" title="全部工具">
            <span class="tools-text">全部工具</span>
          </button>
          <div v-show="showDropdown" class="dropdown-menu" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
            <div class="dropdown-content">
              <div v-for="group in toolGroups" :key="group.id" class="tool-group">
                <div class="group-header">
                  <span class="group-icon">{{ group.icon }}</span>
                  <span class="group-name">{{ group.name }}</span>
                </div>
                <div class="group-tools">
                  <router-link
                    v-for="tool in group.tools"
                    :key="tool.id"
                    :to="tool.path"
                    class="tool-item"
                    :class="{ active: isCurrentTool(tool.path) }"
                  >
                    <span class="tool-icon">{{ tool.icon }}</span>
                    <span class="tool-name">{{ tool.name }}</span>
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <nav class="nav">
        <router-link to="/" class="nav-link">首页</router-link>
        <router-link to="/about" class="nav-link">关于</router-link>
        <router-link to="/about#support" class="nav-link support-link">
          <span class="support-icon">☕</span>
          <span>赞赏</span>
        </router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { toolGroups } from '../router/tools-config'

const route = useRoute()
const showDropdown = ref(false)
let hideTimeout = null

const handleMouseEnter = () => {
  // 清除之前的隐藏定时器
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  showDropdown.value = true
}

const handleMouseLeave = () => {
  // 延长延迟时间，给用户更多时间移动到下拉菜单
  hideTimeout = setTimeout(() => {
    showDropdown.value = false
  }, 300)
}

const isCurrentTool = (path) => {
  return route.path === path
}
</script>

<style scoped>
.header {
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  transition: opacity 0.2s;
}

.logo:hover {
  opacity: 0.8;
}

.logo-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.logo-text {
  letter-spacing: -0.5px;
}

.nav {
  display: flex;
  gap: 32px;
  align-items: center;
}

.nav-link {
  color: #6b7280;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: color 0.2s;
  position: relative;
}

.nav-link:hover {
  color: #1f2937;
}

.nav-link.router-link-active {
  color: #667eea;
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  height: 2px;
  background: #667eea;
}

.support-link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
  border-radius: 6px;
  color: #2c3e50 !important;
  font-weight: 600;
  transition: all 0.3s ease;
}

/* 移除赞赏链接的选中下划线 */
.support-link.router-link-active::after {
  display: none;
}

.support-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(253, 203, 110, 0.4);
}

.support-icon {
  font-size: 16px;
}

/* 工具下拉菜单 */
.tools-dropdown {
  position: relative;
}

.tools-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: #4b5563;
  font-weight: 500;
}

.tools-trigger:hover {
  background: #667eea;
  border-color: #667eea;
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.tools-icon {
  font-size: 16px;
  font-weight: bold;
  transition: transform 0.2s;
}

.tools-text {
  font-size: 13px;
  white-space: nowrap;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 20px;
  min-width: 400px;
  max-width: 500px;
  max-height: 600px;
  overflow-y: auto;
  z-index: 1000;
  opacity: 1;
  transition: opacity 0.15s ease;
}

/* 创建一个透明的桥接区域，连接按钮和下拉菜单 */
.dropdown-menu::before {
  content: '';
  position: absolute;
  top: -12px;
  left: 0;
  right: 0;
  height: 12px;
  background: transparent;
}


.dropdown-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-group {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.group-icon {
  font-size: 18px;
}

.group-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.group-tools {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: #4b5563;
  font-size: 14px;
  transition: all 0.2s;
  background: transparent;
}

.tool-item:hover {
  background: #ffffff;
  color: #667eea;
  transform: translateX(4px);
}

.tool-item.active {
  background: #667eea;
  color: #ffffff;
  font-weight: 500;
}

.tool-item.active .tool-icon {
  transform: scale(1.1);
}

.tool-item .tool-icon {
  font-size: 16px;
  transition: transform 0.2s;
}

.tool-item .tool-name {
  flex: 1;
}

@media (max-width: 768px) {
  .container {
    padding: 0 16px;
  }
  
  .logo-text {
    font-size: 16px;
  }
  
  .nav {
    gap: 20px;
  }
  
  .nav-link {
    font-size: 14px;
  }
  
  .dropdown-menu {
    min-width: 90vw;
    left: 10px;
    right: 10px;
    transform: none;
  }
  
  .dropdown-content {
    grid-template-columns: 1fr;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>