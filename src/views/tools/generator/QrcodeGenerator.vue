<template>
  <div class="qrcode-generator">
    <h1>📱 二维码生成器</h1>
    <p class="description">输入文本或链接，快速生成二维码图片，支持自定义尺寸和颜色</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button class="btn btn-primary" @click="generateQrcode">
          <span class="icon">🎲</span> 生成二维码
        </button>
        <button class="btn btn-success" @click="downloadQrcode" :disabled="!qrcodeDataUrl">
          <span class="icon">💾</span> 下载图片
        </button>
        <button class="btn btn-danger" @click="clearAll">
          <span class="icon">🗑️</span> 清空
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 主内容区域 -->
      <div class="main-content">
        <!-- 左侧输入区 -->
        <div class="input-section">
          <div class="input-card">
            <label class="input-label">输入内容</label>
            <textarea 
              v-model="inputText"
              class="text-input"
              placeholder="请输入文本、网址或其他内容..."
              rows="6"
              @input="onInputChange"
            ></textarea>
            <span class="char-count">{{ statsText }}</span>
            <span v-if="contrastHint" :class="['contrast-hint', contrastLevel]">{{ contrastHint }}</span>
          </div>

          <!-- 选项设置 -->
          <div class="options-card">
            <h3>⚙️ 选项设置</h3>
            <div class="options-grid">
              <div class="option-item">
                <label>尺寸 (px)</label>
                <input type="number" v-model.number="options.width" min="100" max="1000" step="50" />
              </div>
              <div class="option-item">
                <label>边距</label>
                <input type="number" v-model.number="options.margin" min="0" max="10" />
              </div>
              <div class="option-item">
                <label>前景色</label>
                <div class="color-input-wrapper">
                  <input type="color" v-model="options.darkColor" class="color-picker" />
                  <span>{{ options.darkColor }}</span>
                </div>
              </div>
              <div class="option-item">
                <label>背景色</label>
                <div class="color-input-wrapper">
                  <input type="color" v-model="options.lightColor" class="color-picker" />
                  <span>{{ options.lightColor }}</span>
                </div>
              </div>
              <div class="option-item">
                <label>容错级别</label>
                <select v-model="options.errorCorrectionLevel">
                  <option value="L">L - 7%</option>
                  <option value="M">M - 15%</option>
                  <option value="Q">Q - 25%</option>
                  <option value="H">H - 30%</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Logo 设置 -->
          <div class="options-card">
            <h3>🖼️ Logo 设置</h3>
            <div class="logo-section">
              <div class="logo-upload">
                <label class="logo-upload-btn" :class="{ 'has-logo': logoDataUrl }">
                  <input
                    type="file"
                    accept="image/*"
                    @change="onLogoUpload"
                    ref="logoInput"
                    style="display: none;"
                  />
                  <span v-if="!logoDataUrl">📤 上传 Logo</span>
                  <span v-else>🔄 更换 Logo</span>
                </label>
                <button v-if="logoDataUrl" class="btn btn-sm btn-danger" @click="removeLogo">
                  🗑️ 移除
                </button>
              </div>

              <div v-if="logoDataUrl" class="logo-preview">
                <img :src="logoDataUrl" alt="Logo Preview" class="logo-thumb" />
              </div>

              <div v-if="logoDataUrl" class="logo-options">
                <div class="option-item">
                  <label>Logo 大小 (%)</label>
                  <input
                    type="range"
                    v-model.number="logoOptions.size"
                    min="10"
                    max="35"
                    step="1"
                  />
                  <span class="range-value">{{ logoOptions.size }}%</span>
                </div>
                <div class="option-item">
                  <label>圆角</label>
                  <input
                    type="range"
                    v-model.number="logoOptions.borderRadius"
                    min="0"
                    max="50"
                    step="5"
                  />
                  <span class="range-value">{{ logoOptions.borderRadius }}%</span>
                </div>
                <div class="option-item">
                  <label>边框宽度</label>
                  <input
                    type="range"
                    v-model.number="logoOptions.padding"
                    min="0"
                    max="10"
                    step="1"
                  />
                  <span class="range-value">{{ logoOptions.padding }}px</span>
                </div>
                <div class="option-item checkbox-item">
                  <label>
                    <input type="checkbox" v-model="logoOptions.whiteBackground" />
                    白色背景
                  </label>
                </div>
              </div>

              <p class="logo-tip" v-if="!logoDataUrl">
                💡 建议使用正方形图片，推荐 PNG 格式，添加 Logo 时请选择较高容错级别（Q 或 H）
              </p>
            </div>
          </div>
        </div>

        <!-- 右侧预览区 -->
        <div class="preview-section">
          <div class="preview-card">
            <h3>📷 二维码预览</h3>
            <div class="preview-box">
              <img v-if="qrcodeDataUrl" :src="qrcodeDataUrl" alt="QR Code" class="qrcode-image" />
              <div v-else class="placeholder">
                <span class="placeholder-icon">📱</span>
                <p>输入内容后生成二维码</p>
              </div>
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
import { ref, watch, computed } from "vue";
import QRCode from "qrcode";
import { validateQrOptions, analyzeContent, checkQrContrast, validateLogoFile, friendlyQrError, buildQrSummary } from "@/utils/qrcodeGenerate.js";
import ToolFeatures from "@/components/ToolFeatures.vue";
import ToolUsageGuide from "@/components/ToolUsageGuide.vue";
import ToolFaq from "@/components/ToolFaq.vue";
import ToolExamples from "@/components/ToolExamples.vue";
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";

