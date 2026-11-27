// 人民币金额大写：纯本地，按字符串处理金额（不经浮点，避免精度误差）。
// 规则：整数部分按 4 位分级（个/万/亿/兆），级内零只读一个且级末零不读，
// 整级为零或低级高位为零时在级间补一个「零」；小数只取角、分，
// 角分都为零加「整」，角为零分不为零读「零 X 分」。
const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const INNER_UNITS = ['仟', '佰', '拾', ''];
const SECTION_UNITS = ['', '万', '亿', '兆'];
const MAX_INT_DIGITS = 16; // 最高到仟兆位

function sectionText(value) {
  // value: 0-9999，返回级内读法（不含级名）；级内尾零不读，中间连零只读一个
  const digits = [
    Math.floor(value / 1000) % 10,
    Math.floor(value / 100) % 10,
    Math.floor(value / 10) % 10,
    value % 10
  ];
  let out = '';
  let zeroPending = false;
  digits.forEach((d, i) => {
    if (d === 0) {
      if (out) zeroPending = true;
    } else {
      if (zeroPending) { out += '零'; zeroPending = false; }
      out += DIGITS[d] + INNER_UNITS[i];
    }
  });
  return out;
}

export function integerToCapital(intStr) {
  // intStr: 无符号、无前导零（除 "0" 本身）的整数字符串
  if (intStr === '0') return '零';
  const sections = [];
  for (let end = intStr.length; end > 0; end -= 4) {
    sections.unshift(Number(intStr.slice(Math.max(0, end - 4), end)));
  }
  // sections[0] 为最高级；级序号（自右）= sections.length - 1 - idx
  let out = '';
  let zeroSectionPending = false;
  sections.forEach((value, idx) => {
    const level = sections.length - 1 - idx;
    if (value === 0) {
      if (out) zeroSectionPending = true;
      return;
    }
    if (out && (zeroSectionPending || value < 1000)) out += '零';
    zeroSectionPending = false;
    out += sectionText(value) + SECTION_UNITS[level];
  });
  return out;
}

const MAX_INPUT_LENGTH = 64;

// 全角数字/标点转半角（金额从中文输入法或文档粘贴时常见），返回是否发生转换
function normalizeFullWidth(s) {
  let changed = false;
  const out = s.replace(/[\uFF01-\uFF5E\u3000]/g, (ch) => {
    changed = true;
    if (ch === '\u3000') return ' ';
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  return { text: out, changed };
}

export function parseAmount(input = '') {
  const notes = [];
  const raw = String(input ?? '');
  if (raw.length > MAX_INPUT_LENGTH) {
    return { ok: false, error: `金额输入过长（${raw.length} 个字符），最多 ${MAX_INPUT_LENGTH} 个字符` };
  }
  let { text: s, changed } = normalizeFullWidth(raw.trim());
  if (changed) notes.push('已将全角数字/标点转换为半角');
  if (!s) return { ok: false, error: '请输入金额，如 1234.56' };
  let negative = false;
  // 「负」字前缀与 +/- 号（可与 ¥ 前缀任意先后，如 -¥100 / ¥-100）
  for (let i = 0; i < 2; i++) {
    if (s.startsWith('¥')) { s = s.slice(1).trimStart(); }
    else if (s.startsWith('负')) { negative = true; s = s.slice(1); }
    else if (s.startsWith('-') || s.startsWith('+')) { negative = s[0] === '-'; s = s.slice(1); }
    else break;
  }
  if (s.endsWith('元整')) { s = s.slice(0, -2); notes.push('已去掉末尾的「元整」'); }
  else if (s.endsWith('元')) { s = s.slice(0, -1); }
  if (!s) return { ok: false, error: '请输入金额，如 1234.56' };
  const bad = s.match(/[^0-9., ]/);
  if (bad) return { ok: false, error: `金额第 ${bad.index + 1} 个字符「${bad[0]}」不合法，只能输入数字、小数点与千分位分隔符` };
  const parts = s.split('.');
  if (parts.length > 2) return { ok: false, error: '金额只能有一个小数点' };
  let intRaw = parts[0];
  const fracRaw = parts.length === 2 ? parts[1] : '';
  if (intRaw === '' && fracRaw === '') return { ok: false, error: '请输入金额，如 1234.56' };
  if (/[, ]/.test(fracRaw)) {
    return { ok: false, error: '小数部分不能带千分位分隔符' };
  }
  // 千分位分隔符（逗号或空格）只能出现在整数部分，且必须按 3 位分组，
  // 否则 1,5 会被静默拼成 15、1 2 拼成 12，金额场景下绝不能猜。
  const seps = [...new Set(intRaw.match(/[, ]/g) || [])];
  if (seps.length > 1) return { ok: false, error: '千分位分隔符不能混用逗号与空格，请统一一种' };
  if (seps.length === 1) {
    const sep = seps[0];
    const groups = intRaw.split(sep);
    const valid = groups.length > 1 && /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
    if (!valid) {
      return { ok: false, error: `千分位分隔符位置不对：应为每 3 位一组（如 1,234,567），当前「${intRaw}」无法确认金额，请去掉分隔符或改正分组` };
    }
    intRaw = groups.join('');
    notes.push('已按千分位分组去掉分隔符');
  }
  if (fracRaw.length > 2) return { ok: false, error: '金额最多保留两位小数（角、分），请先四舍五入' };
  const intStr = (intRaw || '0').replace(/^0+(?=\d)/, '');
  if (intStr.length > MAX_INT_DIGITS) return { ok: false, error: `整数部分最多 ${MAX_INT_DIGITS} 位（仟兆以内）` };
  const jiao = fracRaw.length >= 1 ? Number(fracRaw[0]) : 0;
  const fen = fracRaw.length >= 2 ? Number(fracRaw[1]) : 0;
  if (negative && intStr === '0' && jiao === 0 && fen === 0) {
    negative = false;
    notes.push('负零按零处理，不读「负」');
  }
  return { ok: true, negative, intStr, jiao, fen, notes };
}

export function convertRmb(parsed) {
  const { negative, intStr, jiao, fen } = parsed;
  const intCapital = integerToCapital(intStr);
  let body;
  if (intStr === '0' && (jiao > 0 || fen > 0)) {
    // 不足一元：不读「零元」，如 0.01 → 零壹分、0.10 → 壹角整、0.11 → 壹角壹分
    if (jiao > 0 && fen > 0) body = `${DIGITS[jiao]}角${DIGITS[fen]}分`;
    else if (jiao > 0) body = `${DIGITS[jiao]}角整`;
    else body = `零${DIGITS[fen]}分`;
  } else if (jiao === 0 && fen === 0) {
    body = `${intCapital}元整`;
  } else if (jiao > 0 && fen === 0) {
    body = `${intCapital}元${DIGITS[jiao]}角整`;
  } else if (jiao === 0) {
    body = `${intCapital}元零${DIGITS[fen]}分`;
  } else {
    body = `${intCapital}元${DIGITS[jiao]}角${DIGITS[fen]}分`;
  }
  return (negative ? '负' : '') + body;
}

export function formatMoney(parsed) {
  const grouped = parsed.intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = `${parsed.jiao}${parsed.fen}`;
  return `${parsed.negative ? '-' : ''}¥${grouped}.${frac}`;
}

export function convertAmountInput(input) {
  const parsed = parseAmount(input);
  if (!parsed.ok) return parsed;
  return { ok: true, parsed, capital: convertRmb(parsed), formatted: formatMoney(parsed), notes: parsed.notes || [] };
}
