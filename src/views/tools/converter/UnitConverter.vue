<template>
  <div class="unit-converter">
    <h1>单位转换工具</h1>
    <p class="description">
      在线单位转换工具，支持长度、重量、温度、面积、体积、时间等常用单位转换
    </p>

    <div class="tool-container">
      <!-- 单位类型选择 -->
      <div class="category-tabs">
        <button
          v-for="category in categories"
          :key="category.id"
          :class="['tab-btn', { active: currentCategory === category.id }]"
          @click="switchCategory(category.id)"
        >
          <span class="tab-icon">{{ category.icon }}</span>
          <span class="tab-name">{{ category.name }}</span>
        </button>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="convert">
          <span class="icon">🔄</span> 转换
        </button>
        <button class="btn btn-secondary" @click="swapUnits">
          <span class="icon">⇄</span> 交换单位
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyResult">
          <span class="icon">📋</span> 复制结果
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 转换区域 -->
      <div class="converter-area">
        <!-- 输入区域 -->
        <div class="converter-panel">
          <div class="panel-header">
            <label>输入值</label>
            <select aria-label="输入值单位" v-model="fromUnit" class="unit-select" @change="convert">
              <option v-for="unit in currentUnits" :key="unit.id" :value="unit.id">
                {{ unit.name }} ({{ unit.symbol }})
              </option>
            </select>
          </div>
          <input aria-label="输入值"
            v-model="inputValue"
            type="text"
            inputmode="decimal"
            class="value-input"
            placeholder="输入数值"
            @input="convert"
          />
        </div>

        <!-- 箭头 -->
        <div class="arrow-container">
          <span class="arrow">→</span>
        </div>

        <!-- 输出区域 -->
        <div class="converter-panel">
          <div class="panel-header">
            <label>输出值</label>
            <select aria-label="输出值单位" v-model="toUnit" class="unit-select" @change="convert">
              <option v-for="unit in currentUnits" :key="unit.id" :value="unit.id">
                {{ unit.name }} ({{ unit.symbol }})
              </option>
            </select>
          </div>
          <div class="value-output">
            {{ outputValue || '转换结果' }}
          </div>
        </div>
      </div>

      <!-- 常用转换快捷按钮 -->
      <div class="quick-conversions" v-if="quickConversions.length > 0">
        <h3>常用转换</h3>
        <div class="quick-btns">
          <button
            v-for="(qc, index) in quickConversions"
            :key="index"
            class="quick-btn"
            @click="applyQuickConversion(qc)"
          >
            {{ qc.label }}
          </button>
        </div>
      </div>

      <!-- 转换公式说明 -->
      <div class="formula-info" v-if="currentFormula">
        <h3>转换公式</h3>
        <div class="formula-content">{{ currentFormula }}</div>
      </div>

      <!-- 全量对照（当前输入换算到本类全部单位） -->
      <div class="unit-reference" v-if="allResults.length > 0">
        <h3>全量对照</h3>
        <div class="reference-table">
          <button v-for="row in allResults" :key="row.id" class="reference-row all-row" @click="copyText(formatResult(row.value) + ' ' + row.symbol)" :title="'点击复制 ' + row.name">
            <span class="unit-name">{{ row.name }}</span>
            <span class="unit-symbol">{{ formatResult(row.value) }} {{ row.symbol }}</span>
          </button>
        </div>
      </div>

      <!-- 单位参考表 -->
      <div class="unit-reference">
        <h3>{{ getCategoryName(currentCategory) }}单位参考</h3>
        <div class="reference-table">
          <div v-for="unit in currentUnits" :key="unit.id" class="reference-row">
            <span class="unit-name">{{ unit.name }}</span>
            <span class="unit-symbol">{{ unit.symbol }}</span>
            <span class="unit-ratio">1 {{ baseUnit?.symbol }} = {{ getConversionRatio(unit) }} {{ unit.symbol }}</span>
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
import { ref, computed, watch } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import { UNIT_CATEGORIES, UNIT_DATA, parseValueStrict, convertUnit, convertAll, formatResult, ratioFromBase, getUnit } from "@/utils/unitConvert.js";

