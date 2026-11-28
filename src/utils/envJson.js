// .env 与 JSON 互转（纯本地）：解析 dotenv 常见写法并生成 .env 文本。
// 支持：export 前缀、# 注释与行尾注释、单/双引号、无引号值、双引号转义、引号多行值、重复键提示。
// R8av 打磨：__proto__ 等特殊键不丢失（Object.fromEntries 建对象）；键名/等号/引号定界符处的
// 全角字符按半角处理（值内容里的全角字原样不动）并记 notes；单引号值同样可跨多行；
// 引号后多余内容的报错行号指向引号真正结束的那一行；JSON 侧语法错误带行列与原因提示、
// 重复键点名、非有限数（1e999）拒绝、不安全整数给 warnings、孤立代理字符点名拒绝；
// 双向输入 100 万字符上限。

import { parseJsonDetailed } from './jsonFormat.js';
import { findDuplicateKey } from './jwtEncode.js';

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const MAX_ENV_INPUT_LENGTH = 1000000;

const FW_EQUALS = '＝';
const FW_DQUOTE = '＂';
const FW_SQUOTE = '＇';

// 结构位置（键名/等号）的全角转半角：U+FF01–FF5E 与半角 1:1 对应，全角空格转普通空格。
function fwToHalf(s) {
  return s.replace(/[\uFF01-\uFF5E\u3000]/g, (ch) =>
    ch === '\u3000' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

function findClosingDoubleQuote(s, quoteChar) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === quoteChar) return i;
  }
  return -1;
}

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

function parseEnv(text) {
  if (typeof text !== 'string') throw new Error('输入必须是文本');
  if (text.length > MAX_ENV_INPUT_LENGTH) throw new Error(`输入超过 ${MAX_ENV_INPUT_LENGTH} 字符上限（当前 ${text.length} 字符），请拆分后再转`);
  const src = text.replace(/^\uFEFF/, '');
  const rawLines = src.split(/\r\n|\r|\n/);
  const entries = [];
  const duplicates = [];
  const notes = [];
  const seen = new Map();
  let notedFw = false;
  const noteFw = () => {
    if (notedFw) return;
    notedFw = true;
    notes.push('键名、等号或引号处检测到全角字符，已按半角处理（值内容里的全角字保持原样）');
  };
  let i = 0;
  while (i < rawLines.length) {
    const lineNo = i + 1;
    let line = rawLines[i];
    i++;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // 结构部分全角容错：第一个 = 或 ＝ 之前是键名区，其中的全角字母/数字/等号按半角处理
    let work = trimmed;
    if (/^export\s+/.test(work)) work = work.replace(/^export\s+/, '');
    const eqIdx = (() => {
      const a = work.indexOf('=');
      const b = work.indexOf(FW_EQUALS);
      if (a === -1) return b;
      if (b === -1) return a;
      return Math.min(a, b);
    })();
    if (eqIdx === -1) throw new Error(`第 ${lineNo} 行：缺少 =，不是 KEY=VALUE 写法`);
    const headHalf = fwToHalf(work.slice(0, eqIdx));
    if (headHalf !== work.slice(0, eqIdx) || work[eqIdx] === FW_EQUALS) noteFw();
    const key = headHalf.trim();
    if (!KEY_RE.test(key)) throw new Error(`第 ${lineNo} 行：键名「${key || '(空)'}」不合法，应以字母或下划线开头，只含字母、数字、下划线、点和连字符`);
    let rest = work.slice(eqIdx + 1).trimStart();
    let value;
    const first = rest[0];
    if (first === '"' || first === FW_DQUOTE) {
      // 双引号：可能跨多行
      const quoteChar = first;
      if (quoteChar === FW_DQUOTE) noteFw();
      let body = rest.slice(1);
      let close = findClosingDoubleQuote(body, quoteChar);
      let endLine = lineNo;
      while (close === -1) {
        if (i >= rawLines.length) throw new Error(`第 ${lineNo} 行：双引号值未闭合`);
        body += '\n' + rawLines[i];
        i++;
        endLine = i;
        close = findClosingDoubleQuote(body, quoteChar);
      }
      const after = body.slice(close + 1).trim();
      if (after && !after.startsWith('#')) throw new Error(`第 ${endLine} 行：引号结束后还有多余内容「${after}」`);
      value = decodeDoubleQuoted(body.slice(0, close), lineNo);
    } else if (first === "'" || first === FW_SQUOTE) {
      // 单引号：字面值，同样可跨多行（内部不处理转义，第一个同型引号即结束）
      const quoteChar = first;
      if (quoteChar === FW_SQUOTE) noteFw();
      let body = rest.slice(1);
      let close = body.indexOf(quoteChar);
      let endLine = lineNo;
      while (close === -1) {
        if (i >= rawLines.length) throw new Error(`第 ${lineNo} 行：单引号值未闭合`);
        body += '\n' + rawLines[i];
        i++;
        endLine = i;
        close = body.indexOf(quoteChar);
      }
      const after = body.slice(close + 1).trim();
      if (after && !after.startsWith('#')) throw new Error(`第 ${endLine} 行：引号结束后还有多余内容「${after}」`);
      value = body.slice(0, close);
    } else {
      // 无引号：空格 + # 视为行尾注释
      const commentAt = rest.search(/\s#/);
      if (commentAt !== -1) rest = rest.slice(0, commentAt);
      value = rest.trim();
    }
    if (seen.has(key)) duplicates.push(key);
    seen.set(key, lineNo);
    entries.push({ key, value, line: lineNo });
  }
  // 用 fromEntries 建对象：__proto__ 等键成为自有属性，不会被原型赋值语义吞掉
  const data = Object.fromEntries(entries.map((e) => [e.key, e.value]));
  return { data, entries, count: entries.length, uniqueCount: Object.keys(data).length, duplicates, notes };
}

export function envToJson(text, indent = 2) {
  const r = parseEnv(text);
  const json = indent === 0 ? JSON.stringify(r.data) : JSON.stringify(r.data, null, indent);
  return { ...r, json };
}

function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) { i++; continue; }
      return true;
    }
    if (c >= 0xDC00 && c <= 0xDFFF) return true;
  }
  return false;
}

