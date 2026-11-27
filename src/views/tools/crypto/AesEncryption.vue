<template>
  <div class="aes-encryption">
    <h1>AES 加解密工具</h1>
    <p class="description">
      在线 AES 对称加密解密工具，支持 AES-128、AES-192、AES-256 等多种模式
    </p>

    <div class="tool-container">
      <!-- 模式选择 -->
      <div class="mode-section">
        <div class="mode-tabs">
          <button 
            :class="['mode-tab', { active: mode === 'encrypt' }]"
            @click="mode = 'encrypt'"
          >
            <span class="icon">🔒</span> 加密
          </button>
          <button 
            :class="['mode-tab', { active: mode === 'decrypt' }]"
            @click="mode = 'decrypt'"
          >
            <span class="icon">🔓</span> 解密
          </button>
        </div>
      </div>

      <!-- 配置选项 -->
      <div class="config-section">
        <div class="config-grid">
          <div class="config-item">
            <label>密钥长度</label>
            <select v-model="keyLength">
              <option value="128">AES-128 (16字节)</option>
              <option value="192">AES-192 (24字节)</option>
              <option value="256">AES-256 (32字节)</option>
            </select>
          </div>
          <div class="config-item">
            <label>加密模式</label>
            <select v-model="cipherMode">
              <option value="CBC">CBC</option>
              <option value="GCM">GCM (推荐)</option>
            </select>
          </div>
          <div class="config-item">
            <label>输出编码</label>
            <select v-model="outputEncoding">
              <option value="base64">Base64</option>
              <option value="hex">Hex (十六进制)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 密钥输入 -->
      <div class="key-section">
        <div class="key-header">
          <label class="section-label">密钥 (Key)</label>
          <div class="key-actions">
            <button class="link-btn" @click="generateRandomKey">
              <span class="icon">🎲</span> 生成随机密钥
            </button>
          </div>
        </div>
        <input
          v-model="secretKey"
          :type="showKey ? 'text' : 'password'"
          class="key-input"
          :placeholder="`请输入正好 ${getKeyLength()} 字节的密钥（UTF-8）`"
        />
        <div class="key-tools">
          <button class="link-btn" @click="showKey = !showKey">{{ showKey ? '隐藏密钥' : '显示密钥' }}</button>
          <span :class="['key-state', keyStateClass]">{{ keyHint }}</span>
        </div>
        <div class="iv-row" v-if="cipherMode === 'CBC'">
          <label>初始向量 (IV):</label>
          <input 
            v-model="iv"
            type="text"
            class="iv-input"
            placeholder="请输入16字节的IV (可选，留空自动生成)"
          />
          <button class="link-btn" @click="generateRandomIV">生成IV</button>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="processData">
          <span class="icon">{{ mode === 'encrypt' ? '🔒' : '🔓' }}</span>
          {{ mode === 'encrypt' ? '加密' : '解密' }}
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon">📋</span> 复制结果
        </button>
        <button class="btn btn-info" @click="swapContent">
          <span class="icon">🔄</span> 交换
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 编辑器布局 -->
      <ToolEditorLayout>
        <ToolEditorPanel :title="mode === 'encrypt' ? '明文输入' : '密文输入'" :info="inputInfo">
          <textarea
            v-model="inputText"
            class="text-input"
            :placeholder="mode === 'encrypt' ? '请输入需要加密的明文内容...' : '请输入需要解密的密文 (Base64/Hex)...'"
          ></textarea>
        </ToolEditorPanel>

        <ToolEditorPanel :title="mode === 'encrypt' ? '加密结果' : '解密结果'" :info="outputInfo">
          <div class="text-output-wrapper">
            <pre v-if="outputText" class="text-output">{{ outputText }}</pre>
            <div v-else class="placeholder">{{ mode === 'encrypt' ? '加密后的密文将显示在这里' : '解密后的明文将显示在这里' }}</div>
          </div>
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
import { ref, computed } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import ToolEditorLayout from "@/components/ToolEditorLayout.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";
import {
  parseKeyBytes,
  randomText,
  encodeCipherBytes,
  decodeCipherText,
  encryptAes,
  decryptAes,
  utf8ByteLength,
  codePointLength,
} from "@/utils/aesCrypto.js";

// 响应式状态
const mode = ref("encrypt");
const inputText = ref("");
const outputText = ref("");
const secretKey = ref("");
const iv = ref("");
const keyLength = ref("256");
const cipherMode = ref("GCM");
const outputEncoding = ref("base64");
const statusMessage = ref("");
const statusType = ref("");
const showKey = ref(false);

