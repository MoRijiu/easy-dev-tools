// 颜色对比度检查（纯本地）：解析颜色、WCAG 相对亮度与对比度、AA/AAA 判定、一键调整前景色达标
// 规则依据 WCAG 2.x：对比度 = (L1 + 0.05) / (L2 + 0.05)，L 为相对亮度（sRGB 线性化加权）。

const NAMED = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], yellow: [255, 255, 0],
  orange: [255, 165, 0], purple: [128, 0, 128], pink: [255, 192, 203], brown: [165, 42, 42],
  cyan: [0, 255, 255], magenta: [255, 0, 255], silver: [192, 192, 192], navy: [0, 0, 128],
  teal: [0, 128, 128], maroon: [128, 0, 0], olive: [128, 128, 0], lime: [0, 255, 0]
};

function fail(error) { return { ok: false, error }; }
function clamp255(n) { return Math.min(255, Math.max(0, Math.round(n))); }

// 全角转半角：＃ＦＦ００００、ｒｇｂ（255，0，0）等整段全角输入按半角识别（U+FF01–FF5E 1:1 对应 ASCII !–~，全角空格转普通空格）
function normalizeColorInput(input) {
  return String(input).replace(/[！-～　]/g, (c) => (c === '　' ? ' ' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0)));
}
// 报错回显用户输入时截断，避免超长输入把整段原文塞进错误信息
function showInput(input) { const t = String(input).trim(); return t.length > 40 ? `${t.slice(0, 40)}…` : t; }
// 严格数字（可带 %）：拒绝 parseFloat 式的尾随垃圾（10abc、0x10、0.5turn 静默吞字符）
const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
function parseStrictNumber(text) { return NUM_RE.test(text) ? Number(text) : NaN; }
function parseAlpha(text) {
  if (text.endsWith('%')) { const n = parseStrictNumber(text.slice(0, -1)); return Number.isNaN(n) ? NaN : n / 100; }
  return parseStrictNumber(text);
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;
  if (ss === 0) { const v = clamp255(ll * 255); return [v, v, v]; }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const conv = (t0) => {
    let t = t0; if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [clamp255(conv(hh + 1 / 3) * 255), clamp255(conv(hh) * 255), clamp255(conv(hh - 1 / 3) * 255)];
}

// 解析颜色：支持 #rgb/#rgba/#rrggbb/#rrggbbaa、rgb()/rgba()、hsl()/hsla()、常用英文名
export function parseColor(input) {
  if (typeof input !== 'string' || !input.trim()) return fail('颜色不能为空，请输入如 #2563eb 或 rgb(37, 99, 235)');
  if (input.length > 1024) return fail(`颜色输入过长（${input.length} 字符，上限 1024），请粘贴单个颜色值`);
  const s = normalizeColorInput(input).trim().toLowerCase();
  if (s === 'transparent') return makeColor(0, 0, 0, 0);
  if (NAMED[s]) { const [r, g, b] = NAMED[s]; return makeColor(r, g, b, 1); }
  if (s.startsWith('#')) {
    const body = s.slice(1);
    const bad = body.search(/[^0-9a-f]/);
    if (bad !== -1) return fail(`十六进制颜色第 ${bad + 1} 位「${body[bad]}」不是 0–9/a–f 字符`);
    if (![3, 4, 6, 8].includes(body.length)) return fail(`十六进制颜色长度应为 3、4、6 或 8 位，当前 ${body.length} 位`);
    if (body.length <= 4) {
      const [r, g, b, a] = [...body].map((c) => parseInt(c + c, 16));
      return makeColor(r, g, b, body.length === 4 ? a / 255 : 1);
    }
    const r = parseInt(body.slice(0, 2), 16); const g = parseInt(body.slice(2, 4), 16); const b = parseInt(body.slice(4, 6), 16);
    return makeColor(r, g, b, body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1);
  }
  const rgbMatch = s.match(/^rgba?\(\s*([^)]*)\)$/);
  if (rgbMatch) {
    if (!rgbMatch[1].trim()) return fail('rgb() 内为空，需要 3 个通道值，可选第 4 个为透明度');
    if (rgbMatch[1].includes('/') && !rgbMatch[1].split('/').pop().trim()) return fail('rgb() 斜杠 / 后须给出透明度（如 rgb(255 0 0 / 0.5)）');
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return fail('rgb() 需要 3 个通道值，可选第 4 个为透明度');
    const nums = [];
    for (let i = 0; i < 3; i++) {
      const p = parts[i];
      const isPct = p.endsWith('%');
      const v0 = parseStrictNumber(isPct ? p.slice(0, -1) : p);
      if (Number.isNaN(v0)) return fail(`rgb() 第 ${i + 1} 个通道「${p}」不是合法数字，应为 0–255 或 0%–100%`);
      const v = isPct ? v0 * 2.55 : v0;
      if (v0 < 0 || (isPct ? v0 > 100 : v0 > 255)) return fail(`rgb() 第 ${i + 1} 个通道「${p}」不合法，应在 0–255（或 0%–100%）之间`);
      nums.push(clamp255(v));
    }
    let a = 1;
    if (parts.length === 4) { a = parseAlpha(parts[3]); if (Number.isNaN(a) || a < 0 || a > 1) return fail(`透明度「${parts[3]}」应在 0–1（或 0%–100%）之间`); }
    return makeColor(nums[0], nums[1], nums[2], a);
  }
  const hslMatch = s.match(/^hsla?\(\s*([^)]*)\)$/);
  if (hslMatch) {
    if (!hslMatch[1].trim()) return fail('hsl() 内为空，需要色相、饱和度、亮度 3 个值，可选第 4 个为透明度');
    if (hslMatch[1].includes('/') && !hslMatch[1].split('/').pop().trim()) return fail('hsl() 斜杠 / 后须给出透明度（如 hsl(120 50% 50% / 0.5)）');
    const parts = hslMatch[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return fail('hsl() 需要色相、饱和度、亮度 3 个值，可选第 4 个为透明度');
    const hueText = parts[0].endsWith('deg') ? parts[0].slice(0, -3) : parts[0];
    const hDeg = parseStrictNumber(hueText);
    if (Number.isNaN(hDeg)) return fail(`hsl() 色相「${parts[0]}」不合法，应为数字（可带 deg 后缀，负数与超 360 会按色环归一）`);
    const pct = (text, label) => {
      if (!text.endsWith('%')) return { error: `hsl() ${label}「${text}」须带 %（如 50%）` };
      const n = parseStrictNumber(text.slice(0, -1));
      if (Number.isNaN(n)) return { error: `hsl() ${label}「${text}」不是合法数字` };
      if (n < 0 || n > 100) return { error: `hsl() ${label}应在 0%–100% 之间，当前「${text}」` };
      return { value: n };
    };
    const sat = pct(parts[1], '饱和度'); if (sat.error) return fail(sat.error);
    const lig = pct(parts[2], '亮度'); if (lig.error) return fail(lig.error);
    let a = 1;
    if (parts.length === 4) { a = parseAlpha(parts[3]); if (Number.isNaN(a) || a < 0 || a > 1) return fail(`透明度「${parts[3]}」应在 0–1（或 0%–100%）之间`); }
    const [r, g, b] = hslToRgb(hDeg, sat.value, lig.value);
    return makeColor(r, g, b, a);
  }
  return fail(`无法识别颜色「${showInput(input)}」，支持 #hex、rgb()、hsl() 与常用英文名（如 white）`);
}

