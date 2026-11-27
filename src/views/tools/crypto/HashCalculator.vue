<template>
  <div class="hash-calculator">
    <h1>哈希计算工具</h1>
    <p class="description">
      在线哈希计算工具，支持 MD5、SHA-1、SHA-256、SHA-384、SHA-512，可计算文本与本地文件，并校验期望哈希
    </p>

    <div class="tool-container">
      <!-- 模式切换 -->
      <div class="mode-switch" role="tablist" aria-label="输入模式">
        <button :class="['mode-btn', { active: mode === 'text' }]" @click="mode = 'text'">文本</button>
        <button :class="['mode-btn', { active: mode === 'file' }]" @click="mode = 'file'">文件</button>
      </div>

      <!-- 哈希算法选择 -->
      <div class="algorithm-section">
        <label class="section-label">选择哈希算法</label>
        <div class="algorithm-buttons">
          <button
            v-for="algo in HASH_ALGORITHMS"
            :key="algo.id"
            :class="['algo-btn', { active: selectedAlgorithms.includes(algo.id) }]"
            @click="toggleAlgorithm(algo.id)"
          >
            {{ algo.name }}<span class="algo-bits">{{ algo.bits }} 位</span>
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

      <!-- 文本输入区域 -->
      <div class="input-section" v-if="mode === 'text'">
        <ToolEditorPanel title="输入内容" :info="inputInfo">
          <textarea aria-label="输入需要计算哈希的文本"
            v-model="inputText"
            class="text-input"
            placeholder="在此输入需要计算哈希的文本内容（可为空，空字符串也有确定哈希）..."
            @input="scheduleCalculate"
          ></textarea>
        </ToolEditorPanel>
        <p class="input-hint">按 UTF-8 字节计算；字符数为 Unicode 码点数，Emoji 等字符占 4 字节。</p>
      </div>

      <!-- 文件输入区域 -->
      <div class="input-section" v-else>
        <div
          class="drop-zone"
          :class="{ dragging }"
          @click="fileInputRef?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <input aria-label="选择要计算哈希的文件" ref="fileInputRef" type="file" hidden @change="onFileChange" />
          <template v-if="fileMeta">
            <div class="file-name">📄 {{ fileMeta.name }}</div>
            <div class="file-size">{{ formatFileSize(fileMeta.size) }} · 点击或拖放可更换文件</div>
          </template>
          <template v-else>
            <div class="file-name">点击选择文件，或把文件拖到这里</div>
            <div class="file-size">文件只在本地读取计算，不会上传到任何服务器</div>
          </template>
        </div>
      </div>

      <!-- 哈希结果区域 -->
      <div class="results-section" v-if="Object.keys(hashResults).length > 0">
        <h2 class="results-title">计算结果</h2>
        <div class="results-grid">
          <div
            v-for="(value, key) in hashResults"
            :key="key"
            :class="['result-card', { matched: matchedIds.includes(key) }]"
          >
            <div class="result-header">
              <span class="result-algo">{{ getAlgorithmName(key) }}<span v-if="matchedIds.includes(key)" class="match-badge">✓ 与期望哈希一致</span></span>
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

        <!-- 期望哈希校验 -->
        <div class="verify-section">
          <label class="section-label" for="expected-hash">校验期望哈希（可选）</label>
          <input
            id="expected-hash"
            v-model="expectedInput"
            class="verify-input"
            type="text"
            spellcheck="false"
            placeholder="粘贴官方公布的哈希值，自动与上方结果比对（大小写、空格不敏感）"
            @input="runVerify"
          />
          <p v-if="verifyMessage" :class="['verify-message', verifyType]">{{ verifyMessage }}</p>
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
import { ref, reactive, computed, watch } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";
import {
  HASH_ALGORITHMS, digestAll, textToBytes, textStats,
  normalizeExpectedHash, findHashMatches, formatFileSize
} from "@/utils/hash.js";

const mode = ref("text");
const inputText = ref("");
const fileBytes = ref(null);
const fileMeta = ref(null);
const fileInputRef = ref(null);
const dragging = ref(false);
const selectedAlgorithms = ref(["MD5", "SHA-256"]);
const hashResults = ref({});
const upperCase = reactive({});
const statusMessage = ref("");
const statusType = ref("");
const expectedInput = ref("");
const verifyMessage = ref("");
const verifyType = ref("");
const matchedIds = ref([]);

let computeSeq = 0;
let debounceTimer = null;

const inputInfo = computed(() => {
  const s = textStats(inputText.value);
  return `${s.chars} 字符 · ${s.bytes} 字节`;
});

const getAlgorithmName = (id) => {
  const algo = HASH_ALGORITHMS.find(a => a.id === id);
  return algo ? algo.name : id;
};

const toggleAlgorithm = (algoId) => {
  const index = selectedAlgorithms.value.indexOf(algoId);
  if (index > -1) selectedAlgorithms.value.splice(index, 1);
  else selectedAlgorithms.value.push(algoId);
  scheduleCalculate();
};

