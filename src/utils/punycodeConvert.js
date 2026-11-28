// Punycode 转换：纯本地 RFC 3492 编解码 + 域名逐标签处理（xn-- 前缀）。
// 编码：含非 ASCII 的标签才转 Punycode 并加 xn--；纯 ASCII 标签原样保留（转小写）。
// 解码：仅 xn-- 开头标签做解码，其余原样保留；非法 Punycode 定位到标签报错。
// 粘贴容错：全角字符/全角句点/中文句号按点与半角处理、URL 粘贴只取主机名、
// 末尾点（完全限定域名）保留、非 ASCII 标签先做 NFC 规范化（IDNA 口径），均以 notes 明示。
// 严格校验：标签/总长上限双向都查、非法字符定位到第几个、孤代理与不可见字符点名、
// 解出代理/控制/分隔符的结果拒绝；错误回显截断，输入有上限。

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';
const PREFIX = 'xn--';
const MAX_INPUT_CHARS = 100000;
const MAX_LABEL_LENGTH = 63;
const MAX_DOMAIN_LENGTH = 253;

function adapt(delta, numPoints, firstTime) {
  delta = firstTime ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((BASE - TMIN) * TMAX) / 2) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

function encodeDigit(d) {
  return String.fromCharCode(d < 26 ? 97 + d : 48 + d - 26);
}

function decodeDigit(ch) {
  const c = ch.codePointAt(0);
  if (c >= 97 && c <= 122) return c - 97;
  if (c >= 65 && c <= 90) return c - 65;
  if (c >= 48 && c <= 57) return c - 48 + 26;
  return -1;
}

// 单个标签（不含 xn-- 前缀）的 Punycode 编码
function punycodeEncode(input) {
  const cps = Array.from(input, (ch) => ch.codePointAt(0));
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  let output = '';
  for (const cp of cps) if (cp < 0x80) output += String.fromCodePoint(cp);
  const basicLength = Array.from(output).length;
  let handled = basicLength;
  if (basicLength > 0) output += DELIMITER;
  while (handled < cps.length) {
    let m = Infinity;
    for (const cp of cps) if (cp >= n && cp < m) m = cp;
    delta += (m - n) * (handled + 1);
    n = m;
    for (const cp of cps) {
      if (cp < n) delta += 1;
      if (cp === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          output += encodeDigit(t + ((q - t) % (BASE - t)));
          q = Math.floor((q - t) / (BASE - t));
        }
        output += encodeDigit(q);
        bias = adapt(delta, handled + 1, handled === basicLength);
        delta = 0;
        handled += 1;
      }
    }
    delta += 1;
    n += 1;
  }
  return output;
}

// 单个标签（不含 xn-- 前缀）的 Punycode 解码，失败返回 { ok:false, error }
function punycodeDecode(input) {
  if (!input) return { ok: false, error: 'xn-- 后面没有 Punycode 内容' };
  if (!/^[A-Za-z0-9-]+$/.test(input)) {
    const chars = Array.from(input);
    const badIdx = chars.findIndex((ch) => !/[A-Za-z0-9-]/.test(ch));
    const bad = chars[badIdx];
    return { ok: false, error: `第 ${badIdx + 1} 个字符「${bad}」非法，Punycode 只能由字母、数字与连字符组成` };
  }
  const output = [];
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  const lastDelim = input.lastIndexOf(DELIMITER);
  let idx = 0;
  if (lastDelim >= 0) {
    for (const ch of input.slice(0, lastDelim)) {
      if (ch.codePointAt(0) >= 0x80) return { ok: false, error: '基本字符段含非 ASCII 字符' };
      output.push(ch.codePointAt(0));
    }
    idx = lastDelim + 1;
  }
  while (idx < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) return { ok: false, error: 'Punycode 数据不完整（截断）' };
      const digit = decodeDigit(input[idx]);
      idx += 1;
      if (digit < 0) return { ok: false, error: `包含非法字符「${input[idx - 1]}」` };
      i += digit * w;
      if (i > 0x7fffffff) return { ok: false, error: 'Punycode 数值溢出，不是有效的编码' };
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
      if (w > 0x7fffffff) return { ok: false, error: 'Punycode 数值溢出，不是有效的编码' };
    }
    const outLen = output.length + 1;
    bias = adapt(i - oldi, outLen, oldi === 0);
    if (Math.floor(i / outLen) > 0x10ffff - n) return { ok: false, error: 'Punycode 解出的码点超出 Unicode 范围' };
    n += Math.floor(i / outLen);
    i %= outLen;
    output.splice(i, 0, n);
    i += 1;
  }
  // 解出的码点逐个验：代理区/控制符不是合法域名内容，String.fromCodePoint 对代理不抛错、须手动拦
  for (let ci = 0; ci < output.length; ci++) {
    const cp = output[ci];
    if (cp >= 0xd800 && cp <= 0xdfff) {
      return { ok: false, error: `解出的第 ${ci + 1} 个字符是未配对代理字符（U+${cp.toString(16).toUpperCase()}），不是有效的 Unicode 文本` };
    }
    if (cp < 0x20 || cp === 0x7f) {
      return { ok: false, error: `解出的第 ${ci + 1} 个字符是控制字符（U+${cp.toString(16).toUpperCase().padStart(4, '0')}），域名中不允许` };
    }
  }
  try {
    return { ok: true, text: String.fromCodePoint(...output) };
  } catch {
    return { ok: false, error: 'Punycode 解出的码点无效' };
  }
}

