<template>
  <div class="password-generator">
    <h1>🔑 密码生成器</h1>
    <p class="description">生成安全的随机密码，支持自定义长度和字符类型</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="generatePasswords">
          <span class="icon">🎲</span> 生成密码
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon">📋</span> 复制全部
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 设置区域 -->
      <div class="settings-section">
        <div class="settings-grid">
          <div class="setting-item">
            <label>密码长度</label>
            <div class="length-control">
              <input type="range" v-model.number="options.length" min="4" max="64" />
              <input type="number" v-model.number="options.length" min="4" max="64" class="length-input" />
            </div>
          </div>
          <div class="setting-item">
            <label>生成数量</label>
            <input type="number" v-model.number="options.count" min="1" max="50" />
          </div>
        </div>

        <div class="char-options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.uppercase" />
            <span>大写字母 (A-Z)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.lowercase" />
            <span>小写字母 (a-z)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.numbers" />
            <span>数字 (0-9)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.symbols" />
            <span>特殊符号 (!@#$%^&*)</span>
          </label>
        </div>

        <div class="exclude-section">
          <label>排除字符</label>
          <input type="text" v-model="options.excludeChars" placeholder="输入要排除的字符，如: 0O1lI" />
        </div>
      </div>

      <!-- 密码强度指示器 -->
      <div class="strength-indicator">
        <label>密码强度:</label>
        <div class="strength-bar">
          <div class="strength-fill" :class="strengthClass" :style="{ width: strengthPercent + '%' }"></div>
        </div>
        <span class="strength-text" :class="strengthClass">{{ strengthText }}</span>
      </div>

      <!-- 输出区域 -->
      <div class="output-section">
        <div class="output-header">
          <h3>生成的密码</h3>
          <span class="password-count">{{ passwords.length }} 个密码</span>
        </div>
        <div class="password-list" v-if="passwords.length">
          <div class="password-item" v-for="(pwd, index) in passwords" :key="index">
            <code class="password-text">{{ pwd }}</code>
            <button class="copy-btn" @click="copySingle(pwd)" title="复制">📋</button>
          </div>
        </div>
        <div v-else class="placeholder">点击"生成密码"按钮生成随机密码</div>
      </div>

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
import { ref, computed } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";

// 响应式状态
const passwords = ref([]);
const statusMessage = ref("");
const statusType = ref("");

const options = ref({
  length: 16,
  count: 5,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeChars: ""
});

// 字符集
const charSets = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?"
};

// 构建可用字符集
const getAvailableChars = () => {
  let chars = "";
  if (options.value.uppercase) chars += charSets.uppercase;
  if (options.value.lowercase) chars += charSets.lowercase;
  if (options.value.numbers) chars += charSets.numbers;
  if (options.value.symbols) chars += charSets.symbols;
  
  // 排除指定字符
  const excludeSet = new Set(options.value.excludeChars);
  chars = chars.split("").filter(c => !excludeSet.has(c)).join("");
  return chars;
};

// 生成单个密码
const generateSinglePassword = () => {
  const chars = getAvailableChars();
  if (!chars) return "";
  const array = new Uint32Array(options.value.length);
  crypto.getRandomValues(array);
  return Array.from(array, x => chars[x % chars.length]).join("");
};

// 生成多个密码
const generatePasswords = () => {
  const chars = getAvailableChars();
  if (!chars) {
    statusMessage.value = "✗ 请至少选择一种字符类型";
    statusType.value = "error";
    return;
  }
  passwords.value = [];
  for (let i = 0; i < options.value.count; i++) {
    passwords.value.push(generateSinglePassword());
  }
  statusMessage.value = `✓ 已生成 ${options.value.count} 个密码`;
  statusType.value = "success";
};

// 密码强度计算
const strengthPercent = computed(() => {
  let score = 0;
  const len = options.value.length;
  if (len >= 8) score += 20;
  if (len >= 12) score += 20;
  if (len >= 16) score += 10;
  if (options.value.uppercase) score += 15;
  if (options.value.lowercase) score += 15;
  if (options.value.numbers) score += 10;
  if (options.value.symbols) score += 10;
  return Math.min(100, score);
});

const strengthClass = computed(() => {
  const p = strengthPercent.value;
  if (p < 40) return "weak";
  if (p < 70) return "medium";
  return "strong";
});

const strengthText = computed(() => {
  const p = strengthPercent.value;
  if (p < 40) return "弱";
  if (p < 70) return "中等";
  return "强";
});

// 复制功能
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
};

const copyOutput = async () => {
  if (!passwords.value.length) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  if (await copyToClipboard(passwords.value.join("\n"))) {
    statusMessage.value = "✓ 已复制所有密码";
    statusType.value = "success";
  }
};

