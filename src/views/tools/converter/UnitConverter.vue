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
            <select v-model="fromUnit" class="unit-select" @change="convert">
              <option v-for="unit in currentUnits" :key="unit.id" :value="unit.id">
                {{ unit.name }} ({{ unit.symbol }})
              </option>
            </select>
          </div>
          <input
            v-model="inputValue"
            type="number"
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
            <select v-model="toUnit" class="unit-select" @change="convert">
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

// 响应式状态
const inputValue = ref("");
const outputValue = ref("");
const currentCategory = ref("length");
const fromUnit = ref("");
const toUnit = ref("");
const statusMessage = ref("");
const statusType = ref("");

// 单位类别
const categories = [
  { id: "length", name: "长度", icon: "📏" },
  { id: "weight", name: "重量", icon: "⚖️" },
  { id: "temperature", name: "温度", icon: "🌡️" },
  { id: "area", name: "面积", icon: "📐" },
  { id: "volume", name: "体积", icon: "🧊" },
  { id: "time", name: "时间", icon: "⏱️" },
  { id: "speed", name: "速度", icon: "🚀" },
  { id: "data", name: "数据", icon: "💾" },
];

// 单位数据 - 以基础单位为1的比率
const unitData = {
  length: {
    base: "m",
    units: [
      { id: "km", name: "千米", symbol: "km", ratio: 0.001 },
      { id: "m", name: "米", symbol: "m", ratio: 1 },
      { id: "dm", name: "分米", symbol: "dm", ratio: 10 },
      { id: "cm", name: "厘米", symbol: "cm", ratio: 100 },
      { id: "mm", name: "毫米", symbol: "mm", ratio: 1000 },
      { id: "um", name: "微米", symbol: "μm", ratio: 1000000 },
      { id: "nm", name: "纳米", symbol: "nm", ratio: 1000000000 },
      { id: "mile", name: "英里", symbol: "mi", ratio: 0.000621371 },
      { id: "yard", name: "码", symbol: "yd", ratio: 1.09361 },
      { id: "foot", name: "英尺", symbol: "ft", ratio: 3.28084 },
      { id: "inch", name: "英寸", symbol: "in", ratio: 39.3701 },
      { id: "li", name: "里", symbol: "里", ratio: 0.002 },
      { id: "zhang", name: "丈", symbol: "丈", ratio: 0.3 },
      { id: "chi", name: "尺", symbol: "尺", ratio: 3 },
      { id: "cun", name: "寸", symbol: "寸", ratio: 30 },
    ],
  },
  weight: {
    base: "kg",
    units: [
      { id: "t", name: "吨", symbol: "t", ratio: 0.001 },
      { id: "kg", name: "千克", symbol: "kg", ratio: 1 },
      { id: "g", name: "克", symbol: "g", ratio: 1000 },
      { id: "mg", name: "毫克", symbol: "mg", ratio: 1000000 },
      { id: "ug", name: "微克", symbol: "μg", ratio: 1000000000 },
      { id: "lb", name: "磅", symbol: "lb", ratio: 2.20462 },
      { id: "oz", name: "盎司", symbol: "oz", ratio: 35.274 },
      { id: "jin", name: "斤", symbol: "斤", ratio: 2 },
      { id: "liang", name: "两", symbol: "两", ratio: 20 },
      { id: "qian", name: "钱", symbol: "钱", ratio: 200 },
    ],
  },
  temperature: {
    base: "c",
    units: [
      { id: "c", name: "摄氏度", symbol: "°C", ratio: 1 },
      { id: "f", name: "华氏度", symbol: "°F", ratio: 1 },
      { id: "k", name: "开尔文", symbol: "K", ratio: 1 },
    ],
  },
  area: {
    base: "m2",
    units: [
      { id: "km2", name: "平方千米", symbol: "km²", ratio: 0.000001 },
      { id: "ha", name: "公顷", symbol: "ha", ratio: 0.0001 },
      { id: "m2", name: "平方米", symbol: "m²", ratio: 1 },
      { id: "dm2", name: "平方分米", symbol: "dm²", ratio: 100 },
      { id: "cm2", name: "平方厘米", symbol: "cm²", ratio: 10000 },
      { id: "mm2", name: "平方毫米", symbol: "mm²", ratio: 1000000 },
      { id: "acre", name: "英亩", symbol: "acre", ratio: 0.000247105 },
      { id: "mu", name: "亩", symbol: "亩", ratio: 0.0015 },
    ],
  },
  volume: {
    base: "l",
    units: [
      { id: "m3", name: "立方米", symbol: "m³", ratio: 0.001 },
      { id: "l", name: "升", symbol: "L", ratio: 1 },
      { id: "ml", name: "毫升", symbol: "mL", ratio: 1000 },
      { id: "dm3", name: "立方分米", symbol: "dm³", ratio: 1 },
      { id: "cm3", name: "立方厘米", symbol: "cm³", ratio: 1000 },
      { id: "gal", name: "加仑(美)", symbol: "gal", ratio: 0.264172 },
      { id: "qt", name: "夸脱", symbol: "qt", ratio: 1.05669 },
      { id: "pt", name: "品脱", symbol: "pt", ratio: 2.11338 },
      { id: "cup", name: "杯", symbol: "cup", ratio: 4.22675 },
    ],
  },
  time: {
    base: "s",
    units: [
      { id: "y", name: "年", symbol: "年", ratio: 0.0000000317098 },
      { id: "d", name: "天", symbol: "天", ratio: 0.0000115741 },
      { id: "h", name: "小时", symbol: "h", ratio: 0.000277778 },
      { id: "min", name: "分钟", symbol: "min", ratio: 0.0166667 },
      { id: "s", name: "秒", symbol: "s", ratio: 1 },
      { id: "ms", name: "毫秒", symbol: "ms", ratio: 1000 },
      { id: "us", name: "微秒", symbol: "μs", ratio: 1000000 },
      { id: "ns", name: "纳秒", symbol: "ns", ratio: 1000000000 },
    ],
  },
  speed: {
    base: "mps",
    units: [
      { id: "mps", name: "米/秒", symbol: "m/s", ratio: 1 },
      { id: "kmph", name: "千米/时", symbol: "km/h", ratio: 3.6 },
      { id: "mph", name: "英里/时", symbol: "mph", ratio: 2.23694 },
      { id: "knot", name: "节", symbol: "kn", ratio: 1.94384 },
      { id: "mach", name: "马赫", symbol: "Ma", ratio: 0.00293858 },
      { id: "c", name: "光速", symbol: "c", ratio: 3.33564e-9 },
    ],
  },
  data: {
    base: "byte",
    units: [
      { id: "bit", name: "比特", symbol: "bit", ratio: 8 },
      { id: "byte", name: "字节", symbol: "B", ratio: 1 },
      { id: "kb", name: "千字节", symbol: "KB", ratio: 1 / 1024 },
      { id: "mb", name: "兆字节", symbol: "MB", ratio: 1 / (1024 * 1024) },
      { id: "gb", name: "吉字节", symbol: "GB", ratio: 1 / (1024 * 1024 * 1024) },
      { id: "tb", name: "太字节", symbol: "TB", ratio: 1 / (1024 * 1024 * 1024 * 1024) },
      { id: "pb", name: "拍字节", symbol: "PB", ratio: 1 / (1024 * 1024 * 1024 * 1024 * 1024) },
    ],
  },
};

