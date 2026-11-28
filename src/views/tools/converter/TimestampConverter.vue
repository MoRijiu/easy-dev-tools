<template>
  <div class="timestamp-converter">
    <h1>时间戳转换工具</h1>
    <p class="description">
      在线时间戳转换工具，支持 Unix 时间戳与日期时间互转，秒/毫秒/微秒自动识别，输入即转换
    </p>

    <div class="tool-container">
      <!-- 当前时间显示 -->
      <div class="current-time-section">
        <div class="current-time-card">
          <span class="label">当前时间戳 (秒)</span>
          <span class="value">{{ currentTimestamp }}</span>
          <button class="copy-btn" aria-label="复制当前时间戳（秒）" @click="copyToClipboard(currentTimestamp.toString())">📋</button>
        </div>
        <div class="current-time-card">
          <span class="label">当前时间戳 (毫秒)</span>
          <span class="value">{{ currentTimestampMs }}</span>
          <button class="copy-btn" aria-label="复制当前时间戳（毫秒）" @click="copyToClipboard(currentTimestampMs.toString())">📋</button>
        </div>
        <div class="current-time-card">
          <span class="label">当前时间</span>
          <span class="value">{{ currentDateTime }}</span>
          <button class="copy-btn" aria-label="复制当前时间" @click="copyToClipboard(currentDateTime)">📋</button>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="timestampToDate">
          <span class="icon" aria-hidden="true">📅</span> 时间戳 → 日期
        </button>
        <button class="btn btn-secondary" @click="dateToTimestamp">
          <span class="icon" aria-hidden="true">⏱️</span> 日期 → 时间戳
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon" aria-hidden="true">📋</span> 复制结果
        </button>
        <button class="btn btn-info" @click="useCurrentTimestamp">
          <span class="icon" aria-hidden="true">🔄</span> 使用当前时间
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage id="timestamp-status" :message="statusMessage" :type="statusType" />

      <!-- 编辑器容器 -->
      <ToolEditorLayout>
        <ToolEditorPanel title="输入" :info="inputInfo">
          <div class="input-section">
            <div class="input-group">
              <label for="ts-input">时间戳输入</label>
              <input id="ts-input" aria-label="时间戳输入" :aria-invalid="invalidFor('ts')" :aria-describedby="describedByFor('ts')"
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
                <label>
                  <input type="radio" v-model="timestampUnit" value="us" /> 微秒
                </label>
              </div>
              <p v-if="detectedHint" class="unit-hint" role="status" aria-live="polite">{{ detectedHint }}</p>
            </div>
            <div class="divider">或</div>
            <div class="input-group">
              <label for="ts-date-text">日期时间输入（文本，按本地时区）</label>
              <input id="ts-date-text" aria-label="日期时间输入（文本，按本地时区）" :aria-invalid="invalidFor('dateText')" :aria-describedby="describedByFor('dateText')"
                v-model="dateTextInput"
                type="text"
                class="text-input-field"
                placeholder="如: 2024-12-05 08:30:00，输入后自动转换"
              />
            </div>
            <div class="input-group">
              <label for="ts-date-picker">或用日期选择器</label>
              <input id="ts-date-picker" aria-label="日期选择器" :aria-invalid="invalidFor('datePicker')" :aria-describedby="describedByFor('datePicker')"
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
              <button class="row-copy" aria-label="复制时间戳（秒）" @click="copyToClipboard(String(result.timestampS))">复制</button>
            </div>
            <div class="result-item">
              <span class="result-label">时间戳 (毫秒)</span>
              <span class="result-value">{{ result.timestampMs }}</span>
              <button class="row-copy" aria-label="复制时间戳（毫秒）" @click="copyToClipboard(String(result.timestampMs))">复制</button>
            </div>
            <div class="result-item">
              <span class="result-label">时间戳 (微秒)</span>
              <span class="result-value">{{ result.timestampUs }}</span>
              <button class="row-copy" aria-label="复制时间戳（微秒）" @click="copyToClipboard(String(result.timestampUs))">复制</button>
            </div>
            <div class="result-item">
              <span class="result-label">本地时间</span>
              <span class="result-value">{{ result.localTime }}</span>
              <button class="row-copy" aria-label="复制本地时间" @click="copyToClipboard(result.localTime)">复制</button>
            </div>
            <div class="result-item">
              <span class="result-label">本地时间 (毫秒)</span>
              <span class="result-value">{{ result.localTimeMs }}</span>
              <button class="row-copy" aria-label="复制本地时间（毫秒）" @click="copyToClipboard(result.localTimeMs)">复制</button>
            </div>
            <div class="result-item">
              <span class="result-label">星期 / 今年第几天</span>
              <span class="result-value">{{ result.weekday }} · 第 {{ result.dayOfYear }} 天</span>
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
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { parseTimestampInput, parseDateText, buildResult, formatLocal } from "@/utils/timestamp.js";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import { useStatusMessage } from "@/composables/useStatusMessage.js";
import { useClipboard } from "@/composables/useClipboard.js";
import ToolEditorLayout from "@/components/ToolEditorLayout.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";

