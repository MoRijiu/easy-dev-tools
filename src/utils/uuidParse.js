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
  // BigInt 除法向零截断：1970 年之前的负数差值须向下取整，否则毫秒多 1、余数变负
  const ms = diff >= 0n ? diff / 10000n : -((-diff + 9999n) / 10000n);
  const rem100ns = diff - ms * 10000n;
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString(), unixMs: Number(ms), subMs100ns: Number(rem100ns) };
}

// 全角字符（ＦＦ５５－｛｝等）转半角，与其他工具的粘贴容错口径一致
export function normalizeUuidInput(input) {
  return String(input ?? '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

const MAX_UUID_INPUT = 2048;

export function parseUuid(input) {
  const original = String(input ?? '');
  if (original.length > MAX_UUID_INPUT) {
    return { ok: false, error: `输入过长（${original.length} 个字符）：一个 UUID 至多约 45 个字符，上限 ${MAX_UUID_INPUT} 个字符，请只粘贴一个 UUID` };
  }
  const notes = [];
  let raw = normalizeUuidInput(original).trim();
  if (raw !== original.trim()) notes.push('已将全角字符转为半角');
  if (!raw) return { ok: false, error: '请输入 UUID' };
  // 多行里每行都是一个完整 UUID 时点名：一次只能解析一个（换行折断的单个 UUID 在下面按空白容错处理）
  const lines = raw.split(/\r\n|\r|\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => {
    let t = line;
    if (/^urn:uuid:/i.test(t)) t = t.slice(9);
    if (t.startsWith('{') && t.endsWith('}')) t = t.slice(1, -1);
    return /^[0-9a-fA-F]{32}$/.test(t) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(t);
  })) {
    return { ok: false, error: `检测到 ${lines.length} 个 UUID（每行一个），一次只能解析一个，请只保留其中一个` };
  }
  // 内部空白容错：去掉空白后只剩十六进制/连字符/包装字符时才忽略（带普通单词的粘贴不合并，仍走原校验报错）
  if (/\s/.test(raw)) {
    const stripped = raw.replace(/\s+/g, '');
    if (/^(?:urn:uuid:)?\{?[0-9a-fA-F-]+\}?$/i.test(stripped)) {
      raw = stripped;
      notes.push('已忽略输入中的空格与换行');
    }
  }
  // URN 前缀与大括号可任意嵌套顺序（{urn:uuid:…}、urn:uuid:{…}），循环剥除
  let braced = false;
  for (let i = 0; i < 3; i++) {
    if (/^urn:uuid:/i.test(raw)) { raw = raw.slice(9); continue; }
    if (raw.startsWith('{') && raw.endsWith('}') && raw.length >= 2) { braced = true; raw = raw.slice(1, -1); continue; }
    break;
  }
  if (raw.startsWith('{') !== raw.endsWith('}')) {
    return { ok: false, error: '大括号不配对：要么成对写 {…}，要么去掉大括号' };
  }
  if (/^urn:/i.test(raw)) {
    return { ok: false, error: 'URN 前缀不完整：应为 urn:uuid: 开头，后面紧跟 UUID 本体' };
  }
  if (!raw) return { ok: false, error: '包装里没有 UUID 本体：请输入完整的 UUID' };
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
  const warnings = [];
  if (!isNil && !isMax) {
    if (version >= 9) warnings.push(`版本位为 ${version}：RFC 9562 只定义 0–8，9–15 为保留未分配，这不是任何已知标准版本的 UUID`);
    else if (version === 0) warnings.push('版本位为 0 且不是 Nil UUID：不符合 RFC 9562 的版本分配，严格校验器可能拒绝');
    if (variant.id !== 'rfc9562') warnings.push(`变体为「${variant.label}」，不是 RFC 9562 标准的 10xx：多数 UUID 库只认标准变体，此值可能被严格校验器拒绝`);
    if (version === 2) warnings.push('v2（DCE Security）的时间与节点字段被本地标识符部分覆盖，不能像 v1 那样直接提取完整时间，本工具不提取 v2 时间');
  }
  return {
    ok: true,
    canonical,
    hex,
    braced,
    notes,
    warnings,
    uppercaseForm: canonical.toUpperCase(),
    urnForm: `urn:uuid:${canonical}`,
    isNil,
    isMax,
    special: isNil ? 'Nil UUID（全 0，表示不存在）' : isMax ? 'Max UUID（全 F，RFC 9562 定义的最大值）' : '',
    version,
    versionName: isMax ? '不适用（Max 特殊值，版本位全 1）' : isNil ? VERSION_NAMES[0] : (VERSION_NAMES[version] || `保留版本 ${version}（未分配）`),
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
  for (const w of r.warnings || []) lines.push(`提示：${w}`);
  lines.push(`无连字符：${r.hex}`, `URN：${r.urnForm}`);
  return lines.join('\n');
}
