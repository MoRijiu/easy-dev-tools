<template>
  <div class="uuid-generator">
    <h1>UUID 生成器</h1>
    <p class="description">
      在线 UUID/GUID 生成工具，支持批量生成、多种格式选项
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
          <label>
            生成数量:
            <input type="number" v-model.number="options.count" min="1" max="100" />
          </label>
          <label>
            <input type="checkbox" v-model="options.uppercase" />
            大写
          </label>
          <label>
            <input type="checkbox" v-model="options.withHyphens" />
            带连字符
          </label>
          <label>
            <input type="checkbox" v-model="options.withBraces" />
            带花括号
          </label>
        </div>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- UUID 列表显示 -->
      <div class="uuid-output-section">
        <ToolEditorPanel 
          title="生成的 UUID" 
          :info="uuidList.length ? `${uuidList.length} 个 UUID` : ''"
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
              点击"生成 UUID"按钮生成 UUID
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
import { ref } from "vue";
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
  count: 1,
  uppercase: false,
  withHyphens: true,
  withBraces: false,
});

// 功能特点数据
const features = [
  { icon: "🎲", title: "随机生成", description: "使用加密安全的随机数生成 UUID v4" },
  { icon: "📦", title: "批量生成", description: "一次最多生成 100 个 UUID" },
  { icon: "🔤", title: "格式选项", description: "支持大小写、连字符、花括号等格式" },
  { icon: "📋", title: "一键复制", description: "单个或批量复制 UUID 到剪贴板" },
  { icon: "⚡", title: "本地处理", description: "所有操作在浏览器本地完成，安全可靠" },
  { icon: "🌐", title: "标准格式", description: "生成符合 RFC 4122 标准的 UUID" },
];

// 使用说明数据
const usageSteps = [
  "设置需要生成的 UUID 数量（1-100）",
  "根据需要选择格式选项：大写、带连字符、带花括号",
  '点击"生成 UUID"按钮生成 UUID',
  "点击单个 UUID 右侧的复制按钮复制该 UUID",
  '点击"复制全部"按钮复制所有生成的 UUID',
];

// 常见问题数据
const faqs = [
  {
    question: "什么是 UUID？",
    answer: "UUID（Universally Unique Identifier）是一种 128 位的唯一标识符，也称为 GUID。它被设计为在全球范围内具有唯一性，常用于数据库主键、分布式系统标识等场景。",
  },
  {
    question: "UUID v4 是如何生成的？",
    answer: "UUID v4 是基于随机数生成的。本工具使用浏览器的 crypto.randomUUID() 或 crypto.getRandomValues() API 生成加密安全的随机 UUID。",
  },
  {
    question: "UUID 会重复吗？",
    answer: "理论上 UUID 可能重复，但概率极低。UUID v4 有 2^122 种可能的组合，实际应用中可以认为是唯一的。",
  },
  {
    question: "不同格式的 UUID 有什么区别？",
    answer: "UUID 的值是相同的，只是显示格式不同。带连字符的格式（如 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）是最常见的标准格式，而不带连字符的格式更紧凑。花括号格式常用于 Windows 系统。",
  },
];

// 使用示例数据
const examples = [
  {
    input: "用户ID",
    output: "morijiu-e29b-41d4-a716-446655440000",
    description: "用于唯一标识用户",
  },
  {
    input: "工具ID",
    output: "tools-550e-8400-e29b-41d4a7164466",
    description: "用于工具配置标识",
  },
  {
    input: "会话ID",
    output: "{session-8400-e29b-41d4-a716-446655}",
    description: "用于追踪用户会话",
  },
];

// 生成单个 UUID
const generateSingleUuid = () => {
  let uuid;

  // 优先使用 crypto.randomUUID()，不支持则使用 fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    uuid = crypto.randomUUID();
  } else {
    // Fallback: 使用 crypto.getRandomValues()
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const array = new Uint8Array(1);
      crypto.getRandomValues(array);
      const r = array[0] % 16;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  return uuid;
};

// 格式化 UUID
const formatUuid = (uuid) => {
  let result = uuid;

  // 移除或保留连字符
  if (!options.value.withHyphens) {
    result = result.replace(/-/g, '');
  }

  // 大小写转换
  if (options.value.uppercase) {
    result = result.toUpperCase();
  }

  // 添加花括号
  if (options.value.withBraces) {
    result = `{${result}}`;
  }

  return result;
};

// 生成 UUID 列表
const generateUuids = () => {
  const count = Math.min(Math.max(1, options.value.count), 100);
  const newUuids = [];

  for (let i = 0; i < count; i++) {
    const uuid = generateSingleUuid();
    newUuids.push(formatUuid(uuid));
  }

  uuidList.value = newUuids;
  statusMessage.value = `✓ 成功生成 ${count} 个 UUID`;
  statusType.value = "success";
};

// 复制单个 UUID
const copySingle = async (uuid) => {
  try {
    await navigator.clipboard.writeText(uuid);
    statusMessage.value = "✓ 已复制到剪贴板";
    statusType.value = "success";
    setTimeout(() => {
      statusMessage.value = "";
    }, 2000);
  } catch (error) {
    statusMessage.value = "✗ 复制失败，请手动复制";
    statusType.value = "error";
  }
};

// 复制全部 UUID
const copyOutput = async () => {
  if (!uuidList.value.length) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  try {
    const text = uuidList.value.join('\n');
    await navigator.clipboard.writeText(text);
    statusMessage.value = `✓ 已复制 ${uuidList.value.length} 个 UUID 到剪贴板`;
    statusType.value = "success";
    setTimeout(() => {
      statusMessage.value = "";
    }, 2000);
  } catch (error) {
    statusMessage.value = "✗ 复制失败，请手动复制";
    statusType.value = "error";
  }
};

// 清空内容
const clearAll = () => {
  uuidList.value = [];
  statusMessage.value = "";
};

// 使用示例
const useExample = (example) => {
  if (example.input === "标准格式") {
    options.value.withHyphens = true;
    options.value.withBraces = false;
    options.value.uppercase = false;
  } else if (example.input === "无连字符") {
    options.value.withHyphens = false;
    options.value.withBraces = false;
    options.value.uppercase = false;
  } else if (example.input === "带花括号") {
    options.value.withHyphens = true;
    options.value.withBraces = true;
    options.value.uppercase = false;
  }
  options.value.count = 1;
  generateUuids();
};
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
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
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
  background: #667eea;
  border-color: #667eea;
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

