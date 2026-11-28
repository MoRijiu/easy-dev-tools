<template>
  <div class="image-converter">
    <h1>图片格式转换工具</h1>
    <p class="description">
      在线图片格式转换工具，支持 JPG、PNG、WebP、GIF、BMP、ICO 等格式互转
    </p>

    <div class="tool-container">
      <!-- 上传区域 + 图片列表 -->
      <div class="upload-images-wrapper">
        <!-- 上传区域 -->
        <div
          class="upload-area"
          :aria-invalid="invalidFor('upload')"
          :aria-describedby="describedByFor('upload')"
          :class="{ 'dragging': isDragging, 'compact': images.length > 0 }"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          @click="triggerFileInput"
          tabindex="0"
          role="button"
          aria-label="选择要转换的图片，或把图片拖放到这里"
          @keydown="onUploadKeydown"
        >
          <input aria-label="选择要转换的图片"
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            @change="onFileSelect"
            style="display: none"
          />
          <div class="upload-content">
            <span class="upload-icon" aria-hidden="true">{{ images.length > 0 ? '➕' : '📁' }}</span>
            <p class="upload-text">{{ images.length > 0 ? '继续添加图片' : '拖拽图片到此处，或点击选择图片' }}</p>
            <p class="upload-hint" v-if="images.length === 0">支持 JPG、PNG、GIF、WebP、BMP 等格式，可多选（单张 ≤20MB、最多 20 张；GIF 只保留第一帧）</p>
            <button v-if="images.length === 0" class="example-btn" @click.stop="loadExample">载入示例图片</button>
          </div>
        </div>

        <!-- 图片列表 -->
        <div class="images-section" v-if="images.length > 0">
          <div class="images-header">
            <h2>🖼️ 已选择 {{ images.length }} 张图片</h2>
            <div class="images-summary" v-if="summary.doneCount > 0">
              <span class="total-original">已转换 {{ summary.doneCount }}/{{ summary.totalCount }} 张 · 原始 {{ formatSize(summary.original) }}</span>
              <span class="total-arrow">→</span>
              <span class="total-converted">转换后: {{ formatSize(summary.converted) }}</span>
            </div>
            <div class="format-badge" v-else>
              <span class="format-label">目标格式:</span>
              <span class="format-value">{{ targetFormatLabel }}</span>
            </div>
          </div>
          <div class="images-grid">
            <div v-for="(img, index) in images" :key="index" class="image-card">
              <div class="image-preview">
                <img :src="img.preview" :alt="img.name" />
                <button class="remove-btn" @click.stop="removeImage(index)" title="移除" :aria-label="`移除 ${img.name}`">×</button>
                <div class="format-tag original">{{ img.originalFormat }}</div>
                <div class="convert-status" v-if="img.convertedBlob">
                  <span class="status-badge success">✓ 已转换</span>
                </div>
              </div>
              <div class="image-info">
                <p class="image-name" :title="img.name">{{ truncateName(img.name) }}</p>
                <p class="image-dims" v-if="img.width">{{ img.width }} × {{ img.height }} px<template v-if="img.outputLabel"> · 输出 {{ img.outputLabel }}<template v-if="img.outText"> {{ img.outText }}</template></template></p>
                <div class="size-compare">
                  <span class="original-size">{{ formatSize(img.originalSize) }}</span>
                  <template v-if="img.convertedSize">
                    <span class="arrow">→</span>
                    <span class="converted-size">{{ formatSize(img.convertedSize) }}</span>
                  </template>
                </div>
              </div>
              <div class="image-actions">
                <button
                  class="action-btn convert-btn"
                  @click="convertImage(index)"
                  :disabled="img.converting"
                  :aria-label="`转换 ${img.name}`"
                >
                  {{ img.converting ? '转换中...' : (img.convertedBlob ? '重新转换' : '转换') }}
                </button>
                <button
                  class="action-btn download-btn"
                  @click="downloadImage(index)"
                  :disabled="!img.convertedBlob"
                  :aria-label="`下载 ${img.name} 的转换结果`"
                >
                  下载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 转换设置 -->
      <div class="settings-section" v-if="images.length > 0">
        <h2>⚙️ 转换设置</h2>
        <div class="settings-grid">
          <div class="setting-item">
            <label for="imgv-target-format">目标格式</label>
            <select id="imgv-target-format" aria-label="目标格式" v-model="targetFormat" :aria-invalid="invalidFor('format')" :aria-describedby="describedByFor('format')">
              <option v-for="fmt in TARGET_FORMATS" :key="fmt.value" :value="fmt.value">{{ fmt.label }} (.{{ fmt.ext }})</option>
            </select>
            <span class="setting-hint">{{ currentTarget.hint }}</span>
          </div>
          <div class="setting-item" v-if="supportsQuality">
            <label for="imgv-quality">输出质量</label>
            <div class="quality-control">
              <input id="imgv-quality" aria-label="输出质量"
                type="range"
                :aria-invalid="invalidFor('quality')"
                :aria-describedby="describedByFor('quality')"
                v-model="quality"
                min="10"
                max="100"
                step="5"
                :style="{ background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${quality}%, var(--border) ${quality}%, var(--border) 100%)` }"
              />
              <span class="quality-value">{{ quality }}%</span>
            </div>
            <span class="setting-hint">质量越高，文件越大（转换时会再严格校验）</span>
          </div>
          <div class="setting-item" v-if="currentTarget.value !== 'ico'">
            <label>调整尺寸 (px)</label>
            <div class="resize-control">
              <input id="imgv-resize-width" aria-label="调整宽度 (px)" type="text" inputmode="numeric" v-model="resizeWidth" placeholder="宽度" :aria-invalid="invalidFor('width')" :aria-describedby="describedByFor('width')" />
              <span class="resize-x">×</span>
              <input id="imgv-resize-height" aria-label="调整高度 (px)" type="text" inputmode="numeric" v-model="resizeHeight" placeholder="高度" :aria-invalid="invalidFor('height')" :aria-describedby="describedByFor('height')" />
            </div>
            <span class="setting-hint">留空保持原尺寸，只填一项则等比缩放（1–8192）</span>
          </div>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar v-if="images.length > 0">
        <button class="btn btn-primary" @click="convertAll" :disabled="images.length === 0">
          <span class="icon" aria-hidden="true">🔄</span> 转换全部
        </button>
        <button class="btn btn-success" @click="downloadAll" :disabled="!hasConvertedImages">
          <span class="icon" aria-hidden="true">📥</span> 下载全部
        </button>
        <button class="btn btn-danger" @click="clearAll" :disabled="images.length === 0">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage id="image-converter-status" :message="statusMessage" :type="statusType" />

      <!-- 使用说明 -->
      <ToolUsageGuide :steps="usageSteps" />

      <!-- 功能特点 -->
      <ToolFeatures :features="features" />

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
import ToolToolbar from "@/components/ToolToolbar.vue";
import ToolStatusMessage from "@/components/ToolStatusMessage.vue";
import { MAX_IMAGE_COUNT, formatBytes, mimeLabel, mimeToExt, parseQuality } from "@/utils/imageTools.js";
import { ICO_SIZES, TARGET_FORMATS, buildIco, computeResizeSize, conversionNotes, parseResizeDimension, resolveConvertTarget, summarizeConversion, targetFormatOf, validateConvertFile } from "@/utils/imageConvert.js";