// 响应式状态
const inputText = ref("");
const qrcodeDataUrl = ref("");
const statusMessage = ref("");
const statusType = ref("");
const logoInput = ref(null);
const logoDataUrl = ref("");

const options = ref({
  width: 256,
  margin: 2,
  darkColor: "#000000",
  lightColor: "#FFFFFF",
  errorCorrectionLevel: "M"
});

const logoOptions = ref({
  size: 20,
  borderRadius: 10,
  padding: 4,
  whiteBackground: true
});

// 内容统计（按 Unicode 码点与 UTF-8 字节计，旧版 String.length 会把 Emoji 算成 2 个字符且不反映真实容量）
const analysis = computed(() => analyzeContent(inputText.value, options.value.errorCorrectionLevel));
const statsText = computed(() => {
  const a = analysis.value;
  if (!inputText.value) return "0 字符";
  return `${a.chars} 字符 · ${a.bytes} 字节（UTF-8）· 占 ${a.level} 级容量 ${a.usagePercent}%（上限 ${a.capacity} 字节）`;
});
const contrastResult = computed(() => {
  try { return checkQrContrast(options.value.darkColor, options.value.lightColor); } catch { return null; }
});
const contrastHint = computed(() => (contrastResult.value && contrastResult.value.level !== "ok" ? contrastResult.value.message : ""));
const contrastLevel = computed(() => (contrastResult.value ? contrastResult.value.level : ""));

// 上传 Logo
const onLogoUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    validateLogoFile(file);
  } catch (e) {
    statusMessage.value = `✗ ${e.message}`;
    statusType.value = "error";
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    statusMessage.value = "✗ Logo 读取失败，请换一张图片重试";
    statusType.value = "error";
  };
  reader.onload = (e) => {
    logoDataUrl.value = e.target.result;
    // 上传 Logo 后自动提高容错级别
    if (options.value.errorCorrectionLevel === "L" || options.value.errorCorrectionLevel === "M") {
      options.value.errorCorrectionLevel = "H";
      statusMessage.value = "✓ Logo 已上传，已自动调整容错级别为 H";
      statusType.value = "success";
    }
    if (inputText.value.trim()) {
      generateQrcode();
    }
  };
  reader.readAsDataURL(file);
};

// 移除 Logo
const removeLogo = () => {
  logoDataUrl.value = "";
  if (logoInput.value) {
    logoInput.value.value = "";
  }
  if (inputText.value.trim()) {
    generateQrcode();
  }
  statusMessage.value = "✓ Logo 已移除";
  statusType.value = "success";
};

// 将 Logo 绘制到二维码上
const addLogoToQrcode = (qrDataUrl) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const qrImg = new Image();
    qrImg.onerror = () => reject(new Error("二维码图片加载失败，无法嵌入 Logo"));

    qrImg.onload = () => {
      canvas.width = qrImg.width;
      canvas.height = qrImg.height;
      ctx.drawImage(qrImg, 0, 0);

      const logoImg = new Image();
      logoImg.onerror = () => reject(new Error("Logo 图片加载失败，请换一张图片重试"));
      logoImg.onload = () => {
        const logoSize = (canvas.width * logoOptions.value.size) / 100;
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = (canvas.height - logoSize) / 2;
        const padding = logoOptions.value.padding;
        const borderRadius = (logoSize * logoOptions.value.borderRadius) / 100;

        // 绘制白色背景（如果启用）
        if (logoOptions.value.whiteBackground) {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.roundRect(logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2, borderRadius + padding);
          ctx.fill();
        }

        // 绘制圆角 Logo
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(logoX, logoY, logoSize, logoSize, borderRadius);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        resolve(canvas.toDataURL("image/png"));
      };
      logoImg.src = logoDataUrl.value;
    };
    qrImg.src = qrDataUrl;
  });
};

