// 数据大小换算：纯本地。字节/比特、SI(1000) 与 IEC(1024) 双标准互转，及按网速估算传输耗时。
export const DATA_UNITS = [
  { symbol: 'bit', name: '比特', bytes: 1 / 8, system: '基本' },
  { symbol: 'B', name: '字节', bytes: 1, system: '基本' },
  { symbol: 'KB', name: '千字节 (SI)', bytes: 1e3, system: 'SI · 1000' },
  { symbol: 'MB', name: '兆字节 (SI)', bytes: 1e6, system: 'SI · 1000' },
  { symbol: 'GB', name: '吉字节 (SI)', bytes: 1e9, system: 'SI · 1000' },
  { symbol: 'TB', name: '太字节 (SI)', bytes: 1e12, system: 'SI · 1000' },
  { symbol: 'PB', name: '拍字节 (SI)', bytes: 1e15, system: 'SI · 1000' },
  { symbol: 'KiB', name: '千比字节 (IEC)', bytes: 1024, system: 'IEC · 1024' },
  { symbol: 'MiB', name: '兆比字节 (IEC)', bytes: 1024 ** 2, system: 'IEC · 1024' },
  { symbol: 'GiB', name: '吉比字节 (IEC)', bytes: 1024 ** 3, system: 'IEC · 1024' },
  { symbol: 'TiB', name: '太比字节 (IEC)', bytes: 1024 ** 4, system: 'IEC · 1024' },
  { symbol: 'PiB', name: '拍比字节 (IEC)', bytes: 1024 ** 5, system: 'IEC · 1024' }
];
const UNIT_MAP = new Map(DATA_UNITS.map((u) => [u.symbol.toLowerCase(), u]));
// 常见别名（小写）
const ALIASES = { b: 'B', byte: 'B', bytes: 'B', bit: 'bit', bits: 'bit', kb: 'KB', mb: 'MB', gb: 'GB', tb: 'TB', pb: 'PB', kib: 'KiB', mib: 'MiB', gib: 'GiB', tib: 'TiB', pib: 'PiB', k: 'KB', m: 'MB', g: 'GB', t: 'TB' };
function resolveUnit(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase();
  if (ALIASES[key]) { const s = ALIASES[key]; return DATA_UNITS.find((u) => u.symbol === s); }
  return UNIT_MAP.get(key) || null;
}
export function formatValue(v) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e15 || (abs > 0 && abs < 1e-6)) return v.toExponential(6).replace(/\.?0+e/, 'e');
  // 最多 6 位小数，去尾零
  let s = v.toFixed(6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  // 千分位（整数部分）
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}
export function parseDataSize(input = '', defaultUnit = 'B') {
  const s = String(input ?? '').trim().replace(/,/g, '').replace(/_/g, '');
  if (!s) return { ok: false, error: '请输入数据大小，如 1.5 GB 或 1024 MiB' };
  const m = s.match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*([a-zA-Z]*)$/i);
  if (!m) return { ok: false, error: '格式应为「数字 + 单位」，如 500 MB、2 GiB、1024' };
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return { ok: false, error: '数字超出可计算范围' };
  if (value < 0) return { ok: false, error: '数据大小不能为负数' };
  let unit;
  if (m[2]) {
    unit = resolveUnit(m[2]);
    if (!unit) return { ok: false, error: `未知单位「${m[2]}」，可用 bit、B、KB、MB、GB、TB、PB、KiB、MiB、GiB、TiB、PiB` };
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
export function humanSize(bytes) {
  if (bytes === 0) return '0 B';
  // 优先 IEC 人读（系统/文件管理器常用），值落在 1..1024 区间
  const iec = DATA_UNITS.filter((u) => ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'].includes(u.symbol));
  let chosen = iec[0];
  for (const u of iec) { if (bytes / u.bytes >= 1) chosen = u; }
  return `${formatValue(bytes / chosen.bytes)} ${chosen.symbol}`;
}
export function formatDuration(totalSeconds) {
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
  if (sec && !d) parts.push(`${sec} 秒`);
  return parts.join(' ');
}
// speedUnit: 'Mbps'|'Gbps'|'KB/s'|'MB/s'|'GB/s' （带宽按 SI，速率字节按 SI 1000 计算并注明）
export function estimateTransfer(bytes, speedValue, speedUnit = 'Mbps') {
  const v = Number(speedValue);
  if (!Number.isFinite(v) || v <= 0) return { ok: false, error: '网速应为大于 0 的数字' };
  let bytesPerSec;
  if (speedUnit === 'Mbps') bytesPerSec = (v * 1e6) / 8;
  else if (speedUnit === 'Gbps') bytesPerSec = (v * 1e9) / 8;
  else if (speedUnit === 'Kbps') bytesPerSec = (v * 1e3) / 8;
  else if (speedUnit === 'KB/s') bytesPerSec = v * 1e3;
  else if (speedUnit === 'MB/s') bytesPerSec = v * 1e6;
  else if (speedUnit === 'GB/s') bytesPerSec = v * 1e9;
  else return { ok: false, error: `未知网速单位「${speedUnit}」` };
  const seconds = bytesPerSec === 0 ? Infinity : bytes / bytesPerSec;
  return { ok: true, bytesPerSec, seconds, text: formatDuration(seconds) };
}
export function buildDataSizeSummary(parsed, rows) {
  if (!parsed) return '';
  const get = (sym) => rows.find((r) => r.symbol === sym);
  return `${formatValue(parsed.value)} ${parsed.unit} = ${get('B').text} B = ${get('MB').text} MB = ${get('MiB').text} MiB = ${get('GB').text} GB = ${get('GiB').text} GiB（人读约 ${humanSize(parsed.bytes)}）`;
}
