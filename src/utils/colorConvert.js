// 颜色转换核心逻辑（纯本地）：严格解析与校验，补齐旧版短板——
// 旧版 HEX 非法字符被 parseInt 静默吞掉、只支持 3/6 位无透明度、数值越界靠浏览器 min/max 假装没事、
// 不支持粘贴 rgb()/hsl()/颜色名一键识别。本模块统一：任意格式文本解析（错误定位）、
// HEX/RGB(A)/HSL(A)/HSV/CMYK/HWB 全格式互转（含 alpha）、分量逐项校验（空/非数字/越界明确报错）、最近命名色。
import { parseColor } from './colorContrast.js';

export const NAMED_COLORS = [
  ['black', 0, 0, 0], ['white', 255, 255, 255], ['red', 255, 0, 0], ['lime', 0, 255, 0],
  ['blue', 0, 0, 255], ['yellow', 255, 255, 0], ['cyan', 0, 255, 255], ['magenta', 255, 0, 255],
  ['silver', 192, 192, 192], ['gray', 128, 128, 128], ['maroon', 128, 0, 0], ['olive', 128, 128, 0],
  ['green', 0, 128, 0], ['purple', 128, 0, 128], ['teal', 0, 128, 128], ['navy', 0, 0, 128],
  ['orange', 255, 165, 0], ['pink', 255, 192, 203], ['brown', 165, 42, 42], ['gold', 255, 215, 0],
  ['salmon', 250, 128, 114], ['khaki', 240, 230, 140], ['violet', 238, 130, 238], ['indigo', 75, 0, 130],
  ['coral', 255, 127, 80], ['tomato', 255, 99, 71], ['turquoise', 64, 224, 208], ['slategray', 112, 128, 144],
  ['crimson', 220, 20, 60], ['steelblue', 70, 130, 180]
];

const clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n)));
const round2 = (n) => Math.round(n * 100) / 100;

export function rgbToHex({ r, g, b, a = 1 }) {
  const hex = '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  if (a >= 1) return hex;
  return hex + clamp255(a * 255).toString(16).padStart(2, '0').toUpperCase();
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2; let h = 0; let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l, a = 1 }) {
  const hh = (((h % 360) + 360) % 360) / 360; const ss = s / 100; const ll = l / 100;
  let r; let g; let b;
  if (ss === 0) { r = g = b = ll; } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    const conv = (t0) => {
      let t = t0; if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = conv(hh + 1 / 3); g = conv(hh); b = conv(hh - 1 / 3);
  }
  return { r: clamp255(r * 255), g: clamp255(g * 255), b: clamp255(b * 255), a };
}

export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const d = max - min; let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360) % 360, s: max === 0 ? 0 : Math.round((d / max) * 100), v: Math.round(max * 100) };
}

export function hsvToRgb({ h, s, v, a = 1 }) {
  const hh = (((h % 360) + 360) % 360) / 360; const ss = s / 100; const vv = v / 100;
  const i = Math.floor(hh * 6); const f = hh * 6 - i;
  const p = vv * (1 - ss); const q = vv * (1 - f * ss); const t = vv * (1 - (1 - f) * ss);
  let r; let g; let b;
  switch (i % 6) {
    case 0: r = vv; g = t; b = p; break;
    case 1: r = q; g = vv; b = p; break;
    case 2: r = p; g = vv; b = t; break;
    case 3: r = p; g = q; b = vv; break;
    case 4: r = t; g = p; b = vv; break;
    default: r = vv; g = p; b = q;
  }
  return { r: clamp255(r * 255), g: clamp255(g * 255), b: clamp255(b * 255), a };
}

export function rgbToCmyk({ r, g, b }) {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  };
}

export function cmykToRgb({ c, m, y, k, a = 1 }) {
  return {
    r: clamp255(255 * (1 - c / 100) * (1 - k / 100)),
    g: clamp255(255 * (1 - m / 100) * (1 - k / 100)),
    b: clamp255(255 * (1 - y / 100) * (1 - k / 100)),
    a
  };
}

// HWB（CSS Color 4）：色相 + 白度 + 黑度；由 HSV 换算
export function rgbToHwb(rgba) {
  const { h, s, v } = rgbToHsv(rgba);
  return { h, w: Math.round((1 - s / 100) * (v / 100) * 100), b: Math.round((1 - v / 100) * 100) };
}
export function hwbToRgb({ h, w, b, a = 1 }) {
  if (w + b >= 100) { const gray = clamp255((w / (w + b)) * 255); return { r: gray, g: gray, b: gray, a }; }
  const base = hsvToRgb({ h, s: 100, v: 100 });
  const mix = (c) => clamp255(c * (1 - w / 100 - b / 100) + 255 * (w / 100));
  return { r: mix(base.r), g: mix(base.g), b: mix(base.b), a };
}

