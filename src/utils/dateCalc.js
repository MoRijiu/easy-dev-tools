// 日期计算：纯本地，按本地日历日计算（忽略时分秒与夏令时细节，以 UTC 日序数做差）
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MIN_YEAR = 1;
const MAX_YEAR = 9999;
// Date.UTC 对 0–99 年会映射到 1900–1999，必须用 setUTCFullYear 构造小年份日期
function makeUTC(y, m, d) { const t = new Date(0); t.setUTCFullYear(y, m - 1, d); t.setUTCHours(0, 0, 0, 0); return t; }
export function parseDateInput(str) {
  if (str === null || str === undefined || !String(str).trim()) throw new Error('请选择或输入日期');
  const s = String(str).trim();
  if ([...s].length > 32) throw new Error('日期输入过长，请使用 YYYY-MM-DD 格式');
  let y, mo, d;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else throw new Error('日期格式应为 YYYY-MM-DD（也支持 YYYY/MM/DD、YYYYMMDD、YYYY年M月D日）');
  if (y < MIN_YEAR || y > MAX_YEAR) throw new Error(`年份应在 ${MIN_YEAR}-${MAX_YEAR} 之间`);
  if (mo < 1 || mo > 12) throw new Error(`月份应在 1-12 之间（收到 ${mo}）`);
  const dim = daysInMonth(y, mo);
  if (d < 1 || d > dim) throw new Error(`${y} 年 ${mo} 月只有 ${dim} 天（收到 ${d} 日）`);
  return { y, m: mo, d };
}
function daysInMonth(y, m) { return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function ordinal({ y, m, d }) { return makeUTC(y, m, d).getTime() / 86400000; }
function fromOrdinal(n) { const t = new Date(n * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
function formatDateObj(o) { return `${String(o.y).padStart(4, '0')}-${String(o.m).padStart(2, '0')}-${String(o.d).padStart(2, '0')}`; }
function weekdayOf(o) { return WEEKDAYS[makeUTC(o.y, o.m, o.d).getUTCDay()]; }
function isoWeek(o) {
  const date = makeUTC(o.y, o.m, o.d);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = makeUTC(date.getUTCFullYear(), 1, 1);
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
  const addMonthsClamped = (o, addM) => { let y = o.y, m = o.m + addM; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return { y, m, d: Math.min(o.d, daysInMonth(y, m)) }; };
  let years = 0; while (ordinal(addMonthsClamped(from, (years + 1) * 12)) <= ordinal(to)) years++;
  let months = 0; while (ordinal(addMonthsClamped(from, years * 12 + months + 1)) <= ordinal(to)) months++;
  const days = ordinal(to) - ordinal(addMonthsClamped(from, years * 12 + months));
  let workdays = 0, weekends = 0;
  for (let n = ordinal(from); n < ordinal(to); n++) { const wd = new Date(n * 86400000).getUTCDay(); if (wd === 0 || wd === 6) weekends++; else workdays++; }
  return { from: formatDateObj(from), to: formatDateObj(to), reversed, totalDays, inclusiveDays: totalDays + 1, weeks: Math.floor(totalDays / 7), remainderDays: totalDays % 7, years, months, days, workdays, weekends, breakdownText: [years ? `${years} 年` : '', months ? `${months} 个月` : '', days ? `${days} 天` : ''].filter(Boolean).join(' ') || '同一天' };
}
const AMOUNT_LIMITS = { days: 3652059, weeks: 521722, months: 119988, years: 9999 };
export function addToDate(baseStr, amount, unit) {
  const base = parseDateInput(baseStr);
  if (amount === null || amount === undefined || (typeof amount === 'string' && !amount.trim())) throw new Error('数量不能为空');
  const amt = typeof amount === 'string' ? Number(amount.trim()) : Number(amount);
  if (!Number.isFinite(amt) || !Number.isInteger(amt)) throw new Error('数量应为整数');
  if (!Object.prototype.hasOwnProperty.call(AMOUNT_LIMITS, unit)) throw new Error('未知单位');
  if (Math.abs(amt) > AMOUNT_LIMITS[unit]) throw new Error(`数量超出可计算范围（${unit === 'days' ? '天' : unit === 'weeks' ? '周' : unit === 'months' ? '月' : '年'}最多 ±${AMOUNT_LIMITS[unit].toLocaleString('en-US')}）`);
  let result;
  if (unit === 'days') result = fromOrdinal(ordinal(base) + amt);
  else if (unit === 'weeks') result = fromOrdinal(ordinal(base) + amt * 7);
  else {
    const addM = unit === 'years' ? amt * 12 : amt;
    let y = base.y, m = base.m + addM;
    y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
    result = { y, m, d: Math.min(base.d, daysInMonth(y, m)) };
  }
  if (!Number.isFinite(result.y) || result.y < MIN_YEAR || result.y > MAX_YEAR) throw new Error('结果日期超出可表示范围（0001-01-01 至 9999-12-31），请减小数量');
  const info = dateInfo(result);
  const delta = ordinal(result) - ordinal(base);
  return { ...info, deltaDays: delta };
}
function formatCount(n) { return Number(n).toLocaleString('en-US'); }
export function buildDiffSummary(r) { return `${r.from} 到 ${r.to}：相隔 ${formatCount(r.totalDays)} 天（${r.breakdownText}），含首尾 ${formatCount(r.inclusiveDays)} 天，工作日 ${formatCount(r.workdays)} 天、周末 ${formatCount(r.weekends)} 天`; }
