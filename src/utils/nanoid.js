// Nano ID 生成：纯本地，算法与 nanoid 官方一致（掩码 + 步进批量取字节，避免取模偏差）。
// 默认字母表为 nanoid 官方 URL 安全字母表（A-Za-z0-9_-，64 个字符）；支持自定义字母表与长度批量生成。
export const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
export const ALPHABET_PRESETS = {
  default: { label: '默认（字母数字 + _-）', alphabet: DEFAULT_ALPHABET },
  alphanumeric: { label: '仅字母数字', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' },
  lowercase: { label: '小写字母 + 数字', alphabet: 'abcdefghijklmnopqrstuvwxyz0123456789' },
  hex: { label: '十六进制小写', alphabet: '0123456789abcdef' },
  digits: { label: '仅数字', alphabet: '0123456789' },
  nolookalike: { label: '无易混字符', alphabet: '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz' }
};
export const MAX_SIZE = 512;
export const MAX_COUNT = 1000;

function defaultRandomBytes(n) {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('当前环境缺少安全随机源（Web Crypto），无法生成 Nano ID');
  }
  const buf = new Uint8Array(n);
  c.getRandomValues(buf);
  return buf;
}

// 全角转半角（数字输入与字母表 BOM 处理共用）：粘贴自中文/日文输入法时长度、数量常是全角数字。
export function normalizeFullwidth(text) {
  let out = '';
  let converted = false;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xff01 && cp <= 0xff5e) { out += String.fromCharCode(cp - 0xfee0); converted = true; }
    else if (cp === 0x3000) { out += ' '; converted = true; }
    else out += ch;
  }
  return { text: out, converted };
}

const INVISIBLE_CHARS = new Set(['\u200B', '\u200C', '\u200D', '\u2060', '\u00AD']);

export function validateAlphabet(alphabet) {
  // 粘贴常带 BOM（U+FEFF 位于开头）：它不是空白，旧版误报「不能包含空白字符」；开头 BOM 直接去掉。
  const raw = String(alphabet ?? '').replace(/^\uFEFF/, '');
  const chars = [...raw];
  if (chars.length < 2) throw new Error('字母表至少需要 2 个字符');
  if (chars.length > 256) throw new Error('字母表最多 256 个字符');
  const seen = new Map();
  chars.forEach((ch, i) => {
    if (seen.has(ch)) throw new Error(`字母表第 ${i + 1} 个字符「${ch}」与第 ${seen.get(ch) + 1} 个重复，请去掉重复字符`);
    seen.set(ch, i);
  });
  chars.forEach((ch, i) => {
    if (ch.codePointAt(0) > 0xffff) throw new Error(`字母表第 ${i + 1} 个字符「${ch}」超出支持范围（仅支持 BMP 字符）`);
    if (INVISIBLE_CHARS.has(ch) || ch === '\uFEFF') throw new Error(`字母表第 ${i + 1} 个字符是不可见字符（零宽/格式字符），生成的 ID 会看不见摸不着，请删掉它`);
    if (/\s/.test(ch)) throw new Error(`字母表第 ${i + 1} 个字符是空白字符，字母表不能包含空白字符`);
  });
  return chars.join('');
}

// 收集输入层面的提示（不报错、但用户应当知道的自动处理与风险），供页面以提示条展示。
export function collectNanoidNotes({ size, count, alphabet } = {}) {
  const notes = [];
  if (normalizeFullwidth(size).converted || normalizeFullwidth(count).converted) notes.push('已将全角数字按半角处理');
  if (String(alphabet ?? '').startsWith('\uFEFF')) notes.push('已忽略字母表开头的 BOM 字符');
  return notes;
}

export function alphabetWarnings(alphabet) {
  const warnings = [];
  const raw = String(alphabet ?? '').replace(/^\uFEFF/, '');
  if (/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/.test(raw)) warnings.push('字母表含全角字符：生成的 ID 会包含全角字符，放进 URL 或代码里可能不方便，通常应改用半角字符');
  return warnings;
}

function toIntInRange(value, label, min, max) {
  const s = normalizeFullwidth(String(value ?? '')).text.trim().replace(/^\uFEFF/, '');
  if (s === '') throw new Error(`请输入${label}`);
  if (!/^\d+$/.test(s)) {
    if (s.startsWith('-')) throw new Error(`${label}不能为负数，收到「${s}」`);
    if (s.includes('.')) throw new Error(`${label}必须是整数，不能是小数，收到「${s}」`);
    if (/[eE]/.test(s)) throw new Error(`${label}请直接写十进制整数，不要用科学计数法，收到「${s}」`);
    if (/[_,，]/.test(s)) throw new Error(`${label}请去掉千分位/数字分隔符后重试，收到「${s}」`);
    throw new Error(`${label}必须是正整数，收到「${s}」`);
  }
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${label}须在 ${min}–${max} 之间，收到「${s}」`);
  return n;
}

// 与 nanoid 官方 customAlphabet 相同的掩码步进算法：每次取 step 个随机字节，按 mask 映射到字母表，凑满 size 为止。
export function generateNanoid({ size = 21, alphabet = DEFAULT_ALPHABET } = {}, randomBytes = defaultRandomBytes) {
  const alpha = validateAlphabet(alphabet);
  const len = toIntInRange(size, '长度', 1, MAX_SIZE);
  const mask = (2 << (31 - Math.clz32((alpha.length - 1) | 1))) - 1;
  const step = Math.ceil((1.6 * mask * len) / alpha.length);
  let id = '';
  let guard = 0;
  while (id.length < len) {
    if (++guard > 1000) throw new Error('随机采样失败，请重试');
    const bytes = randomBytes(step);
    for (let i = 0; i < step && id.length < len; i++) {
      const idx = bytes[i] & mask;
      if (idx < alpha.length) id += alpha[idx];
    }
  }
  return id;
}

export function generateNanoidBatch({ size = 21, alphabet = DEFAULT_ALPHABET, count = 10, unique = true } = {}, randomBytes = defaultRandomBytes) {
  const n = toIntInRange(count, '生成数量', 1, MAX_COUNT);
  const alpha = validateAlphabet(alphabet);
  const len = toIntInRange(size, '长度', 1, MAX_SIZE);
  // 唯一性可行性：组合空间 alpha^len 小于数量时必然重复，直接报错（用对数比较避免溢出）
  if (unique && n > 1 && len * Math.log2(alpha.length) < Math.log2(n)) {
    throw new Error(`当前字母表与长度的组合空间不足以生成 ${n} 个不重复 ID，请加长或扩大字母表`);
  }
  const out = [];
  const seen = unique ? new Set() : null;
  let guard = 0;
  while (out.length < n) {
    if (++guard > n * 100 + 1000) throw new Error('多次生成重复 ID，请加长或扩大字母表');
    const id = generateNanoid({ size: len, alphabet: alpha }, randomBytes);
    if (seen) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(id);
  }
  return out;
}

export function entropyBits(size, alphabetLength) {
  const n = Number(size);
  const a = Number(alphabetLength);
  // 非法输入返回 null 而不是 NaN/负数：旧版 describeEntropy(NaN) 会一路落到「极强」，严重误导。
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(a) || a < 2) return null;
  return Math.round(n * Math.log2(a) * 10) / 10;
}

export function describeEntropy(bits) {
  if (typeof bits !== 'number' || !Number.isFinite(bits) || bits < 0) return '';
  if (bits < 40) return '较弱：仅适合非关键场景的短标识';
  if (bits < 64) return '一般：适合一般业务标识，不建议用作凭证';
  if (bits < 100) return '较强：适合作为公开业务 ID';
  if (bits < 128) return '强：接近 UUID v4 的随机强度（122 位）';
  return '极强：达到或超过常见安全令牌强度';
}
