// 全角 / 半角转换：纯本地。
// 全角区 U+FF01–U+FF5E 与半角 ASCII U+0021–U+007E 一一对应（差 0xFEE0）；
// 全角空格 U+3000 对应普通空格 U+0020。可按数字 / 字母 / 标点 / 空格分类选择是否转换。
// 全角符号区 U+FFE0–U+FFE6（￠￡￢￣￤￥￦）另有对应半角形式（¢£¬¯¦¥₩），按标点类一并转换；
// 反向时这些半角符号也转回全角。半角片假名（U+FF61–U+FF9F）与全角片假名不是简单偏移关系，
// 本工具不处理、原样保留并在 notes 里点名，避免用户以为已经转完。

const MAX_LENGTH = 100000;

// 全角符号（FFE0–FFE6）-> 半角对应码点
const FULL_SPECIAL = new Map([
  [0xffe0, 0x00a2], // ￠ -> ¢
  [0xffe1, 0x00a3], // ￡ -> £
  [0xffe2, 0x00ac], // ￢ -> ¬
  [0xffe3, 0x00af], // ￣ -> ¯
  [0xffe4, 0x00a6], // ￤ -> ¦
  [0xffe5, 0x00a5], // ￥ -> ¥
  [0xffe6, 0x20a9], // ￦ -> ₩
]);
const HALF_SPECIAL = new Map([...FULL_SPECIAL.entries()].map(([f, h]) => [h, f]));

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
function isKanaHalf(cp) { return cp >= 0xff61 && cp <= 0xff9f; }

const DEFAULT_OPTS = { digits: true, letters: true, punctuation: true, space: true };

function toHalfwidth(text, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  let out = '';
  let converted = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x3000) {
      if (opts.space) { out += ' '; converted++; } else out += ch;
    } else if (cp >= 0xff01 && cp <= 0xff5e) {
      if (opts[categoryOfFull(cp)]) { out += String.fromCodePoint(cp - 0xfee0); converted++; } else out += ch;
    } else if (FULL_SPECIAL.has(cp)) {
      if (opts.punctuation) { out += String.fromCodePoint(FULL_SPECIAL.get(cp)); converted++; } else out += ch;
    } else out += ch;
  }
  return { text: out, converted };
}

function toFullwidth(text, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  let out = '';
  let converted = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x20) {
      if (opts.space) { out += '　'; converted++; } else out += ch;
    } else if (cp >= 0x21 && cp <= 0x7e) {
      if (opts[categoryOfHalf(cp)]) { out += String.fromCodePoint(cp + 0xfee0); converted++; } else out += ch;
    } else if (HALF_SPECIAL.has(cp)) {
      if (opts.punctuation) { out += String.fromCodePoint(HALF_SPECIAL.get(cp)); converted++; } else out += ch;
    } else out += ch;
  }
  return { text: out, converted };
}

function countWidth(text) {
  let full = 0;
  let half = 0;
  let kana = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x3000 || (cp >= 0xff01 && cp <= 0xff5e) || FULL_SPECIAL.has(cp)) full++;
    else if ((cp >= 0x20 && cp <= 0x7e) || HALF_SPECIAL.has(cp)) half++;
    else if (isKanaHalf(cp)) kana++;
  }
  return { full, half, kana };
}

// 统计输出里因未勾选类别而残留的可转换字符数（按当前方向）
function countSkipped(text, direction, opts) {
  let n = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (direction === 'toHalf') {
      if (cp === 0x3000) { if (!opts.space) n++; }
      else if (cp >= 0xff01 && cp <= 0xff5e) { if (!opts[categoryOfFull(cp)]) n++; }
      else if (FULL_SPECIAL.has(cp)) { if (!opts.punctuation) n++; }
    } else {
      if (cp === 0x20) { if (!opts.space) n++; }
      else if (cp >= 0x21 && cp <= 0x7e) { if (!opts[categoryOfHalf(cp)]) n++; }
      else if (HALF_SPECIAL.has(cp)) { if (!opts.punctuation) n++; }
    }
  }
  return n;
}

export function convertWidth(text, direction, options = {}) {
  const input = String(text ?? '');
  if (!input) return { ok: false, error: '请先输入要转换的文本' };
  // 字符数按 Unicode 码点计（一个 Emoji 算 1 个），与页面统计口径一致；
  // 旧版用 .length（UTF-16 码元）会把 Emoji 文本提前误判超限。
  let chars = 0;
  for (const _ch of input) chars++;
  if (chars > MAX_LENGTH) return { ok: false, error: `文本过长：最多 ${MAX_LENGTH} 个字符（按 Unicode 码点计），当前 ${chars} 个` };
  if (direction !== 'toHalf' && direction !== 'toFull') return { ok: false, error: '转换方向不正确' };
  const opts = { ...DEFAULT_OPTS, ...options };
  if (!opts.digits && !opts.letters && !opts.punctuation && !opts.space) {
    return { ok: false, error: '请至少勾选一类要转换的字符（数字 / 字母 / 标点 / 空格）' };
  }
  const r = direction === 'toHalf' ? toHalfwidth(input, opts) : toFullwidth(input, opts);
  const before = countWidth(input);
  const notes = [];
  if (r.converted === 0) {
    notes.push(direction === 'toHalf'
      ? '本次没有转换任何字符：输入里没有可转的全角字符（可能已经是半角，或未勾选对应类别）'
      : '本次没有转换任何字符：输入里没有可转的半角字符（可能已经是全角，或未勾选对应类别）');
  }
  const skipped = countSkipped(r.text, direction, opts);
  if (skipped > 0) notes.push(`还有 ${skipped} 个字符因未勾选对应类别而保持原样，勾选后可继续转换`);
  if (before.kana > 0) notes.push(`输入含 ${before.kana} 个半角片假名，本工具不处理、已原样保留`);
  return { ok: true, text: r.text, converted: r.converted, chars, fullBefore: before.full, halfBefore: before.half, kana: before.kana, skipped, notes };
}
