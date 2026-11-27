// 图片格式转换纯逻辑（纯本地）：目标格式/尺寸严格校验、转换提示、真 ICO 打包、汇总统计。
// 与 imageTools.js 分工：那边管文件校验/质量/字节格式化等共享件，这边管「转换成什么、怎么打包」。
// 旧版的假 ICO（PNG 编码直接改名 .ico）在这里被真 ICO 取代：
// buildIco 生成 ICONDIR + ICONDIRENTRY + 内嵌 PNG 数据的标准 ICO 文件。

import { MAX_IMAGE_BYTES } from './imageTools.js';

export const ICO_SIZES = [16, 32, 48];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// 目标格式表：value 是内部标识（ICO 用 'ico'，其余用目标 MIME）。
export const TARGET_FORMATS = [
  { value: 'image/jpeg', label: 'JPEG', ext: 'jpg', supportsQuality: true, hint: '适合照片，有损压缩，文件较小；透明区域会填白' },
  { value: 'image/png', label: 'PNG', ext: 'png', supportsQuality: false, hint: '适合图标/截图，无损压缩，支持透明' },
  { value: 'image/webp', label: 'WebP', ext: 'webp', supportsQuality: true, hint: '现代格式，压缩率高，支持透明' },
  { value: 'image/gif', label: 'GIF', ext: 'gif', supportsQuality: false, hint: '浏览器 Canvas 无法编码 GIF，实际会输出 PNG 静态图（动图只取第一帧）' },
  { value: 'image/bmp', label: 'BMP', ext: 'bmp', supportsQuality: false, hint: '无压缩位图，文件较大；浏览器不支持编码时实际输出 PNG' },
  { value: 'ico', label: 'ICO', ext: 'ico', supportsQuality: false, hint: '真 ICO 文件：内嵌 16/32/48 三种尺寸的 PNG，适合网站 favicon；源图居中裁剪为正方形' },
];

export function targetFormatOf(value) {
  return TARGET_FORMATS.find((f) => f.value === value) || null;
}

// 校验转换目标（设置区 select 的值也可能是被篡改的任意字符串，逐字核对白名单）。
export function resolveConvertTarget(raw) {
  const fmt = targetFormatOf(String(raw || ''));
  if (!fmt) throw new Error(`不支持的目标格式：${raw || '空'}`);
  return fmt;
}

// 转换入列校验（转换语境版）：规则同 imageTools.validateImageFile，但文案按转换场景写。
export function validateConvertFile(file, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (!file) return '文件为空';
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) return `不是图片文件（类型 ${file.type || '未知'}）`;
  if (type === 'image/svg+xml') return 'SVG 是矢量格式，转成位图会丢失矢量信息，已跳过（如需位图请先在矢量工具里导出）';
  if (!(file.size > 0)) return '文件大小为 0';
  if (file.size > maxBytes) return `超过单张上限（实际 ${file.size} 字节，上限 ${maxBytes} 字节）`;
  return null;
}

// 严格解析调整尺寸的单个维度：空或 0 表示不设置，否则须为 1–8192 的整数。不靠 input 的 min 假装校验。
export function parseResizeDimension(raw, label) {
  const text = String(raw ?? '').trim();
  if (text === '' || text === '0') return 0;
  if (!/^\d+$/.test(text)) throw new Error(`${label}必须是整数像素，当前是「${text}」`);
  const value = Number(text);
  if (value < 1 || value > 8192) throw new Error(`${label}必须在 1–8192 之间，当前是 ${value}`);
  return value;
}

// 目标尺寸：两项都给则精确拉伸到该尺寸；只给一项等比缩放；都不给保持原尺寸。
export function computeResizeSize(width, height, targetW, targetH) {
  if (!(width > 0) || !(height > 0)) throw new Error('图片尺寸无效，文件可能已损坏');
  const w = Number(targetW) || 0;
  const h = Number(targetH) || 0;
  if (w > 0 && h > 0) return { width: w, height: h };
  if (w > 0) return { width: w, height: Math.max(1, Math.round((height * w) / width)) };
  if (h > 0) return { width: Math.max(1, Math.round((width * h) / height)), height: h };
  return { width, height };
}