// 响应式状态
const timestampInput = ref("");
const dateInput = ref("");
const dateTextInput = ref("");
const timestampUnit = ref("auto");
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const result = ref(null);
// 输入错误单独留存原文与来源字段：状态区还兼报复制结果，仅当前展示的正是该输入错误时才关联对应控件（R9bk）
const inputError = ref("");
const errorField = ref("");
const setInputError = (msg, field) => { inputError.value = msg; errorField.value = field; statusMessage.value = msg; statusType.value = "error"; };
const activeErrorField = computed(() => (inputError.value && statusType.value === "error" && statusMessage.value === inputError.value ? errorField.value : ""));
const fieldHit = (f) => activeErrorField.value === f || (activeErrorField.value === "dateBoth" && (f === "dateText" || f === "datePicker"));
const invalidFor = (f) => (fieldHit(f) ? "true" : undefined);
const describedByFor = (f) => (fieldHit(f) ? "timestamp-status" : undefined);
const detectedHint = ref("");

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
  currentDateTime.value = formatLocal(now);
};

// 信息显示
const inputInfo = computed(() => timestampInput.value ? `${timestampInput.value.length} 字符` : '');
const outputInfo = computed(() => result.value ? '转换成功' : '');

const applyResult = (ms, usRemainder = 0) => {
  result.value = buildResult(ms, Date.now(), usRemainder);
};

// 时间戳转日期（逐字校验 + 秒/毫秒/微秒自动识别）
const timestampToDate = () => {
  if (!timestampInput.value.trim()) {
    setInputError("✗ 请输入时间戳", "ts");
    detectedHint.value = "";
    return;
  }
  const parsed = parseTimestampInput(timestampInput.value, timestampUnit.value);
  if (!parsed.ok) {
    setInputError(`✗ 转换失败: ${parsed.error.message}`, "ts");
    result.value = null;
    detectedHint.value = "";
    return;
  }
  detectedHint.value = parsed.auto
    ? `自动识别：共 ${parsed.digits} 位，按${parsed.unitLabel}级时间戳处理`
    : `按${parsed.unitLabel}级时间戳处理`;
  applyResult(parsed.ms, parsed.usRemainder);
  statusMessage.value = "✓ 转换成功！";
  statusType.value = "success";
};

// 日期转时间戳（文本严格校验，不静默滚动日期）
const dateToTimestamp = () => {
  if (dateTextInput.value.trim()) {
    const parsed = parseDateText(dateTextInput.value);
    if (!parsed.ok) {
      setInputError(`✗ 转换失败: ${parsed.error.message}`, "dateText");
      result.value = null;
      return;
    }
    applyResult(parsed.ms);
    statusMessage.value = "✓ 转换成功！";
    statusType.value = "success";
    return;
  }
  if (!dateInput.value) {
    setInputError("✗ 请输入日期时间文本或用选择器选择", "dateBoth");
    return;
  }
  const parsed = parseDateText(dateInput.value);
  if (!parsed.ok) {
    setInputError(`✗ 转换失败: ${parsed.error.message}`, "datePicker");
    result.value = null;
    return;
  }
  applyResult(parsed.ms);
  statusMessage.value = "✓ 转换成功！";
  statusType.value = "success";
};