function makeColor(r, g, b, a) {
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return { ok: true, r, g, b, a, hex, rgbText: `rgb(${r}, ${g}, ${b})` };
}

// 半透明色按白色背景合成（页面最常见底色），并标记发生了合成
function compositeOnWhite(color) {
  if (color.a >= 1) return { ...color, composited: false };
  const mix = (c) => clamp255(c * color.a + 255 * (1 - color.a));
  const r = mix(color.r); const g = mix(color.g); const b = mix(color.b);
  return { ...makeColor(r, g, b, 1), composited: true };
}

function linearize(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color) {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

export function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1); const l2 = relativeLuminance(c2);
  const hi = Math.max(l1, l2); const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_THRESHOLDS = { normalAA: 4.5, normalAAA: 7, largeAA: 3, largeAAA: 4.5 };

export function checkContrast(fgInput, bgInput) {
  const fgParsed = parseColor(fgInput);
  if (!fgParsed.ok) return fail(`前景色：${fgParsed.error}`);
  const bgParsed = parseColor(bgInput);
  if (!bgParsed.ok) return fail(`背景色：${bgParsed.error}`);
  const fg = compositeOnWhite(fgParsed); const bg = compositeOnWhite(bgParsed);
  const ratio = contrastRatio(fg, bg);
  const levels = {
    normalAA: ratio >= WCAG_THRESHOLDS.normalAA,
    normalAAA: ratio >= WCAG_THRESHOLDS.normalAAA,
    largeAA: ratio >= WCAG_THRESHOLDS.largeAA,
    largeAAA: ratio >= WCAG_THRESHOLDS.largeAAA
  };
  const grade = levels.normalAAA ? '优秀（AAA）' : levels.normalAA ? '良好（AA）' : levels.largeAA ? '仅大字可用' : '不达标';
  return {
    ok: true, fg, bg, fgRaw: fgParsed, bgRaw: bgParsed,
    ratio, ratioText: ratio.toFixed(2),
    fgLuminance: relativeLuminance(fg), bgLuminance: relativeLuminance(bg),
    levels, grade, composited: fg.composited || bg.composited
  };
}

