// Unicode 转义与 HTML 实体编解码核心（纯本地）
// Unicode 编码：\uXXXX（星平面字符拆代理对）或 \u{...}（ES6 形式）
// Unicode 解码：识别 \uXXXX、\u{...}、\xXX，非法序列精确定位报错
// HTML 编码：命名 / 十进制 / 十六进制三种实体形式
// HTML 解码：命名实体表 + 十进制 / 十六进制数字实体，未知实体原样保留

export const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae', trade: '\u2122',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  laquo: '\u00ab', raquo: '\u00bb', times: '\u00d7', divide: '\u00f7',
  plusmn: '\u00b1', deg: '\u00b0', micro: '\u00b5', para: '\u00b6',
  middot: '\u00b7', bull: '\u2022', dagger: '\u2020', Dagger: '\u2021',
  permil: '\u2030', prime: '\u2032', Prime: '\u2033',
  larr: '\u2190', uarr: '\u2191', rarr: '\u2192', darr: '\u2193', harr: '\u2194',
  alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4',
  pi: '\u03c0', omega: '\u03c9', Omega: '\u03a9',
  infin: '\u221e', ne: '\u2260', le: '\u2264', ge: '\u2265',
  sum: '\u2211', radic: '\u221a', int: '\u222b',
  hearts: '\u2665', spades: '\u2660', clubs: '\u2663', diams: '\u2666',
  check: '\u2713', cross: '\u2717', star: '\u2605',
  cent: '\u00a2', pound: '\u00a3', yen: '\u00a5', euro: '\u20ac',
  sect: '\u00a7', uml: '\u00a8', ordf: '\u00aa', ordm: '\u00ba',
  iexcl: '\u00a1', iquest: '\u00bf', szlig: '\u00df',
  agrave: '\u00e0', eacute: '\u00e9', ccedil: '\u00e7',
  Alpha: '\u0391', Beta: '\u0392', Gamma: '\u0393', Delta: '\u0394',
  Pi: '\u03a0', Sigma: '\u03a3', sigma: '\u03c3', lambda: '\u03bb',
  mu: '\u03bc', tau: '\u03c4', phi: '\u03c6'
};

const CHAR_TO_NAME = {};
for (const [name, ch] of Object.entries(NAMED_ENTITIES)) {
  if (!(ch in CHAR_TO_NAME)) CHAR_TO_NAME[ch] = name;
}

function hex4(cp) {
  return cp.toString(16).toUpperCase().padStart(4, '0');
}

// scope: 'nonAscii'（默认，仅编码非 ASCII）| 'all'（全部字符）
// style: 'escape'（\uXXXX）| 'brace'（\u{...}）
export function unicodeEncode(text, options = {}) {
  const scope = options.scope || 'nonAscii';
  const style = options.style || 'escape';
  let out = '';
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (scope !== 'all' && cp < 0x80) { out += ch; continue; }
    if (style === 'brace') {
      out += '\\u{' + cp.toString(16) + '}';
    } else if (cp <= 0xffff) {
      out += '\\u' + hex4(cp);
    } else {
      const v = cp - 0x10000;
      out += '\\u' + hex4(0xd800 + (v >> 10)) + '\\u' + hex4(0xdc00 + (v & 0x3ff));
    }
  }
  return out;
}

export function unicodeDecode(text) {
  const s = String(text);
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && (s[i + 1] === 'u' || s[i + 1] === 'x')) {
      const start = i;
      if (s[i + 1] === 'x') {
        const hex = s.slice(i + 2, i + 4);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
          throw new Error('第 ' + (start + 1) + ' 个字符处的 \\x 转义不完整，需要 2 位十六进制');
        }
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        continue;
      }
      if (s[i + 2] === '{') {
        const end = s.indexOf('}', i + 3);
        if (end === -1) throw new Error('第 ' + (start + 1) + ' 个字符处的 \\u{...} 缺少右花括号');
        const hex = s.slice(i + 3, end);
        if (!/^[0-9a-fA-F]+$/.test(hex)) {
          throw new Error('第 ' + (start + 1) + ' 个字符处的 \\u{...} 内不是合法十六进制');
        }
        const cp = parseInt(hex, 16);
        if (cp > 0x10ffff) throw new Error('第 ' + (start + 1) + ' 个字符处的码点超出 Unicode 范围');
        out += String.fromCodePoint(cp);
        i = end + 1;
        continue;
      }
      const hex = s.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        throw new Error('第 ' + (start + 1) + ' 个字符处的 \\u 转义不完整，需要 4 位十六进制');
      }
      const unit = parseInt(hex, 16);
      // 代理对：高代理后紧跟低代理时合并为一个字符
      if (unit >= 0xd800 && unit <= 0xdbff && s[i + 6] === '\\' && s[i + 7] === 'u') {
        const hex2 = s.slice(i + 8, i + 12);
        if (/^[0-9a-fA-F]{4}$/.test(hex2)) {
          const low = parseInt(hex2, 16);
          if (low >= 0xdc00 && low <= 0xdfff) {
            out += String.fromCodePoint(0x10000 + ((unit - 0xd800) << 10) + (low - 0xdc00));
            i += 12;
            continue;
          }
        }
      }
      out += String.fromCharCode(unit);
      i += 6;
      continue;
    }
    out += s[i];
    i += 1;
  }
  return out;
}

// mode: 'named'（优先命名实体）| 'decimal'（&#...;）| 'hex'（&#x...;）
// scope: 'nonAscii'（默认：转义 &<>"' 与非 ASCII）| 'all'（所有非字母数字字符）
export function htmlEncode(text, options = {}) {
  const mode = options.mode || 'named';
  const scope = options.scope || 'nonAscii';
  let out = '';
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    const mustEscape = cp < 0x80
      ? (ch === '&' || ch === '<' || ch === '>' || ch === '"' || ch === "'" || (scope === 'all' && !/[A-Za-z0-9 \n\t]/.test(ch)))
      : true;
    if (!mustEscape) { out += ch; continue; }
    if (mode === 'named' && CHAR_TO_NAME[ch]) {
      out += '&' + CHAR_TO_NAME[ch] + ';';
    } else if (mode === 'hex') {
      out += '&#x' + cp.toString(16).toUpperCase() + ';';
    } else {
      out += '&#' + cp + ';';
    }
  }
  return out;
}

export function htmlDecode(text) {
  return String(text).replace(/&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const cp = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return whole;
      try { return String.fromCodePoint(cp); } catch { return whole; }
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : whole;
  });
}

export function convertUnicodeHtml(text, mode, options = {}) {
  switch (mode) {
    case 'unicode-encode': return unicodeEncode(text, options);
    case 'unicode-decode': return unicodeDecode(text);
    case 'html-encode': return htmlEncode(text, options);
    case 'html-decode': return htmlDecode(text);
    default: throw new Error('未知转换模式：' + mode);
  }
}
