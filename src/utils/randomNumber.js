// 随机数生成：纯本地，使用 Web Crypto 安全随机源 + 拒绝采样保证无偏。
// 整数：按范围大小用 BigInt 拒绝采样（不用 Math.random 取模，避免分布偏差）；
// 结果用 BigInt 加法算出再转 Number，范围跨度超过 2^53 时也不会因 Number(BigInt) 精度丢失而偏分布。
// 小数：取 53 位随机整数映射到 [min, max)，用加权插值避免跨度溢出成 Infinity 后静默产出 NaN；
// 可按小数位四舍五入（结果可能等于 max，属舍入结果）。
// 输入口径（2026-11-27 R8aq）：全角数字/字母自动转半角；逗号只认千分位分组、下划线只能单个夹在数字之间；
// 小数严格十进制校验，0x/0b/0o 十六进制等写法点名拒绝（旧版靠 Number() 静默当成十进制算错范围）。
const MAX_COUNT = 1000;
const MAX_INPUT_LENGTH = 64;

export function normalizeRandomText(value) {
  return String(value ?? '').replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
}

function defaultRandomBytes(n) {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('当前环境缺少安全随机源（Web Crypto），无法生成随机数');
  }
  const buf = new Uint8Array(n);
  c.getRandomValues(buf);
  return buf;
}

export function randomBigIntBelow(limit, randomBytes = defaultRandomBytes) {
  // 返回 [0, limit) 的无偏随机 BigInt；limit 为正 BigInt
  if (typeof limit !== 'bigint' || limit <= 0n) throw new Error('随机范围必须为正整数');
  if (limit === 1n) return 0n;
  const bits = (limit - 1n).toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const mask = (1n << BigInt(bits)) - 1n;
  for (let tries = 0; tries < 10000; tries++) {
    const buf = randomBytes(bytes);
    let v = 0n;
    for (const b of buf) v = (v << 8n) | BigInt(b);
    v &= mask;
    if (v < limit) return v;
  }
  throw new Error('随机采样失败，请重试');
}

// 校验并剥除千分位逗号与数字间下划线，返回可交给正则/Number 的纯文本。
function stripGrouping(s, label) {
  let out = s;
  if (out.includes('_')) {
    const badUnderscore = [...out].some((ch, i) => ch === '_' && !(/\d/.test(out[i - 1] || '') && /\d/.test(out[i + 1] || '')));
    if (badUnderscore) {
      throw new Error(`${label}的下划线只能单个夹在两个数字之间，收到「${s}」`);
    }
    out = out.replace(/_/g, '');
  }
  if (out.includes(',')) {
    const sign = out.startsWith('+') || out.startsWith('-') ? out[0] : '';
    const body = sign ? out.slice(1) : out;
    const [intPart, ...rest] = body.split(/[.eE]/);
    if (rest.some((part) => part.includes(','))) {
      throw new Error(`${label}的小数/指数部分不能用逗号，逗号只用于整数部分千分位分组，收到「${s}」`);
    }
    const groups = intPart.split(',');
    const ok = groups.length > 1 && groups[0].length >= 1 && groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3) && groups.every((g) => /^\d+$/.test(g));
    if (!ok) throw new Error(`${label}的逗号须按千分位每 3 位一组（如 1,000），收到「${s}」；小数请用点号`);
    out = sign + groups.join('') + (rest.length ? body.slice(intPart.length) : '');
  }
  return out;
}

function prepareNumeric(value, label) {
  const raw = String(value ?? '');
  if (raw.length > MAX_INPUT_LENGTH) throw new Error(`${label}过长（最多 ${MAX_INPUT_LENGTH} 个字符）`);
  const s = normalizeRandomText(raw).trim();
  if (s === '') throw new Error(`请输入${label}`);
  return stripGrouping(s, label);
}

