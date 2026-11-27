// SemVer 语义化版本：纯本地解析 / 比较 / 递增 / 范围校验（遵循 semver.org 2.0.0）
// 范围语法支持 npm 常用子集：^ ~ >= <= > < =、连字符区间、|| 并集、x/* 通配与 1.2 简写。

const NUM_ID = /^(0|[1-9]\d*)$/;
const ALNUM_ID = /^[0-9A-Za-z-]+$/;
const MAX_INPUT_LEN = 256;

// 全角数字/字母/点/加号/减号转半角（中文输入法粘贴常见），其余字符原样
export function normalizeSemverInput(input) {
  return String(input ?? '').replace(/[０-９Ａ-Ｚａ-ｚ．＋－]/g, (ch) => {
    const code = ch.codePointAt(0);
    if (code >= 0xFF10 && code <= 0xFF19) return String.fromCharCode(code - 0xFF10 + 48);
    if (code >= 0xFF21 && code <= 0xFF3A) return String.fromCharCode(code - 0xFF21 + 65);
    if (code >= 0xFF41 && code <= 0xFF5A) return String.fromCharCode(code - 0xFF41 + 97);
    if (ch === '．') return '.';
    if (ch === '＋') return '+';
    return '-';
  });
}

// 无前导零的数字字符串按「先比长度、再字典序」即数值序，可比任意大整数（不经 Number 防吞精度）
function compareNumericStrings(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function parseIdentifiers(text, kind) {
  if (text === '') throw new Error(`${kind}不能为空`);
  const parts = text.split('.');
  for (const p of parts) {
    if (p === '') throw new Error(`${kind}中存在空标识符`);
    if (!ALNUM_ID.test(p)) throw new Error(`${kind}标识符「${p}」含非法字符，只允许字母、数字与连字符`);
    if (kind === '预发布版本' && /^\d+$/.test(p) && !NUM_ID.test(p)) {
      throw new Error(`预发布数字标识符「${p}」不能有前导零`);
    }
  }
  return parts;
}

export function parseSemver(input) {
  const rawOriginal = String(input ?? '');
  if (rawOriginal.length > MAX_INPUT_LEN) throw new Error(`版本号过长（最多 ${MAX_INPUT_LEN} 个字符）`);
  const raw = normalizeSemverInput(rawOriginal).trim();
  if (!raw) throw new Error('请输入版本号');
  let s = raw;
  if (s.startsWith('v') || s.startsWith('V')) s = s.slice(1);
  if (s.startsWith('=')) s = s.slice(1).trim();
  if (!s) throw new Error('请输入版本号');
  if (/\s/.test(s)) throw new Error('版本号不能含空格');
  let build = '';
  const plusIdx = s.indexOf('+');
  if (plusIdx >= 0) {
    build = s.slice(plusIdx + 1);
    s = s.slice(0, plusIdx);
    parseIdentifiers(build, '构建元数据');
  }
  let prerelease = [];
  const dashIdx = s.indexOf('-');
  if (dashIdx >= 0) {
    const pre = s.slice(dashIdx + 1);
    s = s.slice(0, dashIdx);
    prerelease = parseIdentifiers(pre, '预发布版本');
  }
  const core = s.split('.');
  if (core.length !== 3) throw new Error('版本号必须是 主版本.次版本.修订号 三段，如 1.2.3');
  for (const p of core) {
    if (!/^\d+$/.test(p)) throw new Error(`版本段「${p}」必须是数字`);
    if (!NUM_ID.test(p)) throw new Error(`版本段「${p}」不能有前导零`);
    // 超过安全整数时 Number 会吞精度、规范化字符串会变成 1e+21 之类，直接点名拒绝
    if (!Number.isSafeInteger(Number(p))) throw new Error(`版本段「${p}」过大，超出可精确处理的范围（最大 ${Number.MAX_SAFE_INTEGER}）`);
  }
  const [major, minor, patch] = core.map(Number);
  const version = `${major}.${minor}.${patch}` + (prerelease.length ? `-${prerelease.join('.')}` : '') + (build ? `+${build}` : '');
  return { major, minor, patch, prerelease, build, version, raw };
}

export function isValidSemver(input) {
  try { parseSemver(input); return true; } catch { return false; }
}

function asParsed(v) { return typeof v === 'string' ? parseSemver(v) : v; }

function compareIdentifiers(a, b) {
  const aNum = /^\d+$/.test(a); const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return compareNumericStrings(a, b);
  if (aNum) return -1; // 数字标识符 < 字母数字标识符
  if (bNum) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compareSemver(a, b) {
  const x = asParsed(a); const y = asParsed(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  }
  // 无预发布 > 有预发布；构建元数据不参与优先级
  if (!x.prerelease.length && !y.prerelease.length) return 0;
  if (!x.prerelease.length) return 1;
  if (!y.prerelease.length) return -1;
  const len = Math.max(x.prerelease.length, y.prerelease.length);
  for (let i = 0; i < len; i++) {
    if (i >= x.prerelease.length) return -1;
    if (i >= y.prerelease.length) return 1;
    const c = compareIdentifiers(x.prerelease[i], y.prerelease[i]);
    if (c !== 0) return c;
  }
  return 0;
}

export function bumpVersion(input, type) {
  const v = asParsed(input);
  let { major, minor, patch } = v;
  let prerelease = [];
  if (type === 'major') { major += 1; minor = 0; patch = 0; }
  else if (type === 'minor') { minor += 1; patch = 0; }
  else if (type === 'patch') { patch += 1; }
  else if (type === 'prerelease') {
    if (!v.prerelease.length) { patch += 1; prerelease = ['0']; }
    else {
      prerelease = [...v.prerelease];
      let bumped = false;
      for (let i = prerelease.length - 1; i >= 0; i--) {
        if (/^\d+$/.test(prerelease[i])) { prerelease[i] = (BigInt(prerelease[i]) + 1n).toString(); bumped = true; break; }
      }
      if (!bumped) prerelease.push('0');
    }
  } else throw new Error(`未知递增类型：${type}`);
  const version = `${major}.${minor}.${patch}` + (prerelease.length ? `-${prerelease.join('.')}` : '');
  return { major, minor, patch, prerelease, build: '', version, raw: version };
}

// ---- 范围校验 ----
function parsePartial(text) {
  // 返回 {major, minor, patch, prerelease}，缺失/通配段为 null
  let s = normalizeSemverInput(text).trim();
  if (s.startsWith('v') || s.startsWith('V')) s = s.slice(1);
  let build = '';
  const pi = s.indexOf('+'); if (pi >= 0) { build = s.slice(pi + 1); s = s.slice(0, pi); parseIdentifiers(build, '构建元数据'); }
  let prerelease = [];
  const di = s.indexOf('-'); if (di >= 0) { prerelease = parseIdentifiers(s.slice(di + 1), '预发布版本'); s = s.slice(0, di); }
  if (s === '' || s === '*' || s.toLowerCase() === 'x') return { major: null, minor: null, patch: null, prerelease, build };
  const parts = s.split('.');
  if (parts.length > 3) throw new Error(`范围版本「${text}」段数过多`);
  const vals = parts.map(p => {
    if (p === '*' || p.toLowerCase() === 'x') return null;
    if (!/^\d+$/.test(p)) throw new Error(`范围版本「${text}」含非法段「${p}」`);
    if (!NUM_ID.test(p)) throw new Error(`范围版本「${text}」的段「${p}」不能有前导零`);
    if (!Number.isSafeInteger(Number(p))) throw new Error(`范围版本「${text}」的段「${p}」过大，超出可精确处理的范围`);
    return Number(p);
  });
  while (vals.length < 3) vals.push(null);
  // 通配之后的段必须也是通配
  let seenNull = false;
  for (const v of vals) { if (v === null) seenNull = true; else if (seenNull) throw new Error(`范围版本「${text}」通配位置不合法`); }
  return { major: vals[0], minor: vals[1], patch: vals[2], prerelease, build };
}
function fillLow(p) { return { major: p.major ?? 0, minor: p.minor ?? 0, patch: p.patch ?? 0, prerelease: p.prerelease || [], build: '', version: '' }; }
function fillHighExclusive(p) {
  // 通配上界（不含）：1.2.x -> <1.3.0；1.x -> <2.0.0；全通配 -> null（无上界）
  if (p.major === null) return null;
  if (p.minor === null) return { major: p.major + 1, minor: 0, patch: 0, prerelease: [], build: '', version: '' };
  if (p.patch === null) return { major: p.major, minor: p.minor + 1, patch: 0, prerelease: [], build: '', version: '' };
  return null;
}
function expandComparator(op, p) {
  // 返回原始比较器列表 [{op, version(parsed-like)}]
  const full = p.major !== null && p.minor !== null && p.patch !== null;
  if (op === '' || op === '=') {
    if (p.major === null) return [];
    if (full) return [{ op: '=', v: fillLow(p) }];
    const hi = fillHighExclusive(p);
    return [{ op: '>=', v: fillLow(p) }, { op: '<', v: hi }];
  }
  if (op === '^') {
    if (p.major === null) return [];
    const lo = fillLow(p);
    let hi;
    if (p.major > 0) hi = { major: p.major + 1, minor: 0, patch: 0, prerelease: [], build: '', version: '' };
    else if (p.minor === null) hi = { major: 1, minor: 0, patch: 0, prerelease: [], build: '', version: '' };
    else if (p.minor > 0) hi = { major: 0, minor: p.minor + 1, patch: 0, prerelease: [], build: '', version: '' };
    else if (p.patch === null) hi = { major: 0, minor: 1, patch: 0, prerelease: [], build: '', version: '' };
    else hi = { major: 0, minor: 0, patch: p.patch + 1, prerelease: [], build: '', version: '' };
    return [{ op: '>=', v: lo }, { op: '<', v: hi }];
  }
  if (op === '~') {
    if (p.major === null) return [];
    const lo = fillLow(p);
    const hi = p.minor === null
      ? { major: p.major + 1, minor: 0, patch: 0, prerelease: [], build: '', version: '' }
      : { major: p.major, minor: p.minor + 1, patch: 0, prerelease: [], build: '', version: '' };
    return [{ op: '>=', v: lo }, { op: '<', v: hi }];
  }
  if (op === '>=') return [{ op: '>=', v: fillLow(p) }];
  if (op === '>') {
    // >* / >x 在 npm 里是空集（没有任何版本大于「全部」），用低于最小版本 0.0.0-0 表达永假
    if (p.major === null) return [{ op: '<', v: { major: 0, minor: 0, patch: 0, prerelease: ['0'], build: '', version: '' } }];
    if (full) return [{ op: '>', v: fillLow(p) }];
    const hi = fillHighExclusive(p);
    if (!hi) return [{ op: '>', v: fillLow(p) }];
    return [{ op: '>=', v: hi }];
  }
  if (op === '<') {
    // <* 同理为空集
    if (p.major === null) return [{ op: '<', v: { major: 0, minor: 0, patch: 0, prerelease: ['0'], build: '', version: '' } }];
    const lo = fillLow(p);
    // <1.2.x 语义为 <1.2.0；完整版本直接比较（预发布按 lo 的 prerelease）
    return [{ op: '<', v: lo }];
  }
  if (op === '<=') {
    if (full) return [{ op: '<=', v: fillLow(p) }];
    const hi = fillHighExclusive(p);
    if (!hi) return [{ op: '<=', v: fillLow(p) }];
    return [{ op: '<', v: hi }];
  }
  throw new Error(`未知运算符：${op}`);
}
function testComparator(version, c) {
  const cmp = compareSemver(version, c.v);
  if (c.op === '=') return cmp === 0;
  if (c.op === '>') return cmp > 0;
  if (c.op === '>=') return cmp >= 0;
  if (c.op === '<') return cmp < 0;
  if (c.op === '<=') return cmp <= 0;
  return false;
}
function expandHyphen(aText, bText) {
  const a = parsePartial(aText); const b = parsePartial(bText);
  const out = [{ op: '>=', v: fillLow(a) }];
  if (b.major !== null && b.minor !== null && b.patch !== null) out.push({ op: '<=', v: fillLow(b) });
  else { const hi = fillHighExclusive(b); if (hi) out.push({ op: '<', v: hi }); }
  return out;
}
export function satisfiesRange(input, range) {
  const version = asParsed(input);
  const r = normalizeSemverInput(String(range ?? '')).trim();
  if (r.length > MAX_INPUT_LEN) throw new Error(`范围表达式过长（最多 ${MAX_INPUT_LEN} 个字符）`);
  if (!r || r === '*') return version.prerelease.length === 0; // npm 口径：* 不匹配预发布版本
  const orGroups = r.split('||').map(s => s.trim());
  for (const group of orGroups) {
    if (group === '') continue;
    let comparators = [];
    const hyphen = group.split(/\s+-\s+/);
    if (hyphen.length === 2) {
      comparators = expandHyphen(hyphen[0], hyphen[1]);
    } else {
      const tokens = group.split(/[\s,]+/).filter(Boolean);
      // 合并被空格拆开的运算符，如 ">= 1.2.3"
      const merged = [];
      for (const t of tokens) {
        if (/^(>=|<=|>|<|=|\^|~)$/.test(t) && merged.length >= 0) merged.push(t);
        else if (merged.length && /^(>=|<=|>|<|=|\^|~)$/.test(merged[merged.length - 1])) merged[merged.length - 1] += t;
        else merged.push(t);
      }
      for (const t of merged) {
        const m = t.match(/^(>=|<=|>|<|=|\^|~)?(.*)$/);
        comparators.push(...expandComparator(m[1] || '', parsePartial(m[2])));
      }
    }
    if (!comparators.every(c => testComparator(version, c))) continue;
    // npm 预发布门控：待校验版本带预发布标识时，本组必须有至少一个比较器
    // 带预发布标识且主/次/修订三段与它相同，否则不算满足（如 ^1.2.3 不放行 1.5.0-beta，
    // 但 ^1.2.3-beta 可放行同为 1.2.3 的预发布与后续正式版）
    if (version.prerelease.length) {
      const gated = comparators.some(c => c.v.prerelease && c.v.prerelease.length
        && c.v.major === version.major && c.v.minor === version.minor && c.v.patch === version.patch);
      if (!gated) continue;
    }
    return true;
  }
  return false;
}
export function buildSemverSummary(v) {
  const p = asParsed(v);
  const lines = [
    `版本：${p.version}`,
    `主版本：${p.major}（不兼容变更）`,
    `次版本：${p.minor}（向后兼容功能）`,
    `修订号：${p.patch}（向后兼容修复）`,
    `预发布：${p.prerelease.length ? p.prerelease.join('.') : '无（正式版）'}`,
    `构建元数据：${p.build || '无'}`
  ];
  return lines.join('\n');
}
