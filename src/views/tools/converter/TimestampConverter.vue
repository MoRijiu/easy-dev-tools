<template>
  <div class="timestamp-converter">
    <h1>时间戳转换工具</h1>
    <p class="description">
      在线时间戳转换工具，支持 Unix 时间戳与日期时间互转，毫秒/秒级时间戳
    </p>

    <div class="tool-container">
      <!-- 当前时间显示 -->
      <div class="current-time-section">
        <div class="current-time-card">
          <span class="label">当前时间戳 (秒)</span>
          <span class="value">{{ currentTimestamp }}</span>
          <button class="copy-btn" @click="copyToClipboard(currentTimestamp.toString())">📋</button>
        </div>
        <div class="current-time-card">
          <span class="label">当前时间戳 (毫秒)</span>
          <span class="value">{{ currentTimestampMs }}</span>
          <button class="copy-btn" @click="copyToClipboard(currentTimestampMs.toString())">📋</button>
        </div>
        <div class="current-time-card">
          <span class="label">当前时间</span>
          <span class="value">{{ currentDateTime }}</span>
          <button class="copy-btn" @click="copyToClipboard(currentDateTime)">📋</button>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="timestampToDate">
          <span class="icon">📅</span> 时间戳 → 日期
        </button>
        <button class="btn btn-secondary" @click="dateToTimestamp">
          <span class="icon">⏱️</span> 日期 → 时间戳
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon">📋</span> 复制结果
        </button>
        <button class="btn btn-info" @click="useCurrentTimestamp">
          <span class="icon">🔄</span> 使用当前时间
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 编辑器容器 -->
      <ToolEditorLayout>
        <ToolEditorPanel title="输入" :info="inputInfo">
          <div class="input-section">
            <div class="input-group">
              <label>时间戳输入</label>
              <input
                v-model="timestampInput"
                type="text"
                class="text-input-field"
                placeholder="输入时间戳，如: 1733356800 或 1733356800000"
              />
              <div class="unit-select">
                <label>
                  <input type="radio" v-model="timestampUnit" value="s" /> 秒
                </label>
                <label>
                  <input type="radio" v-model="timestampUnit" value="ms" /> 毫秒
                </label>
                <label>
                  <input type="radio" v-model="timestampUnit" value="auto" /> 自动识别
                </label>
              </div>
            </div>
            <div class="divider">或</div>
            <div class="input-group">
              <label>日期时间输入</label>
              <input
                v-model="dateInput"
                type="datetime-local"
                class="text-input-field"
                step="1"
              />
            </div>
          </div>
        </ToolEditorPanel>

        <ToolEditorPanel title="转换结果" :info="outputInfo">
          <div class="result-section" v-if="result">
            <div class="result-item">
              <span class="result-label">时间戳 (秒)</span>
              <span class="result-value">{{ result.timestampS }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">时间戳 (毫秒)</span>
              <span class="result-value">{{ result.timestampMs }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">本地时间</span>
              <span class="result-value">{{ result.localTime }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">UTC 时间</span>
              <span class="result-value">{{ result.utcTime }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">ISO 8601</span>
              <span class="result-value">{{ result.isoTime }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">相对时间</span>
              <span class="result-value">{{ result.relativeTime }}</span>
            </div>
          </div>
          <div v-else class="placeholder">转换结果将显示在这里</div>
        </ToolEditorPanel>
      </ToolEditorLayout>

      <!-- 使用示例 -->
      <ToolExamples :examples="examples" @use-example="useExample" />

      <!-- 功能特点 -->
      <ToolFeatures :features="features" />

      <!-- 使用说明 -->
      <ToolUsageGuide :steps="usageSteps" />

      <!-- 常见问题 -->
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import ToolEditorLayout from "@/components/ToolEditorLayout.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";

// 响应式状态
const timestampInput = ref("");
const dateInput = ref("");
const timestampUnit = ref("auto");
const statusMessage = ref("");
const statusType = ref("");
const result = ref(null);

// 当前时间
const currentTimestamp = ref(0);
const currentTimestampMs = ref(0);
const currentDateTime = ref("");
let timer = null;

// 更新当前时间
const updateCurrentTime = () => {
  const now = new Date();
  currentTimestampMs.value = now.getTime();
  currentTimestamp.value = Math.floor(now.getTime() / 1000);
  currentDateTime.value = formatDateTime(now);
};

// 格式化日期时间
const formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 计算相对时间
const getRelativeTime = (date) => {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let timeStr;
  if (years > 0) timeStr = `${years} 年`;
  else if (months > 0) timeStr = `${months} 个月`;
  else if (days > 0) timeStr = `${days} 天`;
  else if (hours > 0) timeStr = `${hours} 小时`;
  else if (minutes > 0) timeStr = `${minutes} 分钟`;
  else timeStr = `${seconds} 秒`;

  return isPast ? `${timeStr}前` : `${timeStr}后`;
};

// 信息显示
const inputInfo = computed(() => timestampInput.value ? `${timestampInput.value.length} 字符` : '');
const outputInfo = computed(() => result.value ? '转换成功' : '');

// 时间戳转日期
const timestampToDate = () => {
  if (!timestampInput.value.trim()) {
    statusMessage.value = "✗ 请输入时间戳";
    statusType.value = "error";
    return;
  }

  try {
    let ts = parseInt(timestampInput.value.trim());
    if (isNaN(ts)) {
      throw new Error("无效的时间戳");
    }

    // 自动识别单位
    if (timestampUnit.value === "auto") {
      if (ts > 9999999999999) {
        throw new Error("时间戳过大");
      } else if (ts > 9999999999) {
        ts = ts; // 毫秒
      } else {
        ts = ts * 1000; // 秒转毫秒
      }
    } else if (timestampUnit.value === "s") {
      ts = ts * 1000;
    }

    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      throw new Error("无效的时间戳");
    }

    result.value = {
      timestampS: Math.floor(ts / 1000),
      timestampMs: ts,
      localTime: formatDateTime(date),
      utcTime: date.toUTCString(),
      isoTime: date.toISOString(),
      relativeTime: getRelativeTime(date)
    };

    statusMessage.value = "✓ 转换成功！";
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 转换失败: ${error.message}`;
    statusType.value = "error";
    result.value = null;
  }
};

// 日期转时间戳
const dateToTimestamp = () => {
  if (!dateInput.value) {
    statusMessage.value = "✗ 请选择日期时间";
    statusType.value = "error";
    return;
  }

  try {
    const date = new Date(dateInput.value);
    if (isNaN(date.getTime())) {
      throw new Error("无效的日期时间");
    }

    const ts = date.getTime();
    result.value = {
      timestampS: Math.floor(ts / 1000),
      timestampMs: ts,
      localTime: formatDateTime(date),
      utcTime: date.toUTCString(),
      isoTime: date.toISOString(),
      relativeTime: getRelativeTime(date)
    };

    statusMessage.value = "✓ 转换成功！";
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 转换失败: ${error.message}`;
    statusType.value = "error";
    result.value = null;
  }
};

// 清空
const clearAll = () => {
  timestampInput.value = "";
  dateInput.value = "";
  result.value = null;
  statusMessage.value = "";
};

// 复制到剪贴板
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    statusMessage.value = "✓ 已复制到剪贴板！";
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  } catch (error) {
    statusMessage.value = "✗ 复制失败";
    statusType.value = "error";
  }
};

// 复制输出结果
const copyOutput = async () => {
  if (!result.value) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  const text = `时间戳(秒): ${result.value.timestampS}\n时间戳(毫秒): ${result.value.timestampMs}\n本地时间: ${result.value.localTime}\nUTC时间: ${result.value.utcTime}\nISO 8601: ${result.value.isoTime}`;
  await copyToClipboard(text);
};

// 使用当前时间
const useCurrentTimestamp = () => {
  timestampInput.value = currentTimestamp.value.toString();
  timestampToDate();
};

// 使用示例
const useExample = (example) => {
  timestampInput.value = example.input;
  timestampUnit.value = "auto";
  timestampToDate();
};

// 生命周期
onMounted(() => {
  updateCurrentTime();
  timer = setInterval(updateCurrentTime, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

// 功能特点
const features = [
  { icon: "⏱️", title: "秒级时间戳", description: "支持10位秒级 Unix 时间戳转换" },
  { icon: "⏰", title: "毫秒时间戳", description: "支持13位毫秒级时间戳转换" },
  { icon: "🔄", title: "双向转换", description: "时间戳与日期时间可互相转换" },
  { icon: "🌍", title: "多格式输出", description: "本地时间、UTC、ISO 8601 等格式" },
  { icon: "📅", title: "相对时间", description: "显示距今多长时间" },
  { icon: "⚡", title: "实时显示", description: "实时显示当前时间戳" },
];

// 使用说明
const usageSteps = [
  "在时间戳输入框中输入 Unix 时间戳（10位秒级或13位毫秒级）",
  "选择时间戳单位或使用自动识别功能",
  "点击「时间戳 → 日期」按钮查看转换结果",
  "或在日期时间选择器中选择日期时间，点击「日期 → 时间戳」转换",
  "点击「复制结果」按钮可复制完整的转换结果",
];

// 常见问题
const faqs = [
  {
    question: "什么是 Unix 时间戳？",
    answer: "Unix 时间戳是指从 1970年1月1日 00:00:00 UTC 起至现在的总秒数。它是一种时间表示方式，广泛用于计算机系统和编程中。",
  },
  {
    question: "秒级和毫秒级时间戳有什么区别？",
    answer: "秒级时间戳是10位数字，表示从 1970年1月1日 起的秒数；毫秒级时间戳是13位数字，表示毫秒数。JavaScript 中 Date.now() 返回的是毫秒级时间戳。",
  },
  {
    question: "为什么转换结果和我预期的不一样？",
    answer: "请注意时区的影响。本工具显示的本地时间是基于您浏览器的时区设置的。如果您需要特定时区的时间，请参考 UTC 时间进行换算。",
  },
  {
    question: "时间戳有什么限制？",
    answer: "32位系统的 Unix 时间戳最大值是 2147483647（2038年1月19日），这就是著名的「2038年问题」。64位系统和 JavaScript 可以处理更大范围的时间戳。",
  },
];

// 使用示例
const examples = [
  { input: "1733356800", output: "2024-12-05 00:00:00", description: "极速工具箱上线日期" },
  { input: "1733356800000", output: "2024-12-05 00:00:00", description: "毫秒级时间戳转换" },
  { input: "1704038400", output: "2024-01-01 00:00:00", description: "2024年元旦" },
];
</script>

<style scoped>
.timestamp-converter {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 10px;
  text-align: center;
}

.description {
  text-align: center;
  color: #666;
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.tool-container {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* 当前时间卡片区域 */
.current-time-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.current-time-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.current-time-card .label {
  font-size: 14px;
  opacity: 0.9;
  min-width: 120px;
}

.current-time-card .value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.copy-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 输入区域 */
.input-section {
  padding: 20px;
  background: #f8f9fa;
  min-height: 400px;
}

.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
}

.text-input-field {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: border-color 0.3s;
}

.text-input-field:focus {
  outline: none;
  border-color: #667eea;
}

.unit-select {
  display: flex;
  gap: 20px;
  margin-top: 12px;
}

.unit-select label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: normal;
}

.divider {
  text-align: center;
  color: #999;
  margin: 24px 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #e0e0e0;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

/* 结果区域 */
.result-section {
  padding: 20px;
  background: #f8f9fa;
  min-height: 400px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.result-label {
  color: #666;
  font-size: 14px;
}

.result-value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 15px;
  color: #2c3e50;
  font-weight: 600;
}

.placeholder {
  padding: 20px;
  color: #999;
  text-align: center;
  font-style: italic;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .current-time-card {
    flex-wrap: wrap;
  }

  .current-time-card .label {
    width: 100%;
    margin-bottom: 4px;
  }

  .result-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>

