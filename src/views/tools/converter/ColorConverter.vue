<template>
  <div class="color-converter">
    <h1>颜色转换工具</h1>
    <p class="description">
      在线颜色转换工具，支持 RGB、HEX、HSL、HSV、CMYK 等颜色格式互转
    </p>

    <div class="tool-container">
      <!-- 颜色预览区域 -->
      <div class="color-preview-section">
        <div 
          class="color-preview-box"
          :style="{ backgroundColor: currentHex }"
        >
          <span class="preview-label">颜色预览</span>
        </div>
        <div class="color-picker-wrapper">
          <label>选择颜色:</label>
          <input 
            type="color" 
            v-model="pickerColor"
            @input="onColorPickerChange"
            class="color-picker"
          />
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="randomColor">
          <span class="icon">🎲</span> 随机颜色
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
        <button class="btn btn-success" @click="copyAllFormats">
          <span class="icon">📋</span> 复制所有格式
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 颜色输入区域 -->
      <div class="color-inputs-grid">
        <!-- HEX 输入 -->
        <div class="color-input-card">
          <label class="input-label">HEX</label>
          <div class="input-row">
            <input 
              v-model="hexInput" 
              type="text" 
              class="color-input"
              placeholder="#FF5733"
              @input="onHexChange"
            />
            <button class="copy-btn" @click="copyValue(hexInput, 'HEX')">📋</button>
          </div>
          <span class="format-hint">格式: #RRGGBB 或 #RGB</span>
        </div>

        <!-- RGB 输入 -->
        <div class="color-input-card">
          <label class="input-label">RGB</label>
          <div class="input-row rgb-inputs">
            <input v-model.number="rgb.r" type="number" min="0" max="255" placeholder="R" @input="onRgbChange" />
            <input v-model.number="rgb.g" type="number" min="0" max="255" placeholder="G" @input="onRgbChange" />
            <input v-model.number="rgb.b" type="number" min="0" max="255" placeholder="B" @input="onRgbChange" />
            <button class="copy-btn" @click="copyValue(rgbString, 'RGB')">📋</button>
          </div>
          <span class="format-hint">范围: 0-255</span>
        </div>

        <!-- HSL 输入 -->
        <div class="color-input-card">
          <label class="input-label">HSL</label>
          <div class="input-row hsl-inputs">
            <input v-model.number="hsl.h" type="number" min="0" max="360" placeholder="H" @input="onHslChange" />
            <input v-model.number="hsl.s" type="number" min="0" max="100" placeholder="S" @input="onHslChange" />
            <input v-model.number="hsl.l" type="number" min="0" max="100" placeholder="L" @input="onHslChange" />
            <button class="copy-btn" @click="copyValue(hslString, 'HSL')">📋</button>
          </div>
          <span class="format-hint">H: 0-360°, S/L: 0-100%</span>
        </div>

        <!-- HSV/HSB 输入 -->
        <div class="color-input-card">
          <label class="input-label">HSV / HSB</label>
          <div class="input-row hsv-inputs">
            <input v-model.number="hsv.h" type="number" min="0" max="360" placeholder="H" @input="onHsvChange" />
            <input v-model.number="hsv.s" type="number" min="0" max="100" placeholder="S" @input="onHsvChange" />
            <input v-model.number="hsv.v" type="number" min="0" max="100" placeholder="V" @input="onHsvChange" />
            <button class="copy-btn" @click="copyValue(hsvString, 'HSV')">📋</button>
          </div>
          <span class="format-hint">H: 0-360°, S/V: 0-100%</span>
        </div>

        <!-- CMYK 输入 -->
        <div class="color-input-card">
          <label class="input-label">CMYK</label>
          <div class="input-row cmyk-inputs">
            <input v-model.number="cmyk.c" type="number" min="0" max="100" placeholder="C" @input="onCmykChange" />
            <input v-model.number="cmyk.m" type="number" min="0" max="100" placeholder="M" @input="onCmykChange" />
            <input v-model.number="cmyk.y" type="number" min="0" max="100" placeholder="Y" @input="onCmykChange" />
            <input v-model.number="cmyk.k" type="number" min="0" max="100" placeholder="K" @input="onCmykChange" />
            <button class="copy-btn" @click="copyValue(cmykString, 'CMYK')">📋</button>
          </div>
          <span class="format-hint">范围: 0-100%</span>
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
import { ref, computed } from "vue";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";

// 响应式状态
const hexInput = ref("#667EEA");
const pickerColor = ref("#667EEA");
const rgb = ref({ r: 102, g: 126, b: 234 });
const hsl = ref({ h: 229, s: 76, l: 66 });
const hsv = ref({ h: 229, s: 56, v: 92 });
const cmyk = ref({ c: 56, m: 46, y: 0, k: 8 });
const statusMessage = ref("");
const statusType = ref("");