const selectAll = () => {
  selectedAlgorithms.value = HASH_ALGORITHMS.map(a => a.id);
  scheduleCalculate();
};

const clearSelection = () => {
  selectedAlgorithms.value = [];
  hashResults.value = {};
};

// 当前数据源字节：文本模式按 UTF-8 编码（空字符串也算），文件模式用已读入的字节
const sourceBytes = () => (mode.value === "text" ? textToBytes(inputText.value) : fileBytes.value);

const calculateHash = async () => {
  const seq = ++computeSeq;
  if (selectedAlgorithms.value.length === 0) {
    statusMessage.value = "✗ 请至少选择一种哈希算法";
    statusType.value = "error";
    hashResults.value = {};
    return;
  }
  const bytes = sourceBytes();
  if (bytes === null) {
    statusMessage.value = "✗ 请先选择要计算哈希的文件";
    statusType.value = "error";
    return;
  }
  try {
    const results = await digestAll(selectedAlgorithms.value, bytes);
    if (seq !== computeSeq) return; // 已有更新的计算，丢弃过期结果防竞态覆盖
    for (const id of Object.keys(results)) {
      if (!(id in upperCase)) upperCase[id] = false;
    }
    hashResults.value = results;
    const source = mode.value === "text"
      ? (inputText.value === "" ? "空字符串" : `${formatFileSize(bytes.length)} 文本`)
      : `文件 ${fileMeta.value.name}（${formatFileSize(bytes.length)}）`;
    statusMessage.value = `✓ 已计算 ${source} 的 ${selectedAlgorithms.value.length} 种哈希值`;
    statusType.value = "success";
    runVerify();
  } catch (error) {
    if (seq !== computeSeq) return;
    statusMessage.value = `✗ 计算失败: ${error.message}`;
    statusType.value = "error";
  }
};

// 输入防抖 250ms 自动计算
const scheduleCalculate = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(calculateHash, 250);
};

watch(mode, () => {
  hashResults.value = {};
  verifyMessage.value = "";
  matchedIds.value = [];
  if (mode.value === "text" || fileBytes.value) calculateHash();
});

// 文件读取：只读字节，不上传
const loadFile = async (file) => {
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    fileBytes.value = new Uint8Array(buf);
    fileMeta.value = { name: file.name, size: file.size };
    calculateHash();
  } catch {
    statusMessage.value = "✗ 文件读取失败，请重新选择";
    statusType.value = "error";
  }
};

const onFileChange = (e) => {
  loadFile(e.target.files?.[0]);
  e.target.value = "";
};

const onDrop = (e) => {
  dragging.value = false;
  loadFile(e.dataTransfer.files?.[0]);
};

// 期望哈希校验：归一化后与已计算结果比对
const runVerify = () => {
  matchedIds.value = [];
  if (!expectedInput.value.trim()) {
    verifyMessage.value = "";
    return;
  }
  try {
    const { hex, candidates } = normalizeExpectedHash(expectedInput.value);
    const matches = findHashMatches(hashResults.value, hex);
    matchedIds.value = matches;
    if (matches.length > 0) {
      verifyMessage.value = `✓ 一致：与 ${matches.map(getAlgorithmName).join("、")} 的计算结果相同`;
      verifyType.value = "success";
    } else if (!candidates.some(name => hashResults.value[name])) {
      verifyMessage.value = `该哈希长度对应 ${candidates.join("、")}，但尚未计算该算法，请在上方勾选后重试`;
      verifyType.value = "error";
    } else {
      verifyMessage.value = `✗ 不一致：与已计算的 ${candidates.join("、")} 结果不同，内容可能已被修改或期望哈希粘贴有误`;
      verifyType.value = "error";
    }
  } catch (error) {
    verifyMessage.value = `✗ ${error.message}`;
    verifyType.value = "error";
  }
};

const toggleCase = (key) => {
  upperCase[key] = !upperCase[key];
};

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

const clearAll = () => {
  computeSeq++;
  inputText.value = "";
  fileBytes.value = null;
  fileMeta.value = null;
  hashResults.value = {};
  expectedInput.value = "";
  verifyMessage.value = "";
  matchedIds.value = [];
  statusMessage.value = "";
};

const useExample = (example) => {
  mode.value = "text";
  inputText.value = example.input;
  calculateHash();
};

const features = [
  { icon: "🔐", title: "多算法支持", description: "支持 MD5、SHA-1、SHA-256、SHA-384、SHA-512 等算法" },
  { icon: "📄", title: "文件哈希", description: "可直接计算本地文件哈希，校验下载文件完整性" },
  { icon: "✅", title: "期望哈希校验", description: "粘贴官方公布的哈希值，自动比对是否一致" },
  { icon: "⚡", title: "实时计算", description: "输入防抖自动计算，结果带防竞态保护不会串旧值" },
  { icon: "🔄", title: "大小写切换", description: "支持哈希值大小写切换显示" },
  { icon: "🛡️", title: "安全可靠", description: "全部本地计算，文本与文件都不会上传到服务器" },
];