// 响应式状态
const inputValue = ref("");
const outputValue = ref("");
const currentCategory = ref("length");
const fromUnit = ref("");
const toUnit = ref("");
const statusMessage = ref("");
const statusType = ref("");

// 单位类别（数据与精确系数在 utils/unitConvert.js）
const categories = UNIT_CATEGORIES.map((c) => ({ ...c, icon: { length: "📏", weight: "⚖️", temperature: "🌡️", area: "📐", volume: "🧊", time: "⏱️", speed: "🚀", data: "💾" }[c.id] || "🔄" }));
const unitData = UNIT_DATA;

// 计算属性
const currentUnits = computed(() => unitData[currentCategory.value] || []);
const baseUnit = computed(() => {
  const cat = UNIT_CATEGORIES.find((c) => c.id === currentCategory.value);
  return currentUnits.value.find((u) => u.id === cat?.base);
});
const allResults = ref([]);

// 常用转换快捷按钮
const quickConversions = computed(() => {
  const quick = {
    length: [
      { label: "米 → 英尺", from: "m", to: "foot" },
      { label: "千米 → 英里", from: "km", to: "mile" },
      { label: "厘米 → 英寸", from: "cm", to: "inch" },
      { label: "米 → 尺", from: "m", to: "chi" },
    ],
    weight: [
      { label: "千克 → 磅", from: "kg", to: "lb" },
      { label: "千克 → 斤", from: "kg", to: "jin" },
      { label: "克 → 盎司", from: "g", to: "oz" },
    ],
    temperature: [
      { label: "摄氏 → 华氏", from: "c", to: "f" },
      { label: "华氏 → 摄氏", from: "f", to: "c" },
      { label: "摄氏 → 开尔文", from: "c", to: "k" },
    ],
    area: [
      { label: "平方米 → 平方英尺", from: "m2", to: "ft2" },
      { label: "公顷 → 亩", from: "ha", to: "mu" },
    ],
    volume: [
      { label: "升 → 加仑", from: "l", to: "gal" },
      { label: "毫升 → 杯", from: "ml", to: "cup" },
    ],
    time: [
      { label: "小时 → 分钟", from: "h", to: "min" },
      { label: "天 → 小时", from: "d", to: "h" },
    ],
    speed: [
      { label: "千米/时 → 米/秒", from: "kmph", to: "mps" },
      { label: "千米/时 → 英里/时", from: "kmph", to: "mph" },
    ],
    data: [
      { label: "MB → GB", from: "mb", to: "gb" },
      { label: "GB → TB", from: "gb", to: "tb" },
    ],
  };
  return quick[currentCategory.value] || [];
});

// 当前转换公式
const currentFormula = computed(() => {
  if (!fromUnit.value || !toUnit.value || !inputValue.value || !outputValue.value) return "";
  const fromU = currentUnits.value.find((u) => u.id === fromUnit.value);
  const toU = currentUnits.value.find((u) => u.id === toUnit.value);
  if (!fromU || !toU) return "";
  if (currentCategory.value === "temperature") return getTemperatureFormula(fromUnit.value, toUnit.value);
  const ratio = fromU.factor / toU.factor;
  return `${inputValue.value} ${fromU.symbol} × ${ratio.toPrecision(6)} = ${outputValue.value} ${toU.symbol}`;
});

const getTemperatureFormula = (from, to) => {
  const formulas = {
    c_f: "°F = °C × 9/5 + 32", f_c: "°C = (°F - 32) × 5/9", c_k: "K = °C + 273.15",
    k_c: "°C = K - 273.15", f_k: "K = (°F - 32) × 5/9 + 273.15", k_f: "°F = (K - 273.15) × 9/5 + 32",
  };
  return formulas[`${from}_${to}`] || "同单位无需换算";
};

const formatNumber = formatResult;

// 严格校验后换算：非法字符定位、温度绝对零度、溢出都明确报错，不静默截断
const convert = () => {
  if (!String(inputValue.value).trim() || !fromUnit.value || !toUnit.value) {
    outputValue.value = ""; allResults.value = []; if (!String(inputValue.value).trim()) statusMessage.value = "";
    return;
  }
  try {
    const value = parseValueStrict(inputValue.value);
    const result = convertUnit(value, currentCategory.value, fromUnit.value, toUnit.value);
    outputValue.value = formatResult(result);
    allResults.value = convertAll(value, currentCategory.value, fromUnit.value);
    statusMessage.value = "✓ 转换成功！"; statusType.value = "success";
  } catch (error) {
    outputValue.value = ""; allResults.value = [];
    statusMessage.value = `✗ ${error.message}`; statusType.value = "error";
  }
};