// 生成二维码（序号防竞态：连续输入时只采纳最后一次生成结果）
let generateSeq = 0;
const generateQrcode = async () => {
  const seq = ++generateSeq;
  if (!inputText.value.trim()) {
    statusMessage.value = "✗ 请输入需要生成二维码的内容";
    statusType.value = "error";
    return;
  }

  let opts;
  try {
    opts = validateQrOptions(options.value);
  } catch (e) {
    statusMessage.value = `✗ ${e.message}`;
    statusType.value = "error";
    return;
  }

  const a = analyzeContent(inputText.value, opts.errorCorrectionLevel);
  if (a.overCapacity) {
    statusMessage.value = `✗ ${friendlyQrError(new Error("The amount of data is too big"), a)}`;
    statusType.value = "error";
    return;
  }

  const contrast = checkQrContrast(opts.darkColor, opts.lightColor);
  if (contrast.level === "error") {
    statusMessage.value = `✗ ${contrast.message}`;
    statusType.value = "error";
    return;
  }

  try {
    let dataUrl = await QRCode.toDataURL(inputText.value, {
      width: opts.width,
      margin: opts.margin,
      color: {
        dark: opts.darkColor,
        light: opts.lightColor
      },
      errorCorrectionLevel: opts.errorCorrectionLevel
    });

    // 如果有 Logo，则添加到二维码上
    if (logoDataUrl.value) {
      dataUrl = await addLogoToQrcode(dataUrl);
    }

    if (seq !== generateSeq) return;
    qrcodeDataUrl.value = dataUrl;
    const logoText = logoDataUrl.value ? "（含 Logo）" : "";
    const warnText = contrast.level === "warn" ? `；注意：${contrast.message}` : "";
    statusMessage.value = `✓ 二维码生成成功！尺寸: ${opts.width}x${opts.width}px ${logoText}${warnText}`;
    statusType.value = "success";
  } catch (error) {
    if (seq !== generateSeq) return;
    statusMessage.value = `✗ ${friendlyQrError(error, a)}`;
    statusType.value = "error";
  }
};

// 下载二维码
const downloadQrcode = () => {
  if (!qrcodeDataUrl.value) return;

  const link = document.createElement("a");
  link.download = `qrcode_${Date.now()}.png`;
  link.href = qrcodeDataUrl.value;
  link.click();

  statusMessage.value = "✓ 二维码已下载";
  statusType.value = "success";
};

// 清空
const clearAll = () => {
  inputText.value = "";
  qrcodeDataUrl.value = "";
  logoDataUrl.value = "";
  statusMessage.value = "";
  if (logoInput.value) {
    logoInput.value.value = "";
  }
  options.value = {
    width: 256,
    margin: 2,
    darkColor: "#000000",
    lightColor: "#FFFFFF",
    errorCorrectionLevel: "M"
  };
  logoOptions.value = {
    size: 20,
    borderRadius: 10,
    padding: 4,
    whiteBackground: true
  };
};

// 输入变化时自动生成（250ms 防抖，避免逐字触发整码重绘）
let inputTimer = null;
const onInputChange = () => {
  if (inputTimer) clearTimeout(inputTimer);
  if (!inputText.value.trim()) {
    qrcodeDataUrl.value = "";
    return;
  }
  inputTimer = setTimeout(() => generateQrcode(), 250);
};

// 监听选项变化自动重新生成
watch(options, () => {
  if (inputText.value.trim()) {
    generateQrcode();
  }
}, { deep: true });

// 监听 Logo 选项变化自动重新生成
watch(logoOptions, () => {
  if (inputText.value.trim() && logoDataUrl.value) {
    generateQrcode();
  }
}, { deep: true });

// 使用示例
const useExample = (example) => {
  inputText.value = example.input;
  generateQrcode();
};

// 功能特点
const features = [
  { icon: "⚡", title: "即时预览", description: "输入内容后实时生成二维码预览" },
  { icon: "🎨", title: "自定义样式", description: "支持自定义二维码尺寸、颜色和边距" },
  { icon: "🖼️", title: "Logo 嵌入", description: "支持在二维码中心添加自定义 Logo 图片" },
  { icon: "💾", title: "一键下载", description: "生成的二维码可直接下载为PNG图片" },
  { icon: "🔒", title: "容错设置", description: "支持多种容错级别，保证扫码成功率" }
];

// 使用步骤
const usageSteps = [
  "在输入框中输入文本、网址或任意内容",
  "根据需要调整尺寸、颜色等选项",
  "（可选）上传 Logo 图片并调整大小和样式",
  "点击「生成二维码」或自动生成",
  "预览满意后点击「下载图片」保存"
];