function isAscii(s) {
  return !/[^\x00-\x7F]/.test(s);
}

// 错误回显截断，避免超长输入把整段原文塞进报错
function shortEcho(s) {
  const chars = Array.from(String(s));
  return chars.length > 40 ? `${chars.slice(0, 40).join('')}…` : String(s);
}

// 全角转半角：FF01–FF5E 映射回 ASCII，U+3002/U+FF61 句点按点处理；返回 {text, count}
function normalizePunyText(raw) {
  let count = 0;
  let text = '';
  for (const ch of String(raw)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xff01 && cp <= 0xff5e) { text += String.fromCodePoint(cp - 0xfee0); count += 1; }
    else if (cp === 0x3002 || cp === 0xff61) { text += '.'; count += 1; }
    else text += ch;
  }
  return { text, count };
}

// 编码前逐码点检查原文标签：孤代理/控制/不可见字符点名定位
function checkSourceLabel(label) {
  const chars = Array.from(label);
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    if (cp >= 0xd800 && cp <= 0xdfff) return `第 ${i + 1} 个字符是未配对代理字符，无法编码（原文可能已损坏）`;
    if (cp < 0x20 || cp === 0x7f) return `第 ${i + 1} 个字符是控制字符（U+${cp.toString(16).toUpperCase().padStart(4, '0')}），域名中不允许`;
    if (cp === 0x200b || cp === 0xfeff || cp === 0x2060) {
      return `第 ${i + 1} 个字符是不可见字符 U+${cp.toString(16).toUpperCase()}（零宽），域名中不允许，请删除后重试`;
    }
  }
  return '';
}

// 标签内 ASCII 部分的合法性：只允许字母数字与连字符，非法字符定位；连字符首尾单独点名
function checkLabelAscii(label) {
  const chars = Array.from(label);
  for (let i = 0; i < chars.length; i++) {
    if (chars[i].codePointAt(0) < 0x80 && !/[A-Za-z0-9-]/.test(chars[i])) {
      return `第 ${i + 1} 个字符「${chars[i]}」不允许出现在域名标签中（只允许字母、数字、连字符与非 ASCII 文字）`;
    }
  }
  if (label.startsWith('-') || label.endsWith('-')) return '标签不能以连字符开头或结尾';
  return '';
}