// 响应式状态
const fileInput = ref(null);
const isDragging = ref(false);
const images = ref([]);
const targetFormat = ref("image/png");
const quality = ref(90);
const resizeWidth = ref("");
const resizeHeight = ref("");
const statusMessage = ref("");
const statusType = ref("");
// 输入错误单独留存原文与来源字段：文件类错误归上传区、设置校验按文案字段名归对应控件，仅当前展示的正是该错误时才关联（R9bk）
const inputError = ref("");
const errorField = ref("");
const setInputError = (msg, field) => { inputError.value = msg; errorField.value = field; statusMessage.value = msg; statusType.value = "error"; };
const activeErrorField = computed(() => (inputError.value && statusType.value === "error" && statusMessage.value === inputError.value ? errorField.value : ""));
const invalidFor = (f) => (activeErrorField.value === f ? "true" : undefined);
const describedByFor = (f) => (activeErrorField.value === f ? "image-converter-status" : undefined);

// 计算属性
const hasConvertedImages = computed(() => images.value.some(img => img.convertedBlob));
const summary = computed(() => summarizeConversion(images.value));
const currentTarget = computed(() => targetFormatOf(targetFormat.value) || TARGET_FORMATS[1]);
const supportsQuality = computed(() => currentTarget.value.supportsQuality);
const targetFormatLabel = computed(() => currentTarget.value.label);

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click();
};