// 解析任意格式文本：#hex(3/4/6/8)、rgb()/rgba()、hsl()/hsla()、英文名；失败给可定位的中文错误
export function parseColorInput(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: '颜色为空，请输入如 #FF5733、rgb(255, 87, 51) 或 orange' };
  if (raw.startsWith('#')) {
    const bad = raw.slice(1).search(/[^0-9a-fA-F]/);
    if (bad >= 0) return { ok: false, error: `HEX 第 ${bad + 2} 个字符「${raw[bad + 1]}」不是十六进制字符（0-9、A-F）` };
    if (![3, 4, 6, 8].includes(raw.length - 1)) return { ok: false, error: `HEX 应为 3、4、6 或 8 位，当前 ${raw.length - 1} 位` };
  }
  const parsed = parseColor(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const format = raw.startsWith('#') ? 'HEX' : /^rgba?\(/i.test(raw) ? 'RGB' : /^hsla?\(/i.test(raw) ? 'HSL' : '命名色';
  return { ok: true, rgba: { r: parsed.r, g: parsed.g, b: parsed.b, a: round2(parsed.a) }, format };
}

// 分量校验：format 为 rgb/hsl/hsv/cmyk/hwb，values 为对应分量对象。
// 拒绝空值/非数字/越界（旧版靠 input 的 min/max 属性，粘贴与脚本改值时静默出错）。
const FIELD_SPECS = {
  rgb: [['r', 'R', 0, 255, true], ['g', 'G', 0, 255, true], ['b', 'B', 0, 255, true]],
  hsl: [['h', 'H 色相', 0, 360, false], ['s', 'S 饱和度', 0, 100, false], ['l', 'L 亮度', 0, 100, false]],
  hsv: [['h', 'H 色相', 0, 360, false], ['s', 'S 饱和度', 0, 100, false], ['v', 'V 明度', 0, 100, false]],
  cmyk: [['c', 'C', 0, 100, false], ['m', 'M', 0, 100, false], ['y', 'Y', 0, 100, false], ['k', 'K', 0, 100, false]],
  hwb: [['h', 'H 色相', 0, 360, false], ['w', 'W 白度', 0, 100, false], ['b', 'B 黑度', 0, 100, false]]
};
export function validateComponents(format, values) {
  const specs = FIELD_SPECS[format];
  if (!specs) return { ok: false, error: `未知格式 ${format}` };
  for (const [key, label, min, max, intOnly] of specs) {
    const v = values?.[key];
    if (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
      return { ok: false, error: `${format.toUpperCase()} 的 ${label} 不能为空` };
    }
    const n = Number(v);
    if (!Number.isFinite(n)) return { ok: false, error: `${format.toUpperCase()} 的 ${label}「${v}」不是数字` };
    if (intOnly && !Number.isInteger(n)) return { ok: false, error: `${format.toUpperCase()} 的 ${label} 应为整数，当前 ${n}` };
    if (n < min || n > max) return { ok: false, error: `${format.toUpperCase()} 的 ${label} 应在 ${min}–${max} 之间，当前 ${n}` };
  }
  if (format === 'hwb' && Number(values.w) + Number(values.b) > 100) {
    return { ok: false, error: 'HWB 的白度 + 黑度不应超过 100（超过时颜色会变成灰色）' };
  }
  return { ok: true };
}

export function componentsToRgb(format, values, a = 1) {
  const check = validateComponents(format, values);
  if (!check.ok) return check;
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));
  const v = num(values);
  let rgba;
  if (format === 'rgb') rgba = { r: v.r, g: v.g, b: v.b, a };
  else if (format === 'hsl') rgba = hslToRgb({ ...v, a });
  else if (format === 'hsv') rgba = hsvToRgb({ ...v, a });
  else if (format === 'cmyk') rgba = cmykToRgb({ ...v, a });
  else rgba = hwbToRgb({ ...v, a });
  return { ok: true, rgba };
}

// 一次算齐全部格式文本
export function formatAll(rgba) {
  const { a } = rgba;
  const hsl = rgbToHsl(rgba); const hsv = rgbToHsv(rgba); const cmyk = rgbToCmyk(rgba); const hwb = rgbToHwb(rgba);
  const alphaPct = Math.round(a * 100);
  return {
    hex: rgbToHex({ ...rgba, a: 1 }),
    hex8: rgbToHex(rgba),
    rgb: `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`,
    rgba: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${round2(a)})`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    hsla: `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round2(a)})`,
    hsv: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`,
    cmyk: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
    hwb: `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%${a < 1 ? ` / ${round2(a)}` : ''})`,
    alphaPct, hslObj: hsl, hsvObj: hsv, cmykObj: cmyk, hwbObj: hwb
  };
}

// 最近命名色（欧氏距离，透明色先按白底合成由调用方处理；这里只比 RGB）
export function nearestNamedColor({ r, g, b }) {
  let best = null;
  for (const [name, nr, ng, nb] of NAMED_COLORS) {
    const d = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2;
    if (!best || d < best.distance) best = { name, hex: rgbToHex({ r: nr, g: ng, b: nb, a: 1 }), distance: d };
  }
  return { name: best.name, hex: best.hex, exact: best.distance === 0 };
}

export function buildColorSummary(rgba) {
  const f = formatAll(rgba);
  const near = nearestNamedColor(rgba);
  return [
    `HEX: ${f.hex}${rgba.a < 1 ? `（带透明度 ${f.hex8}）` : ''}`,
    `RGB: ${f.rgba}`,
    `HSL: ${f.hsla}`,
    `HSV: ${f.hsv}`,
    `CMYK: ${f.cmyk}`,
    `HWB: ${f.hwb}`,
    `最近命名色: ${near.name} ${near.hex}${near.exact ? '（精确命中）' : ''}`
  ].join('\n');
}
