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
const NAMED = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], transparent: [0, 0, 0, 0] };

export function parseCssColor(input = '') {
  const s = String(input).trim().toLowerCase();
  if (!s) return { ok: false, error: '颜色不能为空' };
  if (NAMED[s]) {
    const [r, g, b, a = 1] = NAMED[s];
    return { ok: true, r, g, b, a };
  }
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { ok: true, r, g, b, a };
  }
  const fn = s.match(/^rgba?\((.*)\)$/);
  if (fn) {
    const parts = fn[1].split(/[,/]/).map((p) => p.trim()).filter((p) => p !== '');
    if (parts.length !== 3 && parts.length !== 4) return { ok: false, error: `颜色分量数量不对：${input}` };
    const channels = [];
    for (let i = 0; i < 3; i++) {
      const p = parts[i];
      const v = p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p);
      if (!Number.isFinite(v) || v < 0 || v > 255) return { ok: false, error: `颜色分量超出 0–255：${p}` };
      channels.push(Math.round(v));
    }
    let a = 1;
    if (parts.length === 4) {
      const p = parts[3];
      a = p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p);
      if (!Number.isFinite(a) || a < 0 || a > 1) return { ok: false, error: `透明度超出 0–1：${p}` };
    }
    return { ok: true, r: channels[0], g: channels[1], b: channels[2], a };
  }
  if (s.startsWith('#')) return { ok: false, error: `十六进制颜色格式不对：${input}（用 #rgb / #rrggbb / #rrggbbaa）` };
  return { ok: false, error: `无法识别的颜色：${input}（支持 #hex、rgb()/rgba() 与常用英文名）` };
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

export function normalizeStops(rawStops = []) {
  if (!Array.isArray(rawStops) || rawStops.length < 2) return { ok: false, error: '渐变至少需要 2 个色标' };
  if (rawStops.length > 12) return { ok: false, error: '色标最多 12 个' };
  const stops = [];
  for (let i = 0; i < rawStops.length; i++) {
    const raw = rawStops[i] || {};
    const color = parseCssColor(raw.color ?? '');
    if (!color.ok) return { ok: false, error: `第 ${i + 1} 个色标：${color.error}` };
    const pos = Number(raw.position);
    if (!Number.isFinite(pos) || pos < 0 || pos > 100) return { ok: false, error: `第 ${i + 1} 个色标的位置必须是 0–100 的数字` };
    stops.push({ color: formatCssColor(color), position: Math.round(pos * 100) / 100 });
  }
  stops.sort((a, b) => a.position - b.position);
  return { ok: true, stops };
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
  const stopText = norm.stops.map((s) => `${s.color} ${fmtNum(s.position)}%`).join(', ');
  const repeating = options.repeating ? 'repeating-' : '';
  let css;
  if (type === 'linear') {
    const angle = Number(options.angle ?? 90);
    if (!Number.isFinite(angle)) return { ok: false, error: '角度必须是数字' };
    const deg = ((angle % 360) + 360) % 360;
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
    const angle = Number(options.angle ?? 0);
    if (!Number.isFinite(angle)) return { ok: false, error: '起始角度必须是数字' };
    const deg = ((angle % 360) + 360) % 360;
    const position = options.position || 'center';
    if (!POSITIONS.includes(position)) return { ok: false, error: `未知位置：${position}` };
    css = `${repeating}conic-gradient(from ${fmtNum(deg)}deg at ${position}, ${stopText})`;
  }
  return { ok: true, css, stops: norm.stops };
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