const usageSteps = [
  "选择需要计算的哈希算法（可多选）",
  "文本模式输入文本，或切到文件模式选择/拖放文件",
  "等待自动计算，或点击「计算哈希」",
  "（可选）把官方公布的哈希粘贴到校验框，确认是否一致",
  "点击结果旁的复制按钮复制哈希值",
];

const faqs = [
  { question: "什么是哈希算法？", answer: "哈希算法是一种将任意长度的数据映射为固定长度摘要的算法。相同输入总是产生相同输出，但无法从输出逆推输入。" },
  { question: "MD5 和 SHA 有什么区别？", answer: "MD5 生成 128 位摘要，速度快但已被攻破、只适合做文件完整性校验；SHA-256 生成 256 位摘要，更安全，是目前推荐使用的算法。" },
  { question: "下载文件怎么校验有没有被篡改？", answer: "切到文件模式选择下载好的文件，再把官网公布的哈希值粘贴到校验框：一致说明文件完整无误，不一致就不要使用该文件。" },
  { question: "为什么同一段文字和别的工具算出来不一样？", answer: "多半是编码或换行差异：本工具按 UTF-8 字节原样计算（含末尾换行）。若对方工具用了 GBK 编码、或输入时多/少了一个换行，结果就会不同。" },
  { question: "空字符串的哈希是多少？", answer: "空输入也有确定哈希，例如 MD5 是 d41d8cd98f00b204e9800998ecf8427e、SHA-256 是 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855，清空输入框即可看到。" },
  { question: "哈希值可以解密吗？", answer: "哈希是单向函数，不可逆。所谓的「解密」实际是通过彩虹表等方式暴力破解，对于复杂内容几乎不可能。" },
  { question: "这个工具安全吗？", answer: "完全安全。所有计算都在本地浏览器完成，文本和文件都不会上传到任何服务器。" },
];

// 示例输出为真实计算值（MD5），可用上方工具复算验证
const examples = [
  { input: "tools.morijiu.cn", output: "MD5: 67c1647bd2b200f9d457646c20dbc3c9", description: "网站域名哈希" },
  { input: "极速开发工具箱", output: "MD5: 56c3e15fb895b57ad9d734d0eee597d9", description: "中文名称哈希（UTF-8）" },
  { input: "hello world", output: "MD5: 5eb63bbbe01eeed093cb22bb8f5acdc3", description: "经典示例哈希" },
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

/* 模式切换 */
.mode-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 20px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.mode-btn {
  padding: 6px 18px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  cursor: pointer;
}

.mode-btn.active {
  background: var(--accent);
  color: #fff;
}

/* 算法选择区域 */
.algorithm-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg);
  border-radius: 10px;
}

.section-label {
  display: block;
  font-weight: 600;
  color: var(--text-strong);
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
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.algo-bits {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.75;
}

.algo-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.algo-btn.active {
  background: var(--accent);
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
  color: var(--accent);
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

.input-hint {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-3);
}

.drop-zone {
  padding: 28px 20px;
  border: 2px dashed var(--border);
  border-radius: 10px;
  background: var(--bg);
  text-align: center;
  cursor: pointer;
}

.drop-zone.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.file-name {
  font-weight: 600;
  color: var(--text-strong);
  word-break: break-all;
}

.file-size {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-3);
}

/* 结果区域 */
.results-section {
  margin-bottom: 40px;
}

.results-title {
  font-size: 18px;
  color: var(--text-strong);
  margin-bottom: 16px;
}

.results-grid {
  display: grid;
  gap: 16px;
}

.result-card {
  background: var(--bg);
  border-radius: 10px;
  padding: 16px 20px;
  border: 2px solid var(--border);
}

.result-card.matched {
  border-color: var(--success, #2f9e44);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.result-algo {
  font-weight: 700;
  color: var(--accent);
  font-size: 14px;
}

.match-badge {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--success, #2f9e44);
}

.result-actions {
  display: flex;
  gap: 8px;
}

.case-btn {
  padding: 6px 10px;
  border: 2px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  transition: all 0.3s;
}

.case-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.copy-btn {
  background: var(--accent);
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
  color: var(--text);
  word-break: break-all;
  line-height: 1.6;
  background: var(--surface);
  padding: 12px;
  border-radius: 6px;
}

/* 期望哈希校验 */
.verify-section {
  margin-top: 20px;
  padding: 16px 20px;
  background: var(--bg);
  border-radius: 10px;
}

.verify-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.verify-input:focus {
  outline: none;
  border-color: var(--accent);
}

.verify-message {
  margin-top: 10px;
  font-size: 14px;
}

.verify-message.success {
  color: var(--success, #2f9e44);
}

.verify-message.error {
  color: var(--danger-text, #e03131);
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
