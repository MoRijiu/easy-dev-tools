// JSONPath 查询：纯本地实现常用子集
// 支持：$ 根、.name、['name']、[n]（含负数）、[*] / .* 通配、.. 递归下降、
// [start:end:step] 切片、['a','b'] / [0,2] 联合、[?(...)] 过滤
// （存在判断、== != > >= < <=、=~ 正则、&& / || 组合）。
// 结果上限 MAX_RESULTS 条，递归遍历带节点上限，避免大文档卡死。

export const MAX_RESULTS = 1000;
export const MAX_EXPR_LENGTH = 1024;
const MAX_NODES = 200000;

// 键名允许 Unicode 字母（中文、日文等），与 $['中文'] 写法等价
const isIdentStart = (c) => /[\p{L}_$]/u.test(c);
const isIdentChar = (c) => /[\p{L}\p{N}_$]/u.test(c);
const IDENT_RE = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
// 只认对象自身的键：'in' 会把原型链上的 toString/constructor 也算命中，
// 对普通 JSON 数据是假命中（$.toString 在 {} 上不应有结果）
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function parseQuoted(s, i) {
  const quote = s[i];
  let out = '';
  i += 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === undefined) break;
      if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
        i += 6;
      } else {
        const map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '\\': '\\', "'": "'", '"': '"', '/': '/' };
        out += map[n] !== undefined ? map[n] : n;
        i += 2;
      }
      continue;
    }
    if (c === quote) return { value: out, next: i + 1 };
    out += c;
    i += 1;
  }
  throw new Error(`字符串未闭合（位置 ${i}）`);
}

// 解析过滤条件里 @ 之后的路径，如 .a.b[0].c 或 ['a']
function parseAtPath(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '.') {
      i += 1;
      const start = i;
      while (i < text.length && isIdentChar(text[i])) i += 1;
      if (i === start) throw new Error(`过滤条件路径不完整：@${text}`);
      parts.push(text.slice(start, i));
    } else if (text[i] === '[') {
      const end = text.indexOf(']', i);
      if (end < 0) throw new Error(`过滤条件路径缺少 ]：@${text}`);
      const inner = text.slice(i + 1, end).trim();
      if (/^-?\d+$/.test(inner)) parts.push(Number(inner));
      else if ((inner.startsWith("'") && inner.endsWith("'")) || (inner.startsWith('"') && inner.endsWith('"'))) {
        parts.push(parseQuoted(inner, 0).value);
      } else throw new Error(`过滤条件路径不支持：[${inner}]`);
      i = end + 1;
    } else {
      throw new Error(`过滤条件路径含非法字符「${text[i]}」：@${text}`);
    }
  }
  return parts;
}

function parseLiteral(text) {
  const t = text.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith("'") && t.endsWith("'") && t.length >= 2) || (t.startsWith('"') && t.endsWith('"') && t.length >= 2)) {
    return parseQuoted(t, 0).value;
  }
  if (t.startsWith('/') && t.lastIndexOf('/') > 0) {
    const last = t.lastIndexOf('/');
    const flags = t.slice(last + 1);
    if (!/^[ims]*$/.test(flags)) throw new Error(`正则标志不支持：${flags}`);
    const pattern = t.slice(1, last);
    try { new RegExp(pattern, flags); } catch { throw new Error(`过滤条件正则不合法：/${pattern}/${flags}`); }
    return { __regex: pattern, flags };
  }
  throw new Error(`过滤条件字面量无法识别：${t}`);
}

// 把过滤表达式按 || 再 && 切分（引号内的不切）
function splitBool(text, op) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === '\\') { cur += text[i + 1] ?? ''; i += 1; }
      else if (c === quote) quote = '';
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth += 1;
    if (c === ')' || c === ']') depth -= 1;
    if (depth === 0 && text.slice(i, i + 2) === op) { parts.push(cur); cur = ''; i += 1; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseCondition(text) {
  const ors = splitBool(text, '||');
  if (ors.length > 1) return { or: ors.map(parseCondition) };
  const ands = splitBool(text, '&&');
  if (ands.length > 1) return { and: ands.map(parseCondition) };
  const t = text.trim();
  const m = t.match(/^(@(?:\.[\p{L}_$][\p{L}\p{N}_$]*|\[[^\]]*\])*)?\s*(==|!=|>=|<=|=~|>|<)\s*([\s\S]+)$/u);
  if (m) {
    const left = m[1] ? parseAtPath(m[1].slice(1)) : [];
    return { cmp: { path: left, op: m[2], value: parseLiteral(m[3]) } };
  }
  if (/^@/.test(t)) return { exists: parseAtPath(t.slice(1)) };
  throw new Error(`过滤条件无法解析：${t}`);
}

