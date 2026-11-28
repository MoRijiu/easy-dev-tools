// 哈希计算核心：纯本地，MD5 走字节级实现（文本与文件共用同一条路径），
// SHA-1/256/384/512 走 Web Crypto。旧版问题逐项修正：
// - MD5 是字符串版实现，只能算文本、算不了文件二进制；本模块一律先转 Uint8Array 再算。
// - 示例里展示的哈希值是编造的假值（与真实计算对不上），组件改用真实向量。
// - 字符数用 String.length（UTF-16 码元），Emoji 会被算成 2；这里按码点 + UTF-8 字节统计。
// - 自动计算无防竞态：连续输入时先发的慢请求可能后返回覆盖新结果，组件用序号守卫，本模块只管纯计算。
// - 空字符串被 trim 拦掉，但空输入的哈希是确定且常用的校验值，这里允许计算。

export const HASH_ALGORITHMS = [
  { id: 'MD5', name: 'MD5', bits: 128 },
  { id: 'SHA-1', name: 'SHA-1', bits: 160 },
  { id: 'SHA-256', name: 'SHA-256', bits: 256 },
  { id: 'SHA-384', name: 'SHA-384', bits: 384 },
  { id: 'SHA-512', name: 'SHA-512', bits: 512 }
];

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];
const MD5_K = [];
for (let i = 0; i < 64; i++) {
  MD5_K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
}

function leftRotate(x, c) {
  return (x << c) | (x >>> (32 - c));
}

// RFC 1321 MD5，输入/输出均为字节与小写 hex
function md5Hex(bytes) {
  const origLen = bytes.length;
  const paddedLen = (((origLen + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[origLen] = 0x80;
  const view = new DataView(msg.buffer);
  view.setBigUint64(paddedLen - 8, BigInt(origLen) * 8n, true);

  let a0 = 0x67452301 | 0;
  let b0 = 0xefcdab89 | 0;
  let c0 = 0x98badcfe | 0;
  let d0 = 0x10325476 | 0;
  const M = new Int32Array(16);

  for (let block = 0; block < paddedLen; block += 64) {
    for (let j = 0; j < 16; j++) M[j] = view.getInt32(block + j * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c;
      c = b;
      b = (b + leftRotate((a + f + MD5_K[i] + M[g]) | 0, MD5_S[i])) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const out = new DataView(new ArrayBuffer(16));
  out.setInt32(0, a0, true);
  out.setInt32(4, b0, true);
  out.setInt32(8, c0, true);
  out.setInt32(12, d0, true);
  return bytesToHex(new Uint8Array(out.buffer));
}

function bytesToHex(bytes) {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// 计算单个算法的哈希（小写 hex）。MD5 同步实现，SHA 家族走 Web Crypto。
async function digestHex(algorithm, bytes) {
  if (algorithm === 'MD5') return md5Hex(bytes);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('当前环境不支持 Web Crypto（需 HTTPS 或 localhost 安全上下文），无法计算 SHA 系列哈希');
  }
  const buf = await subtle.digest(algorithm, bytes);
  return bytesToHex(new Uint8Array(buf));
}

// 批量计算，返回 { 算法id: hex }，顺序与入参一致。
// R10d：各算法彼此独立，旧版逐个 await 串行等待 Web Crypto；改并发后
// 结果按入参顺序组装，键顺序与值与串行版完全一致，只是总等待变短。
// MD5 为同步实现，并发不改变其计算本身。
export async function digestAll(algorithms, bytes) {
  const values = await Promise.all(algorithms.map((id) => digestHex(id, bytes)));
  const results = {};
  algorithms.forEach((id, i) => { results[id] = values[i]; });
  return results;
}

const encoder = new TextEncoder();
export function textToBytes(text) {
  return encoder.encode(String(text ?? ''));
}

// 文本统计：码点字符数 + UTF-8 字节数（哈希实际是对字节算的，字节数才是口径）
// R10d：字节数旧版每次都 encoder.encode 全文只为取 length，输入框每敲一键
// 就白白分配一份与全文等大的 Uint8Array（且随后计算时还要再编码一份）。
// 改为按码点算术求 UTF-8 字节长：<0x80→1、<0x800→2、<0x10000→3、其余→4；
// 孤立代理项码点落在 0xD800–0xDFFF（<0x10000→3），与 TextEncoder 将其
// 替换为 U+FFFD（3 字节）的结果一致，已用含 Emoji/孤立代理项的向量核对。
export function textStats(text) {
  const str = String(text ?? '');
  let chars = 0;
  let bytes = 0;
  for (const ch of str) {
    chars++;
    const cp = ch.codePointAt(0);
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return { chars, bytes };
}

// 归一化用户粘贴的期望哈希：去空白、转小写；非法字符定位报错；
// 长度必须命中某个已知算法，否则列出合法长度。返回 { hex, candidates: [算法名] }
export function normalizeExpectedHash(raw) {
  const compact = String(raw ?? '').replace(/\s+/g, '');
  if (!compact) throw new Error('请先粘贴要校验的哈希值');
  for (let i = 0; i < compact.length; i++) {
    if (!/[0-9a-fA-F]/.test(compact[i])) {
      throw new Error(`期望哈希第 ${i + 1} 个字符「${compact[i]}」不是十六进制字符`);
    }
  }
  const hex = compact.toLowerCase();
  const candidates = HASH_ALGORITHMS.filter(a => a.bits / 4 === hex.length).map(a => a.name);
  if (candidates.length === 0) {
    const lengths = [...new Set(HASH_ALGORITHMS.map(a => a.bits / 4))].join('/');
    throw new Error(`期望哈希长度为 ${hex.length} 个字符，不匹配任何已知算法（应为 ${lengths} 个字符）`);
  }
  return { hex, candidates };
}

// 在已计算结果里找与期望哈希相等的算法，返回命中的算法 id 数组（大小写不敏感）
export function findHashMatches(results, expectedHex) {
  const target = String(expectedHex ?? '').toLowerCase();
  return Object.entries(results ?? {})
    .filter(([, value]) => String(value).toLowerCase() === target)
    .map(([id]) => id);
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