// 计算属性
const currentHex = computed(() => hexInput.value || "#FFFFFF");
const rgbString = computed(() => `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})`);
const hslString = computed(() => `hsl(${hsl.value.h}, ${hsl.value.s}%, ${hsl.value.l}%)`);
const hsvString = computed(() => `hsv(${hsv.value.h}, ${hsv.value.s}%, ${hsv.value.v}%)`);
const cmykString = computed(() => `cmyk(${cmyk.value.c}%, ${cmyk.value.m}%, ${cmyk.value.y}%, ${cmyk.value.k}%)`);

// ===== 颜色转换函数 =====

// HEX 转 RGB
const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map(c => c + c).join("");
  }
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

// RGB 转 HEX
const rgbToHex = (r, g, b) => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
};

// RGB 转 HSL
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// HSL 转 RGB
const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

// RGB 转 HSV
const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) { h = 0; }
  else {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
};

// HSV 转 RGB
const hsvToRgb = (h, s, v) => {
  h /= 360; s /= 100; v /= 100;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

// RGB 转 CMYK
const rgbToCmyk = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round((1 - r - k) / (1 - k) * 100),
    m: Math.round((1 - g - k) / (1 - k) * 100),
    y: Math.round((1 - b - k) / (1 - k) * 100),
    k: Math.round(k * 100)
  };
};

// CMYK 转 RGB
const cmykToRgb = (c, m, y, k) => {
  c /= 100; m /= 100; y /= 100; k /= 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k))
  };
};

// 更新所有颜色格式（从RGB出发）
const updateAllFromRgb = () => {
  const { r, g, b } = rgb.value;
  hexInput.value = rgbToHex(r, g, b);
  pickerColor.value = hexInput.value;
  hsl.value = rgbToHsl(r, g, b);
  hsv.value = rgbToHsv(r, g, b);
  cmyk.value = rgbToCmyk(r, g, b);
};

// ===== 事件处理 =====
const onColorPickerChange = () => {
  hexInput.value = pickerColor.value.toUpperCase();
  rgb.value = hexToRgb(pickerColor.value);
  updateAllFromRgb();
};

const onHexChange = () => {
  const hex = hexInput.value.trim();
  if (/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    const fullHex = hex.startsWith("#") ? hex : "#" + hex;
    hexInput.value = fullHex.toUpperCase();
    rgb.value = hexToRgb(fullHex);
    updateAllFromRgb();
  }
};

const onRgbChange = () => { updateAllFromRgb(); };

const onHslChange = () => {
  rgb.value = hslToRgb(hsl.value.h, hsl.value.s, hsl.value.l);
  hexInput.value = rgbToHex(rgb.value.r, rgb.value.g, rgb.value.b);
  pickerColor.value = hexInput.value;
  hsv.value = rgbToHsv(rgb.value.r, rgb.value.g, rgb.value.b);
  cmyk.value = rgbToCmyk(rgb.value.r, rgb.value.g, rgb.value.b);
};

const onHsvChange = () => {
  rgb.value = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
  hexInput.value = rgbToHex(rgb.value.r, rgb.value.g, rgb.value.b);
  pickerColor.value = hexInput.value;
  hsl.value = rgbToHsl(rgb.value.r, rgb.value.g, rgb.value.b);
  cmyk.value = rgbToCmyk(rgb.value.r, rgb.value.g, rgb.value.b);
};

const onCmykChange = () => {
  rgb.value = cmykToRgb(cmyk.value.c, cmyk.value.m, cmyk.value.y, cmyk.value.k);
  hexInput.value = rgbToHex(rgb.value.r, rgb.value.g, rgb.value.b);
  pickerColor.value = hexInput.value;
  hsl.value = rgbToHsl(rgb.value.r, rgb.value.g, rgb.value.b);
  hsv.value = rgbToHsv(rgb.value.r, rgb.value.g, rgb.value.b);
};

// 随机颜色
const randomColor = () => {
  rgb.value = { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256) };
  updateAllFromRgb();
  statusMessage.value = "✓ 已生成随机颜色！";
  statusType.value = "success";
};

// 清空
const clearAll = () => {
  hexInput.value = "#FFFFFF";
  pickerColor.value = "#FFFFFF";
  rgb.value = { r: 255, g: 255, b: 255 };
  hsl.value = { h: 0, s: 0, l: 100 };
  hsv.value = { h: 0, s: 0, v: 100 };
  cmyk.value = { c: 0, m: 0, y: 0, k: 0 };
  statusMessage.value = "";
};

// 复制到剪贴板
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
};

