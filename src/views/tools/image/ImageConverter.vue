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
            <p class="upload-hint" v-if="images.length === 0">支持 JPG、PNG、GIF、WebP、BMP 等格式，可多选</p>
          </div>
        </div>

        <!-- 图片列表 -->
        <div class="images-section" v-if="images.length > 0">
          <div class="images-header">
            <h3>🖼️ 已选择 {{ images.length }} 张图片</h3>
            <div class="format-badge">
              <span class="format-label">目标格式:</span>
              <span class="format-value">{{ targetFormatLabel }}</span>
            </div>
          </div>
          <div class="images-grid">
            <div v-for="(img, index) in images" :key="index" class="image-card">
              <div class="image-preview">
                <img :src="img.preview" :alt="img.name" />
                <button class="remove-btn" @click.stop="removeImage(index)" title="移除">×</button>
                <div class="format-tag original">{{ img.originalFormat }}</div>
                <div class="convert-status" v-if="img.convertedBlob">
                  <span class="status-badge success">✓ 已转换</span>
                </div>
              </div>
              <div class="image-info">
                <p class="image-name" :title="img.name">{{ truncateName(img.name) }}</p>
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
                >
                  {{ img.converting ? '转换中...' : (img.convertedBlob ? '重新转换' : '转换') }}
                </button>
                <button
                  class="action-btn download-btn"
                  @click="downloadImage(index)"
                  :disabled="!img.convertedBlob"
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
        <h3>⚙️ 转换设置</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <label>目标格式</label>
            <select v-model="targetFormat">
              <option value="image/jpeg">JPEG (.jpg)</option>
              <option value="image/png">PNG (.png)</option>
              <option value="image/webp">WebP (.webp)</option>
              <option value="image/gif">GIF (.gif)</option>
              <option value="image/bmp">BMP (.bmp)</option>
              <option value="image/x-icon">ICO (.ico)</option>
            </select>
            <span class="setting-hint">{{ formatHints[targetFormat] }}</span>
          </div>
          <div class="setting-item" v-if="supportsQuality">
            <label>输出质量</label>
            <div class="quality-control">
              <input
                type="range"
                v-model="quality"
                min="10"
                max="100"
                step="5"
                :style="{ background: `linear-gradient(to right, #667eea 0%, #667eea ${quality}%, #e0e0e0 ${quality}%, #e0e0e0 100%)` }"
              />
              <span class="quality-value">{{ quality }}%</span>
            </div>
            <span class="setting-hint">质量越高，文件越大</span>
          </div>
          <div class="setting-item">
            <label>调整尺寸</label>
            <div class="resize-control">
              <input type="number" v-model.number="resizeWidth" min="0" placeholder="宽度" />
              <span class="resize-x">×</span>
              <input type="number" v-model.number="resizeHeight" min="0" placeholder="高度" />
            </div>
            <span class="setting-hint">留空保持原尺寸，只填一项则等比缩放</span>
          </div>
        </div>
      </div>

      <!-- 工具栏 -->
      <ToolToolbar v-if="images.length > 0">
        <button class="btn btn-primary" @click="convertAll" :disabled="images.length === 0">
          <span class="icon">🔄</span> 转换全部
        </button>
        <button class="btn btn-success" @click="downloadAll" :disabled="!hasConvertedImages">
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
const targetFormat = ref("image/png");
const quality = ref(90);
const resizeWidth = ref(0);
const resizeHeight = ref(0);
const statusMessage = ref("");
const statusType = ref("");

// 格式提示信息
const formatHints = {
  "image/jpeg": "适合照片，有损压缩，文件较小",
  "image/png": "适合图标/截图，无损压缩，支持透明",
  "image/webp": "现代格式，压缩率高，支持透明",
  "image/gif": "适合简单动画，仅支持256色",
  "image/bmp": "无压缩位图，文件较大",
  "image/x-icon": "适合网站图标，支持多尺寸"
};

// 计算属性
const hasConvertedImages = computed(() => images.value.some(img => img.convertedBlob));
const supportsQuality = computed(() => ["image/jpeg", "image/webp"].includes(targetFormat.value));
const targetFormatLabel = computed(() => {
  const map = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "image/bmp": "BMP",
    "image/x-icon": "ICO"
  };
  return map[targetFormat.value] || "PNG";
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

// 获取格式显示名
const getFormatName = (mimeType) => {
  const map = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "image/bmp": "BMP",
    "image/x-icon": "ICO",
    "image/svg+xml": "SVG"
  };
  return map[mimeType] || mimeType.split("/")[1]?.toUpperCase() || "未知";
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
        originalFormat: getFormatName(file.type),
        convertedSize: null,
        convertedBlob: null,
        converting: false
      });
    };
    reader.readAsDataURL(file);
  });
  statusMessage.value = `✓ 已添加 ${files.length} 张图片`;
  statusType.value = "success";
};

// 转换单张图片
const convertImage = async (index) => {
  const img = images.value[index];
  if (img.converting) return;

  img.converting = true;

  try {
    const convertedBlob = await convertImageFile(img.preview);
    img.convertedBlob = convertedBlob;
    img.convertedSize = convertedBlob.size;

    statusMessage.value = `✓ ${img.name} 转换完成！`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `✗ 转换失败: ${error.message}`;
    statusType.value = "error";
  } finally {
    img.converting = false;
  }
};

