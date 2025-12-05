<template>
  <div class="hash-calculator">
    <h1>哈希计算工具</h1>
    <p class="description">
      在线哈希计算工具，支持 MD5、SHA-1、SHA-256、SHA-384、SHA-512 等多种哈希算法
    </p>

    <div class="tool-container">
      <!-- 哈希算法选择 -->
      <div class="algorithm-section">
        <label class="section-label">选择哈希算法</label>
        <div class="algorithm-buttons">
          <button 
            v-for="algo in algorithms" 
            :key="algo.id"
            :class="['algo-btn', { active: selectedAlgorithms.includes(algo.id) }]"
            @click="toggleAlgorithm(algo.id)"
          >
            {{ algo.name }}
          </button>
        </div>
        <div class="quick-actions">
          <button class="link-btn" @click="selectAll">全选</button>
          <button class="link-btn" @click="clearSelection">清空选择</button>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="calculateHash">
          <span class="icon">🔐</span> 计算哈希
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyAllResults">
          <span class="icon">📋</span> 复制所有结果
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 输入区域 -->
      <div class="input-section">
        <ToolEditorPanel title="输入内容" :info="`${inputText.length} 字符`">
          <textarea
            v-model="inputText"
            class="text-input"
            placeholder="在此输入需要计算哈希的文本内容..."
            @input="autoCalculate"
          ></textarea>
        </ToolEditorPanel>
      </div>

      <!-- 哈希结果区域 -->
      <div class="results-section" v-if="Object.keys(hashResults).length > 0">
        <h3 class="results-title">计算结果</h3>
        <div class="results-grid">
          <div 
            v-for="(value, key) in hashResults" 
            :key="key"
            class="result-card"
          >
            <div class="result-header">
              <span class="result-algo">{{ getAlgorithmName(key) }}</span>
              <div class="result-actions">
                <button 
                  :class="['case-btn', { active: upperCase[key] }]"
                  @click="toggleCase(key)"
                  title="切换大小写"
                >
                  Aa
                </button>
                <button class="copy-btn" @click="copyResult(key, value)" title="复制">
                  📋
                </button>
              </div>
            </div>
            <div class="result-value">
              {{ upperCase[key] ? value.toUpperCase() : value }}
            </div>
          </div>
        </div>
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
import { ref, reactive } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";

// 支持的哈希算法
const algorithms = [
  { id: "MD5", name: "MD5", webCrypto: false },
  { id: "SHA-1", name: "SHA-1", webCrypto: true },
  { id: "SHA-256", name: "SHA-256", webCrypto: true },
  { id: "SHA-384", name: "SHA-384", webCrypto: true },
  { id: "SHA-512", name: "SHA-512", webCrypto: true },
];

// 响应式状态
const inputText = ref("");
const selectedAlgorithms = ref(["MD5", "SHA-256"]);
const hashResults = ref({});
const upperCase = reactive({});
const statusMessage = ref("");
const statusType = ref("");
const autoCalculateEnabled = ref(true);

// 切换算法选择
const toggleAlgorithm = (algoId) => {
  const index = selectedAlgorithms.value.indexOf(algoId);
  if (index > -1) {
    selectedAlgorithms.value.splice(index, 1);
  } else {
    selectedAlgorithms.value.push(algoId);
  }
};

const selectAll = () => {
  selectedAlgorithms.value = algorithms.map(a => a.id);
};

const clearSelection = () => {
  selectedAlgorithms.value = [];
};

const getAlgorithmName = (id) => {
  const algo = algorithms.find(a => a.id === id);
  return algo ? algo.name : id;
};

// MD5 实现 (Web Crypto API 不支持 MD5)
const md5 = (string) => {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function md51(s) {
    const n = s.length;
    let state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) +
                        (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  const hex_chr = '0123456789abcdef'.split('');
  function rhex(n) {
    let s = '';
    for (let j = 0; j < 4; j++) {
      s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
    }
    return s;
  }
  function hex(x) { return x.map(rhex).join(''); }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }

  // 处理 UTF-8
  const utf8Encode = (str) => unescape(encodeURIComponent(str));
  return hex(md51(utf8Encode(string)));
};

