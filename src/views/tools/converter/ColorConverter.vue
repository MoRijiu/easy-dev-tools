<template>
  <div class="color-converter">
    <h1>颜色转换工具</h1>
    <p class="description">
      在线颜色转换工具，支持 HEX、RGB、HSL、HSV、CMYK、HWB 互转（含透明度），可粘贴任意格式一键识别
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

      <!-- 任意格式解析 -->
      <div class="parse-section">
        <label class="input-label" for="any-color">粘贴任意格式一键识别</label>
        <div class="input-row">
          <input id="any-color" v-model="anyInput" type="text" class="color-input" placeholder="#FF5733 / rgb(255, 87, 51) / hsl(11, 100%, 60%) / orange" @keyup.enter="parseAny" />
          <button class="btn btn-primary" @click="parseAny">解析</button>
        </div>
        <span class="format-hint">支持 #HEX（3/4/6/8 位）、rgb()/rgba()、hsl()/hsla() 与常用英文名；错误会定位到具体字符。</span>
        <p v-if="parseError" class="field-error">{{ parseError }}</p>
        <div class="alpha-row">
          <label for="alpha-range">透明度 Alpha：{{ alphaPct }}%</label>
          <input id="alpha-range" v-model.number="alphaPct" type="range" min="0" max="100" @input="onAlphaChange" />
          <span class="format-hint">带透明度时 HEX 显示为 8 位（#RRGGBBAA），RGB/HSL 显示为 rgba()/hsla()</span>
          <span class="named-chip">最近命名色：<b>{{ nearest.name }}</b> {{ nearest.hex }}{{ nearest.exact ? '（精确命中）' : '' }}</span>
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
          <span class="format-hint">格式: #RGB / #RRGGBB / 带透明度 #RGBA / #RRGGBBAA</span>
          <p v-if="hexError" class="field-error">{{ hexError }}</p>
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

        <!-- HWB 输入 -->
        <div class="color-input-card">
          <label class="input-label">HWB（CSS Color 4）</label>
          <div class="input-row hsv-inputs">
            <input v-model.number="hwb.h" type="number" min="0" max="360" placeholder="H" @input="onHwbChange" />
            <input v-model.number="hwb.w" type="number" min="0" max="100" placeholder="W" @input="onHwbChange" />
            <input v-model.number="hwb.b" type="number" min="0" max="100" placeholder="B" @input="onHwbChange" />
            <button class="copy-btn" @click="copyValue(hwbString, 'HWB')">📋</button>
          </div>
          <span class="format-hint">H: 0-360°, W/B: 0-100%（两者之和 ≤100）</span>
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
import { parseColorInput, componentsToRgb, formatAll, nearestNamedColor, buildColorSummary } from "@/utils/colorConvert.js";

// 响应式状态（转换与校验全部走 src/utils/colorConvert.js，纯本地）
const master = ref({ r: 102, g: 126, b: 234, a: 1 });
const hexInput = ref("#667EEA");
const pickerColor = ref("#667EEA");
const rgb = ref({ r: 102, g: 126, b: 234 });
const hsl = ref({ h: 229, s: 76, l: 66 });
const hsv = ref({ h: 229, s: 56, v: 92 });
const cmyk = ref({ c: 56, m: 46, y: 0, k: 8 });
const hwb = ref({ h: 229, w: 40, b: 8 });
const alphaPct = ref(100);
const anyInput = ref("");
const parseError = ref("");
const hexError = ref("");
const statusMessage = ref("");
const statusType = ref("");

const formats = computed(() => formatAll(master.value));
const nearest = computed(() => nearestNamedColor(master.value));
const currentHex = computed(() => formats.value.hex8);
const rgbString = computed(() => (master.value.a < 1 ? formats.value.rgba : formats.value.rgb));
const hslString = computed(() => (master.value.a < 1 ? formats.value.hsla : formats.value.hsl));
const hsvString = computed(() => formats.value.hsv);
const cmykString = computed(() => formats.value.cmyk);
const hwbString = computed(() => formats.value.hwb);

const syncFromMaster = () => {
  const f = formats.value;
  hexInput.value = f.hex8;
  pickerColor.value = f.hex;
  rgb.value = { r: master.value.r, g: master.value.g, b: master.value.b };
  hsl.value = { ...f.hslObj };
  hsv.value = { ...f.hsvObj };
  cmyk.value = { ...f.cmykObj };
  hwb.value = { ...f.hwbObj };
  alphaPct.value = f.alphaPct;
};

const setError = (msg) => { statusMessage.value = msg ? `✗ ${msg}` : ""; statusType.value = msg ? "error" : ""; };

const applyComponents = (format, values) => {
  const result = componentsToRgb(format, values, master.value.a);
  if (!result.ok) { setError(result.error); return; }
  setError("");
  master.value = result.rgba;
  syncFromMaster();
};

