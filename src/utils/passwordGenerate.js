// 密码生成核心：纯本地，Web Crypto 安全随机源 + 拒绝采样无偏取字。
// 旧版问题：Uint32 % 字符数取模有偏；勾选的字符类型不保证出现（可能全是小写）；
// 长度/数量靠 input 的 min/max 假装校验，手动输入越界/小数/空值会被静默吞掉；
// 强度条按选项打分而非真实熵。本模块逐项修正，并支持随机源注入便于独立测试。
import { randomBigIntBelow } from './randomNumber.js';

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;
export const MAX_COUNT = 50;

export const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

export const CLASS_LABELS = {
  uppercase: '大写字母',
  lowercase: '小写字母',
  numbers: '数字',
  symbols: '特殊符号'
};

// 易混淆字符：数字 0/1、字母 O/l/I、竖线 |
export const AMBIGUOUS_CHARS = '0O1lI|';

export function defaultRandomBytes(n) {
  const out = new Uint8Array(n);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) throw new Error('当前环境不支持 crypto.getRandomValues，无法生成安全随机密码');
  for (let off = 0; off < n; off += 65536) {
    cryptoObj.getRandomValues(out.subarray(off, Math.min(n, off + 65536)));
  }
  return out;
}

function validateInt(raw, label, min, max) {
  const text = String(raw ?? '').trim();
  if (!text) throw new Error(`请输入${label}`);
  if (!/^[+-]?\d+$/.test(text)) {
    if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(text)) throw new Error(`${label}必须为整数，「${text}」含小数`);
    throw new Error(`${label}「${text}」不是有效整数`);
  }
  const value = Number(text);
  if (value < min) throw new Error(`${label}至少为 ${min}，当前为 ${value}`);
  if (value > max) throw new Error(`${label}最多为 ${max}，当前为 ${value}，请分批或减小`);
  return value;
}

export function validateLength(raw) {
  return validateInt(raw, '密码长度', MIN_LENGTH, MAX_LENGTH);
}

export function validateCount(raw) {
  return validateInt(raw, '生成数量', 1, MAX_COUNT);
}

// 按选项构建字符池：返回每类剩余字符与合并池；任一勾选类被排除光会明确报错点名该类
export function buildPool(options = {}) {
  const exclude = new Set([...String(options.excludeChars ?? '')]);
  if (options.excludeAmbiguous) {
    for (const ch of AMBIGUOUS_CHARS) exclude.add(ch);
  }
  const groups = [];
  for (const id of Object.keys(CHARSETS)) {
    if (!options[id]) continue;
    const chars = [...CHARSETS[id]].filter((c) => !exclude.has(c)).join('');
    if (!chars) {
      throw new Error(`排除字符把「${CLASS_LABELS[id]}」全部排除了，请减少排除字符或取消勾选该类型`);
    }
    groups.push({ id, label: CLASS_LABELS[id], chars });
  }
  if (groups.length === 0) throw new Error('请至少选择一种字符类型');
  const pool = groups.map((g) => g.chars).join('');
  if ([...pool].length < 2) throw new Error('可用字符只剩 1 个，无法生成有随机性的密码，请减少排除字符');
  return { groups, pool, poolSize: [...pool].length };
}

export function entropyOf(length, poolSize) {
  return Math.round(length * Math.log2(poolSize) * 10) / 10;
}

export function strengthForEntropy(entropy) {
  if (entropy < 40) return { label: '弱', percent: Math.round((entropy / 128) * 100) };
  if (entropy < 60) return { label: '中等', percent: Math.round((entropy / 128) * 100) };
  if (entropy < 80) return { label: '强', percent: Math.round((entropy / 128) * 100) };
  return { label: '很强', percent: Math.min(100, Math.round((entropy / 128) * 100)) };
}

function pickChar(chars, randomBytes) {
  const arr = [...chars];
  const idx = Number(randomBigIntBelow(BigInt(arr.length), randomBytes));
  return arr[idx];
}

export function generateOne(options, poolInfo, randomBytes = defaultRandomBytes) {
  const length = options._length;
  const requireEach = options.requireEach !== false;
  const chars = [];
  if (requireEach) {
    for (const g of poolInfo.groups) chars.push(pickChar(g.chars, randomBytes));
  }
  while (chars.length < length) chars.push(pickChar(poolInfo.pool, randomBytes));
  // Fisher-Yates 无偏洗牌，避免保类字符固定落在开头几位
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Number(randomBigIntBelow(BigInt(i + 1), randomBytes));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function generatePasswords(options = {}, randomBytes = defaultRandomBytes) {
  const length = validateLength(options.length);
  const count = validateCount(options.count);
  const poolInfo = buildPool(options);
  if (options.requireEach !== false && length < poolInfo.groups.length) {
    throw new Error(`密码长度 ${length} 小于所选字符类型数 ${poolInfo.groups.length}，无法保证每类至少出现一个`);
  }
  const normalized = { ...options, _length: length };
  const passwords = [];
  const seen = new Set();
  let attempts = 0;
  while (passwords.length < count) {
    if (++attempts > count * 20 + 100) throw new Error('多次生成均出现重复，已停止，请重试');
    const pwd = generateOne(normalized, poolInfo, randomBytes);
    if (seen.has(pwd)) continue;
    seen.add(pwd);
    // 自检：长度与字符池归属
    if ([...pwd].length !== length || ![...pwd].every((c) => poolInfo.pool.includes(c))) {
      throw new Error('生成结果自检未通过，已停止');
    }
    if (options.requireEach !== false) {
      for (const g of poolInfo.groups) {
        if (![...pwd].some((c) => g.chars.includes(c))) throw new Error('生成结果自检未通过：所选字符类型未全部出现');
      }
    }
    passwords.push(pwd);
  }
  const entropyBits = entropyOf(length, poolInfo.poolSize);
  return {
    passwords,
    length,
    count: passwords.length,
    poolSize: poolInfo.poolSize,
    groups: poolInfo.groups.map((g) => ({ id: g.id, label: g.label, size: [...g.chars].length })),
    entropyBits,
    strength: strengthForEntropy(entropyBits)
  };
}

export function buildPasswordSummary(result) {
  if (!result) return '';
  return [
    `密码配置：长度 ${result.length} · 字符池 ${result.poolSize}（${result.groups.map((g) => g.label).join('、')}）`,
    `理论熵约 ${result.entropyBits} 位（强度：${result.strength.label}）`,
    `共生成 ${result.count} 个，全部不重复`
  ].join('\n');
}
