// 时区转换：纯本地，基于 Intl.DateTimeFormat 的 IANA 时区数据（含夏令时规则）。
// 核心思路：某时区在某时刻的 UTC 偏移 = 该时刻在该时区显示的墙上时间 − 该时刻的 UTC 时间；
// 「墙上时间 + 时区 → 瞬间」用偏移迭代两轮收敛（夏令时切换点附近取收敛结果）。

export const TIMEZONES = [
  { id: 'UTC', label: '协调世界时 UTC' },
  { id: 'Asia/Shanghai', label: '北京/上海 (中国)' },
  { id: 'Asia/Tokyo', label: '东京 (日本)' },
  { id: 'Asia/Singapore', label: '新加坡' },
  { id: 'Asia/Bangkok', label: '曼谷 (泰国)' },
  { id: 'Asia/Kolkata', label: '加尔各答 (印度)' },
  { id: 'Asia/Dubai', label: '迪拜 (阿联酋)' },
  { id: 'Europe/Moscow', label: '莫斯科 (俄罗斯)' },
  { id: 'Europe/Paris', label: '巴黎/柏林 (中欧)' },
  { id: 'Europe/London', label: '伦敦 (英国)' },
  { id: 'America/Sao_Paulo', label: '圣保罗 (巴西)' },
  { id: 'America/New_York', label: '纽约 (美东)' },
  { id: 'America/Chicago', label: '芝加哥 (美中)' },
  { id: 'America/Denver', label: '丹佛 (美山地)' },
  { id: 'America/Los_Angeles', label: '洛杉矶 (美西)' },
  { id: 'Australia/Sydney', label: '悉尼 (澳大利亚)' },
  { id: 'Pacific/Auckland', label: '奥克兰 (新西兰)' },
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const dtfCache = new Map();

function getDtf(timeZone) {
  if (!dtfCache.has(timeZone)) {
    dtfCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return dtfCache.get(timeZone);
}

export function isValidTimeZone(timeZone) {
  try { getDtf(String(timeZone)); return true; } catch { return false; }
}

function partsInZone(date, timeZone) {
  const parts = {};
  for (const p of getDtf(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

/** 某瞬间在某时区的 UTC 偏移（分钟），如上海 +480、纽约冬 -300 */
export function getOffsetMinutes(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wallAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const pad = (n) => String(n).padStart(2, '0');

/** 把瞬间格式化为某时区的墙上时间信息 */
export function formatInZone(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const weekday = WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
  const offsetMinutes = getOffsetMinutes(date, timeZone);
  return {
    timeZone,
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
    dateTime: `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
    weekday,
    offsetMinutes,
    offset: formatOffset(offsetMinutes),
  };
}

/** 墙上时间字符串（YYYY-MM-DD HH:mm[:ss]）+ 时区 → 瞬间（Date） */
export function parseInZone(input, timeZone) {
  const raw = String(input ?? '').trim().replace('T', ' ');
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return { ok: false, error: '时间格式应为 YYYY-MM-DD HH:mm，如 2026-11-27 09:30' };
  const [, ys, mos, ds, hs = '0', mis, ss = '0'] = m;
  const y = Number(ys); const mo = Number(mos); const d = Number(ds);
  const h = Number(hs); const mi = Number(mis); const s = Number(ss);
  if (mo < 1 || mo > 12) return { ok: false, error: `月份 ${mo} 不合法，应为 1–12` };
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) return { ok: false, error: `${y}-${pad(mo)} 只有 ${daysInMonth} 天，日期 ${d} 不合法` };
  if (h > 23) return { ok: false, error: `小时 ${h} 不合法，应为 0–23` };
  if (mi > 59) return { ok: false, error: `分钟 ${mi} 不合法，应为 0–59` };
  if (s > 59) return { ok: false, error: `秒 ${s} 不合法，应为 0–59` };
  if (!isValidTimeZone(timeZone)) return { ok: false, error: `未知时区：${timeZone}` };
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  let instant = wallAsUtc;
  for (let i = 0; i < 3; i++) {
    const next = wallAsUtc - getOffsetMinutes(new Date(instant), timeZone) * 60000;
    if (next === instant) break;
    instant = next;
  }
  return { ok: true, date: new Date(instant) };
}

/** 主入口：源时间 + 源时区 → 各目标时区对照行 */
export function convertTime(input, fromZone, zones = TIMEZONES.map((z) => z.id)) {
  const parsed = parseInZone(input, fromZone);
  if (!parsed.ok) return parsed;
  const instant = parsed.date;
  const source = formatInZone(instant, fromZone);
  const rows = zones.map((z) => {
    const row = formatInZone(instant, z.id ?? z);
    const label = (TIMEZONES.find((t) => t.id === row.timeZone) || {}).label || row.timeZone;
    const dayDiff = Math.round((Date.parse(row.date) - Date.parse(source.date)) / 86400000);
    return { ...row, label, dayDiff, diffHours: (row.offsetMinutes - source.offsetMinutes) / 60 };
  });
  return { ok: true, instant, iso: instant.toISOString(), source, rows };
}

export function formatDiffHours(diff) {
  if (diff === 0) return '同时区';
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  return `${sign}${Number.isInteger(abs) ? abs : abs.toFixed(1)} 小时`;
}
