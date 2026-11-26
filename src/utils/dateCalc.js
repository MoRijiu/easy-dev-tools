// 日期计算：纯本地，按本地日历日计算（忽略时分秒与夏令时细节，以 UTC 日序数做差）
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function parseDateInput(str) {
  if (!str || !String(str).trim()) throw new Error('请选择或输入日期');
  const m = String(str).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error('日期格式应为 YYYY-MM-DD');
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12) throw new Error('月份应在 1-12 之间');
  const dim = daysInMonth(y, mo);
  if (d < 1 || d > dim) throw new Error(`${y} 年 ${mo} 月只有 ${dim} 天`);
  return { y, m: mo, d };
}
export function daysInMonth(y, m) { return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
export function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function ordinal({ y, m, d }) { return Date.UTC(y, m - 1, d) / 86400000; }
function fromOrdinal(n) { const t = new Date(n * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
export function formatDateObj(o) { return `${o.y}-${String(o.m).padStart(2, '0')}-${String(o.d).padStart(2, '0')}`; }
export function weekdayOf(o) { return WEEKDAYS[new Date(Date.UTC(o.y, o.m - 1, o.d)).getUTCDay()]; }
export function isoWeek(o) {
  const date = new Date(Date.UTC(o.y, o.m - 1, o.d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { year: date.getUTCFullYear(), week: Math.ceil((((date - yearStart) / 86400000) + 1) / 7) };
}
export function dateInfo(o) {
  const diy = isLeapYear(o.y) ? 366 : 365;
  const doy = ordinal(o) - ordinal({ y: o.y, m: 1, d: 1 }) + 1;
  const w = isoWeek(o);
  return { date: formatDateObj(o), weekday: weekdayOf(o), isoYear: w.year, isoWeek: w.week, dayOfYear: doy, daysInYear: diy, daysLeftInYear: diy - doy, isLeap: isLeapYear(o.y), quarter: Math.ceil(o.m / 3) };
}
export function diffDates(aStr, bStr) {
  const a = parseDateInput(aStr), b = parseDateInput(bStr);
  let from = a, to = b, reversed = false;
  if (ordinal(b) < ordinal(a)) { from = b; to = a; reversed = true; }
  const totalDays = ordinal(to) - ordinal(from);
  // 日历分解：从 from 逐年/逐月推进（月末收敛），剩余为天数
  const addMonthsClamped = (o, addM) => { let y = o.y, m = o.m + addM; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return { y, m, d: Math.min(o.d, daysInMonth(y, m)) }; };
  let years = 0; while (ordinal(addMonthsClamped(from, (years + 1) * 12)) <= ordinal(to)) years++;
  let months = 0; while (ordinal(addMonthsClamped(from, years * 12 + months + 1)) <= ordinal(to)) months++;
  const days = ordinal(to) - ordinal(addMonthsClamped(from, years * 12 + months));
  let workdays = 0, weekends = 0;
  for (let n = ordinal(from); n < ordinal(to); n++) { const wd = new Date(n * 86400000).getUTCDay(); if (wd === 0 || wd === 6) weekends++; else workdays++; }
  return { from: formatDateObj(from), to: formatDateObj(to), reversed, totalDays, inclusiveDays: totalDays + 1, weeks: Math.floor(totalDays / 7), remainderDays: totalDays % 7, years, months, days, workdays, weekends, breakdownText: [years ? `${years} 年` : '', months ? `${months} 个月` : '', days ? `${days} 天` : ''].filter(Boolean).join(' ') || '同一天' };
}
export function addToDate(baseStr, amount, unit) {
  const base = parseDateInput(baseStr);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || !Number.isInteger(amt)) throw new Error('数量应为整数');
  let result;
  if (unit === 'days') result = fromOrdinal(ordinal(base) + amt);
  else if (unit === 'weeks') result = fromOrdinal(ordinal(base) + amt * 7);
  else if (unit === 'months' || unit === 'years') {
    const addM = unit === 'years' ? amt * 12 : amt;
    let y = base.y, m = base.m + addM;
    y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
    result = { y, m, d: Math.min(base.d, daysInMonth(y, m)) };
  } else throw new Error('未知单位');
  const info = dateInfo(result);
  const delta = ordinal(result) - ordinal(base);
  return { ...info, deltaDays: delta };
}
export function buildDiffSummary(r) { return `${r.from} 到 ${r.to}：相隔 ${r.totalDays} 天（${r.breakdownText}），含首尾 ${r.inclusiveDays} 天，工作日 ${r.workdays} 天、周末 ${r.weekends} 天`; }