// 输入即转换（防抖 250ms，避免逐字打字时频繁报错闪烁：有内容且校验通过才更新结果）
let liveTimer = null;
watch([timestampInput, timestampUnit], () => {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    if (!timestampInput.value.trim()) return;
    const parsed = parseTimestampInput(timestampInput.value, timestampUnit.value);
    if (parsed.ok) {
      detectedHint.value = parsed.auto
        ? `自动识别：共 ${parsed.digits} 位，按${parsed.unitLabel}级时间戳处理`
        : `按${parsed.unitLabel}级时间戳处理`;
      applyResult(parsed.ms, parsed.usRemainder);
      if (statusType.value === "error") { statusMessage.value = ""; statusType.value = ""; inputError.value = ""; errorField.value = ""; }
    }
  }, 250);
});
watch(dateTextInput, () => {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    if (!dateTextInput.value.trim()) return;
    const parsed = parseDateText(dateTextInput.value);
    if (parsed.ok) applyResult(parsed.ms);
  }, 250);
});
watch(dateInput, () => { if (dateInput.value) dateToTimestamp(); });

// 清空
const clearAll = () => {
  timestampInput.value = "";
  dateInput.value = "";
  dateTextInput.value = "";
  detectedHint.value = "";
  result.value = null;
  inputError.value = ""; errorField.value = "";
  statusMessage.value = "";
};

// 复制到剪贴板
const copyToClipboard = async (text) => clipboard.copyText(text, "✓ 已复制到剪贴板！", { failMsg: "✗ 复制失败", autoClearMs: 2000 });

// 复制输出结果
const copyOutput = async () => {
  if (!result.value) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  const text = `时间戳(秒): ${result.value.timestampS}\n时间戳(毫秒): ${result.value.timestampMs}\n时间戳(微秒): ${result.value.timestampUs}\n本地时间: ${result.value.localTime}\nUTC时间: ${result.value.utcTime}\nISO 8601: ${result.value.isoTime}\n相对时间: ${result.value.relativeTime}`;
  await copyToClipboard(text);
};

// 使用当前时间
const useCurrentTimestamp = () => {
  timestampInput.value = currentTimestamp.value.toString();
  timestampUnit.value = "s";
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
    question: "微秒级时间戳也能转吗？",
    answer: "能。16 位数字会自动识别为微秒（Java、Go 等后端常见）；17 位以上的纳秒级请先除以 1000 转成微秒再粘贴，本工具会明确提示而不是截断。",
  },
  {
    question: "输入 2023-02-29 为什么报错？",
    answer: "2023 年不是闰年，2 月只有 28 天。旧工具会把非法日期静默滚到 3 月 1 日，本工具改为严格校验并指出具体哪个字段不合法。",
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
  { input: "1733356800000123", output: "2024-12-05 00:00:00", description: "微秒级时间戳（16 位自动识别）" },
  { input: "-1", output: "1969-12-31 23:59:59 (UTC)", description: "负时间戳（1970 年之前）" },
];
</script>

<style scoped>

/* 当前时间卡片区域 */
.current-time-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.current-time-card {
  background: linear-gradient(135deg, var(--accent-grad-from) 0%, var(--accent-grad-to) 100%);
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
  background: var(--bg);
  min-height: 400px;
}

.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 8px;
}

.text-input-field {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: border-color 0.3s;
}

.text-input-field:focus {
  border-color: var(--accent);
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
  color: var(--text-3);
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
  background: var(--border);
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
  background: var(--bg);
  min-height: 400px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--surface);
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-sm);
}

.result-label {
  color: var(--text-2);
  font-size: 14px;
}

.result-value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 15px;
  color: var(--text-strong);
  font-weight: 600;
}

.placeholder {
  padding: 20px;
  color: var(--text-3);
  text-align: center;
  font-style: italic;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.unit-hint { margin-top: 8px; font-size: 12px; color: var(--text-2); }
.row-copy { margin-left: 10px; padding: 3px 10px; font-size: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); cursor: pointer; white-space: nowrap; }
.row-copy:hover { color: var(--accent-text); border-color: var(--accent); }

/* 响应式设计 */
@media (max-width: 640px) {
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