const onColorPickerChange = () => {
  const parsed = parseColorInput(pickerColor.value);
  if (parsed.ok) { master.value = { ...parsed.rgba, a: master.value.a }; syncFromMaster(); }
};

const onHexChange = () => {
  const parsed = parseColorInput(hexInput.value);
  if (parsed.ok) { hexError.value = ""; master.value = parsed.rgba; syncFromMaster(); }
  else hexError.value = parsed.error;
};

const parseAny = () => {
  const parsed = parseColorInput(anyInput.value);
  if (!parsed.ok) { parseError.value = parsed.error; return; }
  parseError.value = "";
  master.value = parsed.rgba;
  syncFromMaster();
  statusMessage.value = `✓ 已识别为 ${parsed.format} 格式`;
  statusType.value = "success";
  setTimeout(() => { statusMessage.value = ""; }, 2000);
};

const onAlphaChange = () => {
  const v = Number(alphaPct.value);
  if (!Number.isFinite(v) || v < 0 || v > 100) { setError(`透明度应在 0–100 之间，当前 ${alphaPct.value}`); return; }
  setError("");
  master.value = { ...master.value, a: Math.round(v) / 100 };
  syncFromMaster();
};

const onRgbChange = () => applyComponents('rgb', rgb.value);
const onHslChange = () => applyComponents('hsl', hsl.value);
const onHsvChange = () => applyComponents('hsv', hsv.value);
const onCmykChange = () => applyComponents('cmyk', cmyk.value);
const onHwbChange = () => applyComponents('hwb', hwb.value);

const randomColor = () => {
  master.value = { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256), a: master.value.a };
  syncFromMaster();
  statusMessage.value = "✓ 已生成随机颜色！";
  statusType.value = "success";
};

const clearAll = () => {
  master.value = { r: 255, g: 255, b: 255, a: 1 };
  hexError.value = ""; parseError.value = ""; anyInput.value = "";
  syncFromMaster();
  statusMessage.value = "";
};

const copyToClipboard = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
};

const copyValue = async (value, format) => {
  if (await copyToClipboard(value)) {
    statusMessage.value = `✓ 已复制 ${format} 值！`;
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  } else { statusMessage.value = "✗ 复制失败"; statusType.value = "error"; }
};

const copyAllFormats = async () => {
  if (await copyToClipboard(buildColorSummary(master.value))) {
    statusMessage.value = "✓ 已复制所有格式！";
    statusType.value = "success";
    setTimeout(() => { statusMessage.value = ""; }, 2000);
  }
};

// 使用示例
const useExample = (example) => {
  const parsed = parseColorInput(example.input);
  if (parsed.ok) { master.value = parsed.rgba; syncFromMaster(); }
};

// 功能特点
const features = [
  { icon: "🎨", title: "多格式支持", description: "支持 HEX、RGB、HSL、HSV、CMYK、HWB 六种颜色格式与透明度" },
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
  { question: "带透明度的 HEX 怎么写？", answer: "在 #RRGGBB 后再加两位透明度就是 8 位 HEX，如 #FF573380 约为 50% 不透明；本工具调整透明度后会自动按 8 位显示，也可粘贴 rgba() 一键识别。" },
  { question: "输错了为什么不再自动改成最接近的值？", answer: "旧版会把越界或非法字符静默吞掉，容易得到错误颜色还不自知；现在会明确提示哪个分量、哪一位字符有问题，改对后才同步转换。" },
];

// 使用示例
const examples = [
  { input: "#667EEA", output: "rgb(102, 126, 234)", description: "极速工具箱主题蓝" },
  { input: "#764BA2", output: "rgb(118, 75, 162)", description: "极速工具箱渐变紫" },
  { input: "#2ECC71", output: "rgb(46, 204, 113)", description: "成功状态绿" },
  { input: "rgba(255, 87, 51, 0.5)", output: "#FF573380", description: "任意格式粘贴识别（带透明度）" },
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
  box-shadow: var(--shadow-md);
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
  box-shadow: var(--shadow-card-hover);
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
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.color-input-card {
  min-width: 0;
  background: var(--bg);
  padding: 20px;
  border-radius: 10px;
  border: 2px solid var(--border);
  transition: border-color 0.3s;
}

.color-input-card:hover {
  border-color: var(--accent);
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
  min-width: 0;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: border-color 0.3s;
}

.color-input:focus {
  outline: none;
  border-color: var(--accent);
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
  border-color: var(--accent);
}

.copy-btn {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
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

.parse-section { margin-bottom: 20px; padding: 16px; background: var(--bg); border-radius: 10px; }
.alpha-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
.alpha-row input[type="range"] { flex: 1; min-width: 120px; }
.named-chip { font-size: 13px; color: var(--text-2); }
.field-error { color: var(--danger, #dc2626); font-size: 13px; margin-top: 6px; }

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

