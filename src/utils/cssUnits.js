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
const MAX_INPUT_LENGTH = 1024;
const MAX_VALUE = 1e15;
const CONTEXT_MIN = 0.01;
const CONTEXT_MAX = 1e6;
// 全角字符（U+FF01–FF5E）与全角空格转半角，粘贴自中文输入法/文档时常见
function normalizeCssText(s) {
  return String(s ?? '').replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');
}
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
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
export function normalizeContext(raw = {}) {
  const ctx = { ...DEFAULT_CONTEXT };
  const labels = { rootFontSize: '根字号', parentFontSize: '父元素字号', percentBase: '百分比基准', viewportWidth: '视口宽度', viewportHeight: '视口高度' };
  for (const key of Object.keys(labels)) {
    if (raw[key] === undefined || raw[key] === null) continue;
    let text = raw[key];
    if (typeof text === 'string') {
      text = normalizeCssText(text).trim();
      if (text === '') continue; // 清空输入框 = 恢复默认值
      // 严格十进制校验：0x10 之类旧版被 Number() 静默当成 16，必须点名拒绝
      if (!DECIMAL_RE.test(text)) return { ok: false, error: `${labels[key]}必须是大于 0 的纯数字，不要带单位或十六进制写法` };
    }
    const v = Number(text);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: `${labels[key]}必须是大于 0 的数字` };
    if (v < CONTEXT_MIN) return { ok: false, error: `${labels[key]}过小（下限 ${CONTEXT_MIN}）` };
    if (v > CONTEXT_MAX) return { ok: false, error: `${labels[key]}过大（上限 ${CONTEXT_MAX}）` };
    ctx[key] = v;
  }
  return { ok: true, context: ctx };
}
function formatCssValue(v) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e12 || (abs > 0 && abs < 1e-6)) return v.toExponential(5).replace(/\.?0+e/, 'e');
  // 小于 1 的值给 10 位小数：旧版统一 6 位会把 0.0009765625 显示成 0.000977，相对误差近 0.05%
  let s = abs < 1 ? v.toFixed(10) : v.toFixed(6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
// 校验数字 token 里的逗号/下划线：逗号只认千分位分组、下划线只能单个夹在数字之间。
// 旧版无条件剥逗号，1,5px 会被静默算成 15px、1,00px 算成 100px，是最危险的静默算错。
function validateNumberToken(token) {
  const mantissa = token.replace(/^[+-]/, '').split(/[eE]/)[0];
  const [intPart, fracPart = ''] = mantissa.split('.');
  if (fracPart.includes(',')) return '逗号不能出现在小数部分，小数请用点号（如 1.5）';
  if (intPart.includes(',') && !/^\d{1,3}(,\d{3})*$/.test(intPart)) return '逗号只能用作千分位分组（如 1,000），小数请用点号（如 1.5）';
  if (mantissa.includes('_')) {
    if (!/^\d(_?\d)*$/.test(intPart.replace(/,/g, '')) || (fracPart && !/^\d(_?\d)*$/.test(fracPart)) || mantissa.includes('__') || mantissa.startsWith('_') || mantissa.endsWith('_') || mantissa.includes('._') || mantissa.includes('_.')) {
      return '下划线只能单个夹在数字之间（如 1_000）';
    }
  }
  return '';
}
export function parseCssLength(input = '', defaultUnit = 'px') {
  const rawText = String(input ?? '');
  if (rawText.length > MAX_INPUT_LENGTH) return { ok: false, error: `输入过长（上限 ${MAX_INPUT_LENGTH} 字符）` };
  const notes = [];
  const normalized = normalizeCssText(rawText);
  if (normalized !== rawText) notes.push('已将全角字符转为半角');
  const s = normalized.trim();
  if (!s) return { ok: false, error: '请输入 CSS 长度，如 16px、1.5rem 或 2vw' };
  if (/^[+-]?0x/i.test(s)) return { ok: false, error: '不支持十六进制写法，请输入十进制数字，如 16px' };
  // 数字部分放宽到 CSS 合法形式：.5、5.、+5 旧版都被拒，现均可解析
  const m = s.match(/^([+-]?(?:\d[\d,_]*\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-zA-Z%]*)$/);
  if (!m) return { ok: false, error: '格式应为「数字 + 单位」，如 16px、1.5rem、50%' };
  const tokenError = validateNumberToken(m[1]);
  if (tokenError) return { ok: false, error: tokenError };
  const value = Number(m[1].replace(/[,_]/g, ''));
  if (!Number.isFinite(value)) return { ok: false, error: '数字超出可计算范围' };
  if (Math.abs(value) > MAX_VALUE) return { ok: false, error: `数值过大（上限 ${MAX_VALUE}），超出可计算范围` };
  // 1e-999 这类输入会被双精度下溢成 0，旧版静默按 0 展示全部结果，必须明示
  if (value === 0 && /[1-9]/.test(m[1].split(/[eE]/)[0])) notes.push('数值过小，已按 0 计算');
  let unit = m[2] ? m[2].toLowerCase() : String(defaultUnit || 'px').toLowerCase();
  if (unit === 'q') unit = 'Q';
  if (!UNIT_SET.has(unit)) return { ok: false, error: `未知单位「${m[2] || unit}」，可用 px、rem、em、%、vw、vh、vmin、vmax、pt、pc、in、cm、mm、Q` };
  return { ok: true, value, unit, notes };
}
function toPx(value, unit, ctx = DEFAULT_CONTEXT) { return value * pxFactor(unit, ctx); }
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
