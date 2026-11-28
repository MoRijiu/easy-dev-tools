// 数据大小换算：纯本地。字节/比特、SI(1000) 与 IEC(1024) 双标准互转，及按网速估算传输耗时。
export const DATA_UNITS = [
  { symbol: 'bit', name: '比特', bytes: 1 / 8, system: '基本' },
  { symbol: 'B', name: '字节', bytes: 1, system: '基本' },
  { symbol: 'KB', name: '千字节 (SI)', bytes: 1e3, system: 'SI · 1000' },
  { symbol: 'MB', name: '兆字节 (SI)', bytes: 1e6, system: 'SI · 1000' },
  { symbol: 'GB', name: '吉字节 (SI)', bytes: 1e9, system: 'SI · 1000' },
  { symbol: 'TB', name: '太字节 (SI)', bytes: 1e12, system: 'SI · 1000' },
  { symbol: 'PB', name: '拍字节 (SI)', bytes: 1e15, system: 'SI · 1000' },
  { symbol: 'EB', name: '艾字节 (SI)', bytes: 1e18, system: 'SI · 1000' },
  { symbol: 'ZB', name: '泽字节 (SI)', bytes: 1e21, system: 'SI · 1000' },
  { symbol: 'YB', name: '尧字节 (SI)', bytes: 1e24, system: 'SI · 1000' },
  { symbol: 'KiB', name: '千比字节 (IEC)', bytes: 1024, system: 'IEC · 1024' },
  { symbol: 'MiB', name: '兆比字节 (IEC)', bytes: 1024 ** 2, system: 'IEC · 1024' },
  { symbol: 'GiB', name: '吉比字节 (IEC)', bytes: 1024 ** 3, system: 'IEC · 1024' },
  { symbol: 'TiB', name: '太比字节 (IEC)', bytes: 1024 ** 4, system: 'IEC · 1024' },
  { symbol: 'PiB', name: '拍比字节 (IEC)', bytes: 1024 ** 5, system: 'IEC · 1024' },
  { symbol: 'EiB', name: '艾比字节 (IEC)', bytes: 1024 ** 6, system: 'IEC · 1024' },
  { symbol: 'ZiB', name: '泽比字节 (IEC)', bytes: 1024 ** 7, system: 'IEC · 1024' },
  { symbol: 'YiB', name: '尧比字节 (IEC)', bytes: 1024 ** 8, system: 'IEC · 1024' }
];
const MAX_DATA_SIZE_INPUT = 1024;
const UNIT_MAP = new Map(DATA_UNITS.map((u) => [u.symbol.toLowerCase(), u]));
// 常见别名（小写）
const ALIASES = { b: 'B', byte: 'B', bytes: 'B', bit: 'bit', bits: 'bit', kb: 'KB', mb: 'MB', gb: 'GB', tb: 'TB', pb: 'PB', eb: 'EB', zb: 'ZB', yb: 'YB', kib: 'KiB', mib: 'MiB', gib: 'GiB', tib: 'TiB', pib: 'PiB', eib: 'EiB', zib: 'ZiB', yib: 'YiB', k: 'KB', m: 'MB', g: 'GB', t: 'TB' };
function resolveUnit(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase();
  if (ALIASES[key]) { const s = ALIASES[key]; return DATA_UNITS.find((u) => u.symbol === s); }
  return UNIT_MAP.get(key) || null;
}
// 全角 ASCII（数字/字母/标点，含全角点号与逗号）转半角：中文输入法粘贴常见
function normalizeDataSizeInput(raw) {
  return String(raw ?? '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}
function formatValue(v) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e15 || (abs > 0 && abs < 1e-6)) return v.toExponential(6).replace(/\.?0+e/, 'e');
  // >=1 最多 6 位小数；<1 给到 10 位，避免 1 MiB 换 GiB 这类小比例被四舍五入吃掉精度，去尾零
  let s = v.toFixed(abs < 1 ? 10 : 6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  // 千分位（整数部分）
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}
export function parseDataSize(input = '', defaultUnit = 'B') {
  const raw = String(input ?? '');
  if (raw.length > MAX_DATA_SIZE_INPUT) return { ok: false, error: `输入过长（上限 ${MAX_DATA_SIZE_INPUT} 个字符）` };
  const s = normalizeDataSizeInput(raw).trim();
  if (!s) return { ok: false, error: '请输入数据大小，如 1.5 GB 或 1024 MiB' };
  const m = s.match(/^([+-]?[\d,_]+(?:\.\d*)?|[+-]?\.\d+|[+-]?\d+(?:\.\d+)?e[+-]?\d+)\s*([a-zA-Z]*)$/i);
  if (!m) return { ok: false, error: '格式应为「数字 + 单位」，如 500 MB、2 GiB、1024' };
  let numStr = m[1];
  const isSci = /e/i.test(numStr);
  if (!isSci) {
    // 下划线只能单个夹在两个数字之间（1_000），首尾/连写/挨小数点都点名
    if (numStr.includes('_') && !/^\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?$/.test(numStr.replace(/,/g, ''))) {
      return { ok: false, error: '下划线只能单个夹在两个数字之间，如 1_000' };
    }
    // 逗号只能作千分位分组（1,000 / 1,000,000）；1,5 这类写法点名提示用点号，避免被静默当成 15
    if (numStr.includes(',')) {
      const intPart = numStr.split('.')[0];
      if (!/^\d{1,3}(?:,\d{3})+$/.test(intPart)) {
        return { ok: false, error: '逗号只能作千分位分组（如 1,000）；小数请用点号，如 1.5 GB' };
      }
    }
    numStr = numStr.replace(/,/g, '').replace(/_/g, '');
  }
  const value = Number(numStr);
  if (!Number.isFinite(value)) return { ok: false, error: '数字超出可计算范围' };
  if (value < 0) return { ok: false, error: '数据大小不能为负数' };
  let unit;
  if (m[2]) {
    unit = resolveUnit(m[2]);
    if (!unit) return { ok: false, error: `未知单位「${m[2]}」，可用 bit、B、KB、MB、GB、TB、PB、EB、ZB、YB、KiB、MiB、GiB、TiB、PiB、EiB、ZiB、YiB` };
  } else {
    unit = resolveUnit(defaultUnit) || DATA_UNITS.find((u) => u.symbol === 'B');
  }
  const bytes = value * unit.bytes;
  if (!Number.isFinite(bytes)) return { ok: false, error: '数值过大，超出可计算范围' };
  return { ok: true, value, unit: unit.symbol, bytes, bits: bytes * 8 };
}
export function convertDataSize(bytes) {
  return DATA_UNITS.map((u) => ({ symbol: u.symbol, name: u.name, system: u.system, value: bytes / u.bytes, text: formatValue(bytes / u.bytes) }));
}
function humanSize(bytes) {
  if (bytes === 0) return '0 B';
  // 优先 IEC 人读（系统/文件管理器常用），值落在 1..1024 区间
  const iec = DATA_UNITS.filter((u) => ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'].includes(u.symbol));
  let chosen = iec[0];
  for (const u of iec) { if (bytes / u.bytes >= 1) chosen = u; }
  return `${formatValue(bytes / chosen.bytes)} ${chosen.symbol}`;
}
function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '—';
  if (totalSeconds === 0) return '0 秒';
  if (totalSeconds < 1) return `${formatValue(totalSeconds * 1000)} 毫秒`;
  if (totalSeconds < 60) return `${formatValue(totalSeconds)} 秒`;
  const parts = [];
  let rest = Math.floor(totalSeconds);
  const d = Math.floor(rest / 86400); rest %= 86400;
  const h = Math.floor(rest / 3600); rest %= 3600;
  const min = Math.floor(rest / 60); const sec = rest % 60;
  if (d) parts.push(`${d} 天`);
  if (h) parts.push(`${h} 小时`);
  if (min) parts.push(`${min} 分钟`);
  if (sec) parts.push(`${sec} 秒`);
  return parts.join(' ');
}
// 网速数值严格按十进制解析：全角转半角，十六进制/空值/科学计数之外的写法点名拒绝
function parseSpeedValue(raw) {
  const s = normalizeDataSizeInput(String(raw ?? '')).trim();
  if (!s) return { ok: false, error: '请输入网速数值' };
  if (!/^[+-]?(\d+(?:\.\d*)?|\.\d+)$/.test(s)) return { ok: false, error: '网速应为大于 0 的数字（不支持 0x 等其他进制写法）' };
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return { ok: false, error: '网速应为大于 0 的数字' };
  return { ok: true, value: v };
}
const SPEED_RATES = {
  kbps: (v) => (v * 1e3) / 8, mbps: (v) => (v * 1e6) / 8, gbps: (v) => (v * 1e9) / 8,
  'kb/s': (v) => v * 1e3, 'mb/s': (v) => v * 1e6, 'gb/s': (v) => v * 1e9,
  'kib/s': (v) => v * 1024, 'mib/s': (v) => v * 1024 ** 2, 'gib/s': (v) => v * 1024 ** 3
};
// speedUnit: Mbps/Gbps/Kbps（带宽按 SI 除以 8）、KB/s/MB/s/GB/s（SI 1000）、KiB/s/MiB/s/GiB/s（IEC 1024），大小写不敏感
export function estimateTransfer(bytes, speedValue, speedUnit = 'Mbps') {
  const parsed = typeof speedValue === 'number'
    ? (Number.isFinite(speedValue) && speedValue > 0 ? { ok: true, value: speedValue } : { ok: false, error: '网速应为大于 0 的数字' })
    : parseSpeedValue(speedValue);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const rate = SPEED_RATES[String(speedUnit).toLowerCase()];
  if (!rate) return { ok: false, error: `未知网速单位「${speedUnit}」` };
  const bytesPerSec = rate(parsed.value);
  const seconds = bytesPerSec === 0 ? Infinity : bytes / bytesPerSec;
  return { ok: true, bytesPerSec, seconds, text: formatDuration(seconds) };
}
export function buildDataSizeSummary(parsed, rows) {
  if (!parsed) return '';
  const get = (sym) => rows.find((r) => r.symbol === sym);
  return `${formatValue(parsed.value)} ${parsed.unit} = ${get('B').text} B = ${get('MB').text} MB = ${get('MiB').text} MiB = ${get('GB').text} GB = ${get('GiB').text} GiB（人读约 ${humanSize(parsed.bytes)}）`;
}
