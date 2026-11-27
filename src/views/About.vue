<template>
  <div class="about-page">
    <div class="about-container">
      <!-- 头部介绍 -->
      <section class="hero-section">
        <div class="hero-icon" aria-hidden="true">🚀</div>
        <h1>关于极速开发工具箱</h1>
        <p class="subtitle">一个为了更高效开发而诞生的工具集合</p>
      </section>

      <!-- 开发初衷 -->
      <section class="section">
        <div class="section-icon" aria-hidden="true">💡</div>
        <h2>开发初衷</h2>
        <div class="content-card">
          <p>
            这个项目最初是为了<strong>让自己和团队的开发工作更高效</strong>而创建的。
            作为一名开发者，我深知在日常工作中经常需要用到各种小工具：
            格式化JSON、转换时间戳、生成UUID、编解码Base64...
          </p>
          <p>
            与其每次都去搜索"在线JSON格式化"、"Base64编码工具"，
            不如把这些常用工具整合到一起，<strong>打开就能用，简单又高效</strong>！
          </p>
          <p>
            同时，这也是我学习和实践前端技术的一个项目。
            通过开发这个工具箱，我能够深入学习Vue 3、Vite等现代前端技术栈，
            并将所学知识应用到实际项目中。
          </p>
        </div>
      </section>

      <!-- 技术栈 -->
      <section class="section">
        <div class="section-icon" aria-hidden="true">🛠️</div>
        <h2>技术栈</h2>
        <div class="tech-grid">
          <div class="tech-card">
            <span class="tech-icon" aria-hidden="true">⚡</span>
            <h3>Vue 3</h3>
            <p>现代化的渐进式框架</p>
          </div>
          <div class="tech-card">
            <span class="tech-icon" aria-hidden="true">🚀</span>
            <h3>Vite</h3>
            <p>极速的构建工具</p>
          </div>
          <div class="tech-card">
            <span class="tech-icon" aria-hidden="true">🎨</span>
            <h3>CSS3</h3>
            <p>精美的界面设计</p>
          </div>
          <div class="tech-card">
            <span class="tech-icon" aria-hidden="true">🤖</span>
            <h3>AI 辅助</h3>
            <p>提升开发效率</p>
          </div>
        </div>
      </section>

      <!-- 开发过程 -->
      <section class="section">
        <div class="section-icon" aria-hidden="true">🎯</div>
        <h2>开发过程</h2>
        <div class="content-card">
          <p>
            这个项目的开发过程中，我充分利用了<strong>AI辅助编程</strong>的优势。
            通过与AI的协作，我能够：
          </p>
          <ul class="feature-list">
            <li>✨ 快速实现功能原型</li>
            <li>🐛 高效定位和修复bug</li>
            <li>📚 学习最佳实践和设计模式</li>
            <li>🎨 优化用户体验和界面设计</li>
            <li>⚡ 提升代码质量和性能</li>
          </ul>
          <p>
            AI不是替代开发者，而是成为开发者的得力助手。
            它让我能够把更多精力放在<strong>创意和架构设计</strong>上，
            而不是纠结于语法细节。
          </p>
        </div>
      </section>

      <!-- 开源说明 -->
      <section class="section">
        <div class="section-icon" aria-hidden="true">🌟</div>
        <h2>开源项目</h2>
        <div class="content-card">
          <p>
            这个项目是<strong>完全开源</strong>的！代码托管在GitHub上，
            欢迎大家查看、学习、使用，甚至贡献代码。
          </p>
          <p>
            如果你觉得这个工具箱对你有帮助，可以：
          </p>
          <ul class="feature-list">
            <li>⭐ 给项目点个Star</li>
            <li>🐛 提交Issue反馈问题</li>
            <li>💡 提出新功能建议</li>
            <li>🔧 贡献代码和改进</li>
          </ul>
          <div class="github-link">
            <a href="https://github.com/MoRijiu/easy-dev-tools" target="_blank" rel="noopener noreferrer">
              <span class="github-icon" aria-hidden="true">📦</span>
              <span>查看GitHub仓库</span>
            </a>
          </div>
        </div>
      </section>

      <!-- 打赏支持 -->
      <section id="support" class="section support-section">
        <div class="section-icon" aria-hidden="true">☕</div>
        <h2>支持一下</h2>
        <div class="content-card support-card">
          <p class="support-text">
            如果这个工具箱帮你节省了时间，提高了效率，
            <br>
            不妨请我喝杯咖啡，让我有更多动力持续更新和维护！
          </p>
          <p class="support-joke">
            （毕竟服务器也要吃饭的嘛 😄）
          </p>
          
          <div class="qrcode-container">
            <div class="qrcode-item">
              <img src="@/assets/images/wx-qr.jpg" alt="微信赞赏码" class="qrcode-image" />
              <p class="qrcode-label">微信赞赏</p>
            </div>
            <div class="qrcode-item">
              <img src="@/assets/images/zfb-qr.jpg" alt="支付宝收款码" class="qrcode-image" />
              <p class="qrcode-label">支付宝</p>
            </div>
          </div>
          
          <p class="support-thanks">
            🙏 感谢每一位支持者！你们的鼓励是我最大的动力！
          </p>
        </div>
      </section>

      <!-- 联系方式 -->
      <section class="section">
        <div class="section-icon" aria-hidden="true">📮</div>
        <h2>联系我</h2>
        <div class="content-card">
          <p>有任何问题、建议或者想法，欢迎通过以下方式联系我：</p>
          <div class="contact-list">
            <a href="mailto:1092257069@qq.com" class="contact-item">
              <span class="contact-icon" aria-hidden="true">📧</span>
              <span>邮箱：1092257069@qq.com</span>
            </a>
            <a href="https://github.com/MoRijiu" target="_blank" rel="noopener noreferrer" class="contact-item">
              <span class="contact-icon" aria-hidden="true">🐙</span>
              <span>GitHub：@Mo_Rijiu</span>
            </a>
          </div>
        </div>
      </section>

      <!-- 页脚声明 -->
      <section class="footer-note">
        <p>
          💻 用心开发 | 🚀 持续更新 | 🌟 完全免费
        </p>
        <p class="copyright">
          © 2025 极速开发工具箱 | Made with ❤️ and ☕
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { useSeo } from '../composables/useSeo'

