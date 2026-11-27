// 进制转换核心（纯本地）：BigInt 任意精度整数 + 小数部分定长展开（默认 32 位）
// 支持 2–36 进制、负数、前缀（0x/0o/0b，与所选进制匹配时自动剥离；不匹配时点名提示应切换的进制）、
// 下划线分隔符（只能夹在两个数字之间）。所有报错位置都按原文（去首尾空白后）计，含符号与前缀。

export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export const COMMON_BASES = [2, 8, 10, 16, 36];
export const MAX_FRAC_DIGITS = 32;
export const MAX_DIGITS = 4096;

const PREFIXES = { 16: '0x', 8: '0o', 2: '0b' };

export function digitValue(ch) {
  return DIGITS.indexOf(ch.toLowerCase());
}

export function validateBase(base) {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new Error(`进制必须在 2–36 之间（收到 ${base}）`);
  }
}

// 解析输入；返回 { negative, intPart, fracPart, cleaned }
export function parseInput(raw, base) {
  validateBase(base);
  const s = String(raw).trim();
  if (!s) throw new Error('输入为空');
  let start = 0;
  let negative = false;
  if (s[0] === '-' || s[0] === '+') { negative = s[0] === '-'; start = 1; }
  if (start >= s.length) throw new Error('只有符号，没有数字');
  const rest = s.slice(start).toLowerCase();
  const ownPrefix = PREFIXES[base];
  if (ownPrefix && rest.startsWith(ownPrefix)) {
    start += 2;
    if (start >= s.length) throw new Error(`前缀「${ownPrefix}」后面没有数字`);
  } else {
    // 贴进来的前缀与所选进制对不上时点名提示，而不是报一个看不懂的非法字符；
    // 仅当前缀字母本身超出当前进制可用范围时才提示（高进制里 0b/0x 可能是合法数字串，不误伤）
    for (const [prefixBase, prefix] of Object.entries(PREFIXES)) {
      if (rest.startsWith(prefix) && digitValue(prefix[1]) >= base) {
        throw new Error(`检测到前缀「${prefix}」（${prefixBase} 进制），但当前源进制是 ${base}，请把源进制切换为 ${prefixBase} 后重试`);
      }
    }
  }
  let intPart = '';
  let fracPart = '';
  let seenDot = false;
  let digitCount = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    const pos = i + 1;
    if (ch === '.') {
      if (seenDot) throw new Error(`小数点最多只能有一个（第 ${pos} 个字符是多余的小数点）`);
      seenDot = true;
      continue;
    }
    if (ch === '_') {
      const prev = i > start ? s[i - 1] : '';
      const next = i + 1 < s.length ? s[i + 1] : '';
      const isDigit = (c) => c && digitValue(c) >= 0 && digitValue(c) < base;
      if (!isDigit(prev) || !isDigit(next)) {
        throw new Error(`第 ${pos} 个字符「_」只能夹在两个数字之间作分隔符`);
      }
      continue;
    }
    const v = digitValue(ch);
    if (v < 0 || v >= base) {
      throw new Error(`第 ${pos} 个字符「${ch}」不是合法的 ${base} 进制数字（可用 0–${DIGITS[base - 1]}）`);
    }
    digitCount++;
    if (digitCount > MAX_DIGITS) throw new Error(`数字位数过多，最多支持 ${MAX_DIGITS} 位（整数与小数合计）`);
    if (seenDot) fracPart += ch; else intPart += ch;
  }
  if (!intPart && !fracPart) throw new Error('只有小数点，没有数字');
  return { negative, intPart: intPart || '0', fracPart, cleaned: s.slice(start) };
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