// 计算属性
const currentUnits = computed(() => unitData[currentCategory.value]?.units || []);
const baseUnit = computed(() => {
  const data = unitData[currentCategory.value];
  return data?.units.find((u) => u.id === data.base);
});

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
      { label: "平方米 → 平方英尺", from: "m2", to: "acre" },
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
  if (!fromUnit.value || !toUnit.value || !inputValue.value) return "";
  const fromU = currentUnits.value.find((u) => u.id === fromUnit.value);
  const toU = currentUnits.value.find((u) => u.id === toUnit.value);
  if (!fromU || !toU) return "";

  if (currentCategory.value === "temperature") {
    return getTemperatureFormula(fromUnit.value, toUnit.value);
  }

  const ratio = toU.ratio / fromU.ratio;
  return `${inputValue.value} ${fromU.symbol} × ${ratio.toPrecision(6)} = ${outputValue.value} ${toU.symbol}`;
});

// 温度转换公式
const getTemperatureFormula = (from, to) => {
  const formulas = {
    c_f: "°F = °C × 9/5 + 32",
    f_c: "°C = (°F - 32) × 5/9",
    c_k: "K = °C + 273.15",
    k_c: "°C = K - 273.15",
    f_k: "K = (°F - 32) × 5/9 + 273.15",
    k_f: "°F = (K - 273.15) × 9/5 + 32",
  };
  return formulas[`${from}_${to}`] || "";
};

