// 时间戳转换核心逻辑：纯本地处理。
// 补齐旧版短板：秒/毫秒/微秒三档 + 按位数自动识别、整数逐字校验（不再 parseInt 静默截断小数）、
// 负时间戳（1970 年前）、严格日期文本校验（月/日/闰年/时分秒越界定位）、
// 带毫秒本地时间、星期/今年第几天、更细的相对时间。

const MAX_DATE_MS = 8640000000000000; // ECMAScript Date 可表示范围

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

// 按位数猜单位：<=10 位秒、11-13 毫秒、14-16 微秒、17+ 纳秒（超出支持范围）
function detectUnitByDigits(digits) {
  if (digits <= 10) return 's';
  if (digits <= 13) return 'ms';
  if (digits <= 16) return 'us';
  return null;
}

// 解析时间戳输入。unit: 's'|'ms'|'us'|'auto'
// 成功 { ok:true, ms, unit, unitLabel, digits }；ms 可能带小数（微秒的亚毫秒部分单独给 usRemainder）
// 失败 { ok:false, error:{message, position?} }
export function parseTimestampInput(input, unit = 'auto') {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: { message: '输入为空，请输入时间戳' } };
  // 逐字校验：只允许可选负号 + 数字
  const m = /^(-?)(\d+)$/.exec(raw);
  if (!m) {
    if (raw.includes('.')) return { ok: false, error: { message: '时间戳应为整数：检测到小数点，请确认单位（秒级带小数请先换算成毫秒）' } };
    const bad = raw.search(/[^0-9-]/);
    if (bad >= 0) return { ok: false, error: { message: `第 ${bad + 1} 个字符「${raw[bad]}」不是数字，时间戳只能包含数字与开头的负号`, position: bad } };
    return { ok: false, error: { message: '时间戳格式不正确，应为整数（可带负号表示 1970 年之前）' } };
  }
  const negative = m[1] === '-';
  const digitsStr = m[2].replace(/^0+(?=\d)/, '');
  const digits = digitsStr.length;
  let useUnit = unit;
  if (unit === 'auto') {
    useUnit = detectUnitByDigits(digits);
    if (!useUnit) return { ok: false, error: { message: `共 ${digits} 位，疑似纳秒级时间戳：本工具支持到微秒（16 位），纳秒请先除以 1000 转成微秒` } };
  }
  let value = BigInt((negative ? '-' : '') + digitsStr);
  let msBig;
  let usRemainder = 0;
  if (useUnit === 's') msBig = value * 1000n;
  else if (useUnit === 'ms') msBig = value;
  else { // us
    msBig = value / 1000n; // BigInt 向零截断，负数需修正余数方向
    const rem = value % 1000n;
    usRemainder = Number(rem); // -999..999，表示亚毫秒的微秒余数
    if (rem !== 0n && value < 0n) { /* msBig 已向零截断，与 rem 组合即原值 */ }
  }
  if (msBig > BigInt(MAX_DATE_MS) || msBig < BigInt(-MAX_DATE_MS)) {
    return { ok: false, error: { message: '时间戳超出可表示范围（约公元前 271821 年至公元 275760 年），请检查位数与单位是否选对' } };
  }
  const ms = Number(msBig);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return { ok: false, error: { message: '无效的时间戳' } };
  const unitLabel = useUnit === 's' ? '秒' : useUnit === 'ms' ? '毫秒' : '微秒';
  return { ok: true, ms, date, unit: useUnit, unitLabel, digits, usRemainder, auto: unit === 'auto' };
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

export function formatLocal(date, withMs = false) {
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return withMs ? `${base}.${pad(date.getMilliseconds(), 3)}` : base;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const cur = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((cur - start) / 86400000) + 1;
}

function relativeTime(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  if (abs < 1000) return '刚刚';
  const sec = Math.floor(abs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  let str;
  if (day >= 365) { const y = Math.floor(day / 365); const rest = Math.floor((day % 365) / 30); str = rest ? `${y} 年 ${rest} 个月` : `${y} 年`; }
  else if (day >= 30) { const mo = Math.floor(day / 30); const rest = day % 30; str = rest ? `${mo} 个月 ${rest} 天` : `${mo} 个月`; }
  else if (day >= 1) { const rest = hr % 24; str = rest ? `${day} 天 ${rest} 小时` : `${day} 天`; }
  else if (hr >= 1) { const rest = min % 60; str = rest ? `${hr} 小时 ${rest} 分钟` : `${hr} 小时`; }
  else if (min >= 1) { const rest = sec % 60; str = rest ? `${min} 分钟 ${rest} 秒` : `${min} 分钟`; }
  else str = `${sec} 秒`;
  return diff < 0 ? `${str}前` : `${str}后`;
}

// 把解析成功的时间点整理成展示行。nowMs 可注入便于测试。
export function buildResult(ms, nowMs = Date.now(), usRemainder = 0) {
  const date = new Date(ms);
  const us = BigInt(ms) * 1000n + BigInt(usRemainder);
  return {
    timestampS: Math.floor(ms / 1000),
    timestampMs: ms,
    timestampUs: us.toString(),
    localTime: formatLocal(date),
    localTimeMs: formatLocal(date, true),
    utcTime: date.toUTCString(),
    isoTime: date.toISOString(),
    weekday: WEEKDAYS[date.getDay()],
    dayOfYear: dayOfYear(date),
    relativeTime: relativeTime(ms, nowMs),
    date
  };
}

function daysInMonth(y, mo) { // mo 1-12
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
}

// 严格解析日期文本（本地时区）：YYYY-MM-DD[ T]HH:mm[:ss[.fff]]，也接受 datetime-local 的格式。
// 成功 { ok:true, ms, date }；失败定位到字段报错，不让 Date 静默滚动到下个月。
export function parseDateText(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: { message: '输入为空，请输入日期时间' } };
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/.exec(raw);
  if (!m) return { ok: false, error: { message: '日期格式不正确，请用 YYYY-MM-DD HH:mm:ss（如 2024-12-05 08:30:00），或用下方日期选择器' } };
  const y = +m[1], mo = +m[2], d = +m[3];
  const hh = m[4] === undefined ? 0 : +m[4], mi = m[5] === undefined ? 0 : +m[5], ss = m[6] === undefined ? 0 : +m[6];
  const fff = m[7] === undefined ? 0 : +m[7].padEnd(3, '0');
  if (mo < 1 || mo > 12) return { ok: false, error: { message: `月份 ${mo} 不合法，应在 1–12 之间` } };
  const dim = daysInMonth(y, mo);
  if (d < 1 || d > dim) return { ok: false, error: { message: `${y} 年 ${mo} 月只有 ${dim} 天，日期 ${d} 不合法` } };
  if (hh > 23) return { ok: false, error: { message: `小时 ${hh} 不合法，应在 0–23 之间` } };
  if (mi > 59) return { ok: false, error: { message: `分钟 ${mi} 不合法，应在 0–59 之间` } };
  if (ss > 59) return { ok: false, error: { message: `秒 ${ss} 不合法，应在 0–59 之间` } };
  const date = new Date(y, mo - 1, d, hh, mi, ss, fff);
  return { ok: true, ms: date.getTime(), date };
}
