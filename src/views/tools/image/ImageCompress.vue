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
            <p class="upload-hint" v-if="images.length === 0">支持 JPG、PNG、GIF、WebP 等格式，可多选</p>
          </div>
        </div>

        <!-- 图片列表 - 紧跟上传区域 -->
        <div class="images-section" v-if="images.length > 0">
          <div class="images-header">
            <h3>🖼️ 已选择 {{ images.length }} 张图片</h3>
            <div class="images-summary" v-if="totalSavings > 0">
              <span class="total-original">原始总大小: {{ formatSize(totalOriginalSize) }}</span>
              <span class="total-arrow">→</span>
              <span class="total-compressed">压缩后: {{ formatSize(totalCompressedSize) }}</span>
              <span class="total-savings">节省 {{ totalSavings }}%</span>
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
                :style="{ background: `linear-gradient(to right, #667eea 0%, #667eea ${quality}%, var(--border) ${quality}%, var(--border) 100%)` }"
              />
              <span class="quality-value">{{ quality }}%</span>
            </div>
            <span class="setting-hint">质量越低，文件越小</span>
          </div>
          <div class="setting-item">
            <label>最大宽度 (px)</label>
            <input
              type="number"
              v-model.number="maxWidth"
              min="100"
              max="4096"
              placeholder="不限制"
            />
            <span class="setting-hint">超过此宽度将等比缩放</span>
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

// 响应式状态
const fileInput = ref(null);
const isDragging = ref(false);
const images = ref([]);
const quality = ref(80);
const maxWidth = ref(0);
const outputFormat = ref("original");
const statusMessage = ref("");
const statusType = ref("");

// 计算属性
const hasCompressedImages = computed(() => images.value.some(img => img.compressedBlob));
const totalOriginalSize = computed(() => images.value.reduce((sum, img) => sum + img.originalSize, 0));
const totalCompressedSize = computed(() => images.value.reduce((sum, img) => sum + (img.compressedSize || img.originalSize), 0));
const totalSavings = computed(() => {
  if (!hasCompressedImages.value) return 0;
  return Math.round((1 - totalCompressedSize.value / totalOriginalSize.value) * 100);
});

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

// 添加图片
const addImages = (files) => {
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      images.value.push({
        name: file.name,
        file: file,
        preview: e.target.result,
        originalSize: file.size,
        compressedSize: null,
        compressedBlob: null,
        compressing: false,
        savings: 0
      });
    };
    reader.readAsDataURL(file);
  });
  statusMessage.value = `✓ 已添加 ${files.length} 张图片`;
  statusType.value = "success";
};

// 压缩单张图片
const compressImage = async (index) => {
  const img = images.value[index];
  if (img.compressing) return;

  img.compressing = true;

  try {
    const compressedBlob = await compressImageFile(img.file, img.preview);
    img.compressedBlob = compressedBlob;
    img.compressedSize = compressedBlob.size;
    img.savings = Math.round((1 - compressedBlob.size / img.originalSize) * 100);

    // 更新预览
    img.preview = URL.createObjectURL(compressedBlob);

    statusMessage.value = `✓ ${img.name} 压缩完成，节省 ${img.savings}%`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 压缩失败: ${error.message}`;
    statusType.value = "error";
  } finally {
    img.compressing = false;
  }
};

// 压缩图片核心函数
const compressImageFile = (file, dataUrl) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let width = image.width;
      let height = image.height;

      // 限制最大宽度
      if (maxWidth.value > 0 && width > maxWidth.value) {
        height = Math.round((height * maxWidth.value) / width);
        width = maxWidth.value;
      }

      canvas.width = width;
      canvas.height = height;

      // 绘制图片
      ctx.drawImage(image, 0, 0, width, height);

      // 确定输出格式
      let mimeType = outputFormat.value === "original" ? file.type : outputFormat.value;
      if (!mimeType || mimeType === "image/gif") mimeType = "image/png";

      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("压缩失败"));
          }
        },
        mimeType,
        quality.value / 100
      );
    };
    image.onerror = () => reject(new Error("图片加载失败"));
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
  const ext = getExtension(img.compressedBlob.type);
  const baseName = img.name.replace(/\.[^/.]+$/, "");
  link.download = `${baseName}_compressed.${ext}`;
  link.href = URL.createObjectURL(img.compressedBlob);
  link.click();
  URL.revokeObjectURL(link.href);
};

// 获取文件扩展名
const getExtension = (mimeType) => {
  const map = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  return map[mimeType] || "jpg";
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
const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

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
  { icon: "📱", title: "多格式支持", description: "支持 JPG、PNG、GIF、WebP 等常见图片格式" },
];

// 常见问题
const faqs = [
  { question: "压缩后图片质量会下降吗？", answer: "压缩会对图片质量产生一定影响，但通过调整压缩质量参数，可以在文件大小和画质之间找到平衡。建议从80%开始尝试。" },
  { question: "支持哪些图片格式？", answer: "支持 JPG、PNG、GIF、WebP 等主流图片格式。输出格式可以自定义选择。" },
  { question: "压缩后的图片会上传到服务器吗？", answer: "不会。所有压缩操作都在您的浏览器中本地完成，图片不会上传到任何服务器，完全保护您的隐私。" },
  { question: "为什么有时候压缩后文件反而变大了？", answer: "这可能发生在：1. 原图已经高度压缩过；2. 将低质量格式转换为无损格式（如PNG）；3. 压缩质量设置过高。建议尝试降低质量或使用 WebP 格式。" },
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
  border-color: #667eea;
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
  border-color: #667eea;
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
  background: #667eea;
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
  background: #667eea;
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
  color: #667eea;
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
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 12px;
  border: 2px solid #667eea40;
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
  color: #27ae60;
  font-weight: 600;
}

.total-savings {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
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
  border-color: #667eea;
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
  background: #27ae60;
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
  background: #e74c3c;
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
  color: #27ae60;
  font-weight: 600;
}

.savings {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  background: #fee;
  color: #e74c3c;
}

.savings.positive {
  background: var(--success-soft);
  color: #27ae60;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.compress-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.download-btn {
  background: #27ae60;
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: #219a52;
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

