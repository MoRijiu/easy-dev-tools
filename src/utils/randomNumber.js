// 随机数生成：纯本地，使用 Web Crypto 安全随机源 + 拒绝采样保证无偏。
// 整数：按范围大小用 BigInt 拒绝采样（不用 Math.random 取模，避免分布偏差）。
// 小数：取 53 位随机整数映射到 [min, max)，可按小数位四舍五入（结果可能等于 max，属舍入结果）。
export const MAX_COUNT = 1000;

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

function toSafeInteger(value, label) {
  const s = String(value ?? '').trim();
  if (s === '') throw new Error(`请输入${label}`);
  if (!/^[+-]?\d+$/.test(s)) throw new Error(`${label}必须是整数，收到「${s}」`);
  const n = Number(s);
  if (!Number.isSafeInteger(n)) throw new Error(`${label}超出安全整数范围（±9007199254740991）`);
  return n;
}

function toFiniteNumber(value, label) {
  const s = String(value ?? '').trim();
  if (s === '') throw new Error(`请输入${label}`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label}必须是有限数字，收到「${s}」`);
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
  while (out.length < count) {
    if (++guard > maxGuard) throw new Error('随机采样次数过多，请减小数量或扩大范围');
    const v = min + Number(randomBigIntBelow(rangeSize, randomBytes));
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
  if (decimals === '' || decimals === null || decimals === undefined) decimals = null;
  else {
    decimals = toSafeInteger(decimals, '小数位数');
    if (decimals < 0 || decimals > 10) throw new Error('小数位数须在 0–10 之间');
  }
  const out = [];
  const span = max - min;
  for (let i = 0; i < count; i++) {
    const r = Number(randomBigIntBelow(1n << 53n, randomBytes)) / Number(1n << 53n);
    let v = min + r * span;
    if (decimals !== null) v = Number(v.toFixed(decimals));
    out.push(v);
  }
  if (opts.sort === 'asc') out.sort((a, b) => a - b);
  else if (opts.sort === 'desc') out.sort((a, b) => b - a);
  return out;
}

export function summarizeNumbers(values) {
  if (!values || values.length === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  return { count: values.length, min, max, sum, average: sum / values.length };
}

export function formatNumbers(values, separator = '\n') {
  return values.join(separator);
}
