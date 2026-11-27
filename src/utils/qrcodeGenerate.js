// 二维码生成打磨核心（纯本地）：选项严格校验、容量估算、对比度检查、错误友好化
// 旧版问题：尺寸/边距靠 input 的 min/max 假装校验（手输可越界/为空变 NaN）；
// 字符数用 String.length（UTF-16 码元）误导容量判断；前景/背景同色也照样生成扫不出的码；
// qrcode 库的英文报错（数据过长等）直接透传给用户。
import { parseColor, relativeLuminance, contrastRatio } from './colorContrast.js';

export const MIN_WIDTH = 100;
export const MAX_WIDTH = 1000;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 10;
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

// Version 40、Byte 模式下各容错级别的最大字节容量（QR Code 规范容量表）
export const EC_CAPACITY_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };
export const EC_LEVELS = ['L', 'M', 'Q', 'H'];

export function utf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

export function codePointLength(text) {
  return [...text].length;
}

function validateInteger(raw, label, min, max) {
  if (raw === '' || raw === null || raw === undefined || (typeof raw === 'number' && Number.isNaN(raw))) {
    throw new Error(`${label}不能为空`);
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label}必须是整数（当前：${raw}）`);
  }
  if (n < min || n > max) {
    throw new Error(`${label}必须在 ${min}–${max} 之间（当前：${n}）`);
  }
  return n;
}

function validateHexColor(raw, label) {
  if (typeof raw !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(raw.trim())) {
    throw new Error(`${label}必须是 #RRGGBB 格式（当前：${raw}）`);
  }
  return raw.trim().toUpperCase();
}

// 校验并归一化生成选项，非法时抛带字段名的中文错误
export function validateQrOptions(raw = {}) {
  const width = validateInteger(raw.width, '尺寸', MIN_WIDTH, MAX_WIDTH);
  const margin = validateInteger(raw.margin, '边距', MIN_MARGIN, MAX_MARGIN);
  const darkColor = validateHexColor(raw.darkColor, '前景色');
  const lightColor = validateHexColor(raw.lightColor, '背景色');
  const level = String(raw.errorCorrectionLevel || '').toUpperCase();
  if (!EC_LEVELS.includes(level)) {
    throw new Error(`容错级别必须是 L / M / Q / H（当前：${raw.errorCorrectionLevel}）`);
  }
  return { width, margin, darkColor, lightColor, errorCorrectionLevel: level };
}

// 内容容量分析：按 UTF-8 字节数对照所选容错级别的上限
export function analyzeContent(text, level = 'M') {
  const ec = EC_LEVELS.includes(level) ? level : 'M';
  const bytes = utf8ByteLength(text);
  const chars = codePointLength(text);
  const capacity = EC_CAPACITY_BYTES[ec];
  return {
    chars,
    bytes,
    capacity,
    level: ec,
    remaining: capacity - bytes,
    usagePercent: capacity ? Math.round((bytes / capacity) * 1000) / 10 : 0,
    overCapacity: bytes > capacity
  };
}

// 前景/背景对比度检查：反色（前景比背景亮）与低对比都会让扫码大概率失败
export function checkQrContrast(darkInput, lightInput) {
  const dark = parseColor(darkInput);
  const light = parseColor(lightInput);
  if (!dark.ok || !light.ok) throw new Error('颜色格式不正确，无法检查对比度');
  const ratio = contrastRatio(dark, light);
  const inverted = relativeLuminance(dark) > relativeLuminance(light);
  let level = 'ok';
  let message = `对比度 ${ratio.toFixed(2)}:1，扫码识别没有问题`;
  if (inverted) {
    level = 'error';
    message = '前景色比背景色更亮（反色二维码），多数扫码器无法识别，请加深前景或调亮背景';
  } else if (ratio < 3) {
    level = 'error';
    message = `对比度仅 ${ratio.toFixed(2)}:1，过低，二维码大概率扫不出来，请拉大前景与背景的明暗差距`;
  } else if (ratio < 4.5) {
    level = 'warn';
    message = `对比度 ${ratio.toFixed(2)}:1，偏低，打印或低光环境下可能扫不出，建议达到 4.5:1 以上`;
  }
  return { ratio: Math.round(ratio * 100) / 100, inverted, level, message };
}

// Logo 文件校验：类型 + 大小（旧版只看 type 前缀、超大文件照单全收）
export function validateLogoFile(file) {
  if (!file) throw new Error('未选择 Logo 文件');
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('请上传图片文件作为 Logo');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error(`Logo 图片过大（${(file.size / 1024 / 1024).toFixed(1)} MB），请控制在 5 MB 以内`);
  }
  return true;
}

// 把 qrcode 库的英文报错翻成可操作的中文提示
export function friendlyQrError(error, analysis) {
  const msg = (error && error.message) || String(error || '');
  if (/too big|amount of data/i.test(msg)) {
    const cap = analysis ? `当前容错级别 ${analysis.level} 最多容纳 ${analysis.capacity} 字节（UTF-8），你的内容有 ${analysis.bytes} 字节` : '内容超出了二维码容量';
    return `内容过长：${cap}。请缩短内容，或降低容错级别（H→L 容量更大）`;
  }
  if (/margin|width|scale/i.test(msg)) return '尺寸或边距设置不合法，请检查选项';
  return msg ? `生成失败：${msg}` : '生成失败：未知错误';
}

export function buildQrSummary(text, options, analysis, contrast) {
  const lines = [
    `内容：${text.length > 60 ? text.slice(0, 60) + '…' : text}`,
    `字符 ${analysis.chars} · UTF-8 ${analysis.bytes} 字节 · 容量占用 ${analysis.usagePercent}%（${analysis.level} 级上限 ${analysis.capacity} 字节）`,
    `尺寸 ${options.width}×${options.width}px · 边距 ${options.margin} · 容错 ${options.errorCorrectionLevel}`,
    `前景 ${options.darkColor} / 背景 ${options.lightColor} · ${contrast.message}`
  ];
  return lines.join('\n');
}
