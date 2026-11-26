// JSON 字符串转义核心逻辑：纯本地处理，不上传任何数据。遵循 RFC 8259 字符串规则。

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

// 把普通文本转义为 JSON 字符串内容。options:
// - unicode: 非 ASCII 字符也转成 \uXXXX（按 UTF-16 码元，Emoji 输出代理对两段）
// - escapeSlash: 正斜杠 / 转成 \/
// - withQuotes: 输出带外层双引号的完整 JSON 字符串字面量
export function escapeJsonString(text, options = {}) {
  const { unicode = false, escapeSlash = false, withQuotes = true } = options;
  const src = String(text ?? '');
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
      out += String.fromCharCode(parseInt(hex, 16));
      escapeCount++;
      i += 5;
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

// 把 JSON 字符串（带引号字面量或裸转义内容）还原为普通文本。
export function unescapeJsonString(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: '请输入要去转义的 JSON 字符串' };
  if (raw.startsWith('"')) {
    if (raw.length < 2 || !raw.endsWith('"')) {
      return { ok: false, error: '输入以双引号开头但没有以双引号结尾：看起来是未闭合的 JSON 字符串' };
    }
    // 先用自有扫描器定位错误，再用 JSON.parse 兜底校验整体合法性。
    const scanned = parseEscapedBody(raw.slice(1, -1));
    if (!scanned.ok) return scanned;
    try {
      const value = JSON.parse(raw);
      if (typeof value !== 'string') return { ok: false, error: '输入不是 JSON 字符串' };
      return { ok: true, output: value, escapeCount: scanned.escapeCount, quoted: true };
    } catch (e) {
      return { ok: false, error: `JSON 解析失败：${e.message}` };
    }
  }
  const scanned = parseEscapedBody(raw);
  if (!scanned.ok) return scanned;
  return { ok: true, output: scanned.output, escapeCount: scanned.escapeCount, quoted: false };
}

export function buildJsonEscapeSummary(mode, inputText, result) {
  if (!result?.ok) return '';
  const lines = [
    `模式：${mode === 'escape' ? '转义（文本 → JSON 字符串）' : '去转义（JSON 字符串 → 文本）'}`,
    `输入：${String(inputText ?? '').length} 字符`,
    `输出：${result.output.length} 字符`,
    `转义序列：${result.escapeCount} 处`
  ];
  return lines.join('\n');
}
