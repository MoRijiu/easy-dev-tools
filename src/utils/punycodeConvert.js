// Punycode 转换：纯本地 RFC 3492 编解码 + 域名逐标签处理（xn-- 前缀）。
// 编码：含非 ASCII 的标签才转 Punycode 并加 xn--；纯 ASCII 标签原样保留（转小写）。
// 解码：仅 xn-- 开头标签做解码，其余原样保留；非法 Punycode 定位到标签报错。

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';
export const PREFIX = 'xn--';

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
export function punycodeEncode(input) {
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
export function punycodeDecode(input) {
  if (!/^[A-Za-z0-9-]+$/.test(input)) {
    const bad = Array.from(input).find((ch) => !/[A-Za-z0-9-]/.test(ch));
    return { ok: false, error: `包含非法字符「${bad}」，Punycode 只能由字母、数字与连字符组成` };
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
  try {
    return { ok: true, text: String.fromCodePoint(...output) };
  } catch {
    return { ok: false, error: 'Punycode 解出的码点无效' };
  }
}

function isAscii(s) {
  return !/[^\x00-\x7F]/.test(s);
}

function convertDomainLine(line, direction) {
  const raw = line.trim();
  if (!raw) return { ok: false, error: '输入为空' };
  if (/\s/.test(raw)) return { ok: false, error: '域名中不能含空格' };
  const labels = raw.split('.');
  const out = [];
  for (let li = 0; li < labels.length; li++) {
    const label = labels[li];
    if (!label) return { ok: false, error: `第 ${li + 1} 段标签为空（多余的点）` };
    if (direction === 'encode') {
      if (isAscii(label)) {
        if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)) {
          return { ok: false, error: `标签「${label}」含非法字符或以连字符开头/结尾` };
        }
        out.push(label.toLowerCase());
      } else {
        const encoded = PREFIX + punycodeEncode(label.toLowerCase());
        if (encoded.length > 63) return { ok: false, error: `标签「${label}」编码后超过 63 字符上限` };
        out.push(encoded);
      }
    } else {
      if (/^xn--/i.test(label)) {
        const dec = punycodeDecode(label.slice(4).toLowerCase());
        if (!dec.ok) return { ok: false, error: `标签「${label}」：${dec.error}` };
        out.push(dec.text);
      } else {
        out.push(label);
      }
    }
  }
  const joined = out.join('.');
  if (direction === 'encode' && joined.length > 253) return { ok: false, error: '域名总长度超过 253 字符上限' };
  return { ok: true, text: joined };
}

// 多行批量转换：每行一个域名（或单标签）。direction: 'encode' | 'decode'
export function convertPunycode(text, direction) {
  const lines = String(text ?? '').split(/\r?\n/);
  const results = [];
  let converted = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = convertDomainLine(lines[i], direction);
    if (!r.ok) return { ok: false, error: `第 ${i + 1} 行：${r.error}` };
    if (r.text !== lines[i].trim()) converted += 1;
    results.push(r.text);
  }
  if (!results.length) return { ok: false, error: '输入为空，请输入域名或单标签' };
  return { ok: true, text: results.join('\n'), lines: results.length, converted };
}
