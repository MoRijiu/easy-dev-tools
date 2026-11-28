// CSS 渐变生成：纯本地。校验色标颜色/位置，拼装 linear/radial/conic 渐变与可直接粘贴的 CSS 片段。
export const GRADIENT_TYPES = [
  { id: 'linear', name: '线性渐变' },
  { id: 'radial', name: '径向渐变' },
  { id: 'conic', name: '锥形渐变' }
];
export const RADIAL_SHAPES = [
  { id: 'ellipse', name: '椭圆' },
  { id: 'circle', name: '圆形' }
];
export const RADIAL_SIZES = [
  { id: 'farthest-corner', name: '最远角' },
  { id: 'closest-side', name: '最近边' },
  { id: 'closest-corner', name: '最近角' },
  { id: 'farthest-side', name: '最远边' }
];
export const POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'];
const NAMED = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], transparent: [0, 0, 0, 0], yellow: [255, 255, 0], orange: [255, 165, 0], purple: [128, 0, 128], pink: [255, 192, 203], gray: [128, 128, 128], grey: [128, 128, 128], cyan: [0, 255, 255], aqua: [0, 255, 255], magenta: [255, 0, 255], fuchsia: [255, 0, 255], lime: [0, 255, 0], olive: [128, 128, 0], navy: [0, 0, 128], teal: [0, 128, 128], maroon: [128, 0, 0], silver: [192, 192, 192], gold: [255, 215, 0], coral: [255, 127, 80], salmon: [250, 128, 114], khaki: [240, 230, 140], indigo: [75, 0, 130], violet: [238, 130, 238], crimson: [220, 20, 60], brown: [165, 42, 42], rebeccapurple: [102, 51, 153] };

function normalizeGradientText(input = '') {
  return String(input).replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ');
}

function shortEcho(s) {
  const t = String(s);
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

const STRICT_NUM = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseChannel(p, label) {
  const t = String(p).trim();
  if (!t) return { ok: false, error: `${label}不能为空` };
  if (t.endsWith('%')) {
    const num = t.slice(0, -1);
    if (!STRICT_NUM.test(num)) return { ok: false, error: `${label}不是合法数字：${shortEcho(t)}` };
    const v = Number(num);
    if (v < 0 || v > 100) return { ok: false, error: `${label}百分比超出 0%–100%：${shortEcho(t)}` };
    return { ok: true, value: Math.round((v / 100) * 255) };
  }
  if (!STRICT_NUM.test(t)) return { ok: false, error: `${label}不是合法数字：${shortEcho(t)}（不要带多余字符）` };
  const v = Number(t);
  if (v < 0 || v > 255) return { ok: false, error: `${label}超出 0–255：${shortEcho(t)}` };
  return { ok: true, value: Math.round(v) };
}

function parseAlpha(p) {
  const t = String(p).trim();
  if (!t) return { ok: false, error: '透明度不能为空（斜杠后需要给出透明度）' };
  if (t.endsWith('%')) {
    const num = t.slice(0, -1);
    if (!STRICT_NUM.test(num)) return { ok: false, error: `透明度不是合法数字：${shortEcho(t)}` };
    const v = Number(num);
    if (v < 0 || v > 100) return { ok: false, error: `透明度百分比超出 0%–100%：${shortEcho(t)}` };
    return { ok: true, value: v / 100 };
  }
  if (!STRICT_NUM.test(t)) return { ok: false, error: `透明度不是合法数字：${shortEcho(t)}（不要带多余字符）` };
  const v = Number(t);
  if (v < 0 || v > 1) return { ok: false, error: `透明度超出 0–1：${shortEcho(t)}（百分数请写 %）` };
  return { ok: true, value: v };
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100; const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let rgb;
  if (hue < 60) rgb = [c, x, 0]; else if (hue < 120) rgb = [x, c, 0]; else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c]; else if (hue < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
  return rgb.map((v) => Math.round((v + m) * 255));
}

// 拆 rgb()/hsl() 的参数：支持逗号写法与现代空格写法（空格分隔 + / 透明度）
function splitFnArgs(inner, fnName) {
  const body = inner.trim();
  if (!body) return { ok: false, error: `${fnName}() 括号内不能为空` };
  if (body.includes(',')) {
    if (body.includes('/')) return { ok: false, error: `${fnName}() 逗号写法不要混用 / 分隔透明度` };
    const parts = body.split(',').map((p) => p.trim());
    if (parts.some((p) => p === '')) return { ok: false, error: `${fnName}() 有空分量（多余的逗号？）` };
    return { ok: true, channels: parts.slice(0, 3), alpha: parts.length === 4 ? parts[3] : null, count: parts.length };
  }
  const slash = body.split('/');
  if (slash.length > 2) return { ok: false, error: `${fnName}() 只能有一个 / 透明度分隔` };
  const channels = slash[0].trim().split(/\s+/).filter(Boolean);
  let alpha = null;
  if (slash.length === 2) {
    alpha = slash[1].trim();
    if (!alpha || /\s/.test(alpha)) return { ok: false, error: `${fnName}() 斜杠后需要给出单个透明度值` };
  }
  return { ok: true, channels, alpha, count: channels.length + (alpha != null ? 1 : 0) };
}

export function parseCssColor(input = '') {
  const raw = String(input);
  if (raw.length > 256) return { ok: false, error: '颜色输入过长（最多 256 个字符）' };
  const normalized = normalizeGradientText(raw);
  const notes = [];
  if (normalized !== raw) notes.push('已将全角字符转为半角');
  const s = normalized.trim().toLowerCase();
  if (!s) return { ok: false, error: '颜色不能为空' };
  if (NAMED[s]) {
    const [r, g, b, a = 1] = NAMED[s];
    return { ok: true, r, g, b, a, notes };
  }
  if (s.startsWith('#')) {
    const hexMatch = s.match(/^#([0-9a-f]*)$/);
    if (!hexMatch) {
      const badIdx = [...s.slice(1)].findIndex((c) => !/[0-9a-f]/.test(c));
      return { ok: false, error: `十六进制颜色第 ${badIdx + 2} 个字符不是 0–9/a–f：${shortEcho(s)}` };
    }
    const h0 = hexMatch[1];
    if (![3, 4, 6, 8].includes(h0.length)) return { ok: false, error: `十六进制颜色长度不对：${shortEcho(s)}（用 #rgb / #rgba / #rrggbb / #rrggbbaa）` };
    let h = h0;
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { ok: true, r, g, b, a, notes };
  }
  const hslFn = s.match(/^hsla?\((.*)\)$/s);
  if (hslFn) {
    const split = splitFnArgs(hslFn[1], 'hsl');
    if (!split.ok) return split;
    if (split.channels.length !== 3) return { ok: false, error: `hsl() 需要 3 个分量（色相、饱和度、亮度）：${shortEcho(s)}` };
    let hueRaw = split.channels[0];
    let hueFactor = 1;
    if (hueRaw.endsWith('turn')) { hueFactor = 360; hueRaw = hueRaw.slice(0, -4); }
    else if (hueRaw.endsWith('deg')) hueRaw = hueRaw.slice(0, -3);
    else if (/[a-z]$/.test(hueRaw)) return { ok: false, error: `色相单位只支持 deg / turn：${shortEcho(split.channels[0])}` };
    if (!STRICT_NUM.test(hueRaw)) return { ok: false, error: `色相不是合法数字：${shortEcho(split.channels[0])}` };
    const hue = Number(hueRaw) * hueFactor;
    const sl = [];
    for (let i = 1; i < 3; i++) {
      const p = split.channels[i];
      const label = i === 1 ? '饱和度' : '亮度';
      if (!p.endsWith('%')) return { ok: false, error: `hsl() 的${label}必须带 %：${shortEcho(p)}` };
      const num = p.slice(0, -1);
      if (!STRICT_NUM.test(num)) return { ok: false, error: `${label}不是合法数字：${shortEcho(p)}` };
      const v = Number(num);
      if (v < 0 || v > 100) return { ok: false, error: `${label}超出 0%–100%：${shortEcho(p)}` };
      sl.push(v);
    }
    let a = 1;
    if (split.alpha != null) { const pa = parseAlpha(split.alpha); if (!pa.ok) return pa; a = pa.value; }
    if (split.count !== 3 && split.count !== 4) return { ok: false, error: `hsl() 分量数量不对：${shortEcho(s)}` };
    const [r, g, b] = hslToRgb(hue, sl[0], sl[1]);
    return { ok: true, r, g, b, a, notes };
  }
  const fn = s.match(/^rgba?\((.*)\)$/s);
  if (fn) {
    const split = splitFnArgs(fn[1], 'rgb');
    if (!split.ok) return split;
    if (split.channels.length !== 3) return { ok: false, error: `rgb() 需要 3 个颜色分量：${shortEcho(s)}` };
    if (split.count !== 3 && split.count !== 4) return { ok: false, error: `颜色分量数量不对：${shortEcho(s)}` };
    const channels = [];
    for (let i = 0; i < 3; i++) {
      const pc = parseChannel(split.channels[i], `第 ${i + 1} 个颜色分量`);
      if (!pc.ok) return pc;
      channels.push(pc.value);
    }
    let a = 1;
    if (split.alpha != null) { const pa = parseAlpha(split.alpha); if (!pa.ok) return pa; a = pa.value; }
    return { ok: true, r: channels[0], g: channels[1], b: channels[2], a, notes };
  }
  if (s.includes('(') || s.startsWith('rgb') || s.startsWith('hsl')) return { ok: false, error: `颜色函数格式不对：${shortEcho(s)}（检查括号与分量）` };
  return { ok: false, error: `无法识别的颜色：${shortEcho(s)}（支持 #hex、rgb()/rgba()、hsl()/hsla() 与常用英文名）` };
}

export function formatCssColor(c) {
  const hex2 = (v) => v.toString(16).padStart(2, '0');
  if (c.a >= 1) return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  const a = Math.round(c.a * 1000) / 1000;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

export function toHexInput(c) {
  const hex2 = (v) => v.toString(16).padStart(2, '0');
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

function normalizeStops(rawStops = []) {
  if (!Array.isArray(rawStops) || rawStops.length < 2) return { ok: false, error: '渐变至少需要 2 个色标' };
  if (rawStops.length > 12) return { ok: false, error: '色标最多 12 个' };
  const stops = [];
  const notes = [];
  const addNotes = (arr) => { for (const n of arr || []) if (!notes.includes(n)) notes.push(n); };
  for (let i = 0; i < rawStops.length; i++) {
    const raw = rawStops[i] || {};
    const color = parseCssColor(raw.color ?? '');
    if (!color.ok) return { ok: false, error: `第 ${i + 1} 个色标：${color.error}` };
    addNotes(color.notes);
    const posInfo = parseStrictNumber(raw.position, `第 ${i + 1} 个色标的位置`);
    if (!posInfo.ok) return posInfo;
    const pos = posInfo.value;
    addNotes(posInfo.notes);
    if (pos < 0 || pos > 100) return { ok: false, error: `第 ${i + 1} 个色标的位置必须是 0–100 的数字（收到 ${pos}）` };
    stops.push({ color: formatCssColor(color), position: Math.round(pos * 100) / 100 });
  }
  stops.sort((a, b) => a.position - b.position);
  return { ok: true, stops, notes };
}

// 严格数字：数字本身直接用；字符串须全角转半角后整段是十进制数，空串/0x/尾随垃圾都点名
export function parseStrictNumber(raw, label = '数值') {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, error: `${label}必须是有限数字` };
    return { ok: true, value: raw, notes: [] };
  }
  const original = String(raw ?? '');
  if (!original.trim()) return { ok: false, error: `${label}不能为空` };
  const normalized = normalizeGradientText(original).trim();
  const notes = normalized !== original.trim() ? ['已将全角字符转为半角'] : [];
  if (!STRICT_NUM.test(normalized)) return { ok: false, error: `${label}必须是数字（收到 ${shortEcho(original.trim())}，不要带单位或多余字符）` };
  return { ok: true, value: Number(normalized), notes };
}

function fmtNum(v) {
  const n = Math.round(v * 100) / 100;
  return Object.is(n, -0) ? '0' : String(n);
}

export function buildGradient(options = {}) {
  const type = options.type || 'linear';
  if (!GRADIENT_TYPES.some((t) => t.id === type)) return { ok: false, error: `未知渐变类型：${type}` };
  const norm = normalizeStops(options.stops);
  if (!norm.ok) return norm;
  const notes = [...(norm.notes || [])];
  const stopText = norm.stops.map((s) => `${s.color} ${fmtNum(s.position)}%`).join(', ');
  const repeating = options.repeating ? 'repeating-' : '';
  let css;
  if (type === 'linear') {
    const angleInfo = parseStrictNumber(options.angle ?? 90, '角度');
    if (!angleInfo.ok) return angleInfo;
    for (const n of angleInfo.notes) if (!notes.includes(n)) notes.push(n);
    const deg = ((angleInfo.value % 360) + 360) % 360;
    css = `${repeating}linear-gradient(${fmtNum(deg)}deg, ${stopText})`;
  } else if (type === 'radial') {
    const shape = options.shape || 'ellipse';
    if (!RADIAL_SHAPES.some((s) => s.id === shape)) return { ok: false, error: `未知径向形状：${shape}` };
    const size = options.size || 'farthest-corner';
    if (!RADIAL_SIZES.some((s) => s.id === size)) return { ok: false, error: `未知径向大小：${size}` };
    const position = options.position || 'center';
    if (!POSITIONS.includes(position)) return { ok: false, error: `未知位置：${position}` };
    css = `${repeating}radial-gradient(${shape} ${size} at ${position}, ${stopText})`;
  } else {
    const angleInfo = parseStrictNumber(options.angle ?? 0, '起始角度');
    if (!angleInfo.ok) return angleInfo;
    for (const n of angleInfo.notes) if (!notes.includes(n)) notes.push(n);
    const deg = ((angleInfo.value % 360) + 360) % 360;
    const position = options.position || 'center';
    if (!POSITIONS.includes(position)) return { ok: false, error: `未知位置：${position}` };
    css = `${repeating}conic-gradient(from ${fmtNum(deg)}deg at ${position}, ${stopText})`;
  }
  return { ok: true, css, stops: norm.stops, notes };
}

export function buildCssSnippet(gradientCss) {
  return `background: ${gradientCss};`;
}

export const GRADIENT_PRESETS = [
  { name: '落日橙紫', options: { type: 'linear', angle: 135, stops: [{ color: '#ff9966', position: 0 }, { color: '#ff5e62', position: 55 }, { color: '#7b2ff7', position: 100 }] } },
  { name: '清新薄荷', options: { type: 'linear', angle: 90, stops: [{ color: '#43e97b', position: 0 }, { color: '#38f9d7', position: 100 }] } },
  { name: '深海蓝', options: { type: 'radial', shape: 'ellipse', size: 'farthest-corner', position: 'center', stops: [{ color: '#4facfe', position: 0 }, { color: '#1a2a6c', position: 100 }] } },
  { name: '彩虹锥', options: { type: 'conic', angle: 0, position: 'center', stops: [{ color: '#ff0000', position: 0 }, { color: '#ff9a00', position: 20 }, { color: '#ffee00', position: 40 }, { color: '#2ecc71', position: 60 }, { color: '#0090ff', position: 80 }, { color: '#ff0000', position: 100 }] } },
  { name: '条纹重复', options: { type: 'linear', angle: 45, repeating: true, stops: [{ color: '#3b82f6', position: 0 }, { color: '#3b82f6', position: 10 }, { color: '#1d4ed8', position: 10 }, { color: '#1d4ed8', position: 20 }] } },
  { name: '金属灰', options: { type: 'linear', angle: 180, stops: [{ color: '#f5f7fa', position: 0 }, { color: '#c3cfe2', position: 50 }, { color: '#8e9eab', position: 100 }] } }
];
