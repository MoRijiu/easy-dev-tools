// CSS 单位换算：纯本地。以 px 为中间量，相对单位按可调上下文（根字号/父字号/百分比基准/视口）换算。
export const DEFAULT_CONTEXT = { rootFontSize: 16, parentFontSize: 16, percentBase: 16, viewportWidth: 1920, viewportHeight: 1080 };
export const CSS_UNITS = [
  { symbol: 'px', name: '像素', kind: '绝对' },
  { symbol: 'rem', name: '根元素字号倍数', kind: '相对 · 字体' },
  { symbol: 'em', name: '父元素字号倍数', kind: '相对 · 字体' },
  { symbol: '%', name: '百分比（按基准）', kind: '相对 · 基准' },
  { symbol: 'vw', name: '视口宽度 1%', kind: '相对 · 视口' },
  { symbol: 'vh', name: '视口高度 1%', kind: '相对 · 视口' },
  { symbol: 'vmin', name: '视口较小边 1%', kind: '相对 · 视口' },
  { symbol: 'vmax', name: '视口较大边 1%', kind: '相对 · 视口' },
  { symbol: 'pt', name: '点（1/72 英寸）', kind: '绝对 · 印刷' },
  { symbol: 'pc', name: '派卡（12 pt）', kind: '绝对 · 印刷' },
  { symbol: 'in', name: '英寸', kind: '绝对 · 印刷' },
  { symbol: 'cm', name: '厘米', kind: '绝对 · 印刷' },
  { symbol: 'mm', name: '毫米', kind: '绝对 · 印刷' },
  { symbol: 'Q', name: '四分毫米（1/40 cm）', kind: '绝对 · 印刷' }
];
const UNIT_SET = new Set(CSS_UNITS.map((u) => u.symbol));
const PX_PER_IN = 96;
function pxFactor(unit, ctx) {
  switch (unit) {
    case 'px': return 1;
    case 'rem': return ctx.rootFontSize;
    case 'em': return ctx.parentFontSize;
    case '%': return ctx.percentBase / 100;
    case 'vw': return ctx.viewportWidth / 100;
    case 'vh': return ctx.viewportHeight / 100;
    case 'vmin': return Math.min(ctx.viewportWidth, ctx.viewportHeight) / 100;
    case 'vmax': return Math.max(ctx.viewportWidth, ctx.viewportHeight) / 100;
    case 'pt': return PX_PER_IN / 72;
    case 'pc': return PX_PER_IN / 6;
    case 'in': return PX_PER_IN;
    case 'cm': return PX_PER_IN / 2.54;
    case 'mm': return PX_PER_IN / 25.4;
    case 'Q': return PX_PER_IN / 101.6;
    default: return NaN;
  }
}
export function normalizeContext(raw = {}) {
  const ctx = { ...DEFAULT_CONTEXT };
  const labels = { rootFontSize: '根字号', parentFontSize: '父元素字号', percentBase: '百分比基准', viewportWidth: '视口宽度', viewportHeight: '视口高度' };
  for (const key of Object.keys(labels)) {
    if (raw[key] === undefined || raw[key] === '') continue;
    const v = Number(raw[key]);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: `${labels[key]}必须是大于 0 的数字` };
    ctx[key] = v;
  }
  return { ok: true, context: ctx };
}
export function formatCssValue(v) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e12 || (abs > 0 && abs < 1e-6)) return v.toExponential(5).replace(/\.?0+e/, 'e');
  let s = v.toFixed(6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
export function parseCssLength(input = '', defaultUnit = 'px') {
  const s = String(input ?? '').trim().replace(/,/g, '');
  if (!s) return { ok: false, error: '请输入 CSS 长度，如 16px、1.5rem 或 2vw' };
  const m = s.match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*([a-zA-Z%]*)$/);
  if (!m) return { ok: false, error: '格式应为「数字 + 单位」，如 16px、1.5rem、50%' };
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return { ok: false, error: '数字超出可计算范围' };
  let unit = m[2] ? m[2].toLowerCase() : String(defaultUnit || 'px').toLowerCase();
  if (unit === 'q') unit = 'Q';
  if (!UNIT_SET.has(unit)) return { ok: false, error: `未知单位「${m[2]}」，可用 px、rem、em、%、vw、vh、vmin、vmax、pt、pc、in、cm、mm、Q` };
  return { ok: true, value, unit };
}
export function toPx(value, unit, ctx = DEFAULT_CONTEXT) { return value * pxFactor(unit, ctx); }
export function convertCssLength(parsed, ctx = DEFAULT_CONTEXT) {
  const px = toPx(parsed.value, parsed.unit, ctx);
  return CSS_UNITS.map((u) => {
    const value = px / pxFactor(u.symbol, ctx);
    return { symbol: u.symbol, name: u.name, kind: u.kind, value, text: formatCssValue(value), css: `${formatCssValue(value)}${u.symbol}` };
  });
}
export function buildCssSummary(parsed, rows, ctx = DEFAULT_CONTEXT) {
  if (!parsed || !rows?.length) return '';
  const pick = (sym) => rows.find((r) => r.symbol === sym)?.css || '';
  return `${formatCssValue(parsed.value)}${parsed.unit} ≈ ${pick('px')} = ${pick('rem')} = ${pick('em')}（根字号 ${ctx.rootFontSize}px、父字号 ${ctx.parentFontSize}px、视口 ${ctx.viewportWidth}×${ctx.viewportHeight}）`;
}
