// 文本与 Hex/Base32/Base58 编码互转：纯本地，UTF-8 字节为中间表示
export const ENCODING_FORMATS = [
  { id: 'hex', name: 'Hex 十六进制', hint: '每字节两位十六进制，如 hello → 68656c6c6f' },
  { id: 'base32', name: 'Base32', hint: 'RFC 4648 字母表 A-Z2-7，带 = 填充，如 hello → NBSWY3DP' },
  { id: 'base58', name: 'Base58', hint: 'Bitcoin 字母表（无 0/O/I/l），如 hello → Cn8eVZg' }
];
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
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
  let s = String(input ?? '').trim();
  if (/^0x/i.test(s)) s = s.slice(2);
  s = s.replace(/[\s_]+/g, '');
  if (!s) throw new Error('输入为空');
  const bad = s.search(/[^0-9a-fA-F]/);
  if (bad >= 0) throw new Error(`第 ${bad + 1} 个字符「${s[bad]}」不是十六进制字符`);
  if (s.length % 2 !== 0) throw new Error(`Hex 长度应为偶数，当前 ${s.length} 个字符（可能少了一位）`);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
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
  const s = String(input ?? '').replace(/[\s-]+/g, '').toUpperCase();
  if (!s) throw new Error('输入为空');
  const padAt = s.indexOf('=');
  const body = padAt >= 0 ? s.slice(0, padAt) : s;
  if (padAt >= 0 && !/^=+$/.test(s.slice(padAt))) throw new Error('Base32 填充 = 只能出现在末尾');
  if (padAt >= 0 && s.length % 8 !== 0) throw new Error('带填充的 Base32 长度应为 8 的倍数');
  const rem = body.length % 8;
  if ([1, 3, 6].includes(rem)) throw new Error(`Base32 长度不合法（去掉填充后余 ${rem} 个字符无法解码）`);
  let bits = 0, value = 0; const out = [];
  for (let i = 0; i < body.length; i++) {
    const idx = B32.indexOf(body[i]);
    if (idx < 0) throw new Error(`第 ${i + 1} 个字符「${body[i]}」不在 Base32 字母表 A-Z2-7 中`);
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
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
  const s = String(input ?? '').trim();
  if (!s) throw new Error('输入为空');
  let zeros = 0; while (zeros < s.length && s[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < s.length; i++) {
    const idx = B58.indexOf(s[i]);
    if (idx < 0) throw new Error(`第 ${i + 1} 个字符「${s[i]}」不在 Base58 字母表中（注意不含 0、O、I、l）`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 255); carry >>= 8; }
  }
  const isZero = bytes.length === 1 && bytes[0] === 0;
  const body = isZero ? [] : bytes.reverse();
  const out = new Uint8Array(zeros + body.length);
  out.set(body, zeros);
  return out;
}
const ENCODERS = { hex: (b, o) => bytesToHex(b, o), base32: (b) => bytesToBase32(b), base58: (b) => bytesToBase58(b) };
const DECODERS = { hex: hexToBytes, base32: base32ToBytes, base58: base58ToBytes };
export function encodeText(text, format, options = {}) {
  if (!ENCODERS[format]) throw new Error(`未知编码格式：${format}`);
  return ENCODERS[format](textToBytes(text), options);
}
export function decodeText(input, format) {
  if (!DECODERS[format]) throw new Error(`未知编码格式：${format}`);
  return bytesToText(DECODERS[format](input));
}
export function encodeAll(text, options = {}) {
  const bytes = textToBytes(text);
  return { byteLength: bytes.length, hex: bytesToHex(bytes, options), base32: bytesToBase32(bytes), base58: bytesToBase58(bytes) };
}