// 上传区是 div 模拟按钮：回车/空格须与点击等效（空格在 keydown 拦截防页面滚动）；
// 事件须来自上传区本身——区内「载入示例图片」按钮由其原生键盘行为处理、不重复触发
const onUploadKeydown = (e) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    triggerFileInput();
  }
};

// 拖拽事件
const onDragOver = () => { isDragging.value = true; };
const onDragLeave = () => { isDragging.value = false; };

const onDrop = (e) => {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
  addImages(files);
};

// 文件选择
const onFileSelect = (e) => {
  const files = Array.from(e.target.files);
  addImages(files);
  e.target.value = "";
};

// 添加图片：逐个校验（类型/大小/SVG），同名同大小去重，超数量上限明确提示，并读取真实尺寸
const addImages = (files) => {
  const rejected = [];
  let added = 0;
  files.forEach(file => {
    const err = validateConvertFile(file);
    if (err) { rejected.push(`${file.name}：${err}`); return; }
    if (images.value.length + added >= MAX_IMAGE_COUNT) { rejected.push(`${file.name}：一次最多 ${MAX_IMAGE_COUNT} 张`); return; }
    if (images.value.some(img => img.name === file.name && img.originalSize === file.size)) { rejected.push(`${file.name}：已在列表中`); return; }
    added++;
    const reader = new FileReader();
    reader.onload = (e) => {
      const probe = new Image();
      probe.onload = () => {
        images.value.push({
          name: file.name, file, preview: e.target.result,
          originalSize: file.size, originalFormat: mimeLabel(file.type),
          width: probe.width, height: probe.height,
          convertedSize: null, convertedBlob: null, converting: false,
          outputLabel: "", outText: ""
        });
      };
      probe.onerror = () => { setInputError(`✗ ${file.name} 图片加载失败，文件可能已损坏`, "upload"); };
      probe.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  if (added) { statusMessage.value = `✓ 已添加 ${added} 张图片`; statusType.value = "success"; }
  if (rejected.length) { const rejMsg = `${added ? `✓ 已添加 ${added} 张；` : ""}已跳过 ${rejected.length} 个：${rejected.join("；")}`; if (added) { statusMessage.value = rejMsg; statusType.value = "info"; } else { setInputError(rejMsg, "upload"); } }
  if (!added && !rejected.length) { statusMessage.value = "没有选择图片"; statusType.value = "info"; }
};

// 载入示例图片：本地 Canvas 现画一张 480×320 的 PNG（渐变 + 图形 + 文字），不请求任何网络资源
const loadExample = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 480; canvas.height = 320;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 480, 320);
  grad.addColorStop(0, "#4f7cff"); grad.addColorStop(1, "#9b5de5");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 480, 320);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.arc(390, 70, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("示例图片", 36, 150);
  ctx.font = "20px sans-serif";
  ctx.fillText("480 × 320 PNG · 本地生成", 36, 190);
  canvas.toBlob((blob) => {
    if (!blob) { statusMessage.value = "✗ 示例图片生成失败"; statusType.value = "error"; return; }
    addImages([new File([blob], "example.png", { type: "image/png" })]);
  }, "image/png");
};

// 严格校验当前设置（目标格式/质量/尺寸），非法时抛错点名，不靠 input 的 min/max 假装校验
const parseSettings = () => {
  const target = resolveConvertTarget(targetFormat.value);
  const qualityValue = target.supportsQuality ? parseQuality(quality.value) : 100;
  const w = target.value === "ico" ? 0 : parseResizeDimension(resizeWidth.value, "宽度");
  const h = target.value === "ico" ? 0 : parseResizeDimension(resizeHeight.value, "高度");
  return { target, qualityValue, w, h };
};

// 转换单张图片：先校验设置，转换后按 blob.type 核对实际输出格式（浏览器回退时点名，扩展名随实际类型）
const convertImage = async (index) => {
  const img = images.value[index];
  if (img.converting) return false;
  let settings;
  try {
    settings = parseSettings();
  } catch (error) {
    const field = error.message.startsWith("宽度") ? "width" : error.message.startsWith("高度") ? "height" : error.message.includes("质量") ? "quality" : error.message.startsWith("不支持的目标格式") ? "format" : "";
    setInputError(`✗ ${error.message}`, field);
    return false;
  }
  img.converting = true;
  try {
    const { blob, outText } = await convertImageFile(img, settings);
    img.convertedBlob = blob;
    img.convertedSize = blob.size;
    img.outText = outText;
    const actualLabel = mimeLabel(blob.type);
    img.outputLabel = actualLabel;
    const notes = conversionNotes(img.file.type, settings.target);
    if (settings.target.value !== "ico" && blob.type && blob.type !== settings.target.value) {
      notes.push(`浏览器不支持 ${settings.target.label} 编码，实际输出为 ${actualLabel}`);
    }
    statusMessage.value = `✓ ${img.name} 转换完成，输出 ${actualLabel}（${formatSize(blob.size)}）${notes.length ? "；" + notes.join("；") : ""}`;
    statusType.value = "success";
    return true;
  } catch (error) {
    const field = error.message.includes("图片加载失败") || error.message.includes("图片尺寸无效") ? "upload" : error.message.includes("ICO") ? "format" : error.message.includes("未能编码") ? "format" : "";
    setInputError(`✗ 转换失败: ${error.message}`, field);
    return false;
  } finally {
    img.converting = false;
  }
};

const loadImage = (dataUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("图片加载失败，文件可能已损坏"));
  image.src = dataUrl;
});