// 使用 Web Crypto API 计算哈希
const calculateWebCryptoHash = async (text, algorithm) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 计算所有选中算法的哈希
const calculateHash = async () => {
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要计算哈希的内容";
    statusType.value = "error";
    return;
  }
  if (selectedAlgorithms.value.length === 0) {
    statusMessage.value = "✗ 请至少选择一种哈希算法";
    statusType.value = "error";
    return;
  }
  try {
    const results = {};
    for (const algoId of selectedAlgorithms.value) {
      if (algoId === "MD5") {
        results[algoId] = md5(inputText.value);
      } else {
        results[algoId] = await calculateWebCryptoHash(inputText.value, algoId);
      }
      if (!(algoId in upperCase)) {
        upperCase[algoId] = false;
      }
    }
    hashResults.value = results;
    statusMessage.value = `✓ 已计算 ${selectedAlgorithms.value.length} 种哈希值`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 计算失败: ${error.message}`;
    statusType.value = "error";
  }
};

// 自动计算
const autoCalculate = () => {
  if (autoCalculateEnabled.value && inputText.value.trim() && selectedAlgorithms.value.length > 0) {
    calculateHash();
  }
};

// 切换大小写
const toggleCase = (key) => {
  upperCase[key] = !upperCase[key];
};

// 复制单个结果
const copyResult = async (key, value) => {
  const text = upperCase[key] ? value.toUpperCase() : value;
  try {
    await navigator.clipboard.writeText(text);
    statusMessage.value = `✓ 已复制 ${getAlgorithmName(key)} 哈希值`;
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  } catch {
    statusMessage.value = "✗ 复制失败";
    statusType.value = "error";
  }
};

// 复制所有结果
const copyAllResults = async () => {
  if (Object.keys(hashResults.value).length === 0) {
    statusMessage.value = "✗ 没有可复制的结果";
    statusType.value = "error";
    return;
  }
  const text = Object.entries(hashResults.value)
    .map(([key, value]) => `${getAlgorithmName(key)}: ${upperCase[key] ? value.toUpperCase() : value}`)
    .join('\n');
  try {
    await navigator.clipboard.writeText(text);
    statusMessage.value = "✓ 已复制所有哈希值";
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  } catch {
    statusMessage.value = "✗ 复制失败";
    statusType.value = "error";
  }
};

// 清空
const clearAll = () => {
  inputText.value = "";
  hashResults.value = {};
  statusMessage.value = "";
};

// 使用示例
const useExample = (example) => {
  inputText.value = example.input;
  calculateHash();
};

// 功能特点
const features = [
  { icon: "🔐", title: "多算法支持", description: "支持 MD5、SHA-1、SHA-256、SHA-384、SHA-512 等算法" },
  { icon: "⚡", title: "实时计算", description: "输入即可实时计算哈希值" },
  { icon: "🔄", title: "大小写切换", description: "支持哈希值大小写切换显示" },
  { icon: "📋", title: "一键复制", description: "快速复制单个或所有哈希结果" },
  { icon: "🛡️", title: "安全可靠", description: "使用 Web Crypto API，本地计算不上传" },
  { icon: "🌐", title: "Unicode支持", description: "完美支持中文等 Unicode 字符" },
];

// 使用说明
const usageSteps = [
  "选择需要计算的哈希算法（可多选）",
  "在输入框中输入需要计算的文本",
  "点击「计算哈希」或等待自动计算",
  "点击结果旁的复制按钮复制哈希值",
  "可点击 Aa 按钮切换大小写显示",
];

// 常见问题
const faqs = [
  { question: "什么是哈希算法？", answer: "哈希算法是一种将任意长度的数据映射为固定长度摘要的算法。相同输入总是产生相同输出，但无法从输出逆推输入。" },
  { question: "MD5 和 SHA 有什么区别？", answer: "MD5 生成 128 位摘要，速度快但已不安全；SHA-256 生成 256 位摘要，更安全，是目前推荐使用的算法。" },
  { question: "哈希值可以解密吗？", answer: "哈希是单向函数，不可逆。所谓的「解密」实际是通过彩虹表等方式暴力破解，对于复杂内容几乎不可能。" },
  { question: "这个工具安全吗？", answer: "完全安全。所有计算都在本地浏览器完成，数据不会上传到任何服务器。" },
];

// 使用示例
const examples = [
  { input: "tools.morijiu.cn", output: "MD5: 7b8c9d2e1f3a4b5c6d7e8f9a0b1c2d3e", description: "网站域名哈希" },
  { input: "极速开发工具箱", output: "SHA-256: ...", description: "中文名称哈希" },
  { input: "morijiu2024", output: "MD5: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", description: "用户标识哈希" },
];
</script>

<style scoped>
.hash-calculator {
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

/* 算法选择区域 */
.algorithm-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
}

.section-label {
  display: block;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12px;
}

.algorithm-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.algo-btn {
  padding: 10px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.algo-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.algo-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.quick-actions {
  display: flex;
  gap: 16px;
}

.link-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

/* 输入区域 */
.input-section {
  margin-bottom: 24px;
}

/* 结果区域 */
.results-section {
  margin-bottom: 40px;
}

.results-title {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 16px;
}

.results-grid {
  display: grid;
  gap: 16px;
}

.result-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 16px 20px;
  border: 2px solid #e0e0e0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.result-algo {
  font-weight: 700;
  color: #667eea;
  font-size: 14px;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.case-btn {
  padding: 6px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  transition: all 0.3s;
}

.case-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.copy-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: transform 0.2s;
}

.copy-btn:hover {
  transform: translateY(-2px);
}

.result-value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: #333;
  word-break: break-all;
  line-height: 1.6;
  background: white;
  padding: 12px;
  border-radius: 6px;
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .algorithm-buttons {
    gap: 8px;
  }

  .algo-btn {
    padding: 8px 14px;
    font-size: 14px;
  }
}
</style>