// 转换逻辑
const convert = () => {
  if (!inputValue.value || !fromUnit.value || !toUnit.value) {
    outputValue.value = "";
    return;
  }

  const value = parseFloat(inputValue.value);
  if (isNaN(value)) {
    outputValue.value = "";
    statusMessage.value = "✗ 请输入有效的数字";
    statusType.value = "error";
    return;
  }

  try {
    let result;
    if (currentCategory.value === "temperature") {
      result = convertTemperature(value, fromUnit.value, toUnit.value);
    } else {
      const fromU = currentUnits.value.find((u) => u.id === fromUnit.value);
      const toU = currentUnits.value.find((u) => u.id === toUnit.value);
      if (!fromU || !toU) return;
      // 先转为基础单位，再转为目标单位
      const baseValue = value / fromU.ratio;
      result = baseValue * toU.ratio;
    }
    outputValue.value = formatNumber(result);
    statusMessage.value = "✓ 转换成功！";
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 转换失败: ${error.message}`;
    statusType.value = "error";
  }
};

// 温度转换
const convertTemperature = (value, from, to) => {
  if (from === to) return value;
  // 先转为摄氏度
  let celsius;
  if (from === "c") celsius = value;
  else if (from === "f") celsius = (value - 32) * (5 / 9);
  else if (from === "k") celsius = value - 273.15;

  // 再转为目标单位
  if (to === "c") return celsius;
  if (to === "f") return celsius * (9 / 5) + 32;
  if (to === "k") return celsius + 273.15;
  return value;
};

// 格式化数字
const formatNumber = (num) => {
  if (Math.abs(num) < 0.000001 || Math.abs(num) > 1000000000) {
    return num.toExponential(6);
  }
  return parseFloat(num.toPrecision(10)).toString();
};

// 切换类别
const switchCategory = (categoryId) => {
  currentCategory.value = categoryId;
  const units = unitData[categoryId]?.units;
  if (units && units.length >= 2) {
    fromUnit.value = units[0].id;
    toUnit.value = units[1].id;
  }
  outputValue.value = "";
  if (inputValue.value) convert();
};

// 交换单位
const swapUnits = () => {
  const temp = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = temp;
  convert();
};

// 清空
const clearAll = () => {
  inputValue.value = "";
  outputValue.value = "";
  statusMessage.value = "";
};

// 复制结果
const copyResult = async () => {
  if (!outputValue.value) {
    statusMessage.value = "✗ 没有可复制的内容";
    statusType.value = "error";
    return;
  }
  try {
    const toU = currentUnits.value.find((u) => u.id === toUnit.value);
    await navigator.clipboard.writeText(`${outputValue.value} ${toU?.symbol || ""}`);
    statusMessage.value = "✓ 已复制到剪贴板！";
    statusType.value = "success";
    setTimeout(() => (statusMessage.value = ""), 2000);
  } catch {
    statusMessage.value = "✗ 复制失败";
    statusType.value = "error";
  }
};

// 应用快捷转换
const applyQuickConversion = (qc) => {
  fromUnit.value = qc.from;
  toUnit.value = qc.to;
  if (inputValue.value) convert();
};

// 获取类别名称
const getCategoryName = (categoryId) => {
  const cat = categories.find((c) => c.id === categoryId);
  return cat?.name || "";
};

// 获取转换比率显示
const getConversionRatio = (unit) => {
  const base = baseUnit.value;
  if (!base || unit.id === base.id) return "1";
  const ratio = unit.ratio / base.ratio;
  return formatNumber(ratio);
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

/* 分类标签 */
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: #667eea;
  background: #f8f9ff;
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #e0e0e0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 16px;
}

.unit-select {
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 180px;
}

.unit-select:focus {
  outline: none;
  border-color: #667eea;
}

.value-input {
  width: 100%;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 24px;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: center;
}

.value-input:focus {
  outline: none;
  border-color: #667eea;
}

.value-output {
  width: 100%;
  padding: 16px;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 24px;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: center;
  color: #667eea;
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
  color: #667eea;
}

/* 快捷转换 */
.quick-conversions {
  margin-bottom: 24px;
}

.quick-conversions h3 {
  font-size: 16px;
  color: #2c3e50;
  margin-bottom: 12px;
}

.quick-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-btn {
  padding: 8px 16px;
  border: 1px solid #667eea;
  border-radius: 20px;
  background: white;
  color: #667eea;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.quick-btn:hover {
  background: #667eea;
  color: white;
}

/* 公式说明 */
.formula-info {
  background: #f0f4ff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 24px;
}

.formula-info h3 {
  font-size: 14px;
  color: #667eea;
  margin-bottom: 8px;
}

.formula-content {
  font-family: 'Consolas', 'Monaco', monospace;
  color: #2c3e50;
  font-size: 15px;
}

/* 单位参考表 */
.unit-reference {
  margin-bottom: 30px;
}

.unit-reference h3 {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 16px;
}

.reference-table {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.reference-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 14px;
}

.unit-name {
  color: #2c3e50;
  font-weight: 500;
}

.unit-symbol {
  color: #667eea;
  font-family: 'Consolas', 'Monaco', monospace;
}

.unit-ratio {
  color: #888;
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

