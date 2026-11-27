<template>
  <div class="uuid-generator">
    <h1>UUID 生成器</h1>
    <p class="description">
      在线 UUID/GUID 生成工具：v4 随机 / v7 时间有序，批量生成、多种格式，纯本地不上传
    </p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="generateUuids">
          <span class="icon">🎲</span> 生成 UUID
        </button>
        <button class="btn btn-success" @click="copyOutput">
          <span class="icon">📋</span> 复制全部
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        
        <div class="toolbar-divider"></div>
        
        <div class="options">
          <div class="version-switch" role="group" aria-label="UUID 版本">
            <button type="button" :class="{ active: options.version === 'v4' }" @click="options.version = 'v4'">v4 随机</button>
            <button type="button" :class="{ active: options.version === 'v7' }" @click="options.version = 'v7'">v7 时间有序</button>
          </div>
          <label>
            生成数量:
            <input type="number" v-model="options.count" min="1" :max="MAX_COUNT" />
          </label>
          <label>
            <input type="checkbox" v-model="options.uppercase" :disabled="options.urn" />
            大写
          </label>
          <label>
            <input type="checkbox" v-model="options.withHyphens" :disabled="options.urn" />
            带连字符
          </label>
          <label>
            <input type="checkbox" v-model="options.withBraces" :disabled="options.urn" />
            带花括号
          </label>
          <label>
            <input type="checkbox" v-model="options.urn" />
            URN 格式
          </label>
          <button class="btn btn-secondary" :disabled="!uuidList.length" @click="downloadList">⬇️ 下载 .txt</button>
        </div>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- UUID 列表显示 -->
      <div class="uuid-output-section">
        <ToolEditorPanel 
          title="生成的 UUID" 
          :info="uuidList.length ? `${uuidList.length} 个 · ${options.version.toUpperCase()} · 全部唯一` : ''"
        >
          <div class="uuid-list-wrapper">
            <div v-if="uuidList.length" class="uuid-list">
              <div 
                v-for="(uuid, index) in uuidList" 
                :key="index" 
                class="uuid-item"
              >
                <code class="uuid-text">{{ uuid }}</code>
                <button class="copy-single-btn" @click="copySingle(uuid)" title="复制此 UUID">
                  📋
                </button>
              </div>
            </div>
            <div v-else class="placeholder">
              点击“生成 UUID”按钮生成 UUID（默认已生成 5 个）
            </div>
          </div>
        </ToolEditorPanel>
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
import { ref, onMounted } from "vue";
import { generateBatch, MAX_COUNT } from "@/utils/uuidGenerate.js";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import ToolEditorPanel from "@/components/ToolEditorPanel.vue";

const uuidList = ref([]);
const statusMessage = ref("");
const statusType = ref("");

const options = ref({
  count: 5,
  version: "v4",
  uppercase: false,
  withHyphens: true,
  withBraces: false,
  urn: false,
});

// 功能特点数据
const features = [
  { icon: "🎲", title: "v4 随机生成", description: "使用加密安全随机数生成 UUID v4" },
  { icon: "🕒", title: "v7 时间有序", description: "内嵌毫秒时间戳、同一毫秒单调递增，按时间天然可排序" },
  { icon: "📦", title: "批量生成", description: `一次最多生成 ${MAX_COUNT} 个，生成后逐个自检且保证不重复` },
  { icon: "🔤", title: "格式选项", description: "支持大小写、连字符、花括号与 URN 等格式" },
  { icon: "📋", title: "一键复制", description: "单个或批量复制 UUID 到剪贴板，也可下载 .txt" },
  { icon: "⚡", title: "本地处理", description: "所有操作在浏览器本地完成，安全可靠" },
];

// 使用说明数据
const usageSteps = [
  `选择版本：v4 随机，或 v7 时间有序（适合数据库索引、按创建时间排序）`,
  `设置需要生成的 UUID 数量（1-${MAX_COUNT}，必须为整数，越界会明确报错不再静默截断）`,
  "根据需要选择格式选项：大写、带连字符、花括号或 URN",
  '点击"生成 UUID"按钮生成 UUID',
  "点击单个 UUID 右侧的复制按钮复制该 UUID，或复制全部 / 下载 .txt",
];

// 常见问题数据
const faqs = [
  {
    question: "什么是 UUID？",
    answer: "UUID（Universally Unique Identifier）是一种 128 位的唯一标识符，也称为 GUID。它被设计为在全球范围内具有唯一性，常用于数据库主键、分布式系统标识等场景。",
  },
  {
    question: "v4 和 v7 该选哪个？",
    answer: "v4 是纯随机生成，最通用；v7（RFC 9562）把毫秒时间戳放在高位，同一时刻生成的 ID 也单调递增，作为数据库主键时索引局部性更好、能按生成顺序大致排序。新系统优先考虑 v7，老系统生态兼容选 v4。",
  },
  {
    question: "UUID v4 是如何生成的？",
    answer: "UUID v4 是基于随机数生成的。本工具使用浏览器的 crypto.getRandomValues() 生成加密安全的随机字节，再设置版本与变体位；每批生成后都会逐个用解析器自检版本并去重。",
  },
  {
    question: "UUID 会重复吗？",
    answer: "理论上 UUID 可能重复，但概率极低。UUID v4 有 2^122 种可能的组合，实际应用中可以认为是唯一的。本工具单批内还会强制去重，重复的会丢弃重抽。",
  },
  {
    question: "不同格式的 UUID 有什么区别？",
    answer: "UUID 的值是相同的，只是显示格式不同。带连字符的格式（如 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）是最常见的标准格式，而不带连字符的格式更紧凑。花括号格式常用于 Windows 系统；URN 格式（urn:uuid:…）固定为小写带连字符，勾选后大小写/花括号选项不再生效。",
  },
  {
    question: "生成数量为什么不能随便填？",
    answer: `数量必须为 1-${MAX_COUNT} 的整数。旧版对越界数量是静默截断，容易让人误以为生成了更多；现在会明确提示错在哪，分批生成即可。`,
  },
];