const copySingle = async (pwd) => {
  if (await copyToClipboard(pwd)) {
    statusMessage.value = "✓ 已复制密码";
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  }
};

// 清空
const clearAll = () => {
  passwords.value = [];
  statusMessage.value = "";
};

// 使用示例
const useExample = (example) => {
  options.value = { ...options.value, ...example.options };
  generatePasswords();
};

// 功能特点
const features = [
  { icon: "🔐", title: "安全随机", description: "使用加密安全的随机数生成器" },
  { icon: "⚙️", title: "自定义选项", description: "可自定义密码长度和字符类型" },
  { icon: "📊", title: "强度评估", description: "实时显示密码强度评级" },
  { icon: "📋", title: "批量生成", description: "一次生成多个密码供选择" },
  { icon: "🚫", title: "排除字符", description: "可排除容易混淆的字符" },
  { icon: "💾", title: "一键复制", description: "快速复制生成的密码" },
];

// 使用说明
const usageSteps = [
  "设置密码长度（建议12位以上）",
  "选择需要包含的字符类型",
  "设置需要生成的密码数量",
  "点击「生成密码」按钮",
  "点击密码旁的复制按钮复制",
];

// 常见问题
const faqs = [
  { question: "密码长度多少才安全？", answer: "建议至少12位以上，16位或更长会更安全。密码越长，被暴力破解的难度越大。" },
  { question: "需要包含哪些字符类型？", answer: "建议同时包含大小写字母、数字和特殊符号，这样可以大大增加密码的复杂度。" },
  { question: "为什么要排除某些字符？", answer: "某些字符容易混淆，如0和O、1和l、I等。排除这些字符可以避免输入错误。" },
  { question: "生成的密码安全吗？", answer: "本工具使用浏览器的crypto.getRandomValues()API，这是加密安全的随机数生成器，生成的密码具有高随机性。" },
];

// 使用示例
const examples = [
  { input: "API密钥", output: "32位字母数字", description: "接口调用", options: { length: 32, uppercase: true, lowercase: true, numbers: true, symbols: false } },
  { input: "管理后台", output: "16位复杂密码", description: "morijiu后台", options: { length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true } },
  { input: "数据库密码", output: "24位强密码", description: "MySQL/Redis", options: { length: 24, uppercase: true, lowercase: true, numbers: true, symbols: true } },
];
</script>

<style scoped>
.password-generator {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 2.5rem;
  color: var(--text-strong);
  margin-bottom: 10px;
  text-align: center;
}

.description {
  text-align: center;
  color: var(--text-2);
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.tool-container {
  background: var(--surface);
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* 设置区域 */
.settings-section {
  background: var(--bg);
  border-radius: 10px;
  padding: 20px;
  margin: 20px 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 8px;
}

.length-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.length-control input[type="range"] {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  cursor: pointer;
}

.length-input {
  width: 70px;
  padding: 8px;
  border: 2px solid var(--border);
  border-radius: 8px;
  text-align: center;
  font-size: 16px;
}

.setting-item input[type="number"] {
  width: 100%;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 16px;
}

.char-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--surface);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.checkbox-label:hover {
  background: var(--accent-soft);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.exclude-section label {
  display: block;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 8px;
}

.exclude-section input {
  width: 100%;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

/* 强度指示器 */
.strength-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  padding: 16px;
  background: var(--bg);
  border-radius: 10px;
}

.strength-indicator label {
  font-weight: 600;
  color: var(--text-strong);
}

.strength-bar {
  flex: 1;
  height: 10px;
  background: var(--border);
  border-radius: 5px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s, background 0.3s;
}

.strength-fill.weak { background: #e74c3c; }
.strength-fill.medium { background: #f39c12; }
.strength-fill.strong { background: #27ae60; }

.strength-text {
  font-weight: 700;
  min-width: 50px;
}

.strength-text.weak { color: #e74c3c; }
.strength-text.medium { color: #f39c12; }
.strength-text.strong { color: #27ae60; }

/* 输出区域 */
.output-section {
  background: var(--bg);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.output-header h3 {
  margin: 0;
  color: var(--text-strong);
}

.password-count {
  color: var(--text-2);
  font-size: 14px;
}

.password-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.password-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border-radius: 8px;
  border: 2px solid var(--border);
}

.password-text {
  flex: 1;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 16px;
  word-break: break-all;
  color: var(--text-strong);
}

.copy-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.copy-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.placeholder {
  text-align: center;
  color: var(--text-3);
  padding: 40px;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .char-options {
    grid-template-columns: 1fr;
  }

  .strength-indicator {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