function convertDomainLine(line, direction, notes, warnings) {
  let raw = line.trim();
  if (!raw) return { ok: false, error: '输入为空' };
  // 全角容错（含全角句点/中文句号按点分隔）
  const fw = normalizePunyText(raw);
  if (fw.count) { notes.push(`已将 ${fw.count} 个全角字符按半角/点处理`); raw = fw.text; }
  // URL 粘贴容错：带协议或路径/查询时只取主机名部分
  let host = raw;
  const scheme = host.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//);
  if (scheme || /[/?#]/.test(host)) {
    let rest = scheme ? host.slice(scheme[0].length) : host;
    const cut = rest.search(/[/?#]/);
    if (cut >= 0) rest = rest.slice(0, cut);
    const at = rest.lastIndexOf('@');
    if (at >= 0) rest = rest.slice(at + 1);
    if (rest !== host) notes.push('粘贴的内容像 URL，已只取主机名部分转换');
    host = rest;
  }
  // 裸主机名带端口：剥端口（须为合法端口号）
  const portMatch = host.match(/:(\d+)$/);
  if (portMatch) {
    const port = Number(portMatch[1]);
    if (port < 1 || port > 65535) return { ok: false, error: `端口 ${portMatch[1]} 超出 1–65535 范围` };
    host = host.slice(0, -portMatch[0].length);
    notes.push(`已忽略端口 :${portMatch[1]}，只转换主机名`);
  } else if (host.includes(':')) {
    return { ok: false, error: '域名中不能含冒号（如需带端口请写成 主机名:端口）' };
  }
  if (!host) return { ok: false, error: '未找到主机名部分' };
  const wsIdx = Array.from(host).findIndex((ch) => /\s/.test(ch));
  if (wsIdx >= 0) return { ok: false, error: `第 ${wsIdx + 1} 个字符是空白，域名中不能含空白` };
  // 末尾点：完全限定域名（FQDN）的合法写法，保留并提示
  let trailingDot = false;
  if (host.length > 1 && host.endsWith('.')) {
    trailingDot = true;
    host = host.slice(0, -1);
    notes.push('末尾的点是完全限定域名（FQDN）写法，已保留');
  }
  const labels = host.split('.');
  const out = [];
  for (let li = 0; li < labels.length; li++) {
    const label = labels[li];
    if (!label) return { ok: false, error: `第 ${li + 1} 段标签为空（多余的点）` };
    if (direction === 'encode') {
      const badSource = checkSourceLabel(label);
      if (badSource) return { ok: false, error: `标签「${shortEcho(label)}」：${badSource}` };
      const badAscii = checkLabelAscii(label);
      if (badAscii) return { ok: false, error: `标签「${shortEcho(label)}」：${badAscii}` };
      if (isAscii(label)) {
        if (Array.from(label).length > MAX_LABEL_LENGTH) {
          return { ok: false, error: `标签「${shortEcho(label)}」共 ${Array.from(label).length} 个字符，超过 ${MAX_LABEL_LENGTH} 字符上限` };
        }
        out.push(label.toLowerCase());
      } else {
        // IDNA 口径：先 NFC 规范化再编码，组合字符与预组合字符得到同一结果
        const nfc = label.normalize('NFC');
        if (nfc !== label) notes.push(`标签「${shortEcho(label)}」已按 NFC 规范化后再编码（组合字符合并为预组合字符）`);
        const encoded = PREFIX + punycodeEncode(nfc.toLowerCase());
        if (encoded.length > MAX_LABEL_LENGTH) return { ok: false, error: `标签「${shortEcho(label)}」编码后超过 ${MAX_LABEL_LENGTH} 字符上限` };
        out.push(encoded);
      }
    } else {
      if (/^xn--/i.test(label)) {
        if (label.length > MAX_LABEL_LENGTH) {
          return { ok: false, error: `标签「${shortEcho(label)}」共 ${label.length} 个字符，超过 ${MAX_LABEL_LENGTH} 字符上限` };
        }
        const dec = punycodeDecode(label.slice(4).toLowerCase());
        if (!dec.ok) return { ok: false, error: `标签「${shortEcho(label)}」：${dec.error}` };
        // 解出的标签若含点/斜杠等分隔符，会改变域名结构，点名拒绝
        const sepIdx = Array.from(dec.text).findIndex((ch) => './\\:@'.includes(ch) || /\s/.test(ch));
        if (sepIdx >= 0) {
          return { ok: false, error: `标签「${shortEcho(label)}」解出的第 ${sepIdx + 1} 个字符「${Array.from(dec.text)[sepIdx]}」是分隔符，解码结果不是合法的单段标签` };
        }
        if (isAscii(dec.text)) {
          warnings.push(`标签「${shortEcho(label)}」解出的是纯 ASCII「${shortEcho(dec.text)}」，正规 Punycode 不会这样编码，请核对来源`);
        }
        out.push(dec.text);
      } else {
        if (Array.from(label).length > MAX_LABEL_LENGTH && isAscii(label)) {
          return { ok: false, error: `标签「${shortEcho(label)}」共 ${Array.from(label).length} 个字符，超过 ${MAX_LABEL_LENGTH} 字符上限` };
        }
        out.push(label);
      }
    }
  }
  const joined = out.join('.');
  if (Array.from(joined).length > MAX_DOMAIN_LENGTH) {
    return { ok: false, error: `域名总长度 ${Array.from(joined).length} 个字符，超过 ${MAX_DOMAIN_LENGTH} 字符上限` };
  }
  return { ok: true, text: trailingDot ? `${joined}.` : joined };
}

// 多行批量转换：每行一个域名（或单标签）。direction: 'encode' | 'decode'
export function convertPunycode(text, direction) {
  const source = String(text ?? '');
  if (Array.from(source).length > MAX_INPUT_CHARS) {
    return { ok: false, error: `输入共 ${Array.from(source).length} 个字符，超过 ${MAX_INPUT_CHARS} 字符上限，请分批处理` };
  }
  const lines = source.split(/\r\n|\r|\n/);
  const results = [];
  const notes = [];
  const warnings = [];
  let converted = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const lineNotes = [];
    const r = convertDomainLine(lines[i], direction, lineNotes, warnings);
    if (!r.ok) return { ok: false, error: `第 ${i + 1} 行：${r.error}` };
    for (const n of lineNotes) if (!notes.includes(n)) notes.push(n);
    if (r.text !== lines[i].trim()) converted += 1;
    results.push(r.text);
  }
  if (!results.length) return { ok: false, error: '输入为空，请输入域名或单标签' };
  const result = { ok: true, text: results.join('\n'), lines: results.length, converted, notes };
  if (warnings.length) result.warnings = [...new Set(warnings)];
  return result;
}