// 图片转换核心函数
const convertImageFile = (dataUrl) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let width = image.width;
      let height = image.height;

      // 处理调整尺寸
      if (resizeWidth.value > 0 && resizeHeight.value > 0) {
        width = resizeWidth.value;
        height = resizeHeight.value;
      } else if (resizeWidth.value > 0) {
        height = Math.round((height * resizeWidth.value) / width);
        width = resizeWidth.value;
      } else if (resizeHeight.value > 0) {
        width = Math.round((width * resizeHeight.value) / height);
        height = resizeHeight.value;
      }

      canvas.width = width;
      canvas.height = height;

      // 如果是 JPEG 或 BMP，填充白色背景（不支持透明）
      if (targetFormat.value === "image/jpeg" || targetFormat.value === "image/bmp") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
      }

      // 绘制图片
      ctx.drawImage(image, 0, 0, width, height);

      // 处理 ICO 格式（限制尺寸）
      if (targetFormat.value === "image/x-icon") {
        // ICO 通常使用 PNG 编码
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("转换失败")),
          "image/png",
          1
        );
        return;
      }

      // 转换为目标格式
      const qualityValue = supportsQuality.value ? quality.value / 100 : 1;
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("转换失败")),
        targetFormat.value,
        qualityValue
      );
    };
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = dataUrl;
  });
};

// 转换全部
const convertAll = async () => {
  statusMessage.value = "正在转换所有图片...";
  statusType.value = "info";

  for (let i = 0; i < images.value.length; i++) {
    await convertImage(i);
  }

  statusMessage.value = `✓ 已完成 ${images.value.length} 张图片转换`;
  statusType.value = "success";
};

// 下载单张图片
const downloadImage = (index) => {
  const img = images.value[index];
  if (!img.convertedBlob) return;

  const link = document.createElement("a");
  const ext = getExtension(targetFormat.value);
  const baseName = img.name.replace(/\.[^/.]+$/, "");
  link.download = `${baseName}.${ext}`;
  link.href = URL.createObjectURL(img.convertedBlob);
  link.click();
  URL.revokeObjectURL(link.href);
};

// 获取文件扩展名
const getExtension = (mimeType) => {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/x-icon": "ico"
  };
  return map[mimeType] || "png";
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
  "选择目标格式（如 PNG、JPG、WebP 等）",
  "根据需要调整输出质量和尺寸",
  "点击「转换」按钮转换单张图片，或点击「转换全部」批量转换",
  "转换完成后点击「下载」保存图片",
];

// 功能特点
const features = [
  { icon: "🔄", title: "多格式支持", description: "支持 JPG、PNG、WebP、GIF、BMP、ICO 等格式互转" },
  { icon: "📁", title: "批量转换", description: "支持同时上传多张图片，一键批量转换" },
  { icon: "🎛️", title: "质量调节", description: "支持调节 JPEG、WebP 格式的输出质量" },
  { icon: "📐", title: "尺寸调整", description: "可自定义输出图片的宽度和高度" },
  { icon: "🔒", title: "本地处理", description: "所有操作在浏览器本地完成，保护隐私" },
  { icon: "⚡", title: "快速转换", description: "利用 Canvas API 实现高效转换" },
];

// 常见问题
const faqs = [
  { question: "转换后图片质量会变差吗？", answer: "取决于目标格式。PNG 是无损格式，不会损失质量；JPEG 和 WebP 是有损格式，可通过调整质量参数控制。建议转换为 PNG 或高质量 WebP 以保持最佳画质。" },
  { question: "为什么转换后文件变大了？", answer: "这通常发生在将有损格式转为无损格式时（如 JPG→PNG），或将压缩率高的格式转为压缩率低的格式。如果需要更小的文件，推荐使用 WebP 格式。" },
  { question: "支持转换透明背景吗？", answer: "PNG、WebP、GIF 格式支持透明背景。转换为 JPEG 或 BMP 格式时，透明区域会被填充为白色背景。" },
  { question: "ICO 格式有什么特殊用途？", answer: "ICO 格式主要用于网站 favicon 图标。建议使用较小的尺寸（如 32x32 或 64x64 像素）以获得最佳效果。" },
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

/* 上传区域 */
.upload-area {
  border: 3px dashed #e0e0e0;
  border-radius: 12px;
  padding: 50px 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8f9fa;
  margin-bottom: 24px;
}

.upload-area:hover,
.upload-area.dragging {
  border-color: #667eea;
  background: #f0f4ff;
}

.upload-area.compact {
  padding: 20px;
  border-style: dashed;
  background: linear-gradient(135deg, #f8f9fa 0%, #e8f4fd 100%);
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
  color: #2c3e50;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: #999;
}

.upload-images-wrapper {
  margin-bottom: 24px;
}

/* 设置区域 */
.settings-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
}

.settings-section h3 {
  margin-bottom: 16px;
  color: #2c3e50;
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
  color: #2c3e50;
}

.setting-item select {
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

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
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
  border: 2px solid white;
}

.quality-value {
  font-weight: 700;
  color: #667eea;
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
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
}

.resize-control input:focus {
  outline: none;
  border-color: #667eea;
}

.resize-x {
  color: #999;
  font-weight: 600;
}

.setting-hint {
  font-size: 12px;
  color: #999;
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
  color: #2c3e50;
  font-size: 1.1rem;
}

.format-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.format-label {
  color: #666;
  font-size: 14px;
}

.format-value {
  color: #667eea;
  font-weight: 700;
  font-size: 14px;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.image-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
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
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  color: #2c3e50;
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
  color: #666;
}

.arrow {
  color: #999;
}

.converted-size {
  color: #667eea;
  font-weight: 600;
}

.image-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.convert-btn:hover:not(:disabled) {
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

  .format-badge {
    width: 100%;
    justify-content: center;
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
}
</style>

