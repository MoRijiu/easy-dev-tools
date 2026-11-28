<template>
  <div class="danmaku-container">
    <!-- 弹幕是同页工具卡的重复推广位：三行共 432 个（R10d 降量后）
         与下方工具卡完全重复的链接，若进 Tab 顺序/无障碍树，键盘用户要穿过数百个
         重复链接、读屏链接列表也被淹没。故整区 aria-hidden + 链接 tabindex="-1"
         退出键盘与读屏通道（与无缝滚动复制份同一口径），鼠标点击与滚动不受影响，
         导航由同页工具卡、Header 下拉与命令面板承担（R9ai）。 -->
    <div class="danmaku-wrapper" aria-hidden="true">
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
            tabindex="-1"
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
// 暂停通道（R11c 起）：手动暂停/继续按钮已按产品决定移除（用处不大）；
// 保留桌面鼠标悬停自动暂停（方便点中移动中的链接）与
// prefers-reduced-motion 时直接静止两条通道，见下方样式。

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
    // 随机打乱工具顺序（R10d：每份内容只放 1 遍全部工具。
    // 旧版每份重复 3 遍、三行 × 两份无缝复制共渲染 72×3×2×3=1296 个链接，
    // 而单份 72 个工具的宽度已远超容器，无缝滚动只需两份相同内容即可，
    // 重复 3 遍纯属多余 DOM 与布局/绘制开销。改后链接数降至 72×1×2×3=432（−66%）。
    // 行宽同比例缩短为 1/3，动画时长同步除以 3，滚动线速度（px/s）与旧版一致。）
    const shuffledTools = shuffleArray(allTools)
    // 每行随机速度：时长 20-30 秒对应旧版三倍行宽，故除以 3 保持线速度
    const duration = (20 + Math.random() * 10) / 3

    rows.push({
      items: shuffledTools,
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

/* 暂停：鼠标悬停时静止，方便点中移动中的链接（R11c 起无手动开关）。
   弹幕链接已退出 Tab 顺序（R9ai），不再有焦点进入区域的暂停通道。
   悬停暂停只对真有悬停能力的设备（鼠标）生效：触屏点按会让 :hover
   粘滞在容器上，静止状态会一直保持到手指离开后的下一次交互。 */
@media (hover: hover) and (pointer: fine) {
  .danmaku-container:hover .danmaku-row {
    animation-play-state: paused;
  }
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
  /* R10d：原 transition: all 会让任意属性变化都触发过渡计算，收窄到 hover 实际变化的属性 */
  transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease, color 0.3s ease;
  cursor: pointer;
  text-decoration: none;
}

.danmaku-item:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  background: var(--surface);
  color: var(--accent-text);
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