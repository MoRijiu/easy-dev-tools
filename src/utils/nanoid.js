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

export function validateAlphabet(alphabet) {
  const chars = [...String(alphabet ?? '')];
  if (chars.length < 2) throw new Error('字母表至少需要 2 个字符');
  if (chars.length > 256) throw new Error('字母表最多 256 个字符');
  const seen = new Set();
  for (const ch of chars) {
    if (seen.has(ch)) throw new Error(`字母表含重复字符「${ch}」，请去掉重复字符`);
    seen.add(ch);
  }
  for (const ch of chars) {
    if (ch.codePointAt(0) > 0xffff) throw new Error(`字母表字符「${ch}」超出支持范围（仅支持 BMP 字符）`);
    if (/\s/.test(ch)) throw new Error('字母表不能包含空白字符');
  }
  return chars.join('');
}

function toIntInRange(value, label, min, max) {
  const s = String(value ?? '').trim();
  if (s === '') throw new Error(`请输入${label}`);
  if (!/^\d+$/.test(s)) throw new Error(`${label}必须是正整数，收到「${s}」`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${label}须在 ${min}–${max} 之间`);
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
  return Math.round(Number(size) * Math.log2(alphabetLength) * 10) / 10;
}

export function describeEntropy(bits) {
  if (bits < 40) return '较弱：仅适合非关键场景的短标识';
  if (bits < 64) return '一般：适合一般业务标识，不建议用作凭证';
  if (bits < 100) return '较强：适合作为公开业务 ID';
  if (bits < 128) return '强：接近 UUID v4 的随机强度（122 位）';
  return '极强：达到或超过常见安全令牌强度';
}
