// JSON 字符串转义核心逻辑：纯本地处理，不上传任何数据。遵循 RFC 8259 字符串规则。

const MAX_JSON_ESCAPE_CHARS = 1000000;

const SHORT_ESCAPES = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t'
};

function toUnicodeEscape(codeUnit) {
  return '\\u' + codeUnit.toString(16).padStart(4, '0');
}

function isHighSurrogate(code) { return code >= 0xd800 && code <= 0xdbff; }
function isLowSurrogate(code) { return code >= 0xdc00 && code <= 0xdfff; }

export function countCodePoints(text) {
  return [...String(text ?? '')].length;
}

// 把普通文本转义为 JSON 字符串内容。options:
// - unicode: 非 ASCII 字符也转成 \uXXXX（按 UTF-16 码元，Emoji 输出代理对两段）
// - escapeSlash: 正斜杠 / 转成 \/
// - withQuotes: 输出带外层双引号的完整 JSON 字符串字面量
// 未配对的代理字符（孤立的 \uD800 类码元）无论是否勾选 unicode 都输出为 \uXXXX，
// 与格式良好的 JSON.stringify 一致，避免产出严格解析器会拒绝或替换的坏字符串。
export function escapeJsonString(text, options = {}) {
  const { unicode = false, escapeSlash = false, withQuotes = true } = options;
  const src = String(text ?? '');
  if (src.length > MAX_JSON_ESCAPE_CHARS) {
    return { ok: false, error: `输入过长：${src.length} 字符，上限为 ${MAX_JSON_ESCAPE_CHARS} 字符` };
  }
  let body = '';
  let escapeCount = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const code = src.charCodeAt(i);
    if (SHORT_ESCAPES[ch]) {
      body += SHORT_ESCAPES[ch];
      escapeCount++;
    } else if (code < 0x20) {
      body += toUnicodeEscape(code);
      escapeCount++;
    } else if (isHighSurrogate(code) || isLowSurrogate(code)) {
      const nextCode = i + 1 < src.length ? src.charCodeAt(i + 1) : NaN;
      if (isHighSurrogate(code) && isLowSurrogate(nextCode)) {
        if (unicode) {
          body += toUnicodeEscape(code) + toUnicodeEscape(nextCode);
          escapeCount += 2;
        } else {
          body += ch + src[i + 1];
        }
        i++;
      } else {
        body += toUnicodeEscape(code);
        escapeCount++;
      }
    } else if (ch === '/' && escapeSlash) {
      body += '\\/';
      escapeCount++;
    } else if (unicode && code > 0x7e) {
      body += toUnicodeEscape(code);
      escapeCount++;
    } else {
      body += ch;
    }
  }
  return { ok: true, output: withQuotes ? `"${body}"` : body, escapeCount };
}

const UNESCAPES = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t'
};

// 解析转义内容（不含外层引号），逐字扫描以便精确定位错误。
// \uXXXX 的代理对必须成对出现：孤立高/低代理定位报错，不再静默输出坏字符。
function parseEscapedBody(body) {
  let out = '';
  let escapeCount = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') {
      return { ok: false, error: `第 ${i + 1} 个字符是未转义的双引号：在字符串内容里双引号必须写成 \\"` };
    }
    if (ch.charCodeAt(0) < 0x20) {
      return { ok: false, error: `第 ${i + 1} 个字符是未转义的控制字符（码点 ${ch.charCodeAt(0)}），JSON 字符串里必须写成 \\n、\\t 或 \\uXXXX` };
    }
    if (ch !== '\\') { out += ch; continue; }
    const next = body[i + 1];
    if (next === undefined) {
      return { ok: false, error: `末尾的反斜杠后面缺少转义字符（位置 ${i + 1}）` };
    }
    if (next === 'u') {
      const hex = body.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        return { ok: false, error: `第 ${i + 1} 处 \\u 后面应跟 4 位十六进制，实际是「${hex || '(空)'}」` };
      }
      const code = parseInt(hex, 16);
      escapeCount++;
      if (isHighSurrogate(code)) {
        const tail = body.slice(i + 6, i + 12);
        const tailMatch = /^\\u([0-9a-fA-F]{4})$/.exec(tail);
        if (!tailMatch || !isLowSurrogate(parseInt(tailMatch[1], 16))) {
          return { ok: false, error: `第 ${i + 1} 处 \\u${hex} 是孤立的高代理（\\uD800–\\uDBFF），后面必须紧跟一个低代理转义 \\uDC00–\\uDFFF 组成代理对` };
        }
        out += String.fromCharCode(code, parseInt(tailMatch[1], 16));
        escapeCount++;
        i += 11;
      } else if (isLowSurrogate(code)) {
        return { ok: false, error: `第 ${i + 1} 处 \\u${hex} 是孤立的低代理（\\uDC00–\\uDFFF），它只能紧跟在高代理转义之后` };
      } else {
        out += String.fromCharCode(code);
        i += 5;
      }
    } else if (Object.prototype.hasOwnProperty.call(UNESCAPES, next)) {
      out += UNESCAPES[next];
      escapeCount++;
      i += 1;
    } else {
      return { ok: false, error: `第 ${i + 1} 处是非法转义 \\${next}：JSON 只允许 \\" \\\\ \\/ \\b \\f \\n \\r \\t 与 \\uXXXX` };
    }
  }
  return { ok: true, output: out, escapeCount };
}

