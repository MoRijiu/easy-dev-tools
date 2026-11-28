// JWT 生成（HMAC 签名）核心逻辑：纯本地，签名走 Web Crypto，不上传任何数据。
import { parseJsonDetailed } from './jsonFormat.js';

export const JWT_ALGS = [
  { id: 'HS256', hash: 'SHA-256', label: 'HS256（HMAC + SHA-256）' },
  { id: 'HS384', hash: 'SHA-384', label: 'HS384（HMAC + SHA-384）' },
  { id: 'HS512', hash: 'SHA-512', label: 'HS512（HMAC + SHA-512）' }
];

// RFC 7518 §3.2：HMAC 密钥长度应至少等于哈希输出长度
const RECOMMENDED_KEY_BYTES = { HS256: 32, HS384: 48, HS512: 64 };
const MAX_JSON_TEXT_LENGTH = 100000;
const MAX_SECRET_LENGTH = 4096;
const MAX_TOKEN_LENGTH = 100000;

const encoder = new TextEncoder();

function base64UrlEncodeBytes(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeText(text) {
  return base64UrlEncodeBytes(encoder.encode(String(text)));
}

function base64UrlDecodeToBytes(segment) {
  const b64 = String(segment).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 严格解码一段 Base64URL：非法字符定位到第几个、长度 %4==1 直接点名，不让 atob 的英文报错漏出去
function decodeBase64UrlStrict(segment, label = '签名') {
  const seg = String(segment ?? '');
  for (let i = 0; i < seg.length; i += 1) {
    if (!/[A-Za-z0-9_-]/.test(seg[i])) {
      return { ok: false, error: `${label}段第 ${i + 1} 个字符「${seg[i]}」不是合法的 Base64URL 字符` };
    }
  }
  if (seg.length % 4 === 1) {
    return { ok: false, error: `${label}段长度不合法：Base64URL 长度除以 4 不能余 1，多半是复制时多了或少了字符` };
  }
  try {
    return { ok: true, bytes: base64UrlDecodeToBytes(seg) };
  } catch {
    return { ok: false, error: `${label}段无法按 Base64URL 解码` };
  }
}

// 解析 Header / Payload 输入：必须是 JSON 对象；语法错误带行列定位与原因提示（复用 parseJsonDetailed）
export function parseJsonObjectInput(text, label) {
  const raw = String(text ?? '');
  if (raw.length > MAX_JSON_TEXT_LENGTH) {
    return { ok: false, error: `${label} 超过 ${MAX_JSON_TEXT_LENGTH} 字符上限（当前 ${raw.length} 字符）` };
  }
  if (!raw.trim()) return { ok: false, error: `${label} 不能为空` };
  const parsed = parseJsonDetailed(raw);
  if (!parsed.ok) {
    const e = parsed.error;
    const where = e.line ? `第 ${e.line} 行第 ${e.column} 列` : '未知位置';
    const hint = e.hints && e.hints.length ? `；${e.hints[0]}` : '';
    return { ok: false, error: `${label} 不是合法 JSON（${where}）：${e.message}${hint}` };
  }
  const value = parsed.value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: `${label} 必须是 JSON 对象（{ ... }）` };
  }
  return { ok: true, value };
}

// 在已通过 JSON.parse 的原文里找重复键：JSON.parse 只保留最后一个值，
// 但不少 JWT 解析器取第一个，重复键会让同一 Token 在不同系统里解出不同内容，必须点名。
export function findDuplicateKey(text) {
  const src = String(text ?? '');
  let i = 0;
  const n = src.length;
  const skipWs = () => { while (i < n && ' \t\r\n'.includes(src[i])) i += 1; };
  const readString = () => {
    const start = i;
    i += 1; // 开引号
    while (i < n) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '"') { i += 1; break; }
      i += 1;
    }
    try { return JSON.parse(src.slice(start, i)); } catch { return src.slice(start, i); }
  };
  const scanValue = (path) => {
    skipWs();
    if (src[i] === '{') {
      i += 1;
      const seen = new Set();
      skipWs();
      if (src[i] === '}') { i += 1; return null; }
      for (;;) {
        skipWs();
        const key = readString();
        if (seen.has(key)) return { key, path: [...path, key].join('.') };
        seen.add(key);
        skipWs();
        i += 1; // 冒号
        const dup = scanValue([...path, key]);
        if (dup) return dup;
        skipWs();
        if (src[i] === ',') { i += 1; continue; }
        if (src[i] === '}') { i += 1; return null; }
        return null;
      }
    }
    if (src[i] === '[') {
      i += 1;
      skipWs();
      if (src[i] === ']') { i += 1; return null; }
      let idx = 0;
      for (;;) {
        const dup = scanValue([...path, `[${idx}]`]);
        if (dup) return dup;
        idx += 1;
        skipWs();
        if (src[i] === ',') { i += 1; continue; }
        if (src[i] === ']') { i += 1; return null; }
        return null;
      }
    }
    if (src[i] === '"') { readString(); return null; }
    while (i < n && !',}] \t\r\n'.includes(src[i])) i += 1;
    return null;
  };
  return scanValue([]);
}