function toSafeInteger(value, label) {
  const s = prepareNumeric(value, label);
  if (!/^[+-]?\d+$/.test(s)) throw new Error(`${label}必须是整数，收到「${s}」`);
  const n = Number(s);
  if (!Number.isSafeInteger(n)) throw new Error(`${label}超出安全整数范围（±9007199254740991）`);
  return n;
}

function toFiniteNumber(value, label) {
  const s = prepareNumeric(value, label);
  if (/^[+-]?0[xXbBoO]/.test(s)) throw new Error(`${label}不支持十六/二进制写法「${s}」，请用十进制`);
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new Error(`${label}必须是十进制数字，收到「${s}」`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label}超出有限数字范围，收到「${s}」`);
  return n;
}

function toCount(value) {
  const n = toSafeInteger(value, '生成数量');
  if (n < 1 || n > MAX_COUNT) throw new Error(`生成数量须在 1–${MAX_COUNT} 之间`);
  return n;
}

export function generateRandomIntegers(opts = {}, randomBytes = defaultRandomBytes) {
  const min = toSafeInteger(opts.min, '最小值');
  const max = toSafeInteger(opts.max, '最大值');
  if (min > max) throw new Error('最小值不能大于最大值');
  const count = toCount(opts.count);
  const unique = !!opts.unique;
  const rangeSize = BigInt(max) - BigInt(min) + 1n;
  if (unique && BigInt(count) > rangeSize) {
    throw new Error(`范围共 ${rangeSize} 个整数，不够生成 ${count} 个不重复随机数`);
  }
  const out = [];
  const seen = unique ? new Set() : null;
  let guard = 0;
  const maxGuard = count * 100 + 1000;
  const minBig = BigInt(min);
  while (out.length < count) {
    if (++guard > maxGuard) throw new Error('随机采样次数过多，请减小数量或扩大范围');
    // BigInt 加法后整体转 Number：min/max 均为安全整数，结果必在范围内且精确表示
    const v = Number(minBig + randomBigIntBelow(rangeSize, randomBytes));
    if (seen) {
      if (seen.has(v)) continue;
      seen.add(v);
    }
    out.push(v);
  }
  if (opts.sort === 'asc') out.sort((a, b) => a - b);
  else if (opts.sort === 'desc') out.sort((a, b) => b - a);
  return out;
}

export function generateRandomFloats(opts = {}, randomBytes = defaultRandomBytes) {
  const min = toFiniteNumber(opts.min, '最小值');
  const max = toFiniteNumber(opts.max, '最大值');
  if (min > max) throw new Error('最小值不能大于最大值');
  if (min === max) throw new Error('小数模式下最大值必须大于最小值');
  const count = toCount(opts.count);
  let decimals = opts.decimals;
  if (decimals === '' || decimals === null || decimals === undefined || (typeof decimals === 'string' && normalizeRandomText(decimals).trim() === '')) decimals = null;
  else {
    decimals = toSafeInteger(decimals, '小数位数');
    if (decimals < 0 || decimals > 10) throw new Error('小数位数须在 0–10 之间');
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = Number(randomBigIntBelow(1n << 53n, randomBytes)) / Number(1n << 53n);
    // 加权插值：min*(1-r)+max*r，两端同号异号都不会像 max-min 那样溢出成 Infinity
    let v = min * (1 - r) + max * r;
    if (!Number.isFinite(v)) throw new Error('随机结果超出有限数字范围，请缩小最小值/最大值跨度');
    if (v < min) v = min;
    else if (v > max) v = max;
    if (decimals !== null) v = Number(v.toFixed(decimals));
    out.push(v);
  }
  if (opts.sort === 'asc') out.sort((a, b) => a - b);
  else if (opts.sort === 'desc') out.sort((a, b) => b - a);
  return out;
}

export function summarizeNumbers(values) {
  if (!values || values.length === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0, average = 0;
  values.forEach((v, i) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('结果包含非有限数值，无法统计');
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    average += (v - average) / (i + 1); // 增量均值，避免大数相加溢出后平均值变 Infinity
  });
  return { count: values.length, min, max, sum, average };
}

