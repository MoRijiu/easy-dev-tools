// 全角 / 半角转换：纯本地。
// 全角区 U+FF01–U+FF5E 与半角 ASCII U+0021–U+007E 一一对应（差 0xFEE0）；
// 全角空格 U+3000 对应普通空格 U+0020。可按数字 / 字母 / 标点 / 空格分类选择是否转换。
// 半角片假名（U+FF61–U+FF9F）与全角片假名不是简单偏移关系，本工具不处理、原样保留。

export const MAX_LENGTH = 100000;

function categoryOfFull(cp) {
  if (cp >= 0xff10 && cp <= 0xff19) return 'digits';
  if ((cp >= 0xff21 && cp <= 0xff3a) || (cp >= 0xff41 && cp <= 0xff5a)) return 'letters';
  return 'punctuation';
}
function categoryOfHalf(cp) {
  if (cp >= 0x30 && cp <= 0x39) return 'digits';
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return 'letters';
  return 'punctuation';
}

const DEFAULT_OPTS = { digits: true, letters: true, punctuation: true, space: true };

export function toHalfwidth(text, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  let out = '';
  let converted = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x3000) {
      if (opts.space) { out += ' '; converted++; } else out += ch;
    } else if (cp >= 0xff01 && cp <= 0xff5e) {
      if (opts[categoryOfFull(cp)]) { out += String.fromCodePoint(cp - 0xfee0); converted++; } else out += ch;
    } else out += ch;
  }
  return { text: out, converted };
}

export function toFullwidth(text, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  let out = '';
  let converted = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x20) {
      if (opts.space) { out += '　'; converted++; } else out += ch;
    } else if (cp >= 0x21 && cp <= 0x7e) {
      if (opts[categoryOfHalf(cp)]) { out += String.fromCodePoint(cp + 0xfee0); converted++; } else out += ch;
    } else out += ch;
  }
  return { text: out, converted };
}

export function countWidth(text) {
  let full = 0;
  let half = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x3000 || (cp >= 0xff01 && cp <= 0xff5e)) full++;
    else if (cp >= 0x20 && cp <= 0x7e) half++;
  }
  return { full, half };
}

export function convertWidth(text, direction, options = {}) {
  const input = String(text ?? '');
  if (!input) return { ok: false, error: '请先输入要转换的文本' };
  if (input.length > MAX_LENGTH) return { ok: false, error: `文本过长：最多 ${MAX_LENGTH} 个字符` };
  if (direction !== 'toHalf' && direction !== 'toFull') return { ok: false, error: '转换方向不正确' };
  const opts = { ...DEFAULT_OPTS, ...options };
  if (!opts.digits && !opts.letters && !opts.punctuation && !opts.space) {
    return { ok: false, error: '请至少勾选一类要转换的字符（数字 / 字母 / 标点 / 空格）' };
  }
  const r = direction === 'toHalf' ? toHalfwidth(input, opts) : toFullwidth(input, opts);
  const before = countWidth(input);
  return { ok: true, text: r.text, converted: r.converted, chars: [...input].length, fullBefore: before.full, halfBefore: before.half };
}