const canvasToBlob = (canvas, mime, q) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("转换失败，浏览器未能编码该格式")), mime, q);
});

// 图片转换核心：ICO 走真打包（多尺寸 PNG 内嵌），其余走 Canvas 编码
const convertImageFile = async (img, { target, qualityValue, w, h }) => {
  const image = await loadImage(img.preview);

  if (target.value === "ico") {
    const side = Math.min(image.width, image.height);
    const sx = (image.width - side) / 2;
    const sy = (image.height - side) / 2;
    const entries = [];
    for (const size of ICO_SIZES) {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
      const pngBlob = await canvasToBlob(canvas, "image/png", 1);
      entries.push({ size, bytes: new Uint8Array(await pngBlob.arrayBuffer()) });
    }
    const icoBytes = buildIco(entries);
    return { blob: new Blob([icoBytes], { type: "image/x-icon" }), outText: `${ICO_SIZES.join("/")}px 多尺寸` };
  }

  const { width, height } = computeResizeSize(image.width, image.height, w, h);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  // JPEG/BMP 不支持透明，填充白色背景
  if (target.value === "image/jpeg" || target.value === "image/bmp") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, target.value, qualityValue / 100);
  return { blob, outText: `${width} × ${height} px` };
};

// 转换全部
const convertAll = async () => {
  statusMessage.value = "正在转换所有图片...";
  statusType.value = "info";

  for (let i = 0; i < images.value.length; i++) {
    await convertImage(i);
  }

  const s = summarizeConversion(images.value);
  // 全部失败时保留单张的原始错误（含控件关联），不再用汇总消息覆盖（R9bk 顺修）
  if (s.doneCount === 0 && s.totalCount > 0 && inputError.value && statusType.value === "error") {
    statusMessage.value = inputError.value;
    return;
  }
  statusMessage.value = `✓ 已完成 ${s.doneCount}/${s.totalCount} 张图片转换`;
  statusType.value = s.doneCount === s.totalCount ? "success" : "info";
};

// 下载单张图片：扩展名按实际 blob.type，不按目标格式假装
const downloadImage = (index) => {
  const img = images.value[index];
  if (!img.convertedBlob) return;

  const link = document.createElement("a");
  const ext = mimeToExt(img.convertedBlob.type);
  const baseName = img.name.replace(/\.[^/.]+$/, "");
  link.download = `${baseName}.${ext}`;
  link.href = URL.createObjectURL(img.convertedBlob);
  link.click();
  URL.revokeObjectURL(link.href);
};