const copyValue = async (value, format) => {
  if (await copyToClipboard(value)) {
    statusMessage.value = `✓ 已复制 ${format} 值！`;
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  } else {
    statusMessage.value = "✗ 复制失败";
    statusType.value = "error";
  }
};

const copyAllFormats = async () => {
  const text = `HEX: ${hexInput.value}\nRGB: ${rgbString.value}\nHSL: ${hslString.value}\nHSV: ${hsvString.value}\nCMYK: ${cmykString.value}`;
  if (await copyToClipboard(text)) {
    statusMessage.value = "✓ 已复制所有格式！";
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  }
};

// 使用示例
const useExample = (example) => {
  hexInput.value = example.input;
  rgb.value = hexToRgb(example.input);
  updateAllFromRgb();
};

// 功能特点
const features = [
  { icon: "🎨", title: "多格式支持", description: "支持 HEX、RGB、HSL、HSV、CMYK 五种颜色格式" },
  { icon: "🔄", title: "实时转换", description: "修改任意格式，其他格式自动同步更新" },
  { icon: "👁️", title: "颜色预览", description: "实时预览当前颜色效果" },
  { icon: "🎲", title: "随机颜色", description: "一键生成随机颜色" },
  { icon: "📋", title: "一键复制", description: "快速复制任意格式的颜色值" },
  { icon: "🖌️", title: "颜色选择器", description: "支持系统颜色选择器快速取色" },
];

// 使用说明
const usageSteps = [
  "在任意颜色格式输入框中输入颜色值",
  "其他格式会自动同步转换",
  "点击颜色选择器可以直接选取颜色",
  "点击「随机颜色」生成随机颜色",
  "点击对应格式的复制按钮复制颜色值",
];

// 常见问题
const faqs = [
  { question: "HEX 颜色格式是什么？", answer: "HEX 是十六进制颜色表示法，格式为 #RRGGBB，每两位代表红、绿、蓝的强度（00-FF）。例如 #FF0000 表示纯红色。" },
  { question: "RGB 和 HSL 有什么区别？", answer: "RGB 基于红绿蓝三原色混合，适合屏幕显示；HSL 基于色相、饱和度、亮度，更符合人类对颜色的直觉理解，便于调整颜色。" },
  { question: "CMYK 颜色用在什么场景？", answer: "CMYK 是印刷色彩模式，由青(Cyan)、品红(Magenta)、黄(Yellow)、黑(Key)四色组成，用于打印和印刷行业。" },
  { question: "为什么转换后颜色有轻微差异？", answer: "不同颜色模式的色域范围不同，某些颜色在转换时可能会有轻微的四舍五入误差，这是正常现象。" },
];

// 使用示例
const examples = [
  { input: "#667EEA", output: "rgb(102, 126, 234)", description: "极速工具箱主题蓝" },
  { input: "#764BA2", output: "rgb(118, 75, 162)", description: "极速工具箱渐变紫" },
  { input: "#2ECC71", output: "rgb(46, 204, 113)", description: "成功状态绿" },
];
</script>

<style scoped>
.color-converter {
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

/* 颜色预览区域 */
.color-preview-section {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg);
  border-radius: 10px;
}

.color-preview-box {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
  border: 3px solid white;
}

.preview-label {
  font-size: 12px;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 8px;
  border-radius: 4px;
}

.color-picker-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-picker-wrapper label {
  font-weight: 600;
  color: var(--text-strong);
}

.color-picker {
  width: 60px;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

/* 颜色输入网格 */
.color-inputs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.color-input-card {
  background: var(--bg);
  padding: 20px;
  border-radius: 10px;
  border: 2px solid var(--border);
  transition: border-color 0.3s;
}

.color-input-card:hover {
  border-color: #667eea;
}

.input-label {
  display: block;
  font-weight: 700;
  font-size: 16px;
  color: var(--text-strong);
  margin-bottom: 12px;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: border-color 0.3s;
}

.color-input:focus {
  outline: none;
  border-color: #667eea;
}

.rgb-inputs input,
.hsl-inputs input,
.hsv-inputs input,
.cmyk-inputs input {
  width: 70px;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: center;
}

.rgb-inputs input:focus,
.hsl-inputs input:focus,
.hsv-inputs input:focus,
.cmyk-inputs input:focus {
  outline: none;
  border-color: #667eea;
}

.copy-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.copy-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.format-hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .color-preview-section {
    flex-direction: column;
    text-align: center;
  }

  .color-inputs-grid {
    grid-template-columns: 1fr;
  }

  .rgb-inputs input,
  .hsl-inputs input,
  .hsv-inputs input,
  .cmyk-inputs input {
    width: 50px;
    padding: 8px;
  }
}
</style>

