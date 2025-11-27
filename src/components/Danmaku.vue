<template>
  <div class="danmaku-container">
    <div class="danmaku-wrapper">
      <div
        v-for="(row, index) in danmakuRows"
        :key="index"
        class="danmaku-row"
        :style="{ animationDuration: row.duration + 's' }"
      >
        <div class="danmaku-content">
          <router-link
            v-for="(item, idx) in row.items"
            :key="idx"
            :to="item.path"
            class="danmaku-item"
          >
            <span class="danmaku-icon">{{ item.icon }}</span>
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
            <span class="danmaku-icon">{{ item.icon }}</span>
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

.danmaku-row {
  display: flex;
  white-space: nowrap;
  animation: scroll-left linear infinite;
  will-change: transform;
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
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 0.95rem;
  color: #2c3e50;
  transition: all 0.3s ease;
  cursor: pointer;
  text-decoration: none;
}

.danmaku-item:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  background: rgba(255, 255, 255, 1);
  color: #667eea;
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