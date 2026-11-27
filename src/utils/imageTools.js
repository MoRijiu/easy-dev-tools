// 图片工具共享纯逻辑（纯本地）：文件校验、尺寸计算、输出格式与体积统计。
// Canvas 编解码本身在组件里，这里只放可独立测试的判断，避免靠 input 的 min/max 假装校验。

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 单张 20MB
export const MAX_IMAGE_COUNT = 20;

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

const MIME_LABEL = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/x-icon': 'ICO',
  'image/svg+xml': 'SVG',
  'image/avif': 'AVIF',
};

export function mimeToExt(mime) {
  return MIME_EXT[String(mime || '').toLowerCase()] || 'png';
}

export function mimeLabel(mime) {
  const key = String(mime || '').toLowerCase();
  return MIME_LABEL[key] || (key.split('/')[1]?.toUpperCase() || '未知');
}

// 校验一个待处理文件（只看元信息）。返回 null 表示通过，否则返回中文原因。
export function validateImageFile(file, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (!file) return '文件为空';
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) return `不是图片文件（类型 ${file.type || '未知'}）`;
  if (type === 'image/svg+xml') return 'SVG 是矢量格式，Canvas 栅格化压缩意义不大且可能丢字体，已跳过';
  if (!(file.size > 0)) return '文件大小为 0';
  if (file.size > maxBytes) return `超过单张上限 ${formatBytes(maxBytes)}（实际 ${formatBytes(file.size)}）`;
  return null;
}

// 严格解析质量（1–100 的整数）。空/小数/越界都点名报错，不静默钳制。
export function parseQuality(raw) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error(`压缩质量必须是 1–100 的整数，当前是「${text || '空'}」`);
  const value = Number(text);
  if (value < 1 || value > 100) throw new Error(`压缩质量必须在 1–100 之间，当前是 ${value}`);
  return value;
}

// 严格解析最大宽度：空或 0 表示不限制，否则须为 16–8192 的整数。
export function parseMaxWidth(raw) {
  const text = String(raw ?? '').trim();
  if (text === '' || text === '0') return 0;
  if (!/^\d+$/.test(text)) throw new Error(`最大宽度必须是整数像素，当前是「${text}」`);
  const value = Number(text);
  if (value < 16 || value > 8192) throw new Error(`最大宽度必须在 16–8192 之间，当前是 ${value}`);
  return value;
}

// 等比缩放目标尺寸：只缩小不放大；maxWidth=0 表示不限制。
export function computeScaledSize(width, height, maxWidth) {
  if (!(width > 0) || !(height > 0)) throw new Error('图片尺寸无效，文件可能已损坏');
  const limit = Number(maxWidth) || 0;
  if (limit <= 0 || width <= limit) return { width, height, scaled: false };
  return { width: limit, height: Math.max(1, Math.round((height * limit) / width)), scaled: true };
}

// 决定压缩输出 MIME：返回 { mime, warning }。
// GIF 经 Canvas 只保留第一帧（动图会变静态图），保持原格式时改走 PNG 并明确提示；
// 浏览器不支持 WebP 编码时 toBlob 会回退 PNG，组件需按 blob.type 再核对实际格式。
export function resolveCompressMime(fileType, requested) {
  const original = String(fileType || '').toLowerCase();
  if (!requested || requested === 'original') {
    if (original === 'image/gif') return { mime: 'image/png', warning: 'GIF 经 Canvas 压缩只保留第一帧，已输出为 PNG（动图会变静态图）' };
    if (original === 'image/bmp') return { mime: 'image/png', warning: 'BMP 无压缩，输出为 PNG 以免体积暴涨' };
    if (MIME_EXT[original] && original !== 'image/svg+xml') return { mime: original, warning: '' };
    return { mime: 'image/png', warning: `原格式 ${original || '未知'} 浏览器不能编码，已输出为 PNG` };
  }
  const mime = String(requested).toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error(`不支持的输出格式：${requested}`);
  if (mime === 'image/jpeg' && (original === 'image/png' || original === 'image/webp')) {
    return { mime, warning: '输出 JPEG 时透明区域会被填充为白色背景' };
  }
  return { mime, warning: '' };
}

// 节省百分比：负数表示反而变大（调用方如实展示，不藏）。
export function savingsPercent(originalSize, compressedSize) {
  if (!(originalSize > 0) || compressedSize == null) return null;
  return Math.round((1 - compressedSize / originalSize) * 100);
}

// 汇总：只统计已压缩的图片，避免未压缩项按原大小混入「压缩后」总量造成假节省。
export function summarizeCompression(images) {
  const done = (images || []).filter((img) => img && img.compressedSize != null);
  const original = done.reduce((sum, img) => sum + img.originalSize, 0);
  const compressed = done.reduce((sum, img) => sum + img.compressedSize, 0);
  return {
    doneCount: done.length,
    totalCount: (images || []).length,
    original,
    compressed,
    savings: done.length ? savingsPercent(original, compressed) : null,
  };
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
