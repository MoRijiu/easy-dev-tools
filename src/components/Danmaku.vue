<template>
  <div class="danmaku-container">
    <button
      type="button"
      class="danmaku-toggle"
      :aria-pressed="paused ? 'true' : 'false'"
      :aria-label="paused ? '继续滚动工具弹幕' : '暂停滚动工具弹幕'"
      @click="paused = !paused"
    >
      <span aria-hidden="true">{{ paused ? '▶' : '⏸' }}</span>
      {{ paused ? '继续滚动' : '暂停滚动' }}
    </button>
    <div class="danmaku-wrapper">
      <div
        v-for="(row, index) in danmakuRows"
        :key="index"
        class="danmaku-row"
        :class="{ 'is-paused': paused }"
        :style="{ animationDuration: row.duration + 's' }"
      >
        <div class="danmaku-content">
          <router-link
            v-for="(item, idx) in row.items"
            :key="idx"
            :to="item.path"
            class="danmaku-item"
          >
            <span class="danmaku-icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="danmaku-text">{{ item.name }}</span>
          </router-link>
        </div>
        <!-- 复制一份用于无缝滚动 -->
        <div class="danmaku-content" aria-hidden="true">
          <router-link
            v-for="(item, idx) in row.items"
            :key="'copy-' + idx"
            :to="item.path"
            class="danmaku-item"
            tabindex="-1"
          >
            <span class="danmaku-icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="danmaku-text">{{ item.name }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAllTools } from '../router/tools-config'

// 获取所有工具
const allTools = getAllTools()

// 弹幕行数
const rowCount = 3
const danmakuRows = ref([])
// 自动滚动必须可暂停（WCAG 2.2.2）：用户手动暂停、悬停/聚焦时自动暂停；
// 系统要求减少动态时默认静止，由用户主动开启滚动。
const paused = ref(
  typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

// 随机打乱数组
const shuffleArray = (array) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// 初始化弹幕行
const initDanmaku = () => {
  const rows = []
  
  for (let i = 0; i < rowCount; i++) {
    // 随机打乱工具顺序
    const shuffledTools = shuffleArray(allTools)
    // 重复3次以保证充足的长度
    const repeatedTools = [...shuffledTools, ...shuffledTools, ...shuffledTools]
    // 每行随机速度 (20-30秒)
    const duration = 20 + Math.random() * 10
    
    rows.push({
      items: repeatedTools,
      duration: duration
    })
  }
  
  danmakuRows.value = rows
}

onMounted(() => {
  initDanmaku()
})
</script>

<style scoped>
.danmaku-container {
  position: relative;
  width: 100%;
  height: 280px;
  overflow: hidden;
  margin: 2rem 0;
  /* 使用 mask 实现两端渐隐效果 */
  -webkit-mask-image: linear-gradient(to right,
    transparent 0%,
    black 10%,
    black 90%,
    transparent 100%
  );
  mask-image: linear-gradient(to right,
    transparent 0%,
    black 10%,
    black 90%,
    transparent 100%
  );
}

.danmaku-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  padding: 2rem 0;
}

.danmaku-toggle {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 32px;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--danmaku-bg);
  color: var(--text-2);
  font-size: 0.8rem;
  box-shadow: var(--shadow-card);
}

.danmaku-toggle:hover {
  color: var(--accent);
}

.danmaku-row {
  display: flex;
  white-space: nowrap;
  animation: scroll-left linear infinite;
  will-change: transform;
}

/* 暂停：手动开关、鼠标悬停、键盘焦点进入区域时都静止，方便点中/读清移动中的链接 */
/* 注意：聚焦暂停只认链接所在的 wrapper——暂停按钮本身在容器内，
   若用容器 :focus-within，点「继续滚动」后按钮保持焦点会让滚动永远恢复不了 */
.danmaku-row.is-paused,
.danmaku-container:hover .danmaku-row,
.danmaku-wrapper:focus-within .danmaku-row {
  animation-play-state: paused;
}

/* 减少动态偏好：弹幕直接静止（全局规则只压缩时长会跳到末帧，这里明确关停） */
@media (prefers-reduced-motion: reduce) {
  .danmaku-row {
    animation: none;
  }
}

.danmaku-content {
  display: inline-flex;
  padding-right: 2rem;
}

.danmaku-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin: 0 0.5rem;
  background: var(--danmaku-bg);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
  font-size: 0.95rem;
  color: var(--text-strong);
  transition: all 0.3s ease;
  cursor: pointer;
  text-decoration: none;
}

.danmaku-item:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  background: var(--surface);
  color: var(--accent);
}

.danmaku-icon {
  font-size: 1.2rem;
  display: inline-flex;
  align-items: center;
}

.danmaku-text {
  font-weight: 500;
}

/* 滚动动画 */
@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}


/* 响应式设计 */
@media (max-width: 768px) {
  .danmaku-container {
    height: 220px;
    margin: 1.5rem 0;
  }
  
  .danmaku-wrapper {
    padding: 1.5rem 0;
  }
  
  .danmaku-item {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
    margin: 0 0.3rem;
  }
  
  .danmaku-icon {
    font-size: 1rem;
  }
  
  .danmaku-mask {
    width: 100px;
  }
}

@media (max-width: 480px) {
  .danmaku-container {
    height: 180px;
  }
  
  .danmaku-wrapper {
    padding: 1rem 0;
  }
  
  .danmaku-item {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
  }
  
  .danmaku-mask {
    width: 60px;
  }
}
</style>