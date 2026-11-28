<template>
  <div class="password-generator">
    <h1>🔑 密码生成器</h1>
    <p class="description">生成安全的随机密码，支持自定义长度和字符类型</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="generatePasswords">
          <span class="icon" aria-hidden="true">🎲</span> 生成密码
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon" aria-hidden="true">📋</span> 复制全部
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
        <button class="btn btn-secondary" :disabled="!passwords.length" @click="downloadPasswords">⬇️ 下载 .txt</button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage id="password-generator-status" :message="statusMessage" :type="statusType" />

      <!-- 设置区域 -->
      <div class="settings-section">
        <div class="settings-grid">
          <div class="setting-item">
            <label for="pwd-length-range">密码长度</label>
            <div class="length-control">
              <input id="pwd-length-range" aria-label="密码长度（滑杆）" type="range" v-model.number="options.length" min="4" max="128" />
              <input type="text" inputmode="numeric" v-model="options.length" class="length-input" aria-label="密码长度（4-128）" :aria-invalid="invalidFor('length')" :aria-describedby="describedByFor('length')" />
            </div>
          </div>
          <div class="setting-item">
            <label for="pwd-count">生成数量（1-50）</label>
            <input id="pwd-count" aria-label="生成数量" type="text" inputmode="numeric" v-model="options.count" :aria-invalid="invalidFor('count')" :aria-describedby="describedByFor('count')" />
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

        <div class="char-options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.requireEach" />
            <span>每种类型至少出现一个</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.excludeAmbiguous" />
            <span>排除易混字符 (0 O 1 l I |)</span>
          </label>
        </div>

        <div class="exclude-section">
          <label for="pwd-exclude">排除字符</label>
          <input id="pwd-exclude" aria-label="排除字符" type="text" v-model="options.excludeChars" placeholder="输入要排除的字符，如: 0O1lI" :aria-invalid="invalidFor('exclude')" :aria-describedby="describedByFor('exclude')" />
        </div>
      </div>

      <!-- 密码强度指示器（按真实熵：长度 × log2 字符池） -->
      <div class="strength-indicator">
        <label>理论强度:</label>
        <div class="strength-bar">
          <div class="strength-fill" :class="strengthClass" :style="{ width: strengthPercent + '%' }"></div>
        </div>
        <span class="strength-text" :class="strengthClass">{{ strengthText }}</span>
      </div>

      <!-- 输出区域 -->
      <div class="output-section">
        <div class="output-header">
          <h2>生成的密码</h2>
          <span class="password-count">{{ passwords.length }} 个密码</span>
        </div>
        <div class="password-list" v-if="passwords.length">
          <div class="password-item" v-for="(pwd, index) in passwords" :key="index">
            <code class="password-text">{{ pwd }}</code>
            <button class="copy-btn" @click="copySingle(pwd)" title="复制" :aria-label="`复制第 ${index + 1} 个密码`">📋</button>
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
import { generatePasswords as generateCore, buildPool, validateLength, entropyOf, strengthForEntropy } from "@/utils/passwordGenerate.js";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import { useStatusMessage } from "@/composables/useStatusMessage.js";
import { useDownload } from "@/composables/useDownload.js";
import { useClipboard } from "@/composables/useClipboard.js";

// 响应式状态
const passwords = ref([]);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const { copyToClipboard } = useClipboard();
const download = useDownload();

const options = ref({
  length: 16,
  count: 5,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeChars: "",
  excludeAmbiguous: false,
  requireEach: true
});

// 生成错误单独留存：状态区还兼报复制/下载结果，只有当前展示的正是这条生成错误时才做字段关联
const genError = ref("");
// 错误文案自带字段名（密码长度/生成数量/排除字符），据此定位出错字段；「至少选一种字符类型」属整组勾选、环境与自检类错误不归任何字段
const genErrorField = computed(() => {
  if (!genError.value || statusType.value !== "error" || statusMessage.value !== `✗ ${genError.value}`) return "";
  const e = genError.value;
  if (e.startsWith("密码长度")) return "length";
  if (e.startsWith("生成数量")) return "count";
  if (e.includes("排除字符")) return "exclude";
  return "";
});
const invalidFor = (field) => (genErrorField.value === field ? "true" : undefined);
const describedByFor = (field) => (genErrorField.value === field ? "password-generator-status" : undefined);