// 把前景色沿「向黑/向白」方向二分调整到目标对比度（选改动较小的一侧）；无解返回 null
export function adjustForeground(fgInput, bgInput, target = WCAG_THRESHOLDS.normalAA) {
  if (typeof target !== 'number' || !Number.isFinite(target) || target < 1 || target > 21) return fail(`目标对比度应在 1–21 之间，当前 ${target}`);
  const base = checkContrast(fgInput, bgInput);
  if (!base.ok) return fail(base.error);
  if (base.ratio >= target) return { ok: true, changed: false, color: base.fg, ratio: base.ratio };
  const bg = base.bg;
  const blend = (from, to, t) => makeColor(
    clamp255(from.r + (to.r - from.r) * t),
    clamp255(from.g + (to.g - from.g) * t),
    clamp255(from.b + (to.b - from.b) * t), 1
  );
  const search = (toColor) => {
    if (contrastRatio(toColor, bg) < target) return null;
    let lo = 0; let hi = 1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (contrastRatio(blend(base.fg, toColor, mid), bg) >= target) hi = mid; else lo = mid; }
    return { t: hi, color: blend(base.fg, toColor, hi) };
  };
  const toBlack = search(makeColor(0, 0, 0, 1));
  const toWhite = search(makeColor(255, 255, 255, 1));
  const best = toBlack && toWhite ? (toBlack.t <= toWhite.t ? toBlack : toWhite) : (toBlack || toWhite);
  if (!best) return { ok: false, error: '把前景色调到纯黑或纯白也达不到该对比度，请换背景色再试' };
  return { ok: true, changed: true, color: best.color, ratio: contrastRatio(best.color, bg), direction: best === toBlack ? '加深' : '提亮' };
}

export function buildContrastSummary(result) {
  if (!result || !result.ok) return '';
  const yn = (v) => (v ? '通过' : '未通过');
  return [
    `前景 ${result.fg.hex} / 背景 ${result.bg.hex}，对比度 ${result.ratioText}:1（${result.grade}）`,
    `普通文本 AA(4.5) ${yn(result.levels.normalAA)}、AAA(7) ${yn(result.levels.normalAAA)}；大字 AA(3) ${yn(result.levels.largeAA)}、AAA(4.5) ${yn(result.levels.largeAAA)}`
  ].join('\n');
}