// SEO 优化
useSeo({
  title: '关于我们 - 极速开发工具箱',
  description: '了解极速开发工具箱的开发初衷、技术栈和开源信息。一个为提高开发效率而生的在线工具集合。',
  keywords: '关于,开发工具,开源项目,Vue3,Vite,AI辅助开发'
})
</script>

<style scoped>
.about-page {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  padding: 2rem 1rem;
}

.about-container {
  max-width: 900px;
  margin: 0 auto;
}

/* 头部区域 */
.hero-section {
  text-align: center;
  padding: 3rem 1rem;
  margin-bottom: 2rem;
}

.hero-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.hero-section h1 {
  font-size: 2.5rem;
  color: #ffffff;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

/* 通用区块样式 */
.section {
  background: var(--surface);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-card-hover);
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-icon {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 1rem;
}

.section h2 {
  font-size: 1.8rem;
  color: var(--text-strong);
  text-align: center;
  margin-bottom: 1.5rem;
}

.content-card {
  background: var(--bg);
  border-radius: 12px;
  padding: 1.5rem;
  line-height: 1.8;
}

.content-card p {
  color: var(--text-2);
  margin-bottom: 1rem;
}

.content-card p:last-child {
  margin-bottom: 0;
}

.content-card strong {
  color: var(--accent-text);
  font-weight: 600;
}

/* 功能列表 */
.feature-list {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0;
}

.feature-list li {
  padding: 0.5rem 0;
  color: var(--text-2);
  font-size: 1rem;
}

/* 技术栈网格 */
.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.tech-card {
  background: var(--bg);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.tech-card:hover {
  transform: translateY(-5px);
  border-color: var(--accent);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
}

.tech-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.5rem;
}

.tech-card h3 {
  font-size: 1.1rem;
  color: var(--text-strong);
  margin: 0.5rem 0;
}

.tech-card p {
  font-size: 0.9rem;
  color: var(--text-2);
  margin: 0;
}

/* GitHub链接 */
.github-link {
  margin-top: 1.5rem;
  text-align: center;
}

.github-link a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--text-strong);
  color: var(--surface);
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.github-link a:hover {
  background: var(--accent-solid);
  color: var(--on-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.github-icon {
  font-size: 1.2rem;
}

/* 打赏区域 */
.support-section {
  background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
  border: 3px dashed #f39c12;
}

.support-card {
  background: var(--surface);
  text-align: center;
}

.support-text {
  font-size: 1.1rem;
  color: var(--text-strong);
  margin-bottom: 0.5rem;
}

.support-joke {
  font-size: 0.95rem;
  color: var(--text-2);
  font-style: italic;
  margin-bottom: 2rem;
}

.qrcode-container {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 2rem 0;
  flex-wrap: wrap;
}

.qrcode-item {
  text-align: center;
}

.qrcode-image {
  width: 160px;
  height: 160px;
  padding: 12px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow-card-hover);
  transition: transform 0.3s ease;
  display: block;
}

.qrcode-image:hover {
  transform: scale(1.05);
}

.qrcode-label {
  margin-top: 0.75rem;
  font-weight: 600;
  color: var(--text-strong);
}

.support-thanks {
  font-size: 1rem;
  color: var(--accent-text);
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0;
}

/* 联系方式 */
.contact-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-2);
  transition: all 0.3s ease;
  border: 2px solid var(--border);
}

.contact-item:hover {
  border-color: var(--accent);
  transform: translateX(5px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.contact-icon {
  font-size: 1.5rem;
}

/* 页脚声明 */
.footer-note {
  text-align: center;
  padding: 2rem 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.footer-note p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.copyright {
  font-size: 0.9rem;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .hero-section h1 {
    font-size: 2rem;
  }
  
  .subtitle {
    font-size: 1rem;
  }
  
  .section {
    padding: 1.5rem;
  }
  
  .section h2 {
    font-size: 1.5rem;
  }
  
  .tech-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .qrcode-container {
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  
  .qrcode-image {
    width: 180px;
    height: 180px;
  }
}
</style>