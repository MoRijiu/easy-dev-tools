<template>
  <div class="image-compress">
    <h1>图片压缩工具</h1>
    <p class="description">
      在线图片压缩工具，支持 JPG、PNG、WebP 等格式，可调节压缩质量，批量压缩
    </p>

    <div class="tool-container">
      <!-- 上传区域 + 图片列表 -->
      <div class="upload-images-wrapper">
        <!-- 上传区域 -->
        <div
          class="upload-area"
          :class="{ 'dragging': isDragging, 'compact': images.length > 0 }"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            @change="onFileSelect"
            style="display: none"
          />
          <div class="upload-content">
            <span class="upload-icon">{{ images.length > 0 ? '➕' : '📁' }}</span>
            <p class="upload-text">{{ images.length > 0 ? '继续添加图片' : '拖拽图片到此处，或点击选择图片' }}</p>
            <p class="upload-hint" v-if="images.length === 0">支持 JPG、PNG、WebP 等格式，可多选（单张 ≤20MB、最多 20 张；GIF 只保留第一帧）</p>
          </div>
        </div>

        <!-- 图片列表 - 紧跟上传区域 -->
        <div class="images-section" v-if="images.length > 0">
          <div class="images-header">
            <h3>🖼️ 已选择 {{ images.length }} 张图片</h3>
            <div class="images-summary" v-if="summary.doneCount > 0">
              <span class="total-original">已压缩 {{ summary.doneCount }}/{{ summary.totalCount }} 张 · 原始 {{ formatSize(summary.original) }}</span>
              <span class="total-arrow">→</span>
              <span class="total-compressed">压缩后: {{ formatSize(summary.compressed) }}</span>
              <span class="total-savings">{{ summary.savings >= 0 ? `节省 ${summary.savings}%` : `反而大 ${Math.abs(summary.savings)}%` }}</span>
            </div>
          </div>
          <div class="images-grid">
            <div
              v-for="(img, index) in images"
              :key="index"
              class="image-card"
            >
              <div class="image-preview">
                <img :src="img.preview" :alt="img.name" />
                <button class="remove-btn" @click.stop="removeImage(index)" title="移除">×</button>
                <div class="compress-status" v-if="img.compressedSize">
                  <span class="status-badge success">✓ 已压缩</span>
                </div>
              </div>
              <div class="image-info">
                <p class="image-name" :title="img.name">{{ truncateName(img.name) }}</p>
                <p class="image-dims" v-if="img.width">{{ img.width }} × {{ img.height }} px<span v-if="img.outputLabel"> · 输出 {{ img.outputLabel }}<template v-if="img.outWidth"> {{ img.outWidth }} × {{ img.outHeight }} px</template></span></p>
                <div class="size-compare">
                  <span class="original-size">{{ formatSize(img.originalSize) }}</span>
                  <template v-if="img.compressedSize">
                    <span class="arrow">→</span>
                    <span class="compressed-size">{{ formatSize(img.compressedSize) }}</span>
                    <span class="savings" :class="{ 'positive': img.savings > 0 }">
                      {{ img.savings > 0 ? '-' : '+' }}{{ Math.abs(img.savings) }}%
                    </span>
                  </template>
                </div>
              </div>
              <div class="image-actions">
                <button
                  class="action-btn compress-btn"
                  @click="compressImage(index)"
                  :disabled="img.compressing"
                >
                  {{ img.compressing ? '压缩中...' : (img.compressedBlob ? '重新压缩' : '压缩') }}
                </button>
                <button
                  class="action-btn download-btn"
                  @click="downloadImage(index)"
                  :disabled="!img.compressedBlob"
                >
                  下载
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- 压缩设置 -->
      <div class="settings-section" v-if="images.length > 0">
        <h3>⚙️ 压缩设置</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <label>压缩质量</label>
            <div class="quality-control">
              <input
                type="range"
                v-model="quality"
                min="10"
                max="100"
                step="5"
                :style="{ background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${quality}%, var(--border) ${quality}%, var(--border) 100%)` }"
              />
              <span class="quality-value">{{ quality }}%</span>
            </div>
            <span class="setting-hint">质量越低，文件越小</span>
          </div>
          <div class="setting-item">
            <label>最大宽度 (px)</label>
            <input
              type="text"
              inputmode="numeric"
              v-model="maxWidth"
              placeholder="不限制"
            />
            <span class="setting-hint">超过此宽度将等比缩放（16–8192，留空不限制，只缩小不放大）</span>
          </div>
          <div class="setting-item">
            <label>输出格式</label>
            <select v-model="outputFormat">
              <option value="original">保持原格式</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
            <span class="setting-hint">WebP 格式体积最小</span>
          </div>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar v-if="images.length > 0">
        <button class="btn btn-primary" @click="compressAll" :disabled="images.length === 0">
          <span class="icon">🗜️</span> 压缩全部
        </button>
        <button class="btn btn-success" @click="downloadAll" :disabled="!hasCompressedImages">
          <span class="icon">📥</span> 下载全部
        </button>
        <button class="btn btn-danger" @click="clearAll" :disabled="images.length === 0">
          <span class="icon">🗑️</span> 清空
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

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
import { MAX_IMAGE_COUNT, computeScaledSize, formatBytes, mimeLabel, mimeToExt, parseMaxWidth, parseQuality, resolveCompressMime, savingsPercent, summarizeCompression, validateImageFile } from "@/utils/imageTools.js";

// 响应式状态
const fileInput = ref(null);
const isDragging = ref(false);
const images = ref([]);
const quality = ref(80);
const maxWidth = ref("");
const outputFormat = ref("original");
const statusMessage = ref("");
const statusType = ref("");

// 计算属性
const hasCompressedImages = computed(() => images.value.some(img => img.compressedBlob));
const summary = computed(() => summarizeCompression(images.value));

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click();
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
    const err = validateImageFile(file);
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
          originalSize: file.size, width: probe.width, height: probe.height,
          compressedSize: null, compressedBlob: null, compressing: false,
          savings: 0, outputLabel: "", outWidth: 0, outHeight: 0
        });
      };
      probe.onerror = () => { statusMessage.value = `✗ ${file.name} 图片加载失败，文件可能已损坏`; statusType.value = "error"; };
      probe.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  if (added) { statusMessage.value = `✓ 已添加 ${added} 张图片`; statusType.value = "success"; }
  if (rejected.length) { statusMessage.value = `${added ? `✓ 已添加 ${added} 张；` : ""}已跳过 ${rejected.length} 个：${rejected.join("；")}`; statusType.value = added ? "info" : "error"; }
  if (!added && !rejected.length) { statusMessage.value = "没有选择图片"; statusType.value = "info"; }
};

// 压缩单张图片：先严格校验设置，再按实际 blob.type 核对输出格式（WebP 不支持时浏览器会回退 PNG）
const compressImage = async (index) => {
  const img = images.value[index];
  if (img.compressing) return;
  let qualityValue, maxWidthValue, resolved;
  try {
    qualityValue = parseQuality(quality.value);
    maxWidthValue = parseMaxWidth(maxWidth.value);
    resolved = resolveCompressMime(img.file.type, outputFormat.value);
  } catch (error) {
    statusMessage.value = `✗ ${error.message}`;
    statusType.value = "error";
    return;
  }
  img.compressing = true;
  try {
    const { blob, width, height } = await compressImageFile(img.preview, resolved.mime, qualityValue, maxWidthValue);
    img.compressedBlob = blob;
    img.compressedSize = blob.size;
    img.savings = savingsPercent(img.originalSize, blob.size) ?? 0;
    img.outWidth = width; img.outHeight = height;
    const actualLabel = mimeLabel(blob.type);
    img.outputLabel = actualLabel;
    const notes = [];
    if (resolved.warning) notes.push(resolved.warning);
    if (blob.type && blob.type !== resolved.mime) notes.push(`浏览器不支持 ${mimeLabel(resolved.mime)} 编码，实际输出为 ${actualLabel}`);
    statusMessage.value = `✓ ${img.name} 压缩完成，${img.savings >= 0 ? `节省 ${img.savings}%` : `反而大 ${Math.abs(img.savings)}%（可降低质量或改用 WebP）`}${notes.length ? "；" + notes.join("；") : ""}`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 压缩失败: ${error.message}`;
    statusType.value = "error";
  } finally {
    img.compressing = false;
  }
};

const compressImageFile = (dataUrl, mimeType, qualityValue, maxWidthValue) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const { width, height } = computeScaledSize(image.width, image.height, maxWidthValue);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width; canvas.height = height;
        if (mimeType === "image/jpeg") { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => blob ? resolve({ blob, width, height }) : reject(new Error("压缩失败，浏览器未能编码该格式")), mimeType, qualityValue / 100);
      } catch (e) { reject(e); }
    };
    image.onerror = () => reject(new Error("图片加载失败，文件可能已损坏"));
    image.src = dataUrl;
  });
};

// 压缩全部
const compressAll = async () => {
  statusMessage.value = "正在压缩所有图片...";
  statusType.value = "info";

  for (let i = 0; i < images.value.length; i++) {
    await compressImage(i);
  }

  statusMessage.value = `✓ 已完成 ${images.value.length} 张图片压缩`;
  statusType.value = "success";
};

// 下载单张图片
const downloadImage = (index) => {
  const img = images.value[index];
  if (!img.compressedBlob) return;

  const link = document.createElement("a");
  const ext = mimeToExt(img.compressedBlob.type);
  const baseName = img.name.replace(/\.[^/.]+$/, "");
  link.download = `${baseName}_compressed.${ext}`;
  link.href = URL.createObjectURL(img.compressedBlob);
  link.click();
  URL.revokeObjectURL(link.href);
};

// 下载全部
const downloadAll = () => {
  images.value.forEach((img, index) => {
    if (img.compressedBlob) {
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
  "点击上传区域或拖拽图片到上传区域",
  "调整压缩质量、最大宽度和输出格式",
  "点击「压缩」按钮压缩单张图片，或点击「压缩全部」批量压缩",
  "压缩完成后点击「下载」保存图片",
];

// 功能特点
const features = [
  { icon: "🗜️", title: "高效压缩", description: "智能压缩算法，在保持画质的同时大幅减小文件体积" },
  { icon: "📁", title: "批量处理", description: "支持同时上传多张图片，一键批量压缩" },
  { icon: "🎛️", title: "自定义设置", description: "可调节压缩质量、最大宽度和输出格式" },
  { icon: "👁️", title: "实时预览", description: "压缩前后效果对比，清晰了解压缩效果" },
  { icon: "🔒", title: "本地处理", description: "所有操作在浏览器本地完成，保护隐私" },
  { icon: "📱", title: "多格式支持", description: "支持 JPG、PNG、WebP 等格式，GIF 只保留第一帧并会明确提示" },
];

// 常见问题
const faqs = [
  { question: "压缩后图片质量会下降吗？", answer: "压缩会对图片质量产生一定影响，但通过调整压缩质量参数，可以在文件大小和画质之间找到平衡。建议从80%开始尝试。" },
  { question: "支持哪些图片格式？", answer: "支持 JPG、PNG、GIF、WebP 等主流图片格式。输出格式可以自定义选择。" },
  { question: "压缩后的图片会上传到服务器吗？", answer: "不会。所有压缩操作都在您的浏览器中本地完成，图片不会上传到任何服务器，完全保护您的隐私。" },
  { question: "为什么有时候压缩后文件反而变大了？", answer: "这可能发生在：1. 原图已经高度压缩过；2. 将低质量格式转换为无损格式（如PNG）；3. 压缩质量设置过高。页面会如实显示「反而大」的百分比，建议尝试降低质量或使用 WebP 格式。" },
  { question: "GIF 动图压缩后为什么不动了？", answer: "Canvas 只能读取 GIF 的第一帧，压缩输出会改为 PNG 静态图，页面会明确提示。需要保留动画请不要用本工具处理动图。" },
  { question: "为什么不支持 SVG？", answer: "SVG 是矢量格式，放大缩小本就无损；栅格化成位图反而会丢清晰度并可能丢失字体，所以添加时会被跳过并说明原因。" },
  { question: "单张和数量有什么限制？", answer: "单张最大 20MB、一次最多 20 张，超限的文件会被跳过并逐个说明原因；汇总只统计已压缩的图片，不会把未压缩的按原大小混入造成假节省。" },
];
</script>

<style scoped>
.image-compress {
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

.upload-area:hover,
.upload-area.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* 有图片时的紧凑样式 */
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

/* 上传+图片区域包装 */
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

.settings-section h3 {
  margin-bottom: 16px;
  color: var(--text-strong);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.setting-item input[type="number"],
.setting-item select {
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}

.setting-item input:focus,
.setting-item select:focus {
  outline: none;
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
  outline: none;
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
  transition: transform 0.2s;
}

.quality-control input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.1);
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

.quality-control input[type="range"]::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: var(--border);
}

.quality-value {
  font-weight: 700;
  color: var(--accent);
  min-width: 50px;
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

.images-section h3 {
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.total-original {
  color: var(--text-2);
}

.total-arrow {
  color: var(--text-3);
}

.total-compressed {
  color: var(--success);
  font-weight: 600;
}

.total-savings {
  background: linear-gradient(135deg, var(--success) 0%, var(--success) 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.image-card {
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid var(--border);
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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

.compress-status {
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
  background: var(--success);
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
  background: var(--danger, #e74c3c);
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

.compressed-size {
  color: var(--success);
  font-weight: 600;
}

.savings {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  background: #fee;
  color: var(--danger, #e74c3c);
}

.savings.positive {
  background: var(--success-soft);
  color: var(--success);
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

.compress-btn {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  color: white;
}

.compress-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.download-btn {
  background: var(--success);
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: var(--success);
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

  .images-summary {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .image-preview {
    height: 120px;
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

