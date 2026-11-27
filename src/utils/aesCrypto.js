// AES 加解密核心（纯本地，Web Crypto）
// 密文格式：IV 前缀拼接 —— GCM 为 12 字节 IV + 密文(含 16 字节认证标签)，
// CBC 为 16 字节 IV + 密文，整体再按 Base64 / Hex 输出。
// 与旧版的区别：密钥长度严格校验（不再静默补零/截断）、密文解码逐字校验、
// 解密结果用 fatal UTF-8 解码（密钥错误时明确报错而不是输出乱码）。

const textEncoder = new TextEncoder();

export const AES_KEY_BITS = [128, 192, 256];
export const AES_MODES = ["GCM", "CBC"];

export function utf8ByteLength(text) {
  return textEncoder.encode(text).length;
}

export function codePointLength(text) {
  return [...text].length;
}

// 校验并返回密钥字节：UTF-8 字节数必须正好等于 bits/8
export function parseKeyBytes(keyText, bits) {
  if (!AES_KEY_BITS.includes(bits)) {
    throw new Error(`不支持的密钥长度：${bits}，可选 128 / 192 / 256`);
  }
  const target = bits / 8;
  const bytes = textEncoder.encode(keyText ?? "");
  if (bytes.length === 0) {
    throw new Error(`请输入密钥（AES-${bits} 需要正好 ${target} 字节）`);
  }
  if (bytes.length !== target) {
    throw new Error(
      `密钥为 ${bytes.length} 字节，AES-${bits} 需要正好 ${target} 字节（按 UTF-8 计算，一个汉字占 3 字节）`
    );
  }
  return bytes;
}

// 无偏随机文本（拒绝采样）：用于生成随机密钥 / IV 文本
const RANDOM_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomText(byteLength) {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error("随机文本长度必须为正整数");
  }
  const limit = 256 - (256 % RANDOM_CHARSET.length);
  const out = [];
  while (out.length < byteLength) {
    const buf = new Uint8Array(byteLength - out.length + 8);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= limit) continue;
      out.push(RANDOM_CHARSET[b % RANDOM_CHARSET.length]);
      if (out.length === byteLength) break;
    }
  }
  return out.join("");
}

// 分块 Base64 编码（避免大数组展开爆栈）
export function bytesToBase64(bytes) {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// 严格 Base64 解码：忽略空白，其余逐字校验填充位置/个数与非法字符
export function base64ToBytes(input) {
  const clean = String(input ?? "").replace(/\s+/g, "");
  if (clean.length === 0) throw new Error("密文为空");
  if (clean.length % 4 === 1) {
    throw new Error(`Base64 密文长度 ${clean.length} 不合法（长度除以 4 不能余 1）`);
  }
  let padding = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "=") {
      padding++;
      if (i < clean.length - 2) {
        throw new Error(`Base64 填充符 = 只能出现在末尾（第 ${i + 1} 个字符）`);
      }
      continue;
    }
    if (padding > 0) {
      throw new Error(`Base64 填充符 = 后面不能再有内容（第 ${i + 1} 个字符）`);
    }
    if (!BASE64_CHARS.includes(ch)) {
      throw new Error(`Base64 密文第 ${i + 1} 个字符「${ch}」不合法`);
    }
  }
  if (padding > 2) throw new Error("Base64 填充符 = 最多 2 个");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("Base64 密文解码失败，请检查是否完整复制");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// 严格 Hex 解码：忽略空白，奇数长度与非法字符定位报错
export function hexToBytes(input) {
  const clean = String(input ?? "").replace(/\s+/g, "");
  if (clean.length === 0) throw new Error("密文为空");
  if (clean.length % 2 !== 0) {
    throw new Error(`Hex 密文长度 ${clean.length} 为奇数，十六进制必须两两成对`);
  }
  for (let i = 0; i < clean.length; i++) {
    if (!/[0-9a-fA-F]/.test(clean[i])) {
      throw new Error(`Hex 密文第 ${i + 1} 个字符「${clean[i]}」不是十六进制字符`);
    }
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function encodeCipherBytes(bytes, encoding) {
  return encoding === "hex" ? bytesToHex(bytes) : bytesToBase64(bytes);
}

export function decodeCipherText(text, encoding) {
  return encoding === "hex" ? hexToBytes(text) : base64ToBytes(text);
}

function assertSubtle() {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "当前环境不支持 Web Crypto（需要 HTTPS 或 localhost 安全上下文），无法加解密"
    );
  }
}