// 转换前一次性算好提示（返回字符串数组，组件拼进状态消息）：
// 源 GIF 只取第一帧、目标 JPEG/BMP 透明填白、目标 GIF/BMP 浏览器可能回退 PNG。
export function conversionNotes(sourceType, target) {
  const notes = [];
  const src = String(sourceType || '').toLowerCase();
  if (src === 'image/gif') notes.push('源图是 GIF 动图，只取第一帧转换');
  if (target.value === 'image/jpeg' || target.value === 'image/bmp') {
    notes.push('目标格式不支持透明，透明区域会填充为白色背景');
  }
  if (target.value === 'image/gif') {
    notes.push('浏览器无法编码 GIF，将输出 PNG 静态图');
  }
  if (target.value === 'image/bmp') {
    notes.push('浏览器不支持 BMP 编码时将输出 PNG，下载扩展名以实际格式为准');
  }
  if (target.value === 'ico') {
    notes.push(`已生成真 ICO（内嵌 ${ICO_SIZES.join('/')} 三种尺寸 PNG）`);
  }
  return notes;
}

// 判断一段字节是不是 PNG（看 8 字节签名）。
export function isPngBytes(bytes) {
  if (!bytes || bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

// 把多个正方形 PNG 打包成一个真 ICO 文件。
// entries: [{ size, bytes(Uint8Array) }]，size 为边长像素（1–256，256 在头里记 0）。
// 结构：ICONDIR(6B: reserved=0, type=1, count) + 每项 ICONDIRENTRY(16B) + 各 PNG 数据依次拼接。
export function buildIco(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('ICO 至少需要一个尺寸的 PNG 数据');
  const seen = new Set();
  const items = entries.map((entry) => {
    const size = Number(entry && entry.size);
    const bytes = entry && entry.bytes;
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`ICO 尺寸必须是 1–256 的整数，当前是 ${entry && entry.size}`);
    if (seen.has(size)) throw new Error(`ICO 尺寸 ${size} 重复`);
    seen.add(size);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error(`ICO ${size}px 的 PNG 数据为空`);
    if (!isPngBytes(bytes)) throw new Error(`ICO ${size}px 的数据不是 PNG（签名不符），拒绝打包`);
    return { size, bytes };
  });
  items.sort((a, b) => a.size - b.size);
  const headerSize = 6 + items.length * 16;
  const total = headerSize + items.reduce((sum, it) => sum + it.bytes.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = ICO
  view.setUint16(4, items.length, true);
  let offset = headerSize;
  items.forEach((it, i) => {
    const base = 6 + i * 16;
    out[base] = it.size >= 256 ? 0 : it.size; // width byte，256 记 0
    out[base + 1] = it.size >= 256 ? 0 : it.size; // height byte
    out[base + 2] = 0; // palette count
    out[base + 3] = 0; // reserved
    view.setUint16(base + 4, 1, true); // color planes
    view.setUint16(base + 6, 32, true); // bits per pixel
    view.setUint32(base + 8, it.bytes.length, true);
    view.setUint32(base + 12, offset, true);
    out.set(it.bytes, offset);
    offset += it.bytes.length;
  });
  return out;
}

// 判断一段字节是不是真 ICO（魔数 00 00 01 00 + 至少一项 + 第一项内嵌 PNG 签名）。
export function isIcoBytes(bytes) {
  if (!bytes || bytes.length < 6 + 16) return false;
  if (bytes[0] !== 0 || bytes[1] !== 0 || bytes[2] !== 1 || bytes[3] !== 0) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  if (count < 1) return false;
  const imgOffset = view.getUint32(6 + 12, true);
  return isPngBytes(bytes.subarray(imgOffset));
}

// 汇总：只统计已转换的图片（同 R7n 口径，避免未转换项按原大小混入造成假对比）。
export function summarizeConversion(images) {
  const done = (images || []).filter((img) => img && img.convertedSize != null);
  return {
    doneCount: done.length,
    totalCount: (images || []).length,
    original: done.reduce((sum, img) => sum + img.originalSize, 0),
    converted: done.reduce((sum, img) => sum + img.convertedSize, 0),
  };
}
