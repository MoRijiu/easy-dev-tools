// Cron 表达式解析（纯本地）：支持 5 字段（分 时 日 月 周）、
// 6 字段（秒 分 时 日 月 周）、7 字段（秒 分 时 日 月 周 年，Quartz 风格的年份字段）
// 以及 @daily 等预定义别名。
// 注意：Quartz 的 ? / L / W / # 等特殊符号不支持，遇到会明确报错而不是静默误解析。

const MONTH_NAMES = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const DOW_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export const CRON_ALIASES = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *'
};

const FIELD_DEFS = {
  second: { key: 'second', label: '秒', min: 0, max: 59 },
  minute: { key: 'minute', label: '分钟', min: 0, max: 59 },
  hour: { key: 'hour', label: '小时', min: 0, max: 23 },
  dom: { key: 'dom', label: '日', min: 1, max: 31 },
  month: { key: 'month', label: '月', min: 1, max: 12, names: MONTH_NAMES },
  dow: { key: 'dow', label: '星期', min: 0, max: 7, names: DOW_NAMES },
  year: { key: 'year', label: '年', min: 1970, max: 2199 }
};

const resolveToken = (token, def) => {
  const upper = token.toUpperCase();
  if (def.names && upper in def.names) return def.names[upper];
  if (/[?#]/.test(token) || /[LW]/.test(upper)) {
    throw new Error(`包含 Quartz 特殊符号「${token}」，本工具不支持 ? / L / W / #，请改用标准写法（? 可用 * 代替）`);
  }
  if (!token) throw new Error('缺少数值');
  if (!/^\d+$/.test(token)) throw new Error(`无法识别的值「${token}」${def.names ? `（${def.label}可用英文缩写：${Object.keys(def.names).join('/')}）` : ''}`);
  return parseInt(token, 10);
};

// 解析单个字段，返回 { values: number[]（升序去重）, isWildcard }
const parseField = (raw, def) => {
  const values = new Set();
  const parts = raw.split(',');
  for (const part of parts) {
    if (!part) throw new Error('存在空的字段片段（多余的逗号？）');
    const [base, stepRaw, ...rest] = part.split('/');
    if (rest.length) throw new Error(`片段「${part}」格式不正确（步长只能出现一次）`);
    let step = 1;
    if (stepRaw !== undefined) {
      if (!/^\d+$/.test(stepRaw) || parseInt(stepRaw, 10) < 1) throw new Error(`步长「${stepRaw}」必须是正整数（不能为 0 或负数）`);
      step = parseInt(stepRaw, 10);
    }
    let start;
    let end;
    if (base === '*') {
      start = def.min;
      end = def.max;
    } else if (base.includes('-')) {
      const rangeParts = base.split('-');
      if (rangeParts.length !== 2) throw new Error(`范围「${base}」格式不正确（应为 起始-结束）`);
      const [a, b] = rangeParts;
      if (!a || !b) throw new Error(`范围「${base}」缺少${!a ? '起始' : '结束'}值`);
      start = resolveToken(a, def);
      end = resolveToken(b, def);
      if (end < start) throw new Error(`范围「${base}」结束值小于开始值`);
    } else {
      if (!base) throw new Error(`片段「${part}」缺少起始值`);
      start = resolveToken(base, def);
      end = stepRaw !== undefined ? def.max : start;
    }
    if (start < def.min || start > def.max || end < def.min || end > def.max) {
      const bad = start < def.min || start > def.max ? start : end;
      throw new Error(`值 ${bad} 超出范围（${def.label}允许 ${def.min}–${def.max}）`);
    }
    for (let v = start; v <= end; v += step) values.add(def.key === 'dow' && v === 7 ? 0 : v);
  }
  if (!values.size) throw new Error('没有解析出任何匹配值');
  const sorted = [...values].sort((a, b) => a - b);
  const fullSize = def.key === 'dow' ? 7 : def.max - def.min + 1;
  return { values: sorted, isWildcard: sorted.length >= fullSize };
};

// 把值列表压缩展示，如 [1,2,3,5] -> "1-3, 5"
export const compressValues = (values) => {
  if (!values.length) return '';
  const out = [];
  let runStart = values[0];
  let prev = values[0];
  const flush = () => { out.push(runStart === prev ? `${runStart}` : `${runStart}-${prev}`); };
  for (let i = 1; i < values.length; i++) {
    if (values[i] === prev + 1) { prev = values[i]; continue; }
    flush();
    runStart = prev = values[i];
  }
  flush();
  return out.join(', ');
};

// 2 月按 29 天算（闰年存在），用于判断某日号在所选月份里是否可能出现
const MONTH_MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// 解析成功后的语义警告：永不执行、部分月份跳过、仅闰年执行、年份已过等
export const cronWarnings = (parsed) => {
  const warnings = [];
  const { dom, month, year } = parsed.byKey;
  const possible = month.values.some(m => dom.values.some(d => d <= MONTH_MAX_DAY[m - 1]));
  if (!possible) {
    warnings.push(`永不执行：所选月份（${month.values.join('、')} 月）里不存在 ${compressValues(dom.values)} 日，请改小日号或增加月份`);
  } else {
    const skipped = month.values.filter(m => dom.values.some(d => d > MONTH_MAX_DAY[m - 1]));
    if (!month.isWildcard && skipped.length) {
      warnings.push(`${skipped.join('、')} 月没有 ${compressValues(dom.values.filter(d => skipped.some(m => d > MONTH_MAX_DAY[m - 1])))} 日，这些月份会跳过执行`);
    }
    if (month.values.length === 1 && month.values[0] === 2 && dom.values.includes(29) && !dom.values.some(d => d > 29)) {
      warnings.push('仅在闰年执行：2 月 29 日约每 4 年出现一次（逢百年且不能被 400 整除的年份没有，如 2100 年）');
    }
  }
  if (year) {
    const nowYear = new Date().getFullYear();
    if (year.values[year.values.length - 1] < nowYear) {
      warnings.push(`永不执行：年份 ${compressValues(year.values)} 已全部过去（当前 ${nowYear} 年）`);
    }
  }
  return warnings;
};

export const parseCron = (expr) => {
  const trimmed = (expr || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new Error('请输入 Cron 表达式');
  let expanded = trimmed;
  if (trimmed.startsWith('@')) {
    expanded = CRON_ALIASES[trimmed.toLowerCase()];
    if (!expanded) {
      throw new Error(`未知别名「${trimmed}」：支持 ${Object.keys(CRON_ALIASES).join('、')}（@reboot 等系统别名不支持）`);
    }
  }
  const parts = expanded.split(' ');
  let keys;
  if (parts.length === 5) keys = ['minute', 'hour', 'dom', 'month', 'dow'];
  else if (parts.length === 6) keys = ['second', 'minute', 'hour', 'dom', 'month', 'dow'];
  else if (parts.length === 7) keys = ['second', 'minute', 'hour', 'dom', 'month', 'dow', 'year'];
  else throw new Error(`字段数不正确：应为 5、6 或 7 个字段，当前 ${parts.length} 个`);
  const fields = keys.map((key, i) => {
    const def = FIELD_DEFS[key];
    try {
      const parsed = parseField(parts[i], def);
      return { ...def, raw: parts[i], ...parsed };
    } catch (e) {
      throw new Error(`第 ${i + 1} 个字段（${def.label}）「${parts[i]}」：${e.message}`);
    }
  });
  const result = {
    expression: expanded,
    hasSeconds: keys[0] === 'second',
    fields,
    byKey: Object.fromEntries(fields.map(f => [f.key, f]))
  };
  result.warnings = cronWarnings(result);
  return result;
};

const dayMatches = (parsed, date) => {
  const { dom, dow } = parsed.byKey;
  const domHit = dom.values.includes(date.getDate());
  const dowHit = dow.values.includes(date.getDay());
  if (!dom.isWildcard && !dow.isWildcard) return domHit || dowHit; // 标准 Cron：日与星期同时限定时取或
  return domHit && dowHit;
};

// 按天扫描 + 当天时刻组合生成：稀疏表达式（如 2 月 29 日、指定年份）也能快速算出，
// 不会像逐分钟扫描那样受约 2 年窗口限制而误报「无执行时间」。
export const nextRuns = (parsed, from = new Date(), count = 8) => {
  const results = [];
  const hours = parsed.byKey.hour.values;
  const minutes = parsed.byKey.minute.values;
  const seconds = parsed.hasSeconds ? parsed.byKey.second.values : [0];
  const yearField = parsed.byKey.year;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  // 无年份字段时最多找 8 年多一点：覆盖 2 月 29 日最长间隔（2096 → 2104，跨非闰百年）
  const limit = yearField
    ? new Date(yearField.values[yearField.values.length - 1], 11, 31)
    : new Date(from.getFullYear() + 8, from.getMonth(), from.getDate() + 2);
  while (day <= limit && results.length < count) {
    if (
      parsed.byKey.month.values.includes(day.getMonth() + 1) &&
      (!yearField || yearField.values.includes(day.getFullYear())) &&
      dayMatches(parsed, day)
    ) {
      outer:
      for (const h of hours) {
        for (const m of minutes) {
          for (const s of seconds) {
            const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, s);
            if (t > from) results.push(t);
            if (results.length >= count) break outer;
          }
        }
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return results;
};

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (n) => String(n).padStart(2, '0');

// 生成一句中文说明（启发式，精确值以字段表为准）
export const describeCron = (parsed) => {
  const { minute, hour, dom, month, dow } = parsed.byKey;
  const second = parsed.byKey.second;
  let time;
  const stepMatch = minute.raw.match(/^\*\/(\d+)$/);
  if (minute.isWildcard && hour.isWildcard) time = '每分钟';
  else if (stepMatch && hour.isWildcard) time = `每 ${stepMatch[1]} 分钟`;
  else if (stepMatch && hour.values.length === 1) time = `${hour.values[0]} 点内每 ${stepMatch[1]} 分钟`;
  else if (stepMatch) time = `在 ${compressValues(hour.values)} 点内每 ${stepMatch[1]} 分钟`;
  else if (minute.values.length === 1 && hour.isWildcard) time = `每小时的第 ${minute.values[0]} 分钟`;
  else if (minute.isWildcard && hour.values.length === 1) time = `${hour.values[0]} 点期间的每分钟`;
  else if (minute.values.length === 1 && hour.values.length === 1) time = `${hour.values[0]}:${pad(minute.values[0])}`;
  else time = `在 ${hour.raw} 时的 ${minute.raw} 分`;
  let day = '';
  if (!dow.isWildcard && !dom.isWildcard) day = `，每月 ${compressValues(dom.values)} 号或每周${dow.values.map(v => WEEK_LABELS[v]).join('、')}（任一命中即执行）`;
  else if (!dow.isWildcard) day = `，每周${dow.values.map(v => WEEK_LABELS[v]).join('、')}`;
  else if (!dom.isWildcard) day = dom.values.length === 1 ? `，每月 ${dom.values[0]} 号` : `，每月 ${compressValues(dom.values)} 号`;
  let mon = '';
  if (!month.isWildcard) mon = `，仅 ${month.values.join('、')} 月`;
  const sec = second && !second.isWildcard ? `，第 ${compressValues(second.values)} 秒` : '';
  return `${time}${day}${mon}${sec} 执行`;
};