// 在带引号输入里找结束引号的位置（跳过转义字符），找不到返回 -1。
function findClosingQuote(text) {
  for (let i = 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '"') return i;
  }
  return -1;
}

// 把 JSON 字符串（带引号字面量或裸转义内容）还原为普通文本。
// - 带引号：先定位真正的结束引号，结束引号后还有非空白内容时点名「多余内容」，
//   不再误报成未闭合；首尾空白会被忽略并记入 notes。
// - 不带引号：按原文逐字解析，首尾空格属于内容本身、原样保留，不再被 trim 静默吞掉。
// - 全角反斜杠 ＼（中文输入法常见误入）按半角反斜杠处理并记入 notes。
export function unescapeJsonString(input) {
  const rawInput = String(input ?? '');
  if (rawInput.length > MAX_JSON_ESCAPE_CHARS) {
    return { ok: false, error: `输入过长：${rawInput.length} 字符，上限为 ${MAX_JSON_ESCAPE_CHARS} 字符` };
  }
  if (!rawInput.trim()) return { ok: false, error: '请输入要去转义的 JSON 字符串' };
  const notes = [];
  let body = rawInput;
  if (body.includes('＼')) {
    body = body.replaceAll('＼', '\\');
    notes.push('已将全角反斜杠 ＼ 按半角 \\ 处理');
  }
  const trimmed = body.trim();
  if (trimmed.startsWith('"')) {
    const closeIdx = findClosingQuote(trimmed);
    if (closeIdx === -1) {
      return { ok: false, error: '输入以双引号开头但找不到结束引号：看起来是未闭合的 JSON 字符串' };
    }
    const rest = trimmed.slice(closeIdx + 1);
    if (rest.trim()) {
      const preview = rest.trim().slice(0, 20);
      return { ok: false, error: `字符串在第 ${closeIdx + 1} 个字符处已经结束，后面还有多余内容「${preview}」：一次只能去转义一个 JSON 字符串` };
    }
    if (trimmed !== body) notes.push('已忽略带引号字符串前后的空白');
    const literal = trimmed.slice(0, closeIdx + 1);
    const scanned = parseEscapedBody(literal.slice(1, -1));
    if (!scanned.ok) return scanned;
    try {
      const value = JSON.parse(literal);
      if (typeof value !== 'string') return { ok: false, error: '输入不是 JSON 字符串' };
      return { ok: true, output: value, escapeCount: scanned.escapeCount, quoted: true, notes };
    } catch (e) {
      return { ok: false, error: `JSON 解析失败：${e.message}` };
    }
  }
  const scanned = parseEscapedBody(body);
  if (!scanned.ok) return scanned;
  return { ok: true, output: scanned.output, escapeCount: scanned.escapeCount, quoted: false, notes };
}

export function buildJsonEscapeSummary(mode, inputText, result) {
  if (!result?.ok) return '';
  const lines = [
    `模式：${mode === 'escape' ? '转义（文本 → JSON 字符串）' : '去转义（JSON 字符串 → 文本）'}`,
    `输入：${countCodePoints(inputText)} 字符`,
    `输出：${countCodePoints(result.output)} 字符`,
    `转义序列：${result.escapeCount} 处`
  ];
  if (result.notes && result.notes.length) lines.push(`处理：${result.notes.join('；')}`);
  return lines.join('\n');
}
