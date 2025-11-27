<template>
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <div class="footer-brand">
            <div class="brand-logo">
              <img src="/favicon.svg" alt="极速开发工具箱" class="logo-icon" />
              <span class="footer-logo">极速开发工具箱</span>
            </div>
            <p class="footer-desc">让开发更简单，让工具更好用</p>
            <p class="footer-motto">{{ currentMotto }}</p>
          </div>
        </div>
        
        <div class="footer-section">
          <h3 class="footer-title">快速链接</h3>
          <div class="footer-links">
            <router-link to="/" class="footer-link">
              <span class="link-icon">🏠</span> 首页
            </router-link>
            <router-link to="/about" class="footer-link">
              <span class="link-icon">📖</span> 关于
            </router-link>
            <router-link to="/about#support" class="footer-link support-highlight">
              <span class="link-icon">☕</span> 赞赏支持
            </router-link>
            <a href="https://github.com/MoRijiu/easy-dev-tools" target="_blank" rel="noopener noreferrer" class="footer-link">
              <span class="link-icon">💻</span> GitHub
            </a>
          </div>
        </div>

        <div class="footer-section">
          <h3 class="footer-title">联系方式</h3>
          <div class="footer-links">
            <a href="mailto:1092257069@qq.com" class="footer-link">
              <span class="link-icon">📧</span> 邮箱联系
            </a>
            <a href="https://tools.morijiu.cn" target="_blank" rel="noopener noreferrer" class="footer-link">
              <span class="link-icon">🌐</span> 官方网站
            </a>
            <a href="https://github.com/MoRijiu/easy-dev-tools/issues" target="_blank" rel="noopener noreferrer" class="footer-link">
              <span class="link-icon">💬</span> 问题反馈
            </a>
          </div>
        </div>
      </div>

      <div class="footer-divider"></div>

      <div class="footer-bottom">
        <div class="footer-info">
          <p class="copyright">
            © {{ currentYear }} 极速开发工具箱 · Made with
            <span class="heart" :class="{ beating: isHeartBeating }">❤️</span>
            by <a href="https://github.com/MoRijiu" target="_blank" rel="noopener noreferrer" class="dev-link">Mo_Rijiu</a>
          </p>
          <p class="icp">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" class="icp-link">
              辽ICP备2023000877号-1
            </a>
          </p>
          <!-- 访问统计 -->
          <p class="footer-stats">
            <span class="stats-text">
              总访问量 <span id="busuanzi_site_pv" class="stats-number">-</span> 次
            </span>
            <span class="stats-separator">·</span>
            <span class="stats-text">
              总访客数 <span id="busuanzi_site_uv" class="stats-number">-</span> 人
            </span>
          </p>
        </div>
        <div class="footer-badge">
          <span class="badge-item" title="开源项目">⭐ Open Source</span>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const currentYear = new Date().getFullYear()
const isHeartBeating = ref(false)

// 幽默的座右铭轮播
const mottos = [
  '代码写得好，下班回家早 🏃',
  '没有Bug是修不好的，如果有，那就重启 🔄',
  '今天不想写代码，但还是写了 💪',
  '用工具解决问题，而不是制造问题 🎯',
  '让开发像呼吸一样自然 🌊',
  '工具在手，天下我有 ⚡'
]

const currentMotto = ref(mottos[Math.floor(Math.random() * mottos.length)])

// 心跳动画
let heartbeatInterval = null
onMounted(() => {
  heartbeatInterval = setInterval(() => {
    isHeartBeating.value = true
    setTimeout(() => {
      isHeartBeating.value = false
    }, 300)
  }, 3000)

  // 加载不蒜子统计脚本
  const script = document.createElement('script')
  script.src = '//cdn.busuanzi.cc/busuanzi/3.6.9/busuanzi.min.js'
  script.async = true
  script.defer = true
  document.head.appendChild(script)
})

onBeforeUnmount(() => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
})
</script>

<style scoped>
.footer {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-top: 1px solid #e2e8f0;
  margin-top: auto;
  position: relative;
  overflow: hidden;
}

.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    #3b82f6 25%, 
    #8b5cf6 50%, 
    #ec4899 75%, 
    transparent 100%
  );
  opacity: 0.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px 24px 24px;
}

.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 48px;
  margin-bottom: 40px;
}

.footer-section {
  display: flex;
  flex-direction: column;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.footer-logo {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.5px;
}

.footer-desc {
  color: #64748b;
  font-size: 14px;
  margin: 0;
  line-height: 1.6;
  font-weight: 500;
}

.footer-motto {
  color: #94a3b8;
  font-size: 13px;
  margin: 8px 0 0 0;
  font-style: italic;
  padding: 8px 12px;
  background: rgba(148, 163, 184, 0.08);
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
  transition: all 0.3s ease;
}

.footer-motto:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: translateX(4px);
}

.footer-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.footer-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-link {
  color: #64748b;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  position: relative;
}

.footer-link::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: 2px;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.3s ease;
}

.footer-link:hover {
  color: #3b82f6;
  transform: translateX(4px);
}

.footer-link:hover::before {
  width: 100%;
}

.link-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.footer-link.support-highlight {
  color: #f59e0b;
  font-weight: 600;
}

.footer-link.support-highlight:hover {
  color: #d97706;
}

.footer-link.support-highlight::before {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.footer-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 12px;
  margin: 0;
}

.stats-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stats-number {
  color: #64748b;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  transition: color 0.2s ease;
}

.stats-text:hover .stats-number {
  color: #3b82f6;
}

.stats-separator {
  color: #cbd5e1;
  margin: 0 4px;
}

.footer-divider {
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    #e2e8f0 20%,
    #e2e8f0 80%,
    transparent 100%
  );
  margin: 32px 0;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 24px;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.copyright {
  color: #94a3b8;
  font-size: 13px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.heart {
  display: inline-block;
  color: #ef4444;
  font-size: 14px;
  transition: transform 0.3s ease;
}

.heart.beating {
  animation: heartbeat 0.3s ease;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}

.dev-link {
  color: #8b5cf6;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s ease;
  position: relative;
}

.dev-link:hover {
  color: #7c3aed;
}

.dev-link::after {
  content: '✨';
  position: absolute;
  right: -18px;
  opacity: 0;
  transition: all 0.3s ease;
}

.dev-link:hover::after {
  opacity: 1;
  right: -22px;
}

.icp {
  color: #94a3b8;
  font-size: 12px;
  margin: 0;
}

.icp-link {
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.2s;
}

.icp-link:hover {
  color: #64748b;
}

.footer-badge {
  display: flex;
  gap: 12px;
  align-items: center;
}

.badge-item {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 20px;
  transition: all 0.3s ease;
  cursor: default;
  user-select: none;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.badge-item:hover {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

@media (max-width: 968px) {
  .footer-content {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }

  .footer-section:first-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .container {
    padding: 40px 16px 20px;
  }

  .footer-content {
    grid-template-columns: 1fr;
    gap: 32px;
    margin-bottom: 32px;
  }

  .footer-section:first-child {
    grid-column: 1;
  }

  .footer-stats {
    flex-wrap: wrap;
    justify-content: flex-start;
    font-size: 11px;
  }

  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .footer-badge {
    width: 100%;
  }

  .badge-item {
    flex: 1;
    text-align: center;
    font-size: 12px;
    padding: 6px 10px;
  }

  .copyright {
    font-size: 12px;
  }

  .logo-icon {
    width: 28px;
    height: 28px;
  }

  .footer-logo {
    font-size: 18px;
  }
}
</style>