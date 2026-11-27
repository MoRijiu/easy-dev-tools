// CSS Box Shadow 生成：纯本地。校验多层阴影参数（偏移/模糊/扩散/颜色/内阴影），拼装 box-shadow 值与 CSS 片段。
import { parseCssColor, formatCssColor } from './cssGradient.js';

export { parseCssColor, formatCssColor };

export const MAX_LAYERS = 8;
export const LIMITS = {
  offsetX: [-200, 200],
  offsetY: [-200, 200],
  blur: [0, 200],
  spread: [-100, 100]
};

function checkRange(value, field, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) return { ok: false, error: `${label}必须是数字` };
  const [min, max] = LIMITS[field];
  if (n < min || n > max) return { ok: false, error: `${label}必须在 ${min}–${max} 之间` };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

function fmtNum(v) {
  const n = Math.round(v * 100) / 100;
  return Object.is(n, -0) ? '0' : String(n);
}

export function normalizeLayers(rawLayers = []) {
  if (!Array.isArray(rawLayers) || rawLayers.length < 1) return { ok: false, error: '至少需要 1 层阴影' };
  if (rawLayers.length > MAX_LAYERS) return { ok: false, error: `阴影最多 ${MAX_LAYERS} 层` };
  const layers = [];
  for (let i = 0; i < rawLayers.length; i++) {
    const raw = rawLayers[i] || {};
    const prefix = `第 ${i + 1} 层：`;
    const ox = checkRange(raw.offsetX ?? 0, 'offsetX', '水平偏移');
    if (!ox.ok) return { ok: false, error: prefix + ox.error };
    const oy = checkRange(raw.offsetY ?? 0, 'offsetY', '垂直偏移');
    if (!oy.ok) return { ok: false, error: prefix + oy.error };
    const blur = checkRange(raw.blur ?? 0, 'blur', '模糊半径');
    if (!blur.ok) return { ok: false, error: prefix + blur.error };
    const spread = checkRange(raw.spread ?? 0, 'spread', '扩散半径');
    if (!spread.ok) return { ok: false, error: prefix + spread.error };
    const color = parseCssColor(raw.color ?? '');
    if (!color.ok) return { ok: false, error: prefix + color.error };
    layers.push({
      offsetX: ox.value, offsetY: oy.value, blur: blur.value, spread: spread.value,
      color: formatCssColor(color), inset: !!raw.inset
    });
  }
  return { ok: true, layers };
}

export function buildShadow(rawLayers = []) {
  const norm = normalizeLayers(rawLayers);
  if (!norm.ok) return norm;
  const css = norm.layers.map((l) => `${l.inset ? 'inset ' : ''}${fmtNum(l.offsetX)}px ${fmtNum(l.offsetY)}px ${fmtNum(l.blur)}px ${fmtNum(l.spread)}px ${l.color}`).join(', ');
  return { ok: true, css, layers: norm.layers };
}

export function buildCssSnippet(shadowCss) {
  return `box-shadow: ${shadowCss};`;
}

export const SHADOW_PRESETS = [
  { name: '柔和浮起', layers: [{ offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: 'rgba(0, 0, 0, 0.15)', inset: false }] },
  { name: '卡片投影', layers: [{ offsetX: 0, offsetY: 10, blur: 24, spread: -6, color: 'rgba(0, 0, 0, 0.25)', inset: false }] },
  { name: '锐利硬阴影', layers: [{ offsetX: 6, offsetY: 6, blur: 0, spread: 0, color: '#111827', inset: false }] },
  { name: '霓虹发光', layers: [{ offsetX: 0, offsetY: 0, blur: 18, spread: 2, color: '#7c3aed', inset: false }, { offsetX: 0, offsetY: 0, blur: 42, spread: 6, color: 'rgba(124, 58, 237, 0.45)', inset: false }] },
  { name: '内凹陷', layers: [{ offsetX: 0, offsetY: 2, blur: 8, spread: 0, color: 'rgba(0, 0, 0, 0.35)', inset: true }] },
  { name: '分层立体', layers: [{ offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: 'rgba(0, 0, 0, 0.12)', inset: false }, { offsetX: 0, offsetY: 8, blur: 16, spread: -4, color: 'rgba(0, 0, 0, 0.14)', inset: false }, { offsetX: 0, offsetY: 24, blur: 40, spread: -12, color: 'rgba(0, 0, 0, 0.18)', inset: false }] }
];
