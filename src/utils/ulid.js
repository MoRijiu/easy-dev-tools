// ULID 生成与解析：纯本地实现（ULID 规范，Crockford Base32）。
// 结构：26 个字符 = 前 10 个编码 48 位毫秒时间戳 + 后 16 个编码 80 位随机数；
// 字典序与时间序一致，可直接按字符串排序。随机源为 Web Crypto。
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ULID_LENGTH = 26;
export const TIME_CHARS = 10;
export const RANDOM_CHARS = 16;
export const MAX_TIMESTAMP = 281474976710655; // 2^48 - 1
export const MAX_COUNT = 1000;

const DECODE_MAP = new Map([...CROCKFORD].map((ch, i) => [ch, i]));

function defaultRandomBytes(n) {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('当前环境缺少安全随机源（Web Crypto），无法生成 ULID');
  }
  const buf = new Uint8Array(n);
  c.getRandomValues(buf);
  return buf;
}

export function encodeTime(timestampMs) {
  if (typeof timestampMs !== 'number' || !Number.isInteger(timestampMs)) {
    throw new Error(`时间戳必须是整数毫秒，收到「${timestampMs}」`);
  }
  if (timestampMs < 0 || timestampMs > MAX_TIMESTAMP) {
    throw new Error(`时间戳须在 0–${MAX_TIMESTAMP}（48 位）之间，收到 ${timestampMs}`);
  }
  let value = timestampMs;
  let out = '';
  for (let i = 0; i < TIME_CHARS; i++) {
    out = CROCKFORD[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

// 10 个随机字节（80 位）恰好编成 16 个 Base32 字符。
export function encodeRandom(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 10) {
    throw new Error('随机部分需要恰好 10 个字节');
  }
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 0; i < RANDOM_CHARS; i++) {
    out = CROCKFORD[Number(bits & 31n)] + out;
    bits >>= 5n;
  }
  return out;
}

export function generateUlid(timestampMs = Date.now(), randomBytes = defaultRandomBytes) {
  return encodeTime(timestampMs) + encodeRandom(randomBytes(10));
}

// 批量生成：monotonic=true 时同一毫秒内随机部分按 80 位整数逐个 +1，保证不重复且严格递增（与官方 monotonicFactory 语义一致）。
export function generateUlidBatch({ count = 10, timestampMs = null, monotonic = true } = {}, randomBytes = defaultRandomBytes) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT) {
    throw new Error(`生成数量须在 1–${MAX_COUNT} 之间`);
  }
  const baseTime = timestampMs === null || timestampMs === undefined || timestampMs === '' ? Date.now() : Number(timestampMs);
  const timePart = encodeTime(baseTime);
  const seed = randomBytes(10);
  let rand = 0n;
  for (const b of seed) rand = (rand << 8n) | BigInt(b);
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = rand;
    let segment = '';
    for (let j = 0; j < RANDOM_CHARS; j++) {
      segment = CROCKFORD[Number(r & 31n)] + segment;
      r >>= 5n;
    }
    out.push(timePart + segment);
    if (monotonic) {
      rand += 1n;
      if (rand >= (1n << 80n)) throw new Error('同一毫秒内随机部分已溢出，请换一个时间戳重试');
    } else if (i < n - 1) {
      rand = 0n;
      for (const b of randomBytes(10)) rand = (rand << 8n) | BigInt(b);
    }
  }
  return out;
}

export function normalizeUlid(input) {
  const raw = String(input ?? '').trim();
  if (raw === '') throw new Error('请输入 ULID');
  const upper = raw.toUpperCase();
  if (upper.length !== ULID_LENGTH) {
    throw new Error(`ULID 须为 ${ULID_LENGTH} 个字符，收到 ${upper.length} 个`);
  }
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    if (!DECODE_MAP.has(ch)) {
      const hint = 'ILOU'.includes(ch) ? '（Crockford Base32 不含 I/L/O/U，易与 1/0 混淆）' : '';
      throw new Error(`第 ${i + 1} 个字符「${raw[i]}」不在 Crockford Base32 字母表中${hint}`);
    }
  }
  if (DECODE_MAP.get(upper[0]) > 7) {
    throw new Error('首字符超过 7：48 位时间戳溢出，不是合法 ULID');
  }
  return upper;
}

export function isValidUlid(input) {
  try {
    normalizeUlid(input);
    return true;
  } catch {
    return false;
  }
}

export function decodeTime(segment) {
  let value = 0;
  for (const ch of segment) value = value * 32 + DECODE_MAP.get(ch);
  return value;
}

export function parseUlid(input) {
  const ulid = normalizeUlid(input);
  const timeSegment = ulid.slice(0, TIME_CHARS);
  const randomSegment = ulid.slice(TIME_CHARS);
  const timestampMs = decodeTime(timeSegment);
  let rand = 0n;
  for (const ch of randomSegment) rand = (rand << 5n) | BigInt(DECODE_MAP.get(ch));
  const randomnessHex = rand.toString(16).padStart(20, '0');
  const date = new Date(timestampMs);
  return {
    ulid,
    timeSegment,
    randomSegment,
    timestampMs,
    iso: date.toISOString(),
    randomnessHex,
    entropyBits: 80
  };
}

export function buildSummary(parsed) {
  return [
    `ULID：${parsed.ulid}`,
    `内嵌时间：${parsed.iso}（${parsed.timestampMs} ms）`,
    `时间段：${parsed.timeSegment}`,
    `随机段：${parsed.randomSegment}（80 位，十六进制 ${parsed.randomnessHex}）`
  ].join('\n');
}