// 生成密码（核心在 utils/passwordGenerate：无偏拒绝采样 + 保类 + 严格校验；出错保留旧列表）
const generatePasswords = () => {
  try {
    const result = generateCore({ ...options.value });
    passwords.value = result.passwords;
    genError.value = "";
    status.showSuccess(`✓ 已生成 ${result.count} 个密码 · 字符池 ${result.poolSize} · 理论熵约 ${result.entropyBits} 位`);
  } catch (e) {
    genError.value = e.message;
    status.showError(`✗ ${e.message}`);
  }
};

const downloadPasswords = () => {
  if (!passwords.value.length) return;
  download.downloadText(passwords.value.join("\n") + "\n", "passwords.txt");
  status.showSuccess("✓ 已下载 passwords.txt");
};

// 理论强度：熵 = 长度 × log2(字符池)，配置非法时直接展示原因
const strengthInfo = computed(() => {
  try {
    const length = validateLength(options.value.length);
    const { poolSize } = buildPool(options.value);
    const entropy = entropyOf(length, poolSize);
    const s = strengthForEntropy(entropy);
    return { percent: s.percent, label: `${s.label} · 约 ${entropy} 位熵 · 池 ${poolSize}`, invalid: false };
  } catch (e) {
    return { percent: 0, label: e.message, invalid: true };
  }
});

const strengthPercent = computed(() => strengthInfo.value.percent);

const strengthClass = computed(() => {
  if (strengthInfo.value.invalid) return "weak";
  const label = strengthInfo.value.label;
  if (label.startsWith("弱")) return "weak";
  if (label.startsWith("中等")) return "medium";
  return "strong";
});

const strengthText = computed(() => strengthInfo.value.label);

// 复制功能（copyToClipboard 由 useClipboard 提供）
const copyOutput = async () => {
  if (!passwords.value.length) {
    status.showError("✗ 没有可复制的内容");
    return;
  }
  if (await copyToClipboard(passwords.value.join("\n"))) {
    status.showSuccess("✓ 已复制所有密码");
  }
};

const copySingle = async (pwd) => {
  if (await copyToClipboard(pwd)) {
    status.showSuccess("✓ 已复制密码", 2000);
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
  { icon: "🚫", title: "排除字符", description: "自定义排除 + 一键排除 0/O/1/l/I/| 易混字符" },
  { icon: "✅", title: "每类必现", description: "勾选的每种字符类型至少出现一个并自检" },
  { icon: "🎯", title: "无偏采样", description: "拒绝采样取字，每个字符概率严格相等" },
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
  { question: "勾选了符号却可能一个符号都没有吗？", answer: "不会。默认开启「每种类型至少出现一个」：先从每类各抽一个字符再洗牌打散位置，生成后还会自检每类是否都出现。关掉该选项则完全随机，可能某类不出现。" },
  { question: "强度条是怎么算的？", answer: "按理论熵计算：熵 ≈ 长度 × log2(字符池大小)。例如长度 16、字符池 88 时约 103 位熵。旧版按选项逐项加分的算法会高估短密码，已弃用。" },
  { question: "随机取字为什么不用取模？", answer: "直接用随机数对字符池长度取模会让排在前面的字符概率略高（取模偏差）。本工具用拒绝采样：超出均匀区间的随机值直接丢弃重抽，每个字符概率严格相等。" },
  { question: "长度和数量填错会怎样？", answer: "长度须为 4-128 的整数、数量须为 1-50 的整数；填小数、空值或越界会明确报错并保留上次生成的列表，不会静默截断或生成错误数量。排除字符把某一类排光时也会点名报错。" },
];

// 使用示例
const examples = [
  { input: "API密钥", output: "32位字母数字", description: "接口调用", options: { length: 32, uppercase: true, lowercase: true, numbers: true, symbols: false } },
  { input: "管理后台", output: "16位复杂密码", description: "morijiu后台", options: { length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true } },
  { input: "数据库密码", output: "24位强密码", description: "MySQL/Redis", options: { length: 24, uppercase: true, lowercase: true, numbers: true, symbols: true } },
];
</script>

<style scoped>

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
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
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
  white-space: nowrap;
  font-size: 14px;
}

@media (max-width: 640px) {
  .strength-text { white-space: normal; }
}

.strength-text.weak { color: var(--danger-text); }
.strength-text.medium { color: var(--warning-text); }
.strength-text.strong { color: var(--success-text); }

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

.output-header h2 {
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
  background: var(--accent-solid);
  color: #fff;
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

