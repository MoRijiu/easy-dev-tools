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
            <span class="key-hint">{{ keyHint }}</span>
          </div>
        </div>
        <input 
          v-model="secretKey"
          type="text"
          class="key-input"
          :placeholder="`请输入${getKeyLength()}字节的密钥`"
        />
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
        <ToolEditorPanel :title="mode === 'encrypt' ? '明文输入' : '密文输入'" :info="`${inputText.length} 字符`">
          <textarea
            v-model="inputText"
            class="text-input"
            :placeholder="mode === 'encrypt' ? '请输入需要加密的明文内容...' : '请输入需要解密的密文 (Base64/Hex)...'"
          ></textarea>
        </ToolEditorPanel>

        <ToolEditorPanel :title="mode === 'encrypt' ? '加密结果' : '解密结果'" :info="`${outputText.length} 字符`">
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

// 获取密钥长度
const getKeyLength = () => parseInt(keyLength.value) / 8;

// 密钥提示
const keyHint = computed(() => {
  const len = getKeyLength();
  const currentLen = new TextEncoder().encode(secretKey.value).length;
  if (currentLen === 0) return `需要 ${len} 字节`;
  if (currentLen < len) return `还需 ${len - currentLen} 字节`;
  if (currentLen > len) return `超出 ${currentLen - len} 字节`;
  return "✓ 长度正确";
});

// 辅助函数：字节数组转 Hex
const bytesToHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

// 辅助函数：Hex 转字节数组
const hexToBytes = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

// 辅助函数：字节数组转 Base64
const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

// 辅助函数：Base64 转字节数组
const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// 生成随机密钥
const generateRandomKey = () => {
  const len = getKeyLength();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint32Array(len);
  crypto.getRandomValues(array);
  secretKey.value = Array.from(array, x => chars[x % chars.length]).join('');
  statusMessage.value = `✓ 已生成 ${len} 字节随机密钥`;
  statusType.value = "success";
};

// 生成随机IV
const generateRandomIV = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint32Array(16);
  crypto.getRandomValues(array);
  iv.value = Array.from(array, x => chars[x % chars.length]).join('');
  statusMessage.value = "✓ 已生成 16 字节随机 IV";
  statusType.value = "success";
};

// 准备密钥
const prepareKey = async () => {
  const encoder = new TextEncoder();
  let keyBytes = encoder.encode(secretKey.value);
  const targetLen = getKeyLength();

  // 调整密钥长度
  if (keyBytes.length < targetLen) {
    const padded = new Uint8Array(targetLen);
    padded.set(keyBytes);
    keyBytes = padded;
  } else if (keyBytes.length > targetLen) {
    keyBytes = keyBytes.slice(0, targetLen);
  }

  const algorithm = cipherMode.value === 'GCM' ? 'AES-GCM' : 'AES-CBC';
  return await crypto.subtle.importKey(
    'raw', keyBytes, { name: algorithm }, false, ['encrypt', 'decrypt']
  );
};

// 加密
const encrypt = async () => {
  const encoder = new TextEncoder();
  const data = encoder.encode(inputText.value);
  const key = await prepareKey();

  let ivBytes;
  if (cipherMode.value === 'GCM') {
    ivBytes = crypto.getRandomValues(new Uint8Array(12));
  } else {
    if (iv.value) {
      const ivData = encoder.encode(iv.value);
      ivBytes = new Uint8Array(16);
      ivBytes.set(ivData.slice(0, 16));
    } else {
      ivBytes = crypto.getRandomValues(new Uint8Array(16));
    }
  }

  const algorithm = cipherMode.value === 'GCM'
    ? { name: 'AES-GCM', iv: ivBytes }
    : { name: 'AES-CBC', iv: ivBytes };

  const encrypted = await crypto.subtle.encrypt(algorithm, key, data);

  // 将 IV 和密文合并
  const result = new Uint8Array(ivBytes.length + encrypted.byteLength);
  result.set(ivBytes);
  result.set(new Uint8Array(encrypted), ivBytes.length);

  if (outputEncoding.value === 'base64') {
    outputText.value = bytesToBase64(result);
  } else {
    outputText.value = bytesToHex(result);
  }

  statusMessage.value = `✓ 加密成功！使用 AES-${keyLength.value}-${cipherMode.value}`;
  statusType.value = "success";
};

// 解密
const decrypt = async () => {
  let encryptedBytes;

  try {
    if (outputEncoding.value === 'base64') {
      encryptedBytes = base64ToBytes(inputText.value.trim());
    } else {
      encryptedBytes = hexToBytes(inputText.value.trim());
    }
  } catch (e) {
    throw new Error('无效的密文格式');
  }

  const key = await prepareKey();
  const ivLen = cipherMode.value === 'GCM' ? 12 : 16;

  if (encryptedBytes.length < ivLen + 1) {
    throw new Error('密文长度不足');
  }

  const ivBytes = encryptedBytes.slice(0, ivLen);
  const ciphertext = encryptedBytes.slice(ivLen);

  const algorithm = cipherMode.value === 'GCM'
    ? { name: 'AES-GCM', iv: ivBytes }
    : { name: 'AES-CBC', iv: ivBytes };

  const decrypted = await crypto.subtle.decrypt(algorithm, key, ciphertext);
  const decoder = new TextDecoder();
  outputText.value = decoder.decode(decrypted);

  statusMessage.value = `✓ 解密成功！`;
  statusType.value = "success";
};

// 处理加密/解密
const processData = async () => {
  if (!inputText.value.trim()) {
    statusMessage.value = `✗ 请输入需要${mode.value === 'encrypt' ? '加密' : '解密'}的内容`;
    statusType.value = "error";
    return;
  }
  if (!secretKey.value.trim()) {
    statusMessage.value = "✗ 请输入密钥";
    statusType.value = "error";
    return;
  }

  try {
    if (mode.value === 'encrypt') {
      await encrypt();
    } else {
      await decrypt();
    }
  } catch (error) {
    statusMessage.value = `✗ ${mode.value === 'encrypt' ? '加密' : '解密'}失败: ${error.message}`;
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

// 使用示例
const useExample = (example) => {
  inputText.value = example.input;
  secretKey.value = example.key || "MySecretKey12345";
};

// 功能特点
const features = [
  { icon: "🔐", title: "多密钥长度", description: "支持 AES-128、AES-192、AES-256 三种密钥长度" },
  { icon: "🛡️", title: "GCM 模式", description: "推荐使用 GCM 模式，提供认证加密保护" },
  { icon: "🔄", title: "多种编码", description: "输出支持 Base64 和 Hex 两种编码格式" },
  { icon: "🎲", title: "随机生成", description: "一键生成安全的随机密钥和 IV" },
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
];

// 使用示例
const examples = [
  { input: "tools.morijiu.cn", output: "加密后的 Base64 密文", key: "MorijiuSecretKey1234567890123456", description: "域名信息加密" },
  { input: "极速开发工具箱API密钥", output: "加密后的 Base64 密文", key: "ToolsApiKey12345678901234567890", description: "API密钥加密" },
  { input: '{"user":"morijiu","token":"xxx"}', output: "加密后的 Base64 密文", key: "JsonDataKey1234567890123456", description: "用户令牌加密" },
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
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
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
  border-color: #667eea;
}

.mode-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  border-color: #667eea;
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
  color: #667eea;
  font-weight: 500;
}

.link-btn {
  background: none;
  border: none;
  color: #667eea;
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
  border-color: #667eea;
}

.iv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
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

