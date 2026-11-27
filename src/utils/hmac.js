// HMAC 签名核心逻辑：纯本地，签名走 Web Crypto，不上传任何数据。
export const HMAC_ALGS = [
  { id: 'SHA-256', label: 'HMAC-SHA-256', digestBytes: 32 },
  { id: 'SHA-512', label: 'HMAC-SHA-512', digestBytes: 64 },
  { id: 'SHA-384', label: 'HMAC-SHA-384', digestBytes: 48 },
  { id: 'SHA-1', label: 'HMAC-SHA-1（仅兼容旧系统）', digestBytes: 20 }
];

export const INPUT_ENCODINGS = [
  { id: 'utf8', label: 'UTF-8 文本' },
  { id: 'hex', label: 'Hex 十六进制' },
  { id: 'base64', label: 'Base64' }
];

const encoder = new TextEncoder();

export const MAX_KEY_CHARS = 100000;
export const MAX_MESSAGE_CHARS = 1000000;

export const EXPECTED_ENCODINGS = [
  { id: 'hex', label: 'Hex 十六进制' },
  { id: 'base64', label: 'Base64' },
  { id: 'base64url', label: 'Base64URL' }
];

// 全角转半角（U+FF01–FF5E 与全角空格），1:1 替换不改变下标
export function normalizeFullwidth(text) {
  return String(text ?? '').replace(/[\uFF01-\uFF5E\u3000]/g, (ch) =>
    ch === '\u3000' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

// 找未配对代理字符，返回其下标（0 起）与类型；无则 -1
export function findLoneSurrogate(text) {
  const raw = String(text ?? '');
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const n = raw.charCodeAt(i + 1);
      if (!(n >= 0xDC00 && n <= 0xDFFF)) return i;
      i += 1;
    } else if (c >= 0xDC00 && c <= 0xDFFF) return i;
  }
  return -1;
}

function parseHexBytes(rawInput, label) {
  const raw = normalizeFullwidth(rawInput);
  let start = 0;
  while (start < raw.length && /\s/.test(raw[start])) start += 1;
  let hasPrefix = false;
  if (raw.startsWith('0x', start) || raw.startsWith('0X', start)) { hasPrefix = true; start += 2; }
  let cleaned = '';
  const positions = [];
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (/[0-9a-fA-F]/.test(ch)) { cleaned += ch; positions.push(i); continue; }
    if (/\s/.test(ch)) continue;
    if (ch === '_') {
      const prev = raw[i - 1] || '';
      const next = raw[i + 1] || '';
      if (!/[0-9a-fA-F]/.test(prev) || !/[0-9a-fA-F]/.test(next)) {
        return { ok: false, error: `${label}（Hex）第 ${i + 1} 个字符「_」只能夹在两个十六进制数字之间` };
      }
      continue;
    }
    return { ok: false, error: `${label}（Hex）第 ${i + 1} 个字符「${ch}」不是十六进制字符` };
  }
  if (!cleaned) return { ok: false, error: hasPrefix ? `${label}（Hex）0x 后面没有数字` : `${label}（Hex）不能为空` };
  if (cleaned.length % 2 !== 0) return { ok: false, error: `${label}（Hex）长度为奇数 ${cleaned.length}，每字节需要 2 个十六进制字符` };
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return { ok: true, bytes };
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function parseBase64Bytes(rawInput, label, urlSafe) {
  const raw = normalizeFullwidth(rawInput);
  let cleaned = '';
  const positions = [];
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (/\s/.test(ch)) continue;
    cleaned += ch; positions.push(i);
  }
  if (!cleaned) return { ok: false, error: `${label}（Base64）不能为空` };
  const allowed = urlSafe ? /[A-Za-z0-9\-_=]/ : /[A-Za-z0-9+/=]/;
  for (let i = 0; i < cleaned.length; i += 1) {
    if (!allowed.test(cleaned[i])) {
      return { ok: false, error: `${label}（Base64）第 ${positions[i] + 1} 个字符「${cleaned[i]}」不是合法 Base64 字符` };
    }
  }
  const firstPad = cleaned.indexOf('=');
  let data = cleaned;
  let pad = 0;
  if (firstPad !== -1) {
    if (!/^=+$/.test(cleaned.slice(firstPad))) {
      return { ok: false, error: `${label}（Base64）第 ${positions[firstPad] + 1} 个字符「=」只能出现在末尾作填充` };
    }
    pad = cleaned.length - firstPad;
    data = cleaned.slice(0, firstPad);
    if (pad > 2) return { ok: false, error: `${label}（Base64）填充「=」最多 2 个，当前 ${pad} 个` };
    if (cleaned.length % 4 !== 0) return { ok: false, error: `${label}（Base64）带填充时总长度须为 4 的倍数，当前 ${cleaned.length}` };
  } else if (cleaned.length % 4 === 1) {
    return { ok: false, error: `${label}（Base64）长度 ${cleaned.length} 不合法：长度除以 4 余 1` };
  }
  const rem = data.length % 4;
  if (rem === 1) return { ok: false, error: `${label}（Base64）数据长度不合法` };
  if (rem === 2 || rem === 3) {
    const lastVal = B64_ALPHABET.indexOf(urlSafe ? data[data.length - 1].replace('-', '+').replace('_', '/') : data[data.length - 1]);
    const unusedMask = rem === 2 ? 0x0F : 0x03;
    if (lastVal >= 0 && (lastVal & unusedMask) !== 0) {
      return { ok: false, error: `${label}（Base64）最后一个字符的未用比特不为 0，不是规范编码（解码结果可能与标准实现不一致）` };
    }
  }
  const std = (urlSafe ? data.replace(/-/g, '+').replace(/_/g, '/') : data) + '='.repeat((4 - (data.length % 4)) % 4);
  try {
    const bin = atob(std);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return { ok: true, bytes };
  } catch {
    return { ok: false, error: `${label} 不是合法 Base64` };
  }
}

