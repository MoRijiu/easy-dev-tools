// ULID 生成与解析：纯本地实现（ULID 规范，Crockford Base32）。
// 结构：26 个字符 = 前 10 个编码 48 位毫秒时间戳 + 后 16 个编码 80 位随机数；
// 字典序与时间序一致，可直接按字符串排序。随机源为 Web Crypto。
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ULID_LENGTH = 26;
export const TIME_CHARS = 10;
export const RANDOM_CHARS = 16;
export const MAX_TIMESTAMP = 281474976710655; // 2^48 - 1
export const MAX_COUNT = 1000;
export const MAX_INPUT_LENGTH = 4096;

const DECODE_MAP = new Map([...CROCKFORD].map((ch, i) => [ch, i]));
// Crockford Base32 解码容错（规范 Decoding 节）：I/L 读作 1、O 读作 0。
const ALIAS_MAP = new Map([['I', '1'], ['L', '1'], ['O', '0']]);

export function normalizeFullwidthText(text) {
  let count = 0;
  const out = String(text ?? '').replace(/[\uFF01-\uFF5E\u3000]/g, (ch) => {
    count++;
    return ch === '\u3000' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  return { text: out, count };
}

// 严格整数解析（数量/时间戳共用）：全角转半角；小数/科学计数法/千分位/下划线分别点名，不再 Number() 静默强转。
export function parseStrictIntInput(value, label, { min, max }) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`${label}必须是整数，收到「${value}」`);
    if (value < min || value > max) throw new Error(`${label}须在 ${min}–${max} 之间，收到 ${value}`);
    return { value, notes: [] };
  }
  const raw = String(value ?? '');
  if ([...raw].length > 64) throw new Error(`${label}输入过长（上限 64 个字符）`);
  const { text: fw, count } = normalizeFullwidthText(raw);
  const notes = count ? [`已将 ${count} 个全角字符转为半角`] : [];
  const s = fw.trim();
  if (s === '') throw new Error(`${label}不能为空`);
  if (/^-/.test(s)) throw new Error(`${label}不能为负数，收到「${s}」`);
  if (/^\+/.test(s)) throw new Error(`${label}不要带 + 号，收到「${s}」`);
  if (/[eE]/.test(s)) throw new Error(`${label}不支持科学计数法，收到「${s}」，请写完整数字`);
  if (s.includes(',')) throw new Error(`${label}不支持千分位分隔符，收到「${s}」，请去掉逗号`);
  if (s.includes('_')) throw new Error(`${label}不支持下划线分隔符，收到「${s}」，请去掉下划线`);
  if (s.includes('.')) throw new Error(`${label}必须是整数，不能带小数点，收到「${s}」`);
  if (!/^\d+$/.test(s)) {
    const bad = [...s].find((ch) => !/\d/.test(ch));
    throw new Error(`${label}只能包含数字，收到「${s}」，其中「${bad}」不是数字`);
  }
  const big = BigInt(s);
  if (big < BigInt(min) || big > BigInt(max)) throw new Error(`${label}须在 ${min}–${max} 之间，收到 ${s}`);
  return { value: Number(big), notes };
}

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
  const n = parseStrictIntInput(count, '生成数量', { min: 1, max: MAX_COUNT }).value;
  const baseTime = timestampMs === null || timestampMs === undefined || timestampMs === ''
    ? Date.now()
    : parseStrictIntInput(timestampMs, '时间戳', { min: 0, max: MAX_TIMESTAMP }).value;
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

// 生成区输入体检：供页面在调用 generateUlidBatch 前收集 notes（全角转换提示）。
export function collectGenerateNotes({ count, timestampMs } = {}) {
  const notes = [];
  try { notes.push(...parseStrictIntInput(count ?? 10, '生成数量', { min: 1, max: MAX_COUNT }).notes); } catch { /* 报错由生成流程给出 */ }
  if (timestampMs !== null && timestampMs !== undefined && String(timestampMs).trim() !== '') {
    try { notes.push(...parseStrictIntInput(timestampMs, '时间戳', { min: 0, max: MAX_TIMESTAMP }).notes); } catch { /* 同上 */ }
  }
  return [...new Set(notes)];
}