// 获取密钥字节长度
const getKeyLength = () => parseInt(keyLength.value) / 8;

// 密钥提示（严格口径：UTF-8 字节数必须正好等于所选长度，不再补零/截断）
const keyBytesNow = computed(() => utf8ByteLength(secretKey.value));
const keyHint = computed(() => {
  const len = getKeyLength();
  if (keyBytesNow.value === 0) return `需要正好 ${len} 字节`;
  if (keyBytesNow.value < len) return `当前 ${keyBytesNow.value} 字节，还差 ${len - keyBytesNow.value} 字节`;
  if (keyBytesNow.value > len) return `当前 ${keyBytesNow.value} 字节，超出 ${keyBytesNow.value - len} 字节`;
  return "✓ 长度正确";
});
const keyStateClass = computed(() => {
  if (keyBytesNow.value === 0) return "";
  return keyBytesNow.value === getKeyLength() ? "ok" : "bad";
});

const inputInfo = computed(
  () => `${codePointLength(inputText.value)} 字符 · ${utf8ByteLength(inputText.value)} 字节`
);
const outputInfo = computed(
  () => `${codePointLength(outputText.value)} 字符 · ${utf8ByteLength(outputText.value)} 字节`
);

// 生成随机密钥（无偏拒绝采样）
const generateRandomKey = () => {
  const len = getKeyLength();
  secretKey.value = randomText(len);
  statusMessage.value = `✓ 已生成 ${len} 字节随机密钥`;
  statusType.value = "success";
};

// 生成随机IV
const generateRandomIV = () => {
  iv.value = randomText(16);
  statusMessage.value = "✓ 已生成 16 字节随机 IV";
  statusType.value = "success";
};