// 下载全部
const downloadAll = () => {
  images.value.forEach((img, index) => {
    if (img.convertedBlob) {
      setTimeout(() => downloadImage(index), index * 200);
    }
  });
};

// 移除图片
const removeImage = (index) => {
  images.value.splice(index, 1);
};

// 清空
const clearAll = () => {
  images.value = [];
  inputError.value = ""; errorField.value = "";
  statusMessage.value = "";
};

// 格式化文件大小
const formatSize = formatBytes;

// 截断文件名
const truncateName = (name) => {
  return name.length > 20 ? name.slice(0, 17) + "..." : name;
};

// 使用说明
const usageSteps = [
  "点击上传区域或拖拽图片到上传区域（也可以先点「载入示例图片」试一下）",
  "选择目标格式（如 PNG、JPG、WebP、ICO 等）",
  "根据需要调整输出质量和尺寸，非法数值会在转换时点名报错",
  "点击「转换」按钮转换单张图片，或点击「转换全部」批量转换",
  "转换完成后点击「下载」保存图片，扩展名与实际输出格式一致",
];

// 功能特点
const features = [
  { icon: "🔄", title: "多格式支持", description: "支持 JPG、PNG、WebP、GIF、BMP、ICO 等格式互转，实际输出格式逐张核对" },
  { icon: "🧩", title: "真 ICO 输出", description: "ICO 是标准图标文件，内嵌 16/32/48 三种尺寸的 PNG，不是 PNG 改名" },
  { icon: "📁", title: "批量转换", description: "支持同时上传多张图片，一键批量转换" },
  { icon: "🎛️", title: "质量调节", description: "支持调节 JPEG、WebP 格式的输出质量，并做严格校验" },
  { icon: "📐", title: "尺寸调整", description: "可自定义输出图片的宽度和高度，只填一项等比缩放" },
  { icon: "🔒", title: "本地处理", description: "所有操作在浏览器本地完成，保护隐私" },
];

// 常见问题
const faqs = [
  { question: "转换后图片质量会变差吗？", answer: "取决于目标格式。PNG 是无损格式，不会损失质量；JPEG 和 WebP 是有损格式，可通过调整质量参数控制。建议转换为 PNG 或高质量 WebP 以保持最佳画质。" },
  { question: "为什么转换后文件变大了？", answer: "这通常发生在将有损格式转为无损格式时（如 JPG→PNG），或将压缩率高的格式转为压缩率低的格式。如果需要更小的文件，推荐使用 WebP 格式。" },
  { question: "支持转换透明背景吗？", answer: "PNG、WebP、ICO 格式支持透明背景。转换为 JPEG 或 BMP 格式时，透明区域会被填充为白色背景，转换结果里会明确提示。" },
  { question: "ICO 输出是真正的 ICO 文件吗？", answer: "是。生成的是标准 ICO 文件（ICONDIR 文件头 + 内嵌 PNG 数据），一个文件里打包 16×16、32×32、48×48 三种尺寸，浏览器和系统会按场景自动选用，可直接用作网站 favicon。源图会居中裁剪为正方形再缩放。" },
  { question: "为什么选了 GIF 却下载到 PNG？", answer: "浏览器 Canvas 无法编码 GIF（也无法保留动画），所以 GIF 目标实际输出 PNG 静态图，动图只取第一帧；页面会在转换结果里点名说明，下载扩展名也按实际的 PNG 给出，不会拿 PNG 冒充 GIF。" },
  { question: "GIF 动图转换后为什么不动了？", answer: "Canvas 只能读取 GIF 的第一帧，任何目标格式都只会得到静态图。需要保留动画请不要用本工具处理动图。" },
  { question: "为什么不支持 SVG 输入？", answer: "SVG 是矢量格式，转成位图会丢失可无限缩放的特性并可能丢字体，添加时会被跳过并说明原因；如需位图请先在矢量工具里导出为 PNG 再转换。" },
  { question: "单张和数量有什么限制？", answer: "单张最大 20MB、一次最多 20 张，超限或同名同大小的文件会被跳过并逐个说明原因；汇总只统计已转换的图片。" },
];
</script>

<style scoped>
.image-converter {
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

/* 上传区域 */
.upload-area {
  border: 3px dashed var(--border);
  border-radius: 12px;
  padding: 50px 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--bg);
  margin-bottom: 24px;
}

