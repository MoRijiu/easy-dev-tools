// Cron 表达式解析（纯本地）：支持 5 字段（分 时 日 月 周）、
// 6 字段（秒 分 时 日 月 周）、7 字段（秒 分 时 日 月 周 年，Quartz 风格）
// 以及 @daily 等预定义别名。

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
  if (!/^\d+$/.test(token)) throw new Error(`无法识别的值「${token}」`);
  return parseInt(token, 10);
};

// 解析单个字段，返回 { values: number[]（升序去重）, isWildcard }
const parseField = (raw, def) => {
  const values = new Set();
  const parts = raw.split(',');
  for (const part of parts) {
    if (!part) throw new Error('存在空的字段片段');
    const [base, stepRaw, ...rest] = part.split('/');
    if (rest.length) throw new Error(`片段「${part}」格式不正确`);
    let step = 1;
    if (stepRaw !== undefined) {
      if (!/^\d+$/.test(stepRaw) || parseInt(stepRaw, 10) < 1) throw new Error(`步长「${stepRaw}」必须是正整数`);
      step = parseInt(stepRaw, 10);
    }
    let start;
    let end;
    if (base === '*') {
      start = def.min;
      end = def.max;
    } else if (base.includes('-')) {
      const [a, b] = base.split('-');
      start = resolveToken(a, def);
      end = resolveToken(b, def);
      if (end < start) throw new Error(`范围「${base}」结束值小于开始值`);
    } else {
      start = resolveToken(base, def);
      end = stepRaw !== undefined ? def.max : start;
    }
    if (start < def.min || end > def.max) {
      throw new Error(`值超出范围（${def.label}允许 ${def.min}–${def.max}）`);
    }
    for (let v = start; v <= end; v += step) values.add(def.key === 'dow' && v === 7 ? 0 : v);
  }
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

export const parseCron = (expr) => {
  const trimmed = (expr || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new Error('请输入 Cron 表达式');
  const expanded = CRON_ALIASES[trimmed.toLowerCase()] || trimmed;
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
  return {
    expression: expanded,
    hasSeconds: keys[0] === 'second',
    fields,
    byKey: Object.fromEntries(fields.map(f => [f.key, f]))
  };
};

const dayMatches = (parsed, date) => {
  const { dom, dow } = parsed.byKey;
  const domHit = dom.values.includes(date.getDate());
  const dowHit = dow.values.includes(date.getDay());
  if (!dom.isWildcard && !dow.isWildcard) return domHit || dowHit; // 标准 Cron：日与星期同时限定时取或
  return domHit && dowHit;
};

export const nextRuns = (parsed, from = new Date(), count = 8) => {
  const results = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1); // 从下一分钟开始
  const maxMinutes = 366 * 24 * 60 * 2; // 最多往后找约 2 年
  const secondValues = parsed.hasSeconds ? parsed.byKey.second.values : [0];
  for (let i = 0; i < maxMinutes && results.length < count; i++) {
    const d = new Date(cursor.getTime() + i * 60000);
    if (!parsed.byKey.minute.values.includes(d.getMinutes())) continue;
    if (!parsed.byKey.hour.values.includes(d.getHours())) continue;
    if (!parsed.byKey.month.values.includes(d.getMonth() + 1)) continue;
    if (parsed.byKey.year && !parsed.byKey.year.values.includes(d.getFullYear())) continue;
    if (!dayMatches(parsed, d)) continue;
    for (const sec of secondValues) {
      const t = new Date(d);
      t.setSeconds(sec, 0);
      if (t > from) results.push(t);
      if (results.length >= count) break;
    }
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
  else if (stepMatch) time = `每 ${stepMatch[1]} 分钟`;
  else if (minute.values.length === 1 && hour.isWildcard) time = `每小时的第 ${minute.values[0]} 分钟`;
  else if (minute.isWildcard && hour.values.length === 1) time = `${hour.values[0]} 点期间的每分钟`;
  else if (minute.values.length === 1 && hour.values.length === 1) time = `${hour.values[0]}:${pad(minute.values[0])}`;
  else time = `在 ${hour.raw} 时的 ${minute.raw} 分`;
  let day = '';
  if (!dow.isWildcard) day = `，每周${dow.values.map(v => WEEK_LABELS[v]).join('、')}`;
  else if (!dom.isWildcard) day = dom.values.length === 1 ? `，每月 ${dom.values[0]} 号` : `，每月 ${compressValues(dom.values)} 号`;
  let mon = '';
  if (!month.isWildcard) mon = `，仅 ${month.values.join('、')} 月`;
  const sec = second && !second.isWildcard ? `，第 ${compressValues(second.values)} 秒` : '';
  return `${time}${day}${mon}${sec} 执行`;
};