function parseBracket(s, i) {
  // s[i] === '['，返回 { segment, next }
  let j = i + 1;
  let quote = '';
  let inner = '';
  let depth = 0;
  while (j < s.length) {
    const c = s[j];
    if (quote) {
      inner += c;
      if (c === '\\') { inner += s[j + 1] ?? ''; j += 2; continue; }
      if (c === quote) quote = '';
      j += 1;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; inner += c; j += 1; continue; }
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ']' && depth === 0) break;
    inner += c;
    j += 1;
  }
  if (j >= s.length) throw new Error(`缺少 ]（位置 ${i}）`);
  const next = j + 1;
  const t = inner.trim();
  if (t === '*') return { segment: { type: 'wildcard' }, next };
  if (t.startsWith('?(') && t.endsWith(')')) {
    return { segment: { type: 'filter', cond: parseCondition(t.slice(2, -1)) }, next };
  }
  if (t.includes(':')) {
    const parts = t.split(':');
    if (parts.length > 3) throw new Error(`切片写法不正确：[${t}]`);
    const num = (x) => {
      if (x === undefined) return undefined;
      const v = x.trim();
      if (v === '') return undefined;
      if (!/^-?\d+$/.test(v)) throw new Error(`切片只接受整数：[${t}]`);
      return Number(v);
    };
    const step = num(parts[2]);
    if (step === 0) throw new Error('切片步长不能为 0');
    return { segment: { type: 'slice', start: num(parts[0]), end: num(parts[1]), step }, next };
  }
  // 联合：逗号分隔（引号内逗号不算）
  const items = [];
  {
    let cur = '';
    let q = '';
    for (let k = 0; k < t.length; k += 1) {
      const c = t[k];
      if (q) { cur += c; if (c === '\\') { cur += t[k + 1] ?? ''; k += 1; } else if (c === q) q = ''; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === ',') { items.push(cur); cur = ''; continue; }
      cur += c;
    }
    items.push(cur);
  }
  const segs = items.map((raw) => {
    const v = raw.trim();
    if (/^-?\d+$/.test(v)) return { type: 'index', index: Number(v) };
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      return { type: 'child', name: parseQuoted(v, 0).value };
    }
    throw new Error(`括号内写法不支持：[${v}]`);
  });
  if (segs.length === 1) return { segment: segs[0], next };
  return { segment: { type: 'union', items: segs }, next };
}

export function parseJsonPath(expr) {
  const s = String(expr ?? '').trim();
  if (!s) throw new Error('请输入 JSONPath 表达式');
  if (s.length > MAX_EXPR_LENGTH) throw new Error(`表达式过长（${s.length} 字符，上限 ${MAX_EXPR_LENGTH}）`);
  let i = 0;
  if (s[i] === '$') i += 1;
  else if (s[i] === '.' || s[i] === '[') { /* 允许省略 $ */ }
  else throw new Error('表达式需以 $ 开头（如 $.store.book[0]）');
  const segments = [];
  while (i < s.length) {
    if (s.startsWith('..', i)) {
      i += 2;
      if (i >= s.length) throw new Error('.. 后缺少要查找的键名');
      if (s[i] === '*') { segments.push({ type: 'recursive', inner: { type: 'wildcard' } }); i += 1; continue; }
      if (s[i] === '[') {
        const { segment, next } = parseBracket(s, i);
        segments.push({ type: 'recursive', inner: segment });
        i = next;
        continue;
      }
      if (!isIdentStart(s[i])) throw new Error(`.. 后键名不合法（位置 ${i}）`);
      const start = i;
      while (i < s.length && isIdentChar(s[i])) i += 1;
      segments.push({ type: 'recursive', inner: { type: 'child', name: s.slice(start, i) } });
      continue;
    }
    if (s[i] === '.') {
      i += 1;
      if (s[i] === '*') { segments.push({ type: 'wildcard' }); i += 1; continue; }
      if (i >= s.length || !isIdentStart(s[i])) throw new Error(`. 后键名不合法（位置 ${i}）`);
      const start = i;
      while (i < s.length && isIdentChar(s[i])) i += 1;
      segments.push({ type: 'child', name: s.slice(start, i) });
      continue;
    }
    if (s[i] === '[') {
      const { segment, next } = parseBracket(s, i);
      segments.push(segment);
      i = next;
      continue;
    }
    throw new Error(`无法识别的字符「${s[i]}」（位置 ${i}）`);
  }
  return segments;
}

const isObj = (v) => v !== null && typeof v === 'object';