// 处理加密/解密
const processData = async () => {
  if (!inputText.value) {
    statusMessage.value = `✗ 请输入需要${mode.value === 'encrypt' ? '加密' : '解密'}的内容`;
    statusType.value = "error";
    return;
  }
  try {
    // 先严格校验密钥，错误直接点名（字节数/所需长度）
    parseKeyBytes(secretKey.value, parseInt(keyLength.value));
    if (mode.value === 'encrypt') {
      const { combined } = await encryptAes({
        text: inputText.value,
        keyText: secretKey.value,
        bits: parseInt(keyLength.value),
        mode: cipherMode.value,
        ivText: iv.value,
      });
      outputText.value = encodeCipherBytes(combined, outputEncoding.value);
      statusMessage.value = `✓ 加密成功！使用 AES-${keyLength.value}-${cipherMode.value}（密文含 IV 前缀）`;
    } else {
      const data = decodeCipherText(inputText.value, outputEncoding.value);
      outputText.value = await decryptAes({
        data,
        keyText: secretKey.value,
        bits: parseInt(keyLength.value),
        mode: cipherMode.value,
      });
      statusMessage.value = "✓ 解密成功！";
    }
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ ${mode.value === 'encrypt' ? '加密' : '解密'}失败：${error.message}`;
    statusType.value = "error";
    outputText.value = "";
  }
};

// 清空
const clearAll = () => {
  inputText.value = "";
  outputText.value = "";
  statusMessage.value = "";
};

// 复制输出
const copyOutput = async () => {
  if (!outputText.value) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  try {
    await navigator.clipboard.writeText(outputText.value);
    statusMessage.value = "✓ 已复制到剪贴板";
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  } catch {
    statusMessage.value = "✗ 复制失败";
    statusType.value = "error";
  }
};

// 交换内容
const swapContent = () => {
  const temp = inputText.value;
  inputText.value = outputText.value;
  outputText.value = temp;
  mode.value = mode.value === 'encrypt' ? 'decrypt' : 'encrypt';
};

// 使用示例（示例密钥均为正好 32 字节，对应默认 AES-256）
const useExample = (example) => {
  mode.value = "encrypt";
  inputText.value = example.input;
  secretKey.value = example.key || "";
  keyLength.value = "256";
};

// 功能特点
const features = [
  { icon: "🔐", title: "多密钥长度", description: "支持 AES-128、AES-192、AES-256 三种密钥长度" },
  { icon: "🛡️", title: "GCM 模式", description: "推荐使用 GCM 模式，提供认证加密保护" },
  { icon: "🔄", title: "多种编码", description: "输出支持 Base64 和 Hex 两种编码格式" },
  { icon: "🎲", title: "随机生成", description: "一键生成安全的随机密钥和 IV（无偏拒绝采样）" },
  { icon: "📏", title: "严格校验", description: "密钥/IV 字节数、密文编码逐字校验，错误精确定位" },
  { icon: "💻", title: "本地处理", description: "所有加解密在本地完成，数据不上传" },
  { icon: "📋", title: "便捷操作", description: "支持一键复制和输入输出交换" },
];

// 使用说明
const usageSteps = [
  "选择加密或解密模式",
  "设置密钥长度、加密模式和输出编码",
  "输入密钥（可点击生成随机密钥）",
  "在输入框中输入明文或密文",
  "点击加密/解密按钮执行操作",
];

// 常见问题
const faqs = [
  { question: "什么是 AES 加密？", answer: "AES (Advanced Encryption Standard) 是一种对称加密算法，加密和解密使用相同的密钥，是目前最安全、最广泛使用的加密标准。" },
  { question: "应该选择哪种密钥长度？", answer: "AES-256 提供最高的安全性，推荐用于高安全需求场景；AES-128 性能更好，对于一般用途已足够安全。" },
  { question: "CBC 和 GCM 模式有什么区别？", answer: "GCM 模式提供认证加密，可以检测数据是否被篡改，更安全；CBC 模式是传统模式，需要额外的 MAC 来验证完整性。" },
  { question: "密钥如何保管？", answer: "密钥是加密安全的关键，请妥善保管。建议使用密码管理器存储，不要明文保存或通过不安全渠道传输。" },
  { question: "为什么提示密钥长度不对？", answer: "本工具严格按 UTF-8 字节数校验：AES-128/192/256 分别需要正好 16/24/32 字节，一个汉字占 3 字节。旧版工具会把短密钥静默补零、长密钥截断，与其他工具不互通，本工具不再这样做。" },
  { question: "密文是什么格式？为什么比明文长？", answer: "输出是「IV + 密文」拼接后再编码：GCM 前 12 字节是随机 IV（密文还含 16 字节认证标签），CBC 前 16 字节是 IV。解密时工具自动从前缀取 IV，所以同一明文每次加密结果都不同，这是正常的。" },
  { question: "解密失败有哪些原因？", answer: "最常见是密钥不对（差一个字符都不行）、加密模式（GCM/CBC）或输出编码（Base64/Hex）选错、密文复制不完整。GCM 还会校验完整性，密文被改动一个字节也会解密失败。" },
];

// 使用示例
const examples = [
  { input: "tools.morijiu.cn", output: "加密后的 Base64 密文", key: "MorijiuSecretKey1234567890123456", description: "域名信息加密" },
  { input: "极速开发工具箱API密钥", output: "加密后的 Base64 密文", key: "ToolsApiKey-2026-DevTools-123456", description: "API密钥加密" },
  { input: '{"user":"morijiu","token":"xxx"}', output: "加密后的 Base64 密文", key: "JsonDataKey-2026-Tools-123456789", description: "用户令牌加密" },
];
</script>

<style scoped>
.aes-encryption {
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
  box-shadow: var(--shadow-md);
}

/* 模式选择 */
.mode-section {
  margin-bottom: 24px;
}

.mode-tabs {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.mode-tab {
  padding: 14px 40px;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-tab:hover {
  border-color: var(--accent);
}

.mode-tab.active {
  background: var(--accent);
  color: white;
  border-color: transparent;
}

/* 配置区域 */
.config-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg);
  border-radius: 10px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  font-weight: 600;
  color: var(--text-strong);
  font-size: 14px;
}

.config-item select {
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--surface);
  cursor: pointer;
}

.config-item select:focus {
  outline: none;
  border-color: var(--accent);
}

/* 密钥区域 */
.key-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg);
  border-radius: 10px;
}

.key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
}

.section-label {
  font-weight: 600;
  color: var(--text-strong);
}

.key-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.key-hint {
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.link-btn:hover {
  text-decoration: underline;
}

.key-input,
.iv-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.key-input:focus,
.iv-input:focus {
  outline: none;
  border-color: var(--accent);
}

.iv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.key-tools {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.key-state {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
}

.key-state.ok {
  color: var(--success, #16a34a);
}

.key-state.bad {
  color: var(--danger, #dc2626);
}

.iv-row label {
  font-weight: 500;
  color: var(--text-strong);
  font-size: 14px;
}

.iv-row .iv-input {
  flex: 1;
  min-width: 200px;
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .mode-tabs {
    flex-direction: column;
  }

  .mode-tab {
    width: 100%;
    justify-content: center;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .key-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

