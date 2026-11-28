// UUID 生成核心：纯本地生成 v4（随机）/ v7（Unix 毫秒时间有序），遵循 RFC 9562。
// 随机源与时间可注入，便于独立测试；浏览器默认用 crypto.getRandomValues。
import { parseUuid } from './uuidParse.js';

export const MAX_COUNT = 500;

function defaultRandomBytes(n) {
  const out = new Uint8Array(n);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) throw new Error('当前环境不支持 crypto.getRandomValues，无法生成安全随机 UUID');
  // getRandomValues 单次上限 65536 字节，分块填充
  for (let off = 0; off < n; off += 65536) {
    cryptoObj.getRandomValues(out.subarray(off, Math.min(n, off + 65536)));
  }
  return out;
}

function bytesToCanonical(bytes) {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function takeBytes(randomBytes, n) {
  const bytes = randomBytes(n);
  if (!bytes || bytes.length !== n) throw new Error(`随机源应返回 ${n} 个字节`);
  return Uint8Array.from(bytes, (b) => Number(b) & 0xff);
}

// v4：122 位随机，版本位 4、变体位 10
function generateUuidV4({ randomBytes = defaultRandomBytes } = {}) {
  const bytes = takeBytes(randomBytes, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToCanonical(bytes);
}

// v7 字节布局：48 位 Unix 毫秒 | ver 4 位 + rand_a 12 位 | var 2 位 + rand_b 62 位
function v7Bytes(nowMs, randomBytes) {
  if (!Number.isFinite(nowMs) || nowMs < 0 || nowMs > 0xffffffffffff) {
    throw new Error('v7 时间戳超出 48 位毫秒范围');
  }
  const bytes = takeBytes(randomBytes, 16);
  const ms = Math.floor(nowMs);
  bytes[0] = (ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms / 2 ** 24) & 0xff;
  bytes[3] = (ms / 2 ** 16) & 0xff;
  bytes[4] = (ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}


// 把 rand_a + rand_b 视为 74 位计数器 +1（保持版本/变体位不变），用于同毫秒单调递增
function incrementV7Counter(bytes) {
  // 先递增 byte9..15（rand_b 低 56 位，全字节可用）
  let carry = 1;
  for (let i = 15; i >= 9 && carry; i--) {
    const v = bytes[i] + 1;
    bytes[i] = v & 0xff;
    carry = v > 0xff ? 1 : 0;
  }
  if (carry) {
    // 再递增 byte8 低 6 位（高 2 位是变体位，不动）
    const low = (bytes[8] & 0x3f) + 1;
    if (low <= 0x3f) {
      bytes[8] = (bytes[8] & 0xc0) | low;
      return bytes;
    }
    bytes[8] &= 0xc0;
    // 再递增 byte7（rand_a 低 8 位）
    if (bytes[7] < 0xff) { bytes[7] += 1; return bytes; }
    bytes[7] = 0;
    // 最后递增 byte6 低 4 位（rand_a 高 4 位，高 4 位是版本位）
    const a = (bytes[6] & 0x0f) + 1;
    if (a > 0x0f) throw new Error('v7 同毫秒计数器溢出');
    bytes[6] = (bytes[6] & 0xf0) | a;
  }
  return bytes;
}

function validateCount(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, error: '请输入生成数量' };
  if (!/^[+-]?\d+$/.test(text)) {
    if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(text)) return { ok: false, error: `生成数量必须为整数，「${text}」含小数` };
    return { ok: false, error: `生成数量「${text}」不是有效整数` };
  }
  const value = Number(text);
  if (value < 1) return { ok: false, error: `生成数量至少为 1，当前为 ${value}` };
  if (value > MAX_COUNT) return { ok: false, error: `一次最多生成 ${MAX_COUNT} 个，当前为 ${value}，请分批生成` };
  return { ok: true, value };
}

function formatUuid(canonical, { uppercase = false, hyphens = true, braces = false, urn = false } = {}) {
  const parsed = parseUuid(canonical);
  if (!parsed.ok) throw new Error(`无法格式化非法 UUID：${parsed.error}`);
  if (urn) return `urn:uuid:${parsed.canonical}`; // URN 规范形式固定小写带连字符，花括号/大写选项不适用
  let result = hyphens ? parsed.canonical : parsed.hex;
  if (uppercase) result = result.toUpperCase();
  if (braces) result = `{${result}}`;
  return result;
}

export function generateBatch({ count, version = 'v4', format = {}, randomBytes = defaultRandomBytes, now } = {}) {
  const checked = validateCount(count);
  if (!checked.ok) return { ok: false, error: checked.error };
  if (version !== 'v4' && version !== 'v7') return { ok: false, error: `不支持的 UUID 版本「${version}」，仅支持 v4 / v7` };
  const seen = new Set();
  const list = [];
  let lastV7Bytes = null;
  let lastMs = null;
  let attempts = 0;
  while (list.length < checked.value) {
    if (++attempts > checked.value * 10 + 100) return { ok: false, error: '多次生成均出现重复，已停止，请重试' };
    let canonical;
    if (version === 'v4') {
      canonical = generateUuidV4({ randomBytes });
    } else {
      const ms = Math.floor(now !== undefined ? (typeof now === 'function' ? now() : now) : Date.now());
      if (lastV7Bytes && lastMs === ms) {
        // 同一毫秒内递增计数器，保证批量 v7 严格递增、可按生成顺序排序
        canonical = bytesToCanonical(incrementV7Counter(Uint8Array.from(lastV7Bytes)));
        lastV7Bytes = v7BytesFromCanonical(canonical);
      } else {
        const bytes = v7Bytes(ms, randomBytes);
        canonical = bytesToCanonical(bytes);
        lastV7Bytes = bytes;
        lastMs = ms;
      }
    }
    const check = parseUuid(canonical);
    if (!check.ok || check.version !== (version === 'v4' ? 4 : 7)) return { ok: false, error: '生成结果自检未通过，已停止' };
    if (seen.has(canonical)) continue; // 碰撞时丢弃重抽（v7 同毫秒走计数器，理论上不会走到）
    seen.add(canonical);
    list.push(formatUuid(canonical, format));
  }
  return { ok: true, list, count: list.length, unique: seen.size, version };
}

function v7BytesFromCanonical(canonical) {
  const hex = canonical.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