async function importKey(keyBytes, mode) {
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: mode === "GCM" ? "AES-GCM" : "AES-CBC" },
    false,
    ["encrypt", "decrypt"]
  );
}

export function ivLengthForMode(mode) {
  return mode === "GCM" ? 12 : 16;
}

// 加密：返回 { combined, ivBytes, cipherBytes }，combined = IV || 密文
export async function encryptAes({ text, keyText, bits = 256, mode = "GCM", ivText = "" }) {
  assertSubtle();
  if (!AES_MODES.includes(mode)) throw new Error(`不支持的加密模式：${mode}`);
  const keyBytes = parseKeyBytes(keyText, bits);
  const key = await importKey(keyBytes, mode);

  const ivLen = ivLengthForMode(mode);
  let ivBytes;
  if (mode === "CBC" && ivText) {
    const provided = textEncoder.encode(ivText);
    if (provided.length !== 16) {
      throw new Error(`IV 为 ${provided.length} 字节，CBC 模式需要正好 16 字节（按 UTF-8 计算）`);
    }
    ivBytes = provided;
  } else {
    ivBytes = crypto.getRandomValues(new Uint8Array(ivLen));
  }

  const algorithm =
    mode === "GCM" ? { name: "AES-GCM", iv: ivBytes } : { name: "AES-CBC", iv: ivBytes };
  const cipherBuffer = await crypto.subtle.encrypt(
    algorithm,
    key,
    textEncoder.encode(text ?? "")
  );
  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(ivBytes.length + cipherBytes.length);
  combined.set(ivBytes);
  combined.set(cipherBytes, ivBytes.length);
  return { combined, ivBytes, cipherBytes };
}

// 解密：入参为 IV 前缀拼接的完整密文字节，返回明文字符串
export async function decryptAes({ data, keyText, bits = 256, mode = "GCM" }) {
  assertSubtle();
  if (!AES_MODES.includes(mode)) throw new Error(`不支持的加密模式：${mode}`);
  const keyBytes = parseKeyBytes(keyText, bits);
  const key = await importKey(keyBytes, mode);

  const ivLen = ivLengthForMode(mode);
  if (!(data instanceof Uint8Array) || data.length <= ivLen) {
    throw new Error(
      `密文长度不足：至少需要 ${ivLen} 字节 IV 加上密文内容，请确认密文完整且模式选择正确`
    );
  }
  const cipherBytes = data.subarray(ivLen);
  if (mode === "CBC" && cipherBytes.length % 16 !== 0) {
    throw new Error(
      `CBC 密文字节数 ${cipherBytes.length} 不是 16 的倍数，密文不完整或模式/编码选择错误`
    );
  }
  if (mode === "GCM" && cipherBytes.length < 16) {
    throw new Error("GCM 密文长度不足（至少要有 16 字节认证标签），密文不完整");
  }

  const algorithm =
    mode === "GCM"
      ? { name: "AES-GCM", iv: data.slice(0, ivLen) }
      : { name: "AES-CBC", iv: data.slice(0, ivLen) };
  let plainBuffer;
  try {
    plainBuffer = await crypto.subtle.decrypt(algorithm, key, cipherBytes);
  } catch {
    throw new Error(
      mode === "GCM"
        ? "解密失败：密钥不正确、密文不完整或内容已被篡改（GCM 认证校验未通过）"
        : "解密失败：密钥不正确或密文不完整（CBC 填充校验未通过）"
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(plainBuffer);
  } catch {
    throw new Error(
      "解密结果不是有效的 UTF-8 文本：多半是密钥不正确，或该密文加密的不是文本内容"
    );
  }
}