// 双引号转义（.env 的双引号解析只认 \\ \" \n \r \t 等，本工具解码端不认 \uXXXX，
// 故孤立代理字符不做转义输出、改在 jsonToEnv 里点名拒绝，避免写出往返对不上的文本）
function escapeForDoubleQuotes(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function encodeValue(value, quoteMode) {
  if (value === '') return '';
  const needsQuote = /[\s#"'\\]/.test(value) || value.includes('\n') || value !== value.trim();
  if (quoteMode === 'never') {
    if (needsQuote) return null;
    return value;
  }
  if (quoteMode === 'always' || needsQuote) return '"' + escapeForDoubleQuotes(value) + '"';
  return value;
}

export function jsonToEnv(jsonText, options = {}) {
  const quoteMode = options.quote || 'auto'; // auto | always | never
  if (typeof jsonText !== 'string') throw new Error('输入必须是文本');
  if (jsonText.length > MAX_ENV_INPUT_LENGTH) throw new Error(`输入超过 ${MAX_ENV_INPUT_LENGTH} 字符上限（当前 ${jsonText.length} 字符），请拆分后再转`);
  const parsedResult = parseJsonDetailed(jsonText);
  if (!parsedResult.ok) {
    const e = parsedResult.error;
    const where = e.line ? `第 ${e.line} 行第 ${e.column} 列` : '未知位置';
    const hint = e.hints && e.hints.length ? `；${e.hints[0]}` : '';
    throw new Error(`JSON 解析失败（${where}）：${e.message}${hint}`);
  }
  const dup = findDuplicateKey(jsonText);
  if (dup) throw new Error(`JSON 中键「${dup.path}」重复出现，JSON.parse 只会保留最后一个值，请先删掉多余的同名键`);
  const parsed = parsedResult.value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('顶层必须是 JSON 对象，如 {"KEY":"value"}');
  const keys = Object.keys(parsed);
  if (options.sortKeys) keys.sort();
  const lines = [];
  const warnings = [];
  for (const key of keys) {
    if (!KEY_RE.test(key)) throw new Error(`键名「${key}」不合法，无法作为 .env 键名`);
    const v = parsed[key];
    let str;
    if (v === null) str = '';
    else if (typeof v === 'string') {
      if (hasLoneSurrogate(v)) throw new Error(`键「${key}」的值含未配对的代理字符（如 \\ud800 这类孤立转义），.env 文本无法忠实表达，请先修正该值`);
      str = v;
    }
    else if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error(`键「${key}」的数值不是有限数（可能写了 1e999 这类溢出写法），.env 无法表达，请改小或改用字符串`);
      if (Number.isInteger(v) && !Number.isSafeInteger(v)) warnings.push(`键「${key}」的整数超出安全范围，末尾数字可能已被 JSON 解析舍入，请核对原文或改用字符串`);
      str = String(v);
    }
    else if (typeof v === 'boolean') str = String(v);
    else throw new Error(`键「${key}」的值是 ${Array.isArray(v) ? '数组' : '对象'}，.env 只能存字符串，请先压成字符串（如 JSON 字符串）`);
    const encoded = encodeValue(str, quoteMode);
    if (encoded === null) throw new Error(`键「${key}」的值含空格、#、引号或异常字符，必须加引号才能写入 .env，请改用自动/总是引号模式`);
    lines.push(key + '=' + encoded);
  }
  return { env: lines.join('\n') + (lines.length ? '\n' : ''), count: keys.length, warnings };
}
