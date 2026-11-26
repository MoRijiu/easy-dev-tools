// 进制转换核心（纯本地）：BigInt 任意精度整数 + 小数部分定长展开（默认 32 位）
// 支持 2–36 进制、负数、前缀（0x/0o/0b，仅当与所选进制匹配时自动剥离）、下划线分隔符忽略

export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export const COMMON_BASES = [2, 8, 10, 16, 36];
export const MAX_FRAC_DIGITS = 32;

const PREFIXES = { 16: ['0x'], 8: ['0o'], 2: ['0b'] };

export function digitValue(ch) {
  return DIGITS.indexOf(ch.toLowerCase());
}

export function validateBase(base) {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new Error(`进制必须在 2–36 之间（收到 ${base}）`);
  }
}

// 剥离与进制匹配的前缀与下划线；返回 { negative, intPart, fracPart, cleaned }
export function parseInput(raw, base) {
  validateBase(base);
  let s = String(raw).trim().replace(/_/g, '');
  if (!s) throw new Error('输入为空');
  let negative = false;
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  const lower = s.toLowerCase();
  for (const p of PREFIXES[base] || []) {
    if (lower.startsWith(p)) { s = s.slice(p.length); break; }
  }
  if (!s) throw new Error('输入为空');
  const parts = s.split('.');
  if (parts.length > 2) throw new Error('小数点最多只能有一个');
  const [intPart, fracPart = ''] = parts;
  if (!intPart && !fracPart) throw new Error('输入为空');
  const check = (part, label) => {
    for (let i = 0; i < part.length; i++) {
      const v = digitValue(part[i]);
      if (v < 0 || v >= base) {
        throw new Error(`${label}第 ${i + 1} 个字符「${part[i]}」不是合法的 ${base} 进制数字（可用 0–${DIGITS[base - 1]}）`);
      }
    }
  };
  check(intPart, '整数部分');
  check(fracPart, '小数部分');
  return { negative, intPart: intPart || '0', fracPart, cleaned: s };
}

function intToBigInt(intPart, base) {
  let n = 0n;
  const b = BigInt(base);
  for (const ch of intPart) n = n * b + BigInt(digitValue(ch));
  return n;
}

function bigIntToBase(n, base) {
  if (n === 0n) return '0';
  const b = BigInt(base);
  let out = '';
  let v = n;
  while (v > 0n) { out = DIGITS[Number(v % b)] + out; v /= b; }
  return out;
}

// 小数部分：源进制分数 -> 目标进制展开，返回 { digits, exact }
function convertFraction(fracPart, fromBase, toBase, maxDigits = MAX_FRAC_DIGITS) {
  if (!fracPart) return { digits: '', exact: true };
  // 分数 = num / fromBase^len
  let num = 0n;
  const fb = BigInt(fromBase);
  for (const ch of fracPart) num = num * fb + BigInt(digitValue(ch));
  if (num === 0n) return { digits: '', exact: true };
  let den = fb ** BigInt(fracPart.length);
  const tb = BigInt(toBase);
  let digits = '';
  let rem = num;
  for (let i = 0; i < maxDigits && rem !== 0n; i++) {
    rem *= tb;
    digits += DIGITS[Number(rem / den)];
    rem %= den;
  }
  return { digits, exact: rem === 0n };
}

export function convertBase(raw, fromBase, toBase, maxFracDigits = MAX_FRAC_DIGITS) {
  validateBase(toBase);
  const { negative, intPart, fracPart } = parseInput(raw, fromBase);
  const intVal = intToBigInt(intPart, fromBase);
  const isZero = intVal === 0n && (!fracPart || [...fracPart].every(c => digitValue(c) === 0));
  let out = bigIntToBase(intVal, toBase);
  const frac = convertFraction(fracPart, fromBase, toBase, maxFracDigits);
  if (frac.digits) out += '.' + frac.digits;
  return { value: (negative && !isZero ? '-' : '') + out, exact: frac.exact, hasFraction: !!fracPart };
}

export function convertAll(raw, fromBase) {
  const results = {};
  for (const b of COMMON_BASES) results[b] = convertBase(raw, fromBase, b);
  return results;
}

// 二进制按 4 位、其他按需分组展示；整数部分从右分组，小数部分从左分组
export function groupDigits(value, groupSize = 4) {
  if (!groupSize || groupSize < 2) return value;
  let sign = '';
  let v = value;
  if (v.startsWith('-')) { sign = '-'; v = v.slice(1); }
  const [intPart, fracPart] = v.split('.');
  const groupFromRight = (s) => {
    let out = '';
    for (let i = s.length; i > 0; i -= groupSize) out = s.slice(Math.max(0, i - groupSize), i) + (out ? '_' + out : '');
    return out;
  };
  const groupFromLeft = (s) => {
    const chunks = [];
    for (let i = 0; i < s.length; i += groupSize) chunks.push(s.slice(i, i + groupSize));
    return chunks.join('_');
  };
  return sign + groupFromRight(intPart) + (fracPart ? '.' + groupFromLeft(fracPart) : '');
}

export function bitLength(raw, fromBase) {
  const { intPart } = parseInput(raw, fromBase);
  const n = intToBigInt(intPart, fromBase);
  return n === 0n ? 1 : n.toString(2).length;
}
