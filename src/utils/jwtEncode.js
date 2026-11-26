// JWT 生成（HMAC 签名）核心逻辑：纯本地，签名走 Web Crypto，不上传任何数据。
export const JWT_ALGS = [
  { id: 'HS256', hash: 'SHA-256', label: 'HS256（HMAC + SHA-256）' },
  { id: 'HS384', hash: 'SHA-384', label: 'HS384（HMAC + SHA-384）' },
  { id: 'HS512', hash: 'SHA-512', label: 'HS512（HMAC + SHA-512）' }
];

const encoder = new TextEncoder();

export function base64UrlEncodeBytes(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlEncodeText(text) {
  return base64UrlEncodeBytes(encoder.encode(String(text)));
}

export function base64UrlDecodeToBytes(segment) {
  const b64 = String(segment).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 解析 Header / Payload 输入：必须是 JSON 对象
export function parseJsonObjectInput(text, label) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, error: `${label} 不能为空` };
  let value;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `${label} 不是合法 JSON：${e.message}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: `${label} 必须是 JSON 对象（{ ... }）` };
  }
  return { ok: true, value };
}

// 给 Payload 补 iat / exp / nbf（秒级时间戳），返回新对象不改原对象
export function applyTimeClaims(payload, { nowSec, ttlSec = null, nbfOffsetSec = null } = {}) {
  const out = { ...payload };
  const now = Number.isFinite(nowSec) ? Math.floor(nowSec) : Math.floor(Date.now() / 1000);
  out.iat = now;
  if (ttlSec !== null && ttlSec !== undefined) out.exp = now + Math.floor(ttlSec);
  if (nbfOffsetSec !== null && nbfOffsetSec !== undefined) out.nbf = now + Math.floor(nbfOffsetSec);
  return out;
}

async function importHmacKey(secret, alg) {
  const spec = JWT_ALGS.find((a) => a.id === alg);
  if (!spec) throw new Error(`不支持的签名算法：${alg}（本工具仅支持 HMAC 的 HS256/HS384/HS512）`);
  return crypto.subtle.importKey('raw', encoder.encode(String(secret)), { name: 'HMAC', hash: spec.hash }, false, ['sign', 'verify']);
}

// 签名生成完整 Token
export async function signJwt({ headerText, payloadText, secret, alg = 'HS256' }) {
  const spec = JWT_ALGS.find((a) => a.id === alg);
  if (!spec) return { ok: false, error: `不支持的签名算法：${alg}（本工具仅支持 HMAC 的 HS256/HS384/HS512）` };
  const h = parseJsonObjectInput(headerText, 'Header');
  if (!h.ok) return h;
  const p = parseJsonObjectInput(payloadText, 'Payload');
  if (!p.ok) return p;
  if (h.value.alg !== undefined && h.value.alg !== alg) {
    return { ok: false, error: `Header 里的 alg 是 ${h.value.alg}，与所选算法 ${alg} 不一致，请改 Header 或切换算法` };
  }
  if (secret === undefined || secret === null || String(secret) === '') {
    return { ok: false, error: '签名密钥不能为空' };
  }
  const header = { ...h.value, alg };
  if (header.typ === undefined) header.typ = 'JWT';
  const signingInput = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(JSON.stringify(p.value))}`;
  try {
    const key = await importHmacKey(secret, alg);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
    const signature = base64UrlEncodeBytes(new Uint8Array(sig));
    return { ok: true, token: `${signingInput}.${signature}`, header, payload: p.value, signingInput, signature };
  } catch (e) {
    return { ok: false, error: `签名失败：${e.message}` };
  }
}

// 用同一密钥回验一个 Token 的签名（生成后自检 / 校验已有 Token）
export async function verifyJwtSignature(token, secret) {
  const parts = String(token ?? '').trim().split('.');
  if (parts.length !== 3) return { ok: false, error: 'Token 必须是 Header.Payload.Signature 三段' };
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(parts[0])));
  } catch {
    return { ok: false, error: 'Header 段无法解码' };
  }
  const spec = JWT_ALGS.find((a) => a.id === header.alg);
  if (!spec) return { ok: false, error: `alg=${header.alg} 不是 HMAC 算法，本工具无法校验` };
  try {
    const key = await importHmacKey(secret, header.alg);
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecodeToBytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
    return { ok: true, valid, alg: header.alg };
  } catch (e) {
    return { ok: false, error: `校验失败：${e.message}` };
  }
}
