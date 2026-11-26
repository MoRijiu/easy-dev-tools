// SemVer 语义化版本：纯本地解析 / 比较 / 递增 / 范围校验（遵循 semver.org 2.0.0）
// 范围语法支持 npm 常用子集：^ ~ >= <= > < =、连字符区间、|| 并集、x/* 通配与 1.2 简写。

const NUM_ID = /^(0|[1-9]\d*)$/;
const ALNUM_ID = /^[0-9A-Za-z-]+$/;

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
  const raw = String(input ?? '').trim();
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
  if (aNum && bNum) { const d = Number(a) - Number(b); return d === 0 ? 0 : (d < 0 ? -1 : 1); }
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
        if (/^\d+$/.test(prerelease[i])) { prerelease[i] = String(Number(prerelease[i]) + 1); bumped = true; break; }
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
  let s = text.trim();
  if (s.startsWith('v') || s.startsWith('V')) s = s.slice(1);
  let build = '';
  const pi = s.indexOf('+'); if (pi >= 0) { build = s.slice(pi + 1); s = s.slice(0, pi); }
  let prerelease = [];
  const di = s.indexOf('-'); if (di >= 0) { prerelease = parseIdentifiers(s.slice(di + 1), '预发布版本'); s = s.slice(0, di); }
  if (s === '' || s === '*' || s.toLowerCase() === 'x') return { major: null, minor: null, patch: null, prerelease, build };
  const parts = s.split('.');
  if (parts.length > 3) throw new Error(`范围版本「${text}」段数过多`);
  const vals = parts.map(p => {
    if (p === '*' || p.toLowerCase() === 'x') return null;
    if (!/^\d+$/.test(p)) throw new Error(`范围版本「${text}」含非法段「${p}」`);
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
    if (full) return [{ op: '>', v: fillLow(p) }];
    const hi = fillHighExclusive(p);
    if (!hi) return [{ op: '>', v: fillLow(p) }];
    return [{ op: '>=', v: hi }];
  }
  if (op === '<') {
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
  const r = String(range ?? '').trim();
  if (!r || r === '*') return version.prerelease.length === 0 ? true : true; // 简化：* 匹配一切含预发布
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
    if (comparators.every(c => testComparator(version, c))) return true;
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