// 常见问题
const faqs = [
  { question: "二维码可以存储多少内容？", answer: "容量按 UTF-8 字节计算（一个汉字占 3 字节、Emoji 占 4 字节）：L 级上限 2953 字节、M 级 2331、Q 级 1663、H 级 1273。输入框下方会实时显示字节数与容量占用，超限会直接提示。内容越短码越稀疏、越好扫，建议控制在几百字节内。" },
  { question: "为什么提示对比度过低或反色？", answer: "扫码器靠前景与背景的明暗差识别：前景比背景亮（反色）或对比度低于 3:1 时大概率扫不出来，本工具会拦截生成；3:1–4.5:1 会生成但给出警告。经典黑白对比度为 21:1。" },
  { question: "容错级别是什么意思？", answer: "容错级别决定二维码损坏后仍能被识别的比例。L级7%、M级15%、Q级25%、H级30%。级别越高，二维码密度越大。" },
  { question: "为什么我的二维码扫不出来？", answer: "可能是内容过长导致二维码过于密集，尝试增大尺寸或降低容错级别。也要确保前景色与背景色有足够对比度。" },
  { question: "添加 Logo 后二维码还能扫出来吗？", answer: "可以，但需要选择较高的容错级别（建议 Q 或 H）。Logo 大小建议不超过二维码面积的 25%，上传 Logo 时会自动调整容错级别。" },
  { question: "生成的二维码有版权问题吗？", answer: "二维码是开放标准，您可以自由使用生成的二维码用于任何个人或商业用途。" }
];

// 使用示例
const examples = [
  { input: "https://tools.morijiu.cn", output: "网站链接二维码", description: "开发者工具箱" },
  { input: "https://tools.morijiu.cn/generator/qrcode", output: "页面链接二维码", description: "二维码生成器" },
  { input: "Hello, World!", output: "文本二维码", description: "简单文本" },
  { input: "tel:+8613800138000", output: "电话号码二维码", description: "电话号码" },
  { input: "mailto:contact@morijiu.cn", output: "邮箱二维码", description: "邮箱地址" }
];
</script>

<style scoped>
.qrcode-generator {
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

/* 主内容区域 */
.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 24px 0;
}

/* 输入区域 */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-card, .options-card, .preview-card {
  background: var(--bg);
  border-radius: 10px;
  padding: 20px;
}

.input-label {
  display: block;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 10px;
}

.text-input {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
  resize: vertical;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent);
}

.char-count {
  display: block;
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-3);
  margin-top: 6px;
}

.contrast-hint {
  display: block;
  font-size: 0.85rem;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 6px;
}
.contrast-hint.warn { background: var(--warn-soft); color: var(--text-2); }
.contrast-hint.error { background: var(--danger-soft); color: var(--danger-text); }

/* 选项卡片 */
.options-card h3 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  color: var(--text-strong);
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-item label {
  font-size: 0.9rem;
  color: var(--text-2);
  font-weight: 500;
}

.option-item input[type="number"],
.option-item select {
  padding: 8px 12px;
  border: 2px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
}

.option-item input[type="number"]:focus,
.option-item select:focus {
  outline: none;
  border-color: var(--accent);
}

.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 40px;
  height: 32px;
  padding: 0;
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.color-input-wrapper span {
  font-size: 0.9rem;
  color: var(--text-2);
  font-family: monospace;
}

/* 预览区域 */
.preview-section {
  display: flex;
  flex-direction: column;
}

.preview-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-card h3 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  color: var(--text-strong);
}

.preview-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 2px dashed var(--border);
  border-radius: 10px;
  min-height: 300px;
  padding: 20px;
}

.qrcode-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.placeholder {
  text-align: center;
  color: var(--text-3);
}

.placeholder-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.placeholder p {
  font-size: 1rem;
}

/* Logo 设置区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.logo-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  background: var(--accent);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.logo-upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.logo-upload-btn.has-logo {
  background: var(--success);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.logo-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid var(--border);
}

.logo-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px;
  background: var(--surface);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.logo-options .option-item {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.logo-options .option-item label {
  min-width: 80px;
}

.logo-options input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: var(--border);
  border-radius: 3px;
  outline: none;
}

.logo-options input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
}

.range-value {
  min-width: 40px;
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-2);
  font-family: monospace;
}

.checkbox-item {
  flex-direction: row !important;
}

.checkbox-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.logo-tip {
  font-size: 0.85rem;
  color: var(--text-3);
  margin: 0;
  padding: 10px;
  background: var(--warn-soft);
  border-radius: 6px;
  border-left: 3px solid #ffc107;
}

/* 响应式布局 */
@media (max-width: 900px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }

  .logo-options {
    grid-template-columns: 1fr;
  }
}
</style>

