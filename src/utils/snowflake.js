// 雪花 ID（Snowflake）解析与生成核心逻辑：纯本地 BigInt 计算，不上传任何数据。
// 经典结构：时间戳（距纪元毫秒）| 数据中心 | 机器 | 同毫秒序列号，总长不超过 64 位。

export const TWITTER_EPOCH = 1288834974657; // 2010-11-04T01:42:54.657Z，Twitter 雪花纪元
export const DISCORD_EPOCH = 1420070400000; // 2015-01-01T00:00:00.000Z，Discord 纪元

export const SNOWFLAKE_PRESETS = [
  {
    id: 'twitter',
    name: 'Twitter 经典（41+5+5+12）',
    epoch: TWITTER_EPOCH,
    timestampBits: 41,
    datacenterBits: 5,
    workerBits: 5,
    sequenceBits: 12,
    note: '时间戳 41 位 + 数据中心 5 位 + 机器 5 位 + 序列 12 位'
  },
  {
    id: 'discord',
    name: 'Discord（42+10+12）',
    epoch: DISCORD_EPOCH,
    timestampBits: 42,
    datacenterBits: 0,
    workerBits: 10,
    sequenceBits: 12,
    note: 'Discord 的 worker 与 process 各 5 位，本工具合并为 10 位机器位展示'
  },
  {
    id: 'simple',
    name: '简化版（41+10+12）',
    epoch: TWITTER_EPOCH,
    timestampBits: 41,
    datacenterBits: 0,
    workerBits: 10,
    sequenceBits: 12,
    note: '无数据中心位，机器位扩到 10 位（1024 台），很多自研实现采用此布局'
  }
];

export function validateLayout(layout) {
  const fields = [
    ['时间戳', layout.timestampBits],
    ['数据中心', layout.datacenterBits],
    ['机器', layout.workerBits],
    ['序列号', layout.sequenceBits]
  ];
  for (const [label, bits] of fields) {
    if (!Number.isInteger(bits) || bits < 0 || bits > 62) {
      throw new Error(`${label}位数不合法：应为 0–62 的整数`);
    }
  }
  if (layout.timestampBits < 1) throw new Error('时间戳位数至少为 1');
  if (layout.sequenceBits < 1) throw new Error('序列号位数至少为 1');
  const total = layout.timestampBits + layout.datacenterBits + layout.workerBits + layout.sequenceBits;
  if (total > 64) throw new Error(`总位数 ${total} 超过 64 位（雪花 ID 为 64 位整数）`);
  if (!Number.isInteger(layout.epoch) || layout.epoch < 0) throw new Error('纪元（epoch）应为非负整数毫秒时间戳');
  if (layout.epoch > 8640000000000000) throw new Error('纪元（epoch）超出 Date 可表示范围（最大 8640000000000000）');
  return total;
}

const mask = (bits) => (bits === 0 ? 0n : (1n << BigInt(bits)) - 1n);

function toIso(ms) {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}


export const SNOWFLAKE_MAX_INPUT = 256;
const DATE_MAX_MS = 8640000000000000;

export function normalizeSnowflakeInput(input) {
  const raw = String(input ?? '');
  const notes = [];
  let out = '';
  let full = false;
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xff01 && cp <= 0xff5e) { out += String.fromCharCode(cp - 0xfee0); full = true; }
    else if (cp === 0x3000) { out += ' '; full = true; }
    else out += ch;
  }
  if (full) notes.push('已将全角字符按半角处理');
  return { text: out, notes };
}

/**
 * 解析雪花 ID。
 * @param {string} input 十进制字符串（也接受 0x 十六进制）
 * @param {object} layout { epoch, timestampBits, datacenterBits, workerBits, sequenceBits }
 */
