// Unicode 转义与 HTML 实体编解码核心（纯本地）
// Unicode 编码：\uXXXX（星平面字符拆代理对）或 \u{...}（ES6 形式）
// Unicode 解码：识别 \uXXXX、\u{...}、\xXX，非法序列精确定位报错
// HTML 编码：命名 / 十进制 / 十六进制三种实体形式
// HTML 解码：命名实体表（110+，含规范大写变体）+ 十进制 / 十六进制数字实体，未知实体原样保留
// 数字实体指向码点 0 / 代理区 / 超范围时按 HTML 规范替换为 U+FFFD；Unicode 解码遇孤立代理定位报错

const NAMED_ENTITIES = {
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
  mu: '\u03bc', tau: '\u03c4', phi: '\u03c6',
  // HTML 规范定义的大写变体（与小写同义，浏览器均识别）
  AMP: '&', LT: '<', GT: '>', QUOT: '"', COPY: '\u00a9', REG: '\u00ae', TRADE: '\u2122',
  // 常用补充：希腊字母其余部分
  epsilon: '\u03b5', zeta: '\u03b6', eta: '\u03b7', theta: '\u03b8', Theta: '\u0398',
  iota: '\u03b9', kappa: '\u03ba', nu: '\u03bd', xi: '\u03be', Xi: '\u039e',
  rho: '\u03c1', upsilon: '\u03c5', chi: '\u03c7', psi: '\u03c8', Psi: '\u03a8',
  Lambda: '\u039b', Upsilon: '\u03a5', Phi: '\u03a6',
  // 常用补充：数学与符号
  asymp: '\u2248', equiv: '\u2261', oplus: '\u2295', otimes: '\u2297',
  perp: '\u22a5', sdot: '\u22c5', lceil: '\u2308', rceil: '\u2309',
  lfloor: '\u230a', rfloor: '\u230b', lang: '\u27e8', rang: '\u27e9',
  loz: '\u25ca',
  // 常用补充：拉丁与标点
  Agrave: '\u00c0', Eacute: '\u00c9', ecirc: '\u00ea', euml: '\u00eb',
  iacute: '\u00ed', ntilde: '\u00f1', oacute: '\u00f3', ouml: '\u00f6',
  uacute: '\u00fa', uuml: '\u00fc', yuml: '\u00ff',
  OElig: '\u0152', oelig: '\u0153', Scaron: '\u0160', scaron: '\u0161',
  Yuml: '\u0178', fnof: '\u0192', circ: '\u02c6', tilde: '\u02dc',
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', zwnj: '\u200c', zwj: '\u200d',
  lrm: '\u200e', rlm: '\u200f', sbquo: '\u201a', bdquo: '\u201e'
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
function unicodeEncode(text, options = {}) {
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

function unicodeDecode(text) {
  const s = String(text);
  let out = '';
  let i = 0;
  while (i < s.length) {
    // \\ 是转义后的反斜杠本身：输出一个 \，其后的 uXXXX 不再当转义解析
    if (s[i] === '\\' && s[i + 1] === '\\') { out += '\\'; i += 2; continue; }
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
        if (cp >= 0xd800 && cp <= 0xdfff) {
          throw new Error('第 ' + (start + 1) + ' 个字符处的 \\u{...} 是代理区码点（D800–DFFF），不能单独表示字符，请改用完整码点或 \\uXXXX 代理对');
        }
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
      if (unit >= 0xd800 && unit <= 0xdbff) {
        if (s[i + 6] === '\\' && s[i + 7] === 'u') {
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
        throw new Error('第 ' + (start + 1) + ' 个字符处是孤立的高代理（D800–DBFF），后面必须紧跟一个低代理 \\uDC00–\\uDFFF 才能组成字符');
      }
      if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new Error('第 ' + (start + 1) + ' 个字符处是孤立的低代理（DC00–DFFF），前面必须先有一个高代理 \\uD800–\\uDBFF');
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
function htmlEncode(text, options = {}) {
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

function htmlDecode(text) {
  return String(text).replace(/&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const cp = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(cp) || cp < 0) return whole;
      // 按 HTML 规范：码点 0、代理区与超出 Unicode 范围的值一律替换为 U+FFFD，
      // 旧版对代理区会解出孤代理乱码、对 0 会解出不可见的 NUL 字符
      if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '\ufffd';
      return String.fromCodePoint(cp);
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : whole;
  });
}

// 统计解码时原样保留的未知命名实体（去重保序），供页面提示
export function findUnknownEntities(text) {
  const seen = [];
  const re = /&([A-Za-z][A-Za-z0-9]+);/g;
  let m;
  const s = String(text);
  while ((m = re.exec(s)) !== null) {
    if (!Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, m[1]) && !seen.includes(m[0])) seen.push(m[0]);
  }
  return seen;
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