const switchCategory = (categoryId) => {
  currentCategory.value = categoryId;
  const units = unitData[categoryId];
  if (units && units.length >= 2) { fromUnit.value = units[0].id; toUnit.value = units[1].id; }
  outputValue.value = ""; allResults.value = [];
  if (inputValue.value) convert();
};

const swapUnits = () => { const t = fromUnit.value; fromUnit.value = toUnit.value; toUnit.value = t; convert(); };
const clearAll = () => { inputValue.value = ""; outputValue.value = ""; allResults.value = []; statusMessage.value = ""; };

const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); statusMessage.value = "✓ 已复制到剪贴板！"; statusType.value = "success"; setTimeout(() => (statusMessage.value = ""), 2000); }
  catch { statusMessage.value = "✗ 复制失败"; statusType.value = "error"; }
};
const copyResult = async () => {
  if (!outputValue.value) { statusMessage.value = "✗ 没有可复制的内容"; statusType.value = "error"; return; }
  const toU = currentUnits.value.find((u) => u.id === toUnit.value);
  await copyText(`${outputValue.value} ${toU?.symbol || ""}`);
};

const applyQuickConversion = (qc) => { fromUnit.value = qc.from; toUnit.value = qc.to; if (inputValue.value) convert(); };
const getCategoryName = (categoryId) => categories.find((c) => c.id === categoryId)?.name || "";
const getConversionRatio = (unit) => {
  if (currentCategory.value === "temperature") return "—";
  const ratio = ratioFromBase(currentCategory.value, unit.id);
  return ratio === null ? "—" : formatResult(ratio);
};

// 使用示例
const useExample = (example) => {
  // 如果示例有指定类别，先切换类别
  if (example.category && example.category !== currentCategory.value) {
    currentCategory.value = example.category;
  }
  inputValue.value = example.input;
  fromUnit.value = example.from || fromUnit.value;
  toUnit.value = example.to || toUnit.value;
  convert();
};

// 初始化
watch(currentCategory, () => {}, { immediate: true });

// 初始设置默认单位
const initDefaultUnits = () => {
  const units = currentUnits.value;
  if (units.length >= 2) {
    fromUnit.value = units[0].id;
    toUnit.value = units[1].id;
  }
};
initDefaultUnits();

// 功能特点
const features = [
  { icon: "📏", title: "长度转换", description: "支持公制、英制、中国传统等多种长度单位" },
  { icon: "⚖️", title: "重量转换", description: "千克、磅、斤等重量单位互转" },
  { icon: "🌡️", title: "温度转换", description: "摄氏、华氏、开尔文温度互转" },
  { icon: "📐", title: "面积转换", description: "平方米、公顷、亩等面积单位" },
  { icon: "🧊", title: "体积转换", description: "升、加仑、立方米等体积单位" },
  { icon: "💾", title: "数据单位", description: "字节、KB、MB、GB等存储单位" },
];

// 使用说明
const usageSteps = [
  "选择要转换的单位类别（长度、重量、温度等）",
  "在输入框中输入需要转换的数值",
  "选择源单位和目标单位",
  "系统自动计算并显示转换结果",
  "点击「复制结果」可复制转换后的值",
];