export function parseSnowflake(input, layout) {
  validateLayout(layout);
  const { text: normalized, notes } = normalizeSnowflakeInput(input);
  let raw = normalized.trim();
  if (!raw) throw new Error('请输入雪花 ID');
  if (raw.length > SNOWFLAKE_MAX_INPUT) throw new Error(`输入过长：雪花 ID 最多 ${SNOWFLAKE_MAX_INPUT} 个字符（当前 ${raw.length} 个）`);
  if (/\s/.test(raw)) {
    raw = raw.replace(/\s+/g, '');
    notes.push('已忽略 ID 内部的空白与换行（复制时被折断）');
    if (!raw) throw new Error('请输入雪花 ID');
  }
  if (raw.startsWith('-') || raw.startsWith('+')) {
    if (raw.startsWith('-')) throw new Error('雪花 ID 不能为负数：请检查是否粘贴了带符号的数值或选错了字段');
  }
  let value;
  if (/^0[xX]/.test(raw)) {
    const hexPart = raw.slice(2);
    if (!hexPart) throw new Error('0x 后面没有十六进制数字');
    const bad = hexPart.search(/[^0-9a-fA-F]/);
    if (bad !== -1) throw new Error(`第 ${bad + 3} 个字符「${hexPart[bad]}」不是十六进制数字（0-9、a-f）`);
    value = BigInt('0x' + hexPart);
  } else {
    const bad = raw.search(/[^0-9]/);
    if (bad !== -1) {
      const ch = raw[bad];
      if (ch === '.' || ch === 'e' || ch === 'E') throw new Error(`第 ${bad + 1} 个字符「${ch}」：雪花 ID 应为整数，请勿用小数或科学计数法表示（会丢精度）`);
      if (ch === '_' || ch === ',') throw new Error(`第 ${bad + 1} 个字符「${ch}」是分隔符：请去掉千分位/数字分隔符后重试`);
      if (ch === 'x' || ch === 'X') throw new Error(`第 ${bad + 1} 个字符「${ch}」：十六进制须以 0x 开头`);
      throw new Error(`第 ${bad + 1} 个字符「${ch}」不是数字：雪花 ID 应为十进制整数（或 0x 开头的十六进制）`);
    }
    value = BigInt(raw);
  }
  const totalBits = layout.timestampBits + layout.datacenterBits + layout.workerBits + layout.sequenceBits;
  if (value < 0n) throw new Error('雪花 ID 不能为负数');
  if (value >= (1n << BigInt(totalBits))) {
    throw new Error(`该 ID 超出当前布局的 ${totalBits} 位范围，请检查布局（位数/预设）是否选对`);
  }
  const seqShift = 0n;
  const workerShift = BigInt(layout.sequenceBits);
  const dcShift = workerShift + BigInt(layout.workerBits);
  const tsShift = dcShift + BigInt(layout.datacenterBits);
  const sequence = Number((value >> seqShift) & mask(layout.sequenceBits));
  const workerId = Number((value >> workerShift) & mask(layout.workerBits));
  const datacenterId = layout.datacenterBits > 0 ? Number((value >> dcShift) & mask(layout.datacenterBits)) : null;
  const delta = value >> tsShift;
  const timestampMs = layout.epoch + Number(delta);
  const binary = value.toString(2).padStart(totalBits, '0');
  const groups = [];
  let pos = 0;
  const take = (bits) => {
    if (bits === 0) return null;
    const s = binary.slice(pos, pos + bits);
    pos += bits;
    return s;
  };
  groups.push({ label: `时间戳（${layout.timestampBits} 位）`, bits: take(layout.timestampBits) });
  if (layout.datacenterBits > 0) groups.push({ label: `数据中心（${layout.datacenterBits} 位）`, bits: take(layout.datacenterBits) });
  if (layout.workerBits > 0) groups.push({ label: `机器（${layout.workerBits} 位）`, bits: take(layout.workerBits) });
  else take(0);
  groups.push({ label: `序列号（${layout.sequenceBits} 位）`, bits: take(layout.sequenceBits) });
  const warnings = [];
  if (value === 0n) warnings.push('ID 为 0：各段均为 0、生成时间正好是纪元时刻，通常不是真实生成的雪花 ID');
  if (timestampMs > Date.now()) warnings.push('解析出的生成时间在未来：多半是布局或纪元选错了');
  if (timestampMs > DATE_MAX_MS) warnings.push('生成时间超出 Date 可表示范围，无法给出 ISO 时间');
  return {
    notes,
    warnings,
    id: value.toString(10),
    hex: '0x' + value.toString(16).toUpperCase(),
    totalBits,
    deltaMs: Number(delta),
    timestampMs,
    iso: toIso(timestampMs),
    datacenterId,
    workerId,
    sequence,
    groups
  };
}

/**
 * 按布局生成雪花 ID（返回十进制字符串）。
 * @param {object} parts { timestampMs, datacenterId=0, workerId=0, sequence=0 }
 * @param {object} layout 同 parseSnowflake
 */
export function generateSnowflake(parts, layout) {
  validateLayout(layout);
  const { timestampMs, datacenterId = 0, workerId = 0, sequence = 0 } = parts;
  if (!Number.isInteger(timestampMs)) throw new Error('生成时间应为整数毫秒时间戳');
  if (timestampMs < 0 || timestampMs > DATE_MAX_MS) throw new Error('生成时间超出 Date 可表示范围（0–8640000000000000）');
  const delta = timestampMs - layout.epoch;
  if (delta < 0) throw new Error(`生成时间早于纪元（epoch=${layout.epoch}），差 ${-delta} 毫秒`);
  if (BigInt(delta) >= (1n << BigInt(layout.timestampBits))) {
    throw new Error(`距纪元 ${delta} 毫秒超出 ${layout.timestampBits} 位时间戳范围`);
  }
  const check = (label, v, bits) => {
    if (!Number.isInteger(v) || v < 0) throw new Error(`${label}应为非负整数`);
    if (bits === 0 && v !== 0) throw new Error(`当前布局没有${label}位，${label}必须为 0`);
    if (v >= 2 ** bits) throw new Error(`${label} ${v} 超出 ${bits} 位范围（0–${2 ** bits - 1}）`);
  };
  check('数据中心', datacenterId, layout.datacenterBits);
  check('机器 ID', workerId, layout.workerBits);
  check('序列号', sequence, layout.sequenceBits);
  const value =
    (BigInt(delta) << BigInt(layout.datacenterBits + layout.workerBits + layout.sequenceBits)) |
    (BigInt(datacenterId) << BigInt(layout.workerBits + layout.sequenceBits)) |
    (BigInt(workerId) << BigInt(layout.sequenceBits)) |
    BigInt(sequence);
  return value.toString(10);
}

export function buildSnowflakeSummary(r, layout) {
  const lines = [
    `雪花 ID：${r.id}`,
    `十六进制：${r.hex}`,
    `生成时间：${r.iso ?? '超出可表示范围'}（时间戳 ${r.timestampMs}，距纪元 ${r.deltaMs} 毫秒）`
  ];
  if (r.datacenterId !== null) lines.push(`数据中心 ID：${r.datacenterId}`);
  lines.push(`机器 ID：${r.workerId}`, `序列号：${r.sequence}`);
  lines.push(`布局：时间戳 ${layout.timestampBits} 位 / 数据中心 ${layout.datacenterBits} 位 / 机器 ${layout.workerBits} 位 / 序列 ${layout.sequenceBits} 位，纪元 ${layout.epoch}`);
  if (r.warnings?.length) lines.push(`提示：${r.warnings.join('；')}`);
  return lines.join('\n');
}