export function normalizeUlidDetailed(input) {
  const original = String(input ?? '');
  if ([...original].length > MAX_INPUT_LENGTH) throw new Error(`输入过长（上限 ${MAX_INPUT_LENGTH} 个字符）`);
  const notes = [];
  let s = original;
  if (s.charCodeAt(0) === 0xFEFF) { s = s.slice(1); notes.push('已忽略开头的 BOM'); }
  const lines = s.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length > 1) throw new Error(`检测到 ${lines.length} 行内容，一次只能解析一个 ULID，请只保留一行`);
  s = (lines[0] ?? '').trim();
  if (s === '') throw new Error('请输入 ULID');
  const fw = normalizeFullwidthText(s);
  if (fw.count) { s = fw.text; notes.push(`已将 ${fw.count} 个全角字符转为半角`); }
  s = s.trim();
  // 内部空白（复制折断）与连字符：去掉后恰为 26 位才容忍，并明示处理项。
  if (/[\s-]/.test(s)) {
    const compact = s.replace(/[\s-]/g, '');
    if (compact.length === ULID_LENGTH) {
      if (/\s/.test(s)) notes.push('已忽略内部空白（复制时被折断）');
      if (s.includes('-')) notes.push('已忽略连字符（ULID 标准形式无连字符）');
      s = compact;
    }
  }
  let upper = s.toUpperCase();
  if (upper.length !== ULID_LENGTH) {
    throw new Error(`ULID 须为 ${ULID_LENGTH} 个字符，收到 ${[...upper].length} 个`);
  }
  // I/L/O 别名按 Crockford 解码规范读作 1/1/0，明示替换个数。
  let aliasCount = 0;
  upper = [...upper].map((ch) => {
    if (ALIAS_MAP.has(ch)) { aliasCount++; return ALIAS_MAP.get(ch); }
    return ch;
  }).join('');
  if (aliasCount) notes.push(`已按 Crockford 解码规范将 ${aliasCount} 个 I/L/O 读作 1/1/0（原样粘贴含易混字母）`);
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    if (!DECODE_MAP.has(ch)) {
      const hint = ch === 'U' ? '（Crockford Base32 不含 U，以免随机拼出英文脏话）' : '';
      throw new Error(`第 ${i + 1} 个字符「${s[i] ?? ch}」不在 Crockford Base32 字母表中${hint}`);
    }
  }
  if (DECODE_MAP.get(upper[0]) > 7) {
    throw new Error('首字符超过 7：48 位时间戳溢出，不是合法 ULID');
  }
  return { ulid: upper, notes };
}

export function normalizeUlid(input) {
  return normalizeUlidDetailed(input).ulid;
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

export function parseUlid(input, nowMs = Date.now()) {
  const { ulid, notes } = normalizeUlidDetailed(input);
  const timeSegment = ulid.slice(0, TIME_CHARS);
  const randomSegment = ulid.slice(TIME_CHARS);
  const timestampMs = decodeTime(timeSegment);
  let rand = 0n;
  for (const ch of randomSegment) rand = (rand << 5n) | BigInt(DECODE_MAP.get(ch));
  const randomnessHex = rand.toString(16).padStart(20, '0');
  const date = new Date(timestampMs);
  const warnings = [];
  if (timestampMs === 0) warnings.push('内嵌时间为 0（1970-01-01），多半是占位/测试值，不是真实生成的 ULID');
  else if (typeof nowMs === 'number' && Number.isFinite(nowMs) && timestampMs > nowMs) warnings.push('内嵌时间在未来，请复核来源时钟或它是否为随机字符串');
  if (rand === 0n) warnings.push('随机段全为 0，真实随机生成的概率极低，多半是手工构造值');
  return {
    ulid,
    timeSegment,
    randomSegment,
    timestampMs,
    iso: date.toISOString(),
    randomnessHex,
    entropyBits: 80,
    notes,
    warnings
  };
}

export function buildSummary(parsed) {
  const lines = [
    `ULID：${parsed.ulid}`,
    `内嵌时间：${parsed.iso}（${parsed.timestampMs} ms）`,
    `时间段：${parsed.timeSegment}`,
    `随机段：${parsed.randomSegment}（80 位，十六进制 ${parsed.randomnessHex}）`
  ];
  if (parsed.warnings?.length) lines.push(`提示：${parsed.warnings.join('；')}`);
  return lines.join('\n');
}