// 常见问题
const faqs = [
  {
    question: "温度转换的公式是什么？",
    answer: "摄氏转华氏：°F = °C × 9/5 + 32；华氏转摄氏：°C = (°F - 32) × 5/9；摄氏转开尔文：K = °C + 273.15",
  },
  {
    question: "1斤等于多少千克？",
    answer: "1斤等于0.5千克（500克），这是中国市制重量单位。1千克等于2斤。",
  },
  {
    question: "英尺和米如何换算？",
    answer: "1米约等于3.281英尺，1英尺约等于0.305米。",
  },
  {
    question: "温度为什么不能低于 -273.15°C？",
    answer: "-273.15°C（0 K、-459.67°F）是绝对零度，物理上温度不可能更低；输入低于绝对零度会直接报错，而不是给出一个不存在的结果。",
  },
  {
    question: "输入 12abc 或 1e999 会怎样？",
    answer: "会明确报错并指出问题位置：非法字符会定位到第几个字符，科学计数法不完整或数值溢出也会单独提示，不会像 parseFloat 那样静默截断成 12。",
  },
  {
    question: "数据存储单位之间的换算关系？",
    answer: "1KB = 1024字节，1MB = 1024KB，1GB = 1024MB，1TB = 1024GB。",
  },
];

// 使用示例
const examples = [
  { input: "1024", from: "mb", to: "gb", category: "data", output: "1 GB", description: "文件大小转换" },
  { input: "500", from: "ms", to: "s", category: "time", output: "0.5 s", description: "API响应时间" },
  { input: "100", from: "cm", to: "inch", category: "length", output: "39.37 in", description: "屏幕尺寸转换" },
];
</script>

<style scoped>
.unit-converter {
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

/* 分类标签 */
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.tab-btn.active {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  color: white;
  border-color: transparent;
}

.tab-icon {
  font-size: 18px;
}

/* 转换区域 */
.converter-area {
  display: flex;
  align-items: stretch;
  gap: 20px;
  margin-bottom: 30px;
}

.converter-panel {
  flex: 1;
  background: var(--bg);
  border-radius: 12px;
  padding: 20px;
  border: 2px solid var(--border);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header label {
  font-weight: 600;
  color: var(--text-strong);
  font-size: 16px;
}

.unit-select {
  padding: 8px 12px;
  border: 2px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--surface);
  cursor: pointer;
  min-width: 180px;
}

.unit-select:focus {
  outline: none;
  border-color: var(--accent);
}

.value-input {
  width: 100%;
  padding: 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 24px;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: center;
}

.value-input:focus {
  outline: none;
  border-color: var(--accent);
}

.value-output {
  width: 100%;
  padding: 16px;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 24px;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: center;
  color: var(--accent);
  font-weight: 600;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow {
  font-size: 32px;
  color: var(--accent);
}

/* 快捷转换 */
.quick-conversions {
  margin-bottom: 24px;
}

.quick-conversions h3 {
  font-size: 16px;
  color: var(--text-strong);
  margin-bottom: 12px;
}

.quick-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-btn {
  padding: 8px 16px;
  border: 1px solid var(--accent);
  border-radius: 20px;
  background: var(--surface);
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.quick-btn:hover {
  background: var(--accent);
  color: white;
}

/* 公式说明 */
.formula-info {
  background: var(--accent-soft);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 24px;
}

.formula-info h3 {
  font-size: 14px;
  color: var(--accent);
  margin-bottom: 8px;
}

.formula-content {
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-strong);
  font-size: 15px;
}

/* 单位参考表 */
.unit-reference {
  margin-bottom: 30px;
}

.unit-reference h3 {
  font-size: 18px;
  color: var(--text-strong);
  margin-bottom: 16px;
}

.reference-table {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.all-row { cursor: pointer; border: 1px solid var(--border); text-align: left; width: 100%; }
.all-row:hover { border-color: var(--accent); }
.reference-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg);
  border-radius: 6px;
  font-size: 14px;
}

.unit-name {
  color: var(--text-strong);
  font-weight: 500;
}

.unit-symbol {
  color: var(--accent);
  font-family: 'Consolas', 'Monaco', monospace;
}

.unit-ratio {
  color: var(--text-3, var(--text-2));
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .converter-area {
    flex-direction: column;
  }

  .arrow-container {
    transform: rotate(90deg);
  }

  .category-tabs {
    justify-content: center;
  }

  .tab-btn {
    padding: 8px 12px;
    font-size: 13px;
  }

  .tab-name {
    display: none;
  }

  .unit-select {
    min-width: 140px;
  }
}

@media (max-width: 480px) {
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .unit-select {
    width: 100%;
  }

  .value-input,
  .value-output {
    font-size: 20px;
  }
}
</style>

