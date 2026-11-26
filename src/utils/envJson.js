// .env 与 JSON 互转（纯本地）：解析 dotenv 常见写法并生成 .env 文本。
// 支持：export 前缀、# 注释与行尾注释、单/双引号、无引号值、双引号转义、双引号多行值、重复键提示。

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function decodeDoubleQuoted(raw, lineNo) {
  // raw 不含外层引号
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') { out += ch; continue; }
    const next = raw[i + 1];
    if (next === undefined) throw new Error(`第 ${lineNo} 行：双引号值以反斜杠结尾，转义不完整`);
    i++;
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === '\\') out += '\\';
    else if (next === '"') out += '"';
    else if (next === '$') out += '$';
    else out += '\\' + next; // 未知转义原样保留，避免悄悄改值
  }
  return out;
}

function findClosingDoubleQuote(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '"') return i;
  }
  return -1;
}

export function parseEnv(text) {
  if (typeof text !== 'string') throw new Error('输入必须是文本');
  const src = text.replace(/^\uFEFF/, '');
  const rawLines = src.split(/\r\n|\r|\n/);
  const data = {};
  const entries = [];
  const duplicates = [];
  const seen = new Map();
  let i = 0;
  while (i < rawLines.length) {
    const lineNo = i + 1;
    let line = rawLines[i];
    i++;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^export\s+/.test(trimmed)) line = trimmed.replace(/^export\s+/, '');
    else line = trimmed;
    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`第 ${lineNo} 行：缺少 =，不是 KEY=VALUE 写法`);
    const key = line.slice(0, eq).trim();
    if (!KEY_RE.test(key)) throw new Error(`第 ${lineNo} 行：键名「${key || '(空)'}」不合法，应以字母或下划线开头，只含字母、数字、下划线、点和连字符`);
    let rest = line.slice(eq + 1).trimStart();
    let value;
    if (rest.startsWith('"')) {
      // 双引号：可能跨多行
      let body = rest.slice(1);
      let close = findClosingDoubleQuote(body);
      let startLine = lineNo;
      while (close === -1) {
        if (i >= rawLines.length) throw new Error(`第 ${startLine} 行：双引号值未闭合`);
        body += '\n' + rawLines[i];
        i++;
        close = findClosingDoubleQuote(body);
      }
      const after = body.slice(close + 1).trim();
      if (after && !after.startsWith('#')) throw new Error(`第 ${startLine} 行：引号结束后还有多余内容「${after}」`);
      value = decodeDoubleQuoted(body.slice(0, close), startLine);
    } else if (rest.startsWith("'")) {
      const close = rest.indexOf("'", 1);
      if (close === -1) throw new Error(`第 ${lineNo} 行：单引号值未闭合`);
      const after = rest.slice(close + 1).trim();
      if (after && !after.startsWith('#')) throw new Error(`第 ${lineNo} 行：引号结束后还有多余内容「${after}」`);
      value = rest.slice(1, close);
    } else {
      // 无引号：空格 + # 视为行尾注释
      const commentAt = rest.search(/\s#/);
      if (commentAt !== -1) rest = rest.slice(0, commentAt);
      value = rest.trim();
    }
    if (seen.has(key)) duplicates.push(key);
    seen.set(key, lineNo);
    data[key] = value;
    entries.push({ key, value, line: lineNo });
  }
  return { data, entries, count: entries.length, uniqueCount: Object.keys(data).length, duplicates };
}

export function envToJson(text, indent = 2) {
  const r = parseEnv(text);
  const json = indent === 0 ? JSON.stringify(r.data) : JSON.stringify(r.data, null, indent);
  return { ...r, json };
}

function encodeValue(value, quoteMode) {
  if (value === '') return '';
  const needsQuote = /[\s#"'\\]/.test(value) || value.includes('\n') || value !== value.trim();
  if (quoteMode === 'never') {
    if (needsQuote) return null;
    return value;
  }
  if (quoteMode === 'always' || needsQuote) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    return '"' + escaped + '"';
  }
  return value;
}

export function jsonToEnv(jsonText, options = {}) {
  const quoteMode = options.quote || 'auto'; // auto | always | never
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('顶层必须是 JSON 对象，如 {"KEY":"value"}');
  const keys = Object.keys(parsed);
  if (options.sortKeys) keys.sort();
  const lines = [];
  for (const key of keys) {
    if (!KEY_RE.test(key)) throw new Error(`键名「${key}」不合法，无法作为 .env 键名`);
    const v = parsed[key];
    let str;
    if (v === null) str = '';
    else if (typeof v === 'string') str = v;
    else if (typeof v === 'number' || typeof v === 'boolean') str = String(v);
    else throw new Error(`键「${key}」的值是 ${Array.isArray(v) ? '数组' : '对象'}，.env 只能存字符串，请先压成字符串（如 JSON 字符串）`);
    const encoded = encodeValue(str, quoteMode);
    if (encoded === null) throw new Error(`键「${key}」的值含空格、# 或引号，必须加引号才能写入 .env，请改用自动/总是引号模式`);
    lines.push(key + '=' + encoded);
  }
  return { env: lines.join('\n') + (lines.length ? '\n' : ''), count: keys.length };
}
