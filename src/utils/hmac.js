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

// 按指定编码把输入文本解析为字节；非法输入定位报错
export function parseInputBytes(text, encoding, label = '输入') {
  const raw = String(text ?? '');
  if (encoding === 'utf8') return { ok: true, bytes: encoder.encode(raw) };
  if (encoding === 'hex') {
    let s = raw.trim();
    if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
    s = s.replace(/[\s_]+/g, '');
    if (!s) return { ok: false, error: `${label}（Hex）不能为空` };
    if (s.length % 2 !== 0) return { ok: false, error: `${label}（Hex）长度为奇数 ${s.length}，每字节需要 2 个十六进制字符` };
    const bad = s.search(/[^0-9a-fA-F]/);
    if (bad !== -1) return { ok: false, error: `${label}（Hex）第 ${bad + 1} 个字符「${s[bad]}」不是十六进制字符` };
    const bytes = new Uint8Array(s.length / 2);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    return { ok: true, bytes };
  }
  if (encoding === 'base64') {
    const s = raw.replace(/\s+/g, '');
    if (!s) return { ok: false, error: `${label}（Base64）不能为空` };
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length % 4 === 1) {
      return { ok: false, error: `${label} 不是合法 Base64（仅允许 A–Z a–z 0–9 + / 与末尾 = 填充）` };
    }
    try {
      const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return { ok: true, bytes };
    } catch {
      return { ok: false, error: `${label} 不是合法 Base64` };
    }
  }
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