// 使用示例数据（input 为预设名，useExample 按名切换选项）
const examples = [
  {
    input: "v4 标准格式",
    output: "550e8400-e29b-41d4-a716-446655440000",
    description: "最常见的 v4 标准写法（示意值）",
  },
  {
    input: "v7 时间有序",
    output: "01941f2a-7b3c-7d4e-8f50-1a2b3c4d5e6f",
    description: "高位内嵌时间、按生成顺序可排序（示意值）",
  },
  {
    input: "无连字符大写",
    output: "550E8400E29B41D4A716446655440000",
    description: "紧凑大写写法（示意值）",
  },
  {
    input: "带花括号",
    output: "{550e8400-e29b-41d4-a716-446655440000}",
    description: "Windows / .NET 常见写法（示意值）",
  },
  {
    input: "URN 格式",
    output: "urn:uuid:550e8400-e29b-41d4-a716-446655440000",
    description: "URN 命名空间写法（示意值）",
  },
];

const showStatus = (message, type) => {
  statusMessage.value = message;
  statusType.value = type;
  if (type === "success") {
    setTimeout(() => {
      if (statusMessage.value === message) statusMessage.value = "";
    }, 2500);
  }
};

// 生成 UUID 列表：数量严格校验，越界/非整数明确报错，不再静默截断
const generateUuids = () => {
  const result = generateBatch({
    count: options.value.count,
    version: options.value.version,
    format: {
      uppercase: options.value.uppercase,
      hyphens: options.value.withHyphens,
      braces: options.value.withBraces,
      urn: options.value.urn,
    },
  });
  if (!result.ok) {
    showStatus(`✗ ${result.error}`, "error");
    return;
  }
  uuidList.value = result.list;
  showStatus(`✓ 成功生成 ${result.count} 个 UUID（${result.version.toUpperCase()}，全部唯一）`, "success");
};

// 复制单个 UUID
const copySingle = async (uuid) => {
  try {
    await navigator.clipboard.writeText(uuid);
    showStatus("✓ 已复制到剪贴板", "success");
  } catch (error) {
    showStatus("✗ 复制失败，请手动复制", "error");
  }
};

// 复制全部 UUID
const copyOutput = async () => {
  if (!uuidList.value.length) {
    showStatus("✗ 没有可复制的内容", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(uuidList.value.join('\n'));
    showStatus(`✓ 已复制 ${uuidList.value.length} 个 UUID 到剪贴板`, "success");
  } catch (error) {
    showStatus("✗ 复制失败，请手动复制", "error");
  }
};

// 下载为 .txt
const downloadList = () => {
  if (!uuidList.value.length) return;
  const blob = new Blob([uuidList.value.join('\n') + '\n'], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `uuid-${options.value.version}-${uuidList.value.length}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus("✓ 已下载 UUID 列表", "success");
};

// 清空内容
const clearAll = () => {
  uuidList.value = [];
  statusMessage.value = "";
};

// 使用示例：按预设名切换版本与格式后生成 1 个
const useExample = (example) => {
  const presets = {
    "v4 标准格式": { version: "v4", uppercase: false, withHyphens: true, withBraces: false, urn: false },
    "v7 时间有序": { version: "v7", uppercase: false, withHyphens: true, withBraces: false, urn: false },
    "无连字符大写": { version: "v4", uppercase: true, withHyphens: false, withBraces: false, urn: false },
    "带花括号": { version: "v4", uppercase: false, withHyphens: true, withBraces: true, urn: false },
    "URN 格式": { version: "v4", uppercase: false, withHyphens: true, withBraces: false, urn: true },
  };
  const preset = presets[example.input];
  if (!preset) return;
  Object.assign(options.value, preset);
  options.value.count = 1;
  generateUuids();
};

onMounted(generateUuids);
</script>

<style scoped>
.uuid-generator {
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

.uuid-output-section {
  margin-bottom: 40px;
}

.uuid-list-wrapper {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  background: var(--bg);
}

.uuid-list {
  padding: 15px;
}

.uuid-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  margin-bottom: 8px;
  background: var(--surface);
  border-radius: 8px;
  border: 1px solid var(--border);
  transition: all 0.2s;
}

.uuid-item:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--accent-soft);
}

.uuid-item:last-child {
  margin-bottom: 0;
}

.uuid-text {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  color: var(--text);
  user-select: all;
}

.copy-single-btn {
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.copy-single-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
}

.version-switch {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.version-switch button {
  padding: 5px 10px;
  background: var(--surface);
  color: var(--text-2);
  border: none;
  cursor: pointer;
  font-size: 13px;
}

.version-switch button.active {
  background: var(--accent);
  color: #fff;
}

.placeholder {
  padding: 60px 20px;
  color: var(--text-3);
  text-align: center;
  font-style: italic;
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .uuid-text {
    font-size: 12px;
    word-break: break-all;
  }
}
</style>