function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (!(d >= 0xdc00 && d <= 0xdfff)) return true;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}

// 找第一个含未配对代理字符的字符串（含键名），返回所在路径；这类字符写进 Token 后
// 严格解码器会把它替换成 U+FFFD 或直接报错，签出来的 Token 与原文对不上。
function findLoneSurrogatePath(value, path = [], depth = 0) {
  if (depth > 100) return null;
  if (typeof value === 'string') return hasLoneSurrogate(value) ? path : null;
  if (Array.isArray(value)) {
    for (let idx = 0; idx < value.length; idx += 1) {
      const hit = findLoneSurrogatePath(value[idx], [...path, `[${idx}]`], depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (hasLoneSurrogate(k)) return [...path, k];
      const hit = findLoneSurrogatePath(v, [...path, k], depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function formatClaimTime(sec) {
  const ms = sec * 1000;
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return `${sec}`;
  return new Date(ms).toISOString();
}

function describeValue(v) {
  if (typeof v === 'string') return `字符串「${v}」`;
  if (v === null) return 'null';
  if (Array.isArray(v)) return '数组';
  return `${typeof v} ${String(v)}`;
}

// 校验 exp / nbf / iat：非数字直接报错（旧版照单全收、验签方会忽略或判无效），
// 已过期 / 尚未生效只警告不拦——调试时签过期 Token 是合理需求，但不能静默。
function checkTimeClaims(payload, nowSec) {
  const warnings = [];
  const now = Number.isFinite(nowSec) ? Math.floor(nowSec) : Math.floor(Date.now() / 1000);
  for (const claim of ['exp', 'nbf', 'iat']) {
    if (!(claim in payload)) continue;
    const v = payload[claim];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { ok: false, error: `Payload 的 ${claim} 必须是秒级数字时间戳，当前是${describeValue(v)}，请改成数字（点「快捷有效期」可自动写入）` };
    }
  }
  if (typeof payload.exp === 'number' && payload.exp <= now) {
    warnings.push(`exp 是 ${formatClaimTime(payload.exp)}，已经过期：这个 Token 生成出来就不能用了（调试过期场景可忽略）`);
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now) {
    warnings.push(`nbf 是 ${formatClaimTime(payload.nbf)}，尚未生效：要等到该时间之后验签才会通过`);
  }
  if (typeof payload.iat === 'number' && payload.iat > now + 300) {
    warnings.push(`iat 是 ${formatClaimTime(payload.iat)}，比当前时间还晚 5 分钟以上：签发时间在未来，部分验签方会拒绝`);
  }
  return { ok: true, warnings };
}

// 给 Payload 补 iat / exp / nbf（秒级时间戳），返回新对象不改原对象；
// ttl / nbf 偏移必须是有限数字，NaN 会被 JSON.stringify 写成 null（旧版静默坏结果），直接抛错点名。
export function applyTimeClaims(payload, { nowSec, ttlSec = null, nbfOffsetSec = null } = {}) {
  const out = { ...payload };
  const now = Number.isFinite(nowSec) ? Math.floor(nowSec) : Math.floor(Date.now() / 1000);
  const MAX_OFFSET = 100 * 365 * 86400; // 100 年（秒）
  const checkOffset = (v, label) => {
    if (!Number.isFinite(v)) throw new Error(`${label}必须是有限数字（秒），当前是 ${String(v)}`);
    if (Math.abs(v) > MAX_OFFSET) throw new Error(`${label}超出 ±100 年范围：${v} 秒`);
    return Math.floor(v);
  };
  out.iat = now;
  if (ttlSec !== null && ttlSec !== undefined) out.exp = now + checkOffset(ttlSec, '有效期');
  if (nbfOffsetSec !== null && nbfOffsetSec !== undefined) out.nbf = now + checkOffset(nbfOffsetSec, '生效延迟');
  return out;
}

async function importHmacKey(secret, alg) {
  const spec = JWT_ALGS.find((a) => a.id === alg);
  if (!spec) throw new Error(`不支持的签名算法：${alg}（本工具仅支持 HMAC 的 HS256/HS384/HS512）`);
  return crypto.subtle.importKey('raw', encoder.encode(String(secret)), { name: 'HMAC', hash: spec.hash }, false, ['sign', 'verify']);
}

// 签名生成完整 Token；成功返回 { ok, token, header, payload, warnings, secretBytes }
export async function signJwt({ headerText, payloadText, secret, alg = 'HS256', nowSec } = {}) {
  const spec = JWT_ALGS.find((a) => a.id === alg);
  if (!spec) return { ok: false, error: `不支持的签名算法：${alg}（本工具仅支持 HMAC 的 HS256/HS384/HS512）` };
  if (secret === undefined || secret === null || String(secret) === '') {
    return { ok: false, error: '签名密钥不能为空' };
  }
  if (String(secret).length > MAX_SECRET_LENGTH) {
    return { ok: false, error: `签名密钥超过 ${MAX_SECRET_LENGTH} 字符上限（当前 ${String(secret).length} 字符）` };
  }
  const h = parseJsonObjectInput(headerText, 'Header');
  if (!h.ok) return h;
  const p = parseJsonObjectInput(payloadText, 'Payload');
  if (!p.ok) return p;
  for (const [label, raw, value] of [['Header', headerText, h.value], ['Payload', payloadText, p.value]]) {
    const dup = findDuplicateKey(raw);
    if (dup) {
      return { ok: false, error: `${label} 有重复键「${dup.key}」（位于 ${dup.path}）：JSON.parse 只保留最后一个值，但不少 JWT 解析器取第一个，同一 Token 会解出不同内容，请只保留一个` };
    }
    const lone = findLoneSurrogatePath(value, [label]);
    if (lone) {
      return { ok: false, error: `${lone.join('.')} 包含未配对的代理字符（如 \\ud800 这类写一半的 \\u 转义）：写进 Token 后严格解码器会替换成 � 或报错，请改成完整字符或合法转义` };
    }
  }
  if (h.value.alg !== undefined && h.value.alg !== alg) {
    return { ok: false, error: `Header 里的 alg 是 ${h.value.alg}，与所选算法 ${alg} 不一致，请改 Header 或切换算法` };
  }
  if (h.value.typ !== undefined && typeof h.value.typ !== 'string') {
    return { ok: false, error: `Header 的 typ 必须是字符串（如 "JWT"），当前是${describeValue(h.value.typ)}` };
  }
  const timeCheck = checkTimeClaims(p.value, nowSec);
  if (!timeCheck.ok) return timeCheck;
  const warnings = [...timeCheck.warnings];
  const secretBytes = encoder.encode(String(secret)).length;
  const recommended = RECOMMENDED_KEY_BYTES[alg];
  if (secretBytes < recommended) {
    warnings.push(`密钥只有 ${secretBytes} 字节，低于 ${alg} 建议的至少 ${recommended} 字节（RFC 7518），太短的密钥容易被离线爆破，生产环境请换随机长密钥`);
  }
  const header = { ...h.value, alg };
  if (header.typ === undefined) header.typ = 'JWT';
  const signingInput = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(JSON.stringify(p.value))}`;
  try {
    const key = await importHmacKey(secret, alg);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
    const signature = base64UrlEncodeBytes(new Uint8Array(sig));
    return { ok: true, token: `${signingInput}.${signature}`, header, payload: p.value, signingInput, signature, warnings, secretBytes };
  } catch (e) {
    return { ok: false, error: `签名失败：${e.message}` };
  }
}

// 用同一密钥回验一个 Token 的签名（生成后自检 / 校验已有 Token）；各段先做严格 Base64URL 校验再解码
export async function verifyJwtSignature(token, secret) {
  const raw = String(token ?? '').trim();
  if (raw.length > MAX_TOKEN_LENGTH) return { ok: false, error: `Token 超过 ${MAX_TOKEN_LENGTH} 字符上限（当前 ${raw.length} 字符）` };
  if (secret === undefined || secret === null || String(secret) === '') {
    return { ok: false, error: '签名密钥不能为空' };
  }
  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Token 必须是 Header.Payload.Signature 三段' };
  const labels = ['Header', 'Payload', '签名'];
  const decoded = [];
  for (let s = 0; s < 3; s += 1) {
    const d = decodeBase64UrlStrict(parts[s], labels[s]);
    if (!d.ok) return d;
    decoded.push(d.bytes);
  }
  let header;
  try {
    header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded[0]));
  } catch {
    return { ok: false, error: 'Header 段解码后不是合法的 UTF-8 JSON' };
  }
  if (header === null || typeof header !== 'object' || Array.isArray(header)) {
    return { ok: false, error: 'Header 段必须是 JSON 对象' };
  }
  if (header.alg === undefined) return { ok: false, error: 'Header 里缺少 alg，无法确定验签算法' };
  const spec = JWT_ALGS.find((a) => a.id === header.alg);
  if (!spec) return { ok: false, error: `alg=${header.alg} 不是 HMAC 算法，本工具无法校验` };
  try {
    const key = await importHmacKey(secret, header.alg);
    const valid = await crypto.subtle.verify('HMAC', key, decoded[2], encoder.encode(`${parts[0]}.${parts[1]}`));
    return { ok: true, valid, alg: header.alg };
  } catch (e) {
    return { ok: false, error: `校验失败：${e.message}` };
  }
}
