// JWT 解码核心逻辑：纯本地字符串解析，不上传任何数据。
// 严格校验：段数、Base64URL 字符与长度、UTF-8 合法性、JSON 对象形态，错误定位到段与字符位置。
// 粘贴容错：自动去掉 Bearer 前缀与内部空白（复制时常带换行），并在结果里标记已做的清理。

const B64URL_RE = /^[A-Za-z0-9_-]*$/;

export function normalizeToken(raw) {
  let token = String(raw ?? '');
  const notes = [];
  const trimmed = token.trim();
  if (trimmed !== token) notes.push('已去除首尾空白');
  token = trimmed;
  const bearer = /^bearer\s+/i.exec(token);
  if (bearer) {
    token = token.slice(bearer[0].length);
    notes.push('已去除 Bearer 前缀');
  }
  if (/\s/.test(token)) {
    token = token.replace(/\s+/g, '');
    notes.push('已去除内部空白/换行');
  }
  return { token, notes };
}

export function decodeSegment(segment, name) {
  if (!segment) throw new Error(`${name} 段为空`);
  const badIndex = segment.search(/[^A-Za-z0-9_-]/);
  if (badIndex !== -1) {
    throw new Error(`${name} 段第 ${badIndex + 1} 个字符「${segment[badIndex]}」不是合法的 Base64URL 字符`);
  }
  if (!B64URL_RE.test(segment)) throw new Error(`${name} 段包含非法字符`);
  if (segment.length % 4 === 1) {
    throw new Error(`${name} 段长度 ${segment.length} 不合法（Base64URL 长度除以 4 的余数不能为 1）`);
  }
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new Error(`${name} 段 Base64URL 解码失败`);
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${name} 段解出的字节不是合法的 UTF-8 文本`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new Error(`${name} 段不是合法的 JSON：${e.message}`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    const kind = Array.isArray(value) ? '数组' : value === null ? 'null' : typeof value;
    throw new Error(`${name} 段应为 JSON 对象，实际是${kind}`);
  }
  return value;
}

export function validateSignatureSegment(segment) {
  if (!segment) return;
  const badIndex = segment.search(/[^A-Za-z0-9_-]/);
  if (badIndex !== -1) {
    throw new Error(`Signature 段第 ${badIndex + 1} 个字符「${segment[badIndex]}」不是合法的 Base64URL 字符`);
  }
  if (segment.length % 4 === 1) {
    throw new Error(`Signature 段长度 ${segment.length} 不合法（Base64URL 长度除以 4 的余数不能为 1）`);
  }
}

export function parseJwt(raw) {
  const { token, notes } = normalizeToken(raw);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error(`JWT 应由 3 段以点号分隔，当前检测到 ${parts.length} 段`);
  }
  const header = decodeSegment(parts[0], 'Header');
  const payload = decodeSegment(parts[1], 'Payload');
  validateSignatureSegment(parts[2]);
  return { header, payload, signature: parts[2], notes };
}

// 时间类声明状态：exp 过期 / nbf 未生效 / 非数字时间戳点名提醒
export function analyzeTimeClaims(payload, nowSec = Math.floor(Date.now() / 1000)) {
  const result = { expState: 'none', nbfState: 'none', warnings: [] };
  const check = (key) => {
    const v = payload?.[key];
    if (v === undefined) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      result.warnings.push(`${key} 不是数字时间戳（实际为 ${JSON.stringify(v)}），无法判断时间状态`);
      return null;
    }
    return v;
  };
  const exp = check('exp');
  if (exp !== null) result.expState = nowSec > exp ? 'expired' : 'valid';
  else if (payload?.exp !== undefined) result.expState = 'invalid';
  const nbf = check('nbf');
  if (nbf !== null) result.nbfState = nowSec < nbf ? 'pending' : 'active';
  else if (payload?.nbf !== undefined) result.nbfState = 'invalid';
  check('iat');
  return result;
}

export function buildWarnings(header, payload, signature, timeInfo) {
  const warnings = [...(timeInfo?.warnings ?? [])];
  const alg = header?.alg;
  if (alg === undefined) warnings.push('Header 缺少 alg 字段');
  if (typeof alg === 'string' && alg.toLowerCase() === 'none') {
    warnings.push('alg 为 none：该 Token 没有签名保护，任何人都可伪造，请勿信任其内容');
  }
  if (alg !== undefined && typeof alg === 'string' && alg.toLowerCase() !== 'none' && !signature) {
    warnings.push(`alg 为 ${alg} 但 Signature 段为空，该 Token 未附带签名`);
  }
  return warnings;
}

export function formatClaimValue(value) {
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
