// 时区转换：纯本地，基于 Intl.DateTimeFormat 的 IANA 时区数据（含夏令时规则）。
// 核心思路：某时区在某时刻的 UTC 偏移 = 该时刻在该时区显示的墙上时间 − 该时刻的 UTC 时间；
// 「墙上时间 + 时区 → 瞬间」用候选偏移逐个回算校验：两个候选都对得上 = 夏令时重复时刻（取第一次并提示），
// 都对不上 = 夏令时跳变里不存在的时刻（点名报错并给出跳变前后时刻），不再静默算出别的时间。

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

const MAX_TIME_INPUT_LENGTH = 256;

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

function isValidTimeZone(timeZone) {
  try { getDtf(String(timeZone)); return true; } catch { return false; }
}

/** 按真实年份构造 UTC 毫秒（Date.UTC 会把 0–99 年映射到 1900–1999，必须绕开） */
function utcMs(year, monthIndex, day, hour = 0, minute = 0, second = 0) {
  const dt = new Date(0);
  dt.setUTCFullYear(year, monthIndex, day);
  dt.setUTCHours(hour, minute, second, 0);
  return dt.getTime();
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
function getOffsetMinutes(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const wallAsUtc = utcMs(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wallAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const pad = (n) => String(n).padStart(2, '0');
const padYear = (y) => String(y).padStart(4, '0');

/** 把瞬间格式化为某时区的墙上时间信息 */
function formatInZone(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const weekday = WEEKDAYS[new Date(utcMs(p.year, p.month - 1, p.day)).getUTCDay()];
  const offsetMinutes = getOffsetMinutes(date, timeZone);
  return {
    timeZone,
    date: `${padYear(p.year)}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
    dateTime: `${padYear(p.year)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
    weekday,
    offsetMinutes,
    offset: formatOffset(offsetMinutes),
  };
}

/** 全角转半角（数字/字母/标点/冒号/空格），返回是否发生转换 */
function normalizeTimezoneInput(input) {
  const raw = String(input ?? '');
  let changed = false;
  const text = raw.replace(/[！-～　]/g, (ch) => {
    changed = true;
    return ch === '　' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  });
  return { text, changed };
}

function daysInMonth(year, month) {
  return new Date(utcMs(year, month, 0)).getUTCDate();
}

/** 解析墙上时间各字段并逐项校验；dateOnly 时时间为 00:00:00 */
function parseWallParts(text) {
  const m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
    || text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!m) return { ok: false, error: '时间格式应为 YYYY-MM-DD HH:mm（也支持 2026/11/27、2026年11月27日 与 ISO 8601），如 2026-11-27 09:30' };
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const hasTime = m[4] !== undefined;
  const h = hasTime ? Number(m[4]) : 0;
  const mi = hasTime ? Number(m[5]) : 0;
  const s = m[6] !== undefined ? Number(m[6]) : 0;
  if (y < 1 || y > 9999) return { ok: false, error: `年份 ${m[1]} 不合法，应为 0001–9999` };
  if (mo < 1 || mo > 12) return { ok: false, error: `月份 ${mo} 不合法，应为 1–12` };
  const dim = daysInMonth(y, mo);
  if (d < 1 || d > dim) return { ok: false, error: `${y}-${pad(mo)} 只有 ${dim} 天，日期 ${d} 不合法` };
  if (h > 23) return { ok: false, error: `小时 ${h} 不合法，应为 0–23` };
  if (mi > 59) return { ok: false, error: `分钟 ${mi} 不合法，应为 0–59` };
  if (s > 59) return { ok: false, error: `秒 ${s} 不合法，应为 0–59` };
  return { ok: true, y, mo, d, h, mi, s, hasTime };
}

function sameWall(date, timeZone, wall) {
  const p = partsInZone(date, timeZone);
  return p.year === wall.y && p.month === wall.mo && p.day === wall.d
    && p.hour === wall.h && p.minute === wall.mi && p.second === wall.s;
}

/** 在 [lo, hi] 内二分定位偏移切换瞬间（秒级），返回切换后的第一个瞬间 */
function findTransition(loMs, hiMs, timeZone, newOffset) {
  let lo = Math.floor(loMs / 1000);
  let hi = Math.floor(hiMs / 1000);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (getOffsetMinutes(new Date(mid * 1000), timeZone) === newOffset) hi = mid;
    else lo = mid;
  }
  return hi * 1000;
}

/**
 * 墙上时间字符串 + 时区 → 瞬间（Date）。
 * 支持 YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日、只给日期（按 00:00 并提示）、
 * ISO 8601 带 Z 或 ±HH:mm 偏移（按偏移定瞬间并提示）、全角输入。
 * 夏令时不存在的时刻点名报错；重复出现的时刻取第一次并在 notes 里说明两次的偏移。
 */
function parseInZone(input, timeZone) {
  const rawInput = String(input ?? '');
  if (rawInput.length > MAX_TIME_INPUT_LENGTH) {
    return { ok: false, error: `输入过长（${rawInput.length} 字符），时间文本最多 ${MAX_TIME_INPUT_LENGTH} 字符` };
  }
  const { text: normalized, changed } = normalizeTimezoneInput(rawInput);
  const notes = [];
  if (changed) notes.push('已把全角字符转为半角后解析');
  let text = normalized.trim().replace('T', ' ');
  if (!isValidTimeZone(timeZone)) return { ok: false, error: `未知时区：${timeZone}` };

  // ISO 8601 偏移后缀：Z 或 ±HH:mm / ±HHmm，瞬间由偏移直接确定，与源时区无关
  const suffix = text.match(/^(.*?)\s*([zZ]|[+-]\d{2}:?\d{2})$/);
  if (suffix && /\d/.test(suffix[1]) && suffix[1].includes(':')) {
    const wall = parseWallParts(suffix[1].trim());
    if (!wall.ok) return wall;
    let offsetMinutes = 0;
    if (suffix[2] !== 'Z' && suffix[2] !== 'z') {
      const sign = suffix[2].startsWith('-') ? -1 : 1;
      const digits = suffix[2].slice(1).replace(':', '');
      const oh = Number(digits.slice(0, 2)); const om = Number(digits.slice(2, 4));
      if (oh > 14 || om > 59 || (oh === 14 && om > 0)) {
        return { ok: false, error: `UTC 偏移 ${suffix[2]} 不合法，应在 -14:00 到 +14:00 之间` };
      }
      offsetMinutes = sign * (oh * 60 + om);
    }
    const instant = utcMs(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s) - offsetMinutes * 60000;
    notes.push(`输入自带 UTC 偏移（${suffix[2].toUpperCase() === 'Z' ? 'Z' : suffix[2]}），已按该偏移确定瞬间；下方对照按所选源时区显示同一时刻`);
    if (!wall.hasTime) notes.push('未填写时间，已按 00:00 处理');
    return { ok: true, date: new Date(instant), notes };
  }

  const wall = parseWallParts(text);
  if (!wall.ok) return wall;
  if (!wall.hasTime) notes.push('未填写时间，已按 00:00 处理');
  const wallAsUtc = utcMs(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s);

  // 候选偏移：以墙上时间（当 UTC 看）为中心 ±48 小时多点采样，再按各候选瞬间复核一轮，
  // 覆盖夏令时切换点两侧的偏移（重复时刻的第二次出现可能在数小时之后）
  const sampleHours = [-48, -24, -12, -6, 0, 6, 12, 24, 48];
  const candidateOffsets = [];
  const pushOffset = (o) => { if (!candidateOffsets.includes(o)) candidateOffsets.push(o); };
  for (const dh of sampleHours) pushOffset(getOffsetMinutes(new Date(wallAsUtc + dh * 3600000), timeZone));
  for (const o of [...candidateOffsets]) {
    pushOffset(getOffsetMinutes(new Date(wallAsUtc - o * 60000), timeZone));
  }

  const matches = [];
  for (const o of candidateOffsets) {
    const t = wallAsUtc - o * 60000;
    if (sameWall(new Date(t), timeZone, wall) && !matches.includes(t)) matches.push(t);
  }
  matches.sort((a, b) => a - b);

  const wallText = `${padYear(wall.y)}-${pad(wall.mo)}-${pad(wall.d)} ${pad(wall.h)}:${pad(wall.mi)}:${pad(wall.s)}`;
  if (matches.length === 0) {
    // 不存在的时刻：在采样点里找偏移发生变化的一对相邻点，二分定位跳变瞬间
    let lo = null; let hi = null; let offHi = null;
    for (let i = 1; i < sampleHours.length; i++) {
      const a = wallAsUtc + sampleHours[i - 1] * 3600000;
      const b = wallAsUtc + sampleHours[i] * 3600000;
      const oa = getOffsetMinutes(new Date(a), timeZone);
      const ob = getOffsetMinutes(new Date(b), timeZone);
      if (oa !== ob) { lo = a; hi = b; offHi = ob; break; }
    }
    if (lo === null) return { ok: false, error: `${wallText} 在 ${timeZone} 无法换算，请检查输入` };
    const transition = findTransition(lo, hi, timeZone, offHi);
    const before = formatInZone(new Date(transition - 1000), timeZone);
    const after = formatInZone(new Date(transition), timeZone);
    return {
      ok: false,
      error: `${wallText} 在 ${timeZone} 不存在：当天时钟从 ${before.time} 直接跳到 ${after.time}（夏令时开始），这段时间被跳过了，请改用跳变前后的时间`,
    };
  }
  if (matches.length > 1) {
    const first = formatOffset(getOffsetMinutes(new Date(matches[0]), timeZone));
    const second = formatOffset(getOffsetMinutes(new Date(matches[matches.length - 1]), timeZone));
    notes.push(`该时间当天出现两次（夏令时结束、时钟回拨），已按第一次出现（${first}）计算；第二次为 ${second}`);
  }
  return { ok: true, date: new Date(matches[0]), notes };
}

function dayNumber(dateText) {
  const [y, mo, d] = dateText.split('-').map(Number);
  return Math.round(utcMs(y, mo - 1, d) / 86400000);
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
    const dayDiff = dayNumber(row.date) - dayNumber(source.date);
    return { ...row, label, dayDiff, diffHours: (row.offsetMinutes - source.offsetMinutes) / 60 };
  });
  return { ok: true, instant, iso: instant.toISOString(), source, rows, notes: parsed.notes || [] };
}

/** 时差格式化：按小时+分钟精确表达（4 分之 3 小时等分数偏移不再四舍五入成小数） */
export function formatDiffHours(diff) {
  const totalMinutes = Math.round(diff * 60);
  if (totalMinutes === 0) return '同时区';
  const sign = totalMinutes > 0 ? '+' : '−';
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${sign}${minutes} 分钟`;
  if (minutes === 0) return `${sign}${hours} 小时`;
  return `${sign}${hours} 小时 ${minutes} 分钟`;
}