export function formatPath(parts) {
  let out = '$';
  for (const p of parts) {
    if (typeof p === 'number') out += `[${p}]`;
    else if (IDENT_RE.test(p)) out += `.${p}`;
    else out += `['${String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
  }
  return out;
}

function resolveAt(node, parts) {
  let cur = node;
  for (const p of parts) {
    if (!isObj(cur)) return { found: false };
    if (Array.isArray(cur)) {
      const idx = typeof p === 'number' ? (p < 0 ? cur.length + p : p) : null;
      if (idx === null || idx < 0 || idx >= cur.length) return { found: false };
      cur = cur[idx];
    } else {
      if (!hasOwn(cur, p)) return { found: false };
      cur = cur[p];
    }
  }
  return { found: true, value: cur };
}

function evalCondition(cond, node) {
  if (cond.or) return cond.or.some((c) => evalCondition(c, node));
  if (cond.and) return cond.and.every((c) => evalCondition(c, node));
  if (cond.exists) return resolveAt(node, cond.exists).found;
  if (cond.cmp) {
    const { path, op, value } = cond.cmp;
    const { found, value: left } = resolveAt(node, path);
    if (!found) return false;
    if (value && typeof value === 'object' && '__regex' in value) {
      if (op !== '=~') throw new Error('正则字面量只能配合 =~ 使用');
      return new RegExp(value.__regex, value.flags).test(String(left));
    }
    switch (op) {
      case '==': return left === value || (typeof left === 'number' && typeof value === 'number' && left === value);
      case '!=': return left !== value;
      case '>': return left > value;
      case '>=': return left >= value;
      case '<': return left < value;
      case '<=': return left <= value;
      case '=~': {
        let re;
        try { re = new RegExp(String(value)); } catch { throw new Error(`过滤条件正则不合法：${String(value)}`); }
        return re.test(String(left));
      }
      default: return false;
    }
  }
  return false;
}

function applySegment(seg, node, path, out, state) {
  const push = (value, parts) => {
    if (out.length >= MAX_RESULTS) { state.truncated = true; return; }
    out.push({ path: parts, value });
  };
  switch (seg.type) {
    case 'child': {
      if (isObj(node) && !Array.isArray(node) && hasOwn(node, seg.name)) push(node[seg.name], [...path, seg.name]);
      break;
    }
    case 'index': {
      if (Array.isArray(node)) {
        const idx = seg.index < 0 ? node.length + seg.index : seg.index;
        if (idx >= 0 && idx < node.length) push(node[idx], [...path, idx]);
      }
      break;
    }
    case 'wildcard': {
      if (Array.isArray(node)) node.forEach((v, idx) => push(v, [...path, idx]));
      else if (isObj(node)) Object.keys(node).forEach((k) => push(node[k], [...path, k]));
      break;
    }
    case 'slice': {
      if (Array.isArray(node)) {
        const len = node.length;
        const step = seg.step ?? 1;
        let start = seg.start === undefined ? (step > 0 ? 0 : len - 1) : seg.start;
        let end = seg.end === undefined ? (step > 0 ? len : -len - 1) : seg.end;
        if (start < 0) start = Math.max(len + start, step > 0 ? 0 : -1);
        if (end < 0) end = Math.max(len + end, step > 0 ? 0 : -1);
        if (step > 0) {
          start = Math.min(start, len); end = Math.min(end, len);
          for (let idx = start; idx < end; idx += step) push(node[idx], [...path, idx]);
        } else {
          start = Math.min(start, len - 1); end = Math.min(end, len - 1);
          for (let idx = start; idx > end; idx += step) push(node[idx], [...path, idx]);
        }
      }
      break;
    }
    case 'union': {
      for (const item of seg.items) applySegment(item, node, path, out, state);
      break;
    }
    case 'filter': {
      if (Array.isArray(node)) {
        node.forEach((v, idx) => { if (evalCondition(seg.cond, v)) push(v, [...path, idx]); });
      } else if (isObj(node)) {
        if (evalCondition(seg.cond, node)) push(node, path);
      }
      break;
    }
    case 'recursive': {
      const walk = (n, p) => {
        if (state.nodes > MAX_NODES) { state.truncated = true; return; }
        state.nodes += 1;
        applySegment(seg.inner, n, p, out, state);
        if (Array.isArray(n)) n.forEach((v, idx) => walk(v, [...p, idx]));
        else if (isObj(n)) Object.keys(n).forEach((k) => walk(n[k], [...p, k]));
      };
      walk(node, path);
      break;
    }
    default: break;
  }
}

export function queryJsonPath(data, expr) {
  const segments = parseJsonPath(expr);
  let current = [{ path: [], value: data }];
  const state = { truncated: false, nodes: 0 };
  for (const seg of segments) {
    const next = [];
    for (const item of current) {
      const out = [];
      applySegment(seg, item.value, item.path, out, state);
      next.push(...out);
      if (next.length >= MAX_RESULTS) { state.truncated = true; break; }
    }
    current = next.slice(0, MAX_RESULTS);
    if (!current.length) break;
  }
  return {
    matches: current.map((m) => ({ path: formatPath(m.path), value: m.value })),
    truncated: state.truncated
  };
}

export function buildJsonPathSummary(expr, result) {
  const lines = [`表达式：${expr}`, `命中 ${result.matches.length} 条${result.truncated ? '（已达上限截断）' : ''}`];
  for (const m of result.matches.slice(0, 50)) {
    const v = typeof m.value === 'object' && m.value !== null ? JSON.stringify(m.value) : String(m.value);
    lines.push(`${m.path} = ${v}`);
  }
  return lines.join('\n');
}
