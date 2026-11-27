// 文本与 Hex/Base32/Base58 编码互转：纯本地，UTF-8 字节为中间表示
export const ENCODING_FORMATS = [
  { id: 'hex', name: 'Hex 十六进制', hint: '每字节两位十六进制，如 hello → 68656c6c6f' },
  { id: 'base32', name: 'Base32', hint: 'RFC 4648 字母表 A-Z2-7，带 = 填充，如 hello → NBSWY3DP' },
  { id: 'base58', name: 'Base58', hint: 'Bitcoin 字母表（无 0/O/I/l），如 hello → Cn8eVZg' }
];
// 输入上限：Hex/Base32 是线性算法给到 100 万字符；Base58 是平方级换算，
// 编码（按字节）与解码（按字符）都收紧到 2 万，超限点名报错而不是把页面算死
export const MAX_LINEAR_INPUT = 1000000;
export const MAX_BASE58_INPUT = 20000;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// 全角字符（中文输入法粘贴常见）转半角：逐码点 1 对 1 替换，长度不变、位置不偏移
export function normalizeEncodingInput(input) {
  return [...String(input ?? '')].map((ch) => {
    const cp = ch.codePointAt(0);
    if (cp === 0x3000) return ' ';
    if (cp >= 0xff01 && cp <= 0xff5e) return String.fromCodePoint(cp - 0xfee0);
    return ch;
  }).join('');
}
function checkLimit(length, format) {
  const max = format === 'base58' ? MAX_BASE58_INPUT : MAX_LINEAR_INPUT;
  if (length > max) {
    throw new Error(format === 'base58'
      ? `Base58 换算是平方级计算，输入上限 ${MAX_BASE58_INPUT} 个字符，当前 ${length} 个`
      : `输入上限 ${MAX_LINEAR_INPUT} 个字符，当前 ${length} 个`);
  }
}
export function textToBytes(text) { return new TextEncoder().encode(String(text ?? '')); }
export function bytesToText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('解码结果不是合法的 UTF-8 文本（可能是二进制数据或编码选错了）'); }
}
export function bytesToHex(bytes, { uppercase = false, spaced = false } = {}) {
  const parts = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  const s = spaced ? parts.join(' ') : parts.join('');
  return uppercase ? s.toUpperCase() : s;
}
export function hexToBytes(input) {
  const chars = [...normalizeEncodingInput(input)];
  // 定位 0x 前缀：只认开头（允许前置空白）的一处
  let start = 0;
  while (start < chars.length && /\s/.test(chars[start])) start++;
  let bodyStart = start;
  if ((chars[start] === '0') && (chars[start + 1] === 'x' || chars[start + 1] === 'X')) bodyStart = start + 2;
  // 收集数字字符并记住原文位置（下标按码点计、从 1 起）；空白忽略，下划线只能夹在两个数字之间
  const digits = []; const positions = [];
  let prev = ''; // 上一个有意义字符：'' 开头 / 'd' 数字 / '_' 下划线
  let underscorePos = 0;
  for (let i = bodyStart; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) continue;
    if (ch === '_') {
      if (prev !== 'd') throw new Error(`第 ${i + 1} 个字符「_」只能夹在两个十六进制数字之间`);
      prev = '_'; underscorePos = i + 1; continue;
    }
    if (!/[0-9a-fA-F]/.test(ch)) throw new Error(`第 ${i + 1} 个字符「${ch}」不是十六进制字符`);
    digits.push(ch); positions.push(i + 1); prev = 'd';
  }
  if (prev === '_') throw new Error(`第 ${underscorePos} 个字符「_」只能夹在两个十六进制数字之间`);
  if (!digits.length) {
    if (bodyStart > start) throw new Error('0x 前缀后面没有十六进制数字');
    throw new Error('输入为空');
  }
  if (digits.length % 2 !== 0) throw new Error(`Hex 长度应为偶数，当前 ${digits.length} 个数字字符（可能少了一位）`);
  const out = new Uint8Array(digits.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(digits[i * 2] + digits[i * 2 + 1], 16);
  return out;
}
export function bytesToBase32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}
export function base32ToBytes(input) {
  const chars = [...normalizeEncodingInput(input)];
  // 空白与连字符（分组写法）忽略，但保留原文位置映射，报错指原文第几个字符
  const kept = []; const positions = [];
  for (let i = 0; i < chars.length; i++) {
    if (/[\s-]/.test(chars[i])) continue;
    kept.push(chars[i].toUpperCase()); positions.push(i + 1);
  }
  if (!kept.length) throw new Error('输入为空');
  const s = kept.join('');
  const padAt = s.indexOf('=');
  const body = padAt >= 0 ? s.slice(0, padAt) : s;
  if (padAt >= 0 && !/^=+$/.test(s.slice(padAt))) throw new Error(`第 ${positions[padAt + s.slice(padAt).search(/[^=]/)]} 个字符起填充 = 后面还有内容，= 只能出现在末尾`);
  if (!body.length) throw new Error('输入只有填充符 =，没有 Base32 数据字符');
  const rem = body.length % 8;
  if ([1, 3, 6].includes(rem)) throw new Error(`Base32 长度不合法（去掉填充后余 ${rem} 个字符无法解码）`);
  if (padAt >= 0) {
    const padCount = s.length - padAt;
    const expected = (8 - rem) % 8;
    if (padCount !== expected) throw new Error(`Base32 填充数量不对：数据 ${body.length} 个字符应带 ${expected} 个 =，当前 ${padCount} 个`);
  }
  let bits = 0, value = 0; const out = [];
  for (let i = 0; i < body.length; i++) {
    const idx = B32.indexOf(body[i]);
    if (idx < 0) throw new Error(`第 ${positions[i]} 个字符「${body[i]}」不在 Base32 字母表 A-Z2-7 中（注意没有 0/1/8/9）`);
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  // 规范编码要求结尾多余比特为 0，如 MZ====== 的 Z 多余比特非 0、与 MY====== 解出同一字节，应点名
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) throw new Error('Base32 结尾多余比特不为 0，不是规范编码（最后一个数据字符可能写错了）');
  return new Uint8Array(out);
}
export function bytesToBase58(bytes) {
  if (!bytes.length) return '';
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // 以 256 进制转 58 进制（小端数组逐位进位）
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '1'.repeat(zeros);
  if (!(digits.length === 1 && digits[0] === 0)) for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
export function base58ToBytes(input) {
  const normalized = normalizeEncodingInput(input);
  const chars = [...normalized];
  // 只剥两端空白，位置按原文计；内部空白不忽略、会点名报错
  let start = 0; let end = chars.length;
  while (start < end && /\s/.test(chars[start])) start++;
  while (end > start && /\s/.test(chars[end - 1])) end--;
  const body = chars.slice(start, end);
  if (!body.length) throw new Error('输入为空');
  let zeros = 0; while (zeros < body.length && body[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < body.length; i++) {
    const idx = B58.indexOf(body[i]);
    if (idx < 0) throw new Error(`第 ${start + i + 1} 个字符「${body[i]}」不在 Base58 字母表中（注意不含 0、O、I、l，内部空格也不忽略）`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 255); carry >>= 8; }
  }
  const isZero = bytes.length === 1 && bytes[0] === 0;
  const decoded = isZero ? [] : bytes.reverse();
  const out = new Uint8Array(zeros + decoded.length);
  out.set(decoded, zeros);
  return out;
}
const ENCODERS = { hex: (b, o) => bytesToHex(b, o), base32: (b) => bytesToBase32(b), base58: (b) => bytesToBase58(b) };
const DECODERS = { hex: hexToBytes, base32: base32ToBytes, base58: base58ToBytes };
export function encodeText(text, format, options = {}) {
  if (!ENCODERS[format]) throw new Error(`未知编码格式：${format}`);
  const bytes = textToBytes(text);
  checkLimit(format === 'base58' ? bytes.length : [...String(text ?? '')].length, format);
  return ENCODERS[format](bytes, options);
}
export function decodeText(input, format) {
  if (!DECODERS[format]) throw new Error(`未知编码格式：${format}`);
  checkLimit([...normalizeEncodingInput(input)].length, format);
  return bytesToText(DECODERS[format](input));
}
export function encodeAll(text, options = {}) {
  const bytes = textToBytes(text);
  // 一屏对照含 Base58，按 Base58 上限校验
  checkLimit(bytes.length, 'base58');
  return { byteLength: bytes.length, hex: bytesToHex(bytes, options), base32: bytesToBase32(bytes), base58: bytesToBase58(bytes) };
}