// 按指定编码把输入文本解析为字节；非法输入定位报错
export function parseInputBytes(text, encoding, label = '输入') {
  const raw = String(text ?? '');
  if (encoding === 'utf8') {
    const lone = findLoneSurrogate(raw);
    if (lone !== -1) return { ok: false, error: `${label} 第 ${lone + 1} 个字符是未配对的代理字符，无法按 UTF-8 编码（粘贴内容可能已损坏），请检查后重试` };
    return { ok: true, bytes: encoder.encode(raw) };
  }
  if (encoding === 'hex') return parseHexBytes(raw, label);
  if (encoding === 'base64') return parseBase64Bytes(raw, label, false);
  if (encoding === 'base64url') return parseBase64Bytes(raw, label, true);
  return { ok: false, error: `${label} 的编码方式不支持：${encoding}` };
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 计算 HMAC：algorithm 取 HMAC_ALGS 的 id；key/message 各自带编码
export async function computeHmac({ algorithm, keyText, keyEncoding = 'utf8', messageText, messageEncoding = 'utf8' } = {}) {
  const spec = HMAC_ALGS.find((a) => a.id === algorithm);
  if (!spec) return { ok: false, error: `不支持的算法：${algorithm}（仅支持 ${HMAC_ALGS.map((a) => a.id).join(' / ')}）` };
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, error: '当前环境不支持 Web Crypto（需要 HTTPS 或 localhost 安全上下文）' };
  if (String(keyText ?? '') === '') return { ok: false, error: '密钥不能为空' };
  if (String(keyText ?? '').length > MAX_KEY_CHARS) return { ok: false, error: `密钥过长：${String(keyText).length} 字符，上限 ${MAX_KEY_CHARS} 字符` };
  if (String(messageText ?? '').length > MAX_MESSAGE_CHARS) return { ok: false, error: `消息过长：${String(messageText).length} 字符，上限 ${MAX_MESSAGE_CHARS} 字符` };
  const keyParsed = parseInputBytes(keyText, keyEncoding, '密钥');
  if (!keyParsed.ok) return keyParsed;
  const msgParsed = parseInputBytes(messageText, messageEncoding, '消息');
  if (!msgParsed.ok) return msgParsed;
  try {
    const key = await subtle.importKey('raw', keyParsed.bytes, { name: 'HMAC', hash: spec.id }, false, ['sign']);
    const sig = new Uint8Array(await subtle.sign('HMAC', key, msgParsed.bytes));
    return {
      ok: true,
      algorithm: spec.id,
      label: spec.label,
      keyBytes: keyParsed.bytes.length,
      messageBytes: msgParsed.bytes.length,
      digestBytes: sig.length,
      hex: bytesToHex(sig),
      base64: bytesToBase64(sig),
      base64Url: bytesToBase64Url(sig)
    };
  } catch (e) {
    return { ok: false, error: `签名计算失败：${e.message}` };
  }
}

// 验签：用同一密钥/消息重算并与期望签名逐字节比较（长度不等直接不匹配，相等时恒定累积差异）
export async function verifyHmacSignature({ algorithm, keyText, keyEncoding = 'utf8', messageText, messageEncoding = 'utf8', expectedText, expectedEncoding = 'hex' } = {}) {
  if (String(expectedText ?? '').trim() === '') return { ok: false, error: '期望签名不能为空' };
  const expected = parseInputBytes(expectedText, expectedEncoding, '期望签名');
  if (!expected.ok) return expected;
  const computed = await computeHmac({ algorithm, keyText, keyEncoding, messageText, messageEncoding });
  if (!computed.ok) return computed;
  const digest = new Uint8Array(computed.hex.length / 2);
  for (let i = 0; i < digest.length; i += 1) digest[i] = parseInt(computed.hex.slice(i * 2, i * 2 + 2), 16);
  if (expected.bytes.length !== digest.length) {
    return { ok: true, match: false, reason: `长度不一致：期望 ${expected.bytes.length} 字节，${computed.label} 签名应为 ${digest.length} 字节`, expectedBytes: expected.bytes.length, digestBytes: digest.length, algorithm: computed.algorithm, label: computed.label };
  }
  let diff = 0;
  for (let i = 0; i < digest.length; i += 1) diff |= digest[i] ^ expected.bytes[i];
  return { ok: true, match: diff === 0, reason: diff === 0 ? '签名一致' : '签名不一致：内容不同（请核对算法、密钥与消息编码）', expectedBytes: expected.bytes.length, digestBytes: digest.length, algorithm: computed.algorithm, label: computed.label };
}

export function buildHmacSummary(result) {
  if (!result?.ok) return '';
  return [
    `算法：${result.label}`,
    `密钥：${result.keyBytes} 字节 · 消息：${result.messageBytes} 字节 · 签名：${result.digestBytes} 字节`,
    `Hex：${result.hex}`,
    `Base64：${result.base64}`,
    `Base64URL：${result.base64Url}`
  ].join('\n');
}