.upload-area:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.upload-area:hover,
.upload-area.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.upload-area.compact {
  padding: 20px;
  border-style: dashed;
  background: linear-gradient(135deg, var(--bg) 0%, var(--accent-soft) 100%);
}

.upload-area.compact .upload-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.upload-area.compact .upload-text {
  font-size: 15px;
  margin-bottom: 0;
}

.upload-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 18px;
  color: var(--text-strong);
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: var(--text-3);
}

.example-btn {
  margin-top: 14px;
  padding: 8px 18px;
  border: 2px solid var(--accent);
  border-radius: 8px;
  background: transparent;
  color: var(--accent-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.example-btn:hover {
  background: var(--accent-solid);
  color: white;
}

.upload-images-wrapper {
  margin-bottom: 24px;
}

/* 设置区域 */
.settings-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg);
  border-radius: 10px;
}

.settings-section h2 {
  margin-bottom: 16px;
  color: var(--text-strong);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: 20px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item label {
  font-weight: 600;
  color: var(--text-strong);
}

.setting-item select {
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}

.setting-item select:focus {
  border-color: var(--accent);
}

.quality-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quality-control input[type="range"] {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.quality-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
  border: 2px solid white;
}

.quality-control input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
  border: 2px solid white;
}

.quality-value {
  font-weight: 700;
  color: var(--accent-text);
  min-width: 50px;
}

.resize-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resize-control input {
  width: 80px;
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
}

.resize-control input:focus {
  border-color: var(--accent);
}

.resize-x {
  color: var(--text-3);
  font-weight: 600;
}

.setting-hint {
  font-size: 12px;
  color: var(--text-3);
}

/* 图片列表 */
.images-section {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, var(--accent)15 0%, var(--accent-2)15 100%);
  border-radius: 12px;
  border: 2px solid var(--accent)40;
}

.images-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.images-section h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.1rem;
}

.images-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  padding: 8px 16px;
  background: var(--surface);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
}

.total-original {
  color: var(--text-2);
}

.total-arrow {
  color: var(--text-3);
}

.total-converted {
  color: var(--accent-text);
  font-weight: 600;
}

.format-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--surface);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
}

.format-label {
  color: var(--text-2);
  font-size: 14px;
}

.format-value {
  color: var(--accent-text);
  font-weight: 700;
  font-size: 14px;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
  gap: 16px;
}

.image-card {
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid var(--border);
  transition: all 0.3s;
  box-shadow: var(--shadow-card);
}

.image-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
  transform: translateY(-2px);
}

.image-preview {
  position: relative;
  height: 150px;
  background: linear-gradient(135deg, var(--bg-soft) 0%, var(--border) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.format-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.format-tag.original {
  background: linear-gradient(135deg, var(--accent-grad-from) 0%, var(--accent-grad-to) 100%);
  color: white;
}

.convert-status {
  position: absolute;
  bottom: 8px;
  left: 8px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.success {
  background: var(--success-solid);
  color: white;
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  opacity: 0.8;
}

.image-card:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: var(--danger-solid);
  transform: scale(1.1);
}

.image-info {
  padding: 12px 16px;
}

.image-name {
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-dims {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 6px;
}

.size-compare {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}

.original-size {
  color: var(--text-2);
}

.arrow {
  color: var(--text-3);
}

.converted-size {
  color: var(--accent-text);
  font-weight: 600;
}

.image-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.action-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.convert-btn {
  background: linear-gradient(135deg, var(--accent-grad-from) 0%, var(--accent-grad-to) 100%);
  color: white;
}

.convert-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.download-btn {
  background: var(--success-solid);
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: var(--success-solid);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }

  .upload-area {
    padding: 30px 20px;
  }

  .upload-area.compact {
    padding: 16px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .images-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .images-summary,
  .format-badge {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
    gap: 12px;
  }

  .image-preview {
    height: 120px;
  }

  .resize-control {
    flex-wrap: wrap;
  }

  .resize-control input {
    width: 70px;
  }

  .image-info {
    padding: 10px 12px;
  }

  .image-actions {
    padding: 10px 12px;
  }

  .action-btn {
    padding: 8px;
    font-size: 13px;
  }
}
</style>
