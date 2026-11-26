// UUID 解析核心逻辑：纯本地字符串解析，不上传任何数据。遵循 RFC 9562。
export const VERSION_NAMES = {
  0: '无版本（版本位为 0）',
  1: 'v1 时间型（Gregorian 时间 + 节点）',
  2: 'v2 DCE Security 型',
  3: 'v3 名称型（MD5）',
  4: 'v4 随机型',
  5: 'v5 名称型（SHA-1）',
  6: 'v6 时间型（重排版 v1，时间可排序）',
  7: 'v7 时间型（Unix 毫秒，可排序）',
  8: 'v8 自定义型'
};

const GREGORIAN_OFFSET_100NS = 122192928000000000n; // 1582-10-15 到 1970-01-01 的 100ns 数

function gregorian100nsToIso(ts100ns) {
  const diff = ts100ns - GREGORIAN_OFFSET_100NS;
  const ms = diff / 10000n;
  const rem100ns = diff % 10000n;
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString(), unixMs: Number(ms), subMs100ns: Number(rem100ns) };
}

export function parseUuid(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: '请输入 UUID' };
  if (/^urn:uuid:/i.test(raw)) raw = raw.slice(9);
  let braced = false;
  if (raw.startsWith('{') && raw.endsWith('}')) { braced = true; raw = raw.slice(1, -1); }
  let hex;
  if (raw.includes('-')) {
    const parts = raw.split('-');
    if (parts.length !== 5 || parts.map((p) => p.length).join(',') !== '8,4,4,4,12') {
      return { ok: false, error: '连字符分组不正确：标准格式为 8-4-4-4-12（如 550e8400-e29b-41d4-a716-446655440000）' };
    }
    hex = parts.join('');
  } else {
    hex = raw;
  }
  if (hex.length !== 32) return { ok: false, error: `长度不正确：去掉连字符后应为 32 个十六进制字符，实际 ${hex.length} 个` };
  const bad = hex.search(/[^0-9a-fA-F]/);
  if (bad !== -1) return { ok: false, error: `第 ${bad + 1} 个字符「${hex[bad]}」不是十六进制字符（只允许 0-9、a-f）` };
  hex = hex.toLowerCase();
  const canonical = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const isNil = hex === '0'.repeat(32);
  const isMax = hex === 'f'.repeat(32);
  const version = parseInt(hex[12], 16);
  const variantNibble = parseInt(hex[16], 16);
  let variant;
  if ((variantNibble & 0x8) === 0) variant = { id: 'ncs', label: 'NCS 兼容（保留）', bits: '0xxx' };
  else if ((variantNibble & 0xc) === 0x8) variant = { id: 'rfc9562', label: 'RFC 9562 标准', bits: '10xx' };
  else if ((variantNibble & 0xe) === 0xc) variant = { id: 'microsoft', label: 'Microsoft 兼容（保留）', bits: '110x' };
  else variant = { id: 'future', label: '未来保留', bits: '111x' };
  const clockSeq = ((variantNibble & 0x3f) << 8) | parseInt(hex.slice(18, 20), 16);
  const nodeHex = hex.slice(20);
  const node = nodeHex.match(/.{2}/g).join(':');
  const nodeIsRandom = (parseInt(nodeHex.slice(0, 2), 16) & 0x01) === 0x01;

  let timestamp = null;
  if (!isNil && !isMax) {
    if (version === 1) {
      const ts = BigInt('0x' + hex.slice(13, 16) + hex.slice(8, 12) + hex.slice(0, 8));
      const conv = gregorian100nsToIso(ts);
      if (conv) timestamp = { kind: 'gregorian', label: '内嵌时间（v1，100 纳秒精度）', raw100ns: ts.toString(), ...conv };
    } else if (version === 6) {
      const ts = BigInt('0x' + hex.slice(0, 8) + hex.slice(8, 12) + hex.slice(13, 16));
      const conv = gregorian100nsToIso(ts);
      if (conv) timestamp = { kind: 'gregorian', label: '内嵌时间（v6，100 纳秒精度）', raw100ns: ts.toString(), ...conv };
    } else if (version === 7) {
      const ms = parseInt(hex.slice(0, 12), 16);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) timestamp = { kind: 'unix', label: '内嵌时间（v7，Unix 毫秒）', iso: d.toISOString(), unixMs: ms, subMs100ns: 0 };
    }
  }
  const hasClockAndNode = (version === 1 || version === 6) && !isNil && !isMax;
  return {
    ok: true,
    canonical,
    hex,
    braced,
    uppercaseForm: canonical.toUpperCase(),
    urnForm: `urn:uuid:${canonical}`,
    isNil,
    isMax,
    special: isNil ? 'Nil UUID（全 0，表示不存在）' : isMax ? 'Max UUID（全 F，RFC 9562 定义的最大值）' : '',
    version,
    versionName: VERSION_NAMES[version] || `未知版本 ${version}`,
    variant,
    clockSeq: hasClockAndNode ? clockSeq : null,
    node: hasClockAndNode ? node : null,
    nodeIsRandom: hasClockAndNode ? nodeIsRandom : null,
    timestamp,
    segments: [
      { label: '段 1（8 位）', value: hex.slice(0, 8) },
      { label: '段 2（4 位）', value: hex.slice(8, 12) },
      { label: '段 3（4 位，首位为版本）', value: hex.slice(12, 16) },
      { label: '段 4（4 位，首位含变体）', value: hex.slice(16, 20) },
      { label: '段 5（12 位）', value: hex.slice(20) }
    ]
  };
}

export function isValidUuid(input) {
  return parseUuid(input).ok;
}

export function buildUuidSummary(r) {
  if (!r?.ok) return '';
  const lines = [
    `UUID：${r.canonical}`,
    `版本：${r.versionName}`,
    `变体：${r.variant.label}（${r.variant.bits}）`
  ];
  if (r.special) lines.push(`特殊值：${r.special}`);
  if (r.timestamp) lines.push(`内嵌时间：${r.timestamp.iso}（Unix 毫秒 ${r.timestamp.unixMs}）`);
  if (r.clockSeq !== null) lines.push(`时钟序列：${r.clockSeq}`);
  if (r.node) lines.push(`节点：${r.node}${r.nodeIsRandom ? '（随机节点，多播位置 1）' : ''}`);
  lines.push(`无连字符：${r.hex}`, `URN：${r.urnForm}`);
  return lines.join('\n');
}
