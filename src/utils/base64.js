// Base64 编解码核心逻辑：纯本地处理，不上传任何数据。
// 相比直接 atob/btoa，这里补齐：大文本分块编码（避免展开参数爆栈）、
// URL-safe 字母表、解码前的逐字校验与错误定位、缺填充自动补齐提示、
// 解出字节不是合法 UTF-8 时的明确报错（而不是静默替换成 �）。

const STD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// 分块把字节转成二进制字符串，避免 String.fromCharCode(...bytes) 在大输入时爆栈。
function bytesToBinaryString(bytes) {
  const CHUNK = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return out;
}

// 编码文本（先转 UTF-8 字节）。options: { urlSafe=false, padding=true }
export function encodeBase64Text(text, options = {}) {
  const src = String(text ?? '');
  const bytes = new TextEncoder().encode(src);
  let output = btoa(bytesToBinaryString(bytes));
  if (options.urlSafe) output = output.replace(/\+/g, '-').replace(/\//g, '_');
  if (options.padding === false) output = output.replace(/=+$/, '');
  return {
    output,
    inputChars: src.length,
    bytes: bytes.length,
    outputChars: output.length,
    alphabet: options.urlSafe ? 'URL-safe' : '标准'
  };
}

// 校验并解码 Base64 文本。成功 { ok:true, text, bytes, alphabet, warnings }
// 失败 { ok:false, error:{ message, position? } }，position 为去掉空白后的字符下标（从 1 起的第几个在 message 里说明）。
export function decodeBase64Text(input) {
  const raw = String(input ?? '');
  const cleaned = raw.replace(/\s/g, '');
  if (!cleaned) return { ok: false, error: { message: '输入为空，请输入 Base64 字符串' } };

  const hasStdOnly = /[+/]/.test(cleaned);
  const hasUrlOnly = /[-_]/.test(cleaned);
  if (hasStdOnly && hasUrlOnly) {
    return { ok: false, error: { message: '同时混用了标准字母表的 + / 与 URL-safe 字母表的 - _，请统一成一种' } };
  }
  const urlSafe = hasUrlOnly;
  const alphabetChars = urlSafe ? URL_CHARS : STD_CHARS;

  // 逐字校验：非法字符精确定位
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '=') continue;
    if (!alphabetChars.includes(ch)) {
      const hint = /[-_]/.test(ch) || /[+/]/.test(ch)
        ? '该字符属于另一种 Base64 字母表'
        : 'Base64 只允许 A–Z、a–z、0–9 与两个符号字符';
      return { ok: false, error: { message: `第 ${i + 1} 个字符「${ch}」不是合法的 Base64 字符：${hint}`, position: i } };
    }
  }

  // 填充校验：= 只能出现在末尾且最多 2 个
  const firstPad = cleaned.indexOf('=');
  let core = cleaned;
  let padCount = 0;
  if (firstPad !== -1) {
    const tail = cleaned.slice(firstPad);
    if (!/^=+$/.test(tail)) {
      return { ok: false, error: { message: `第 ${firstPad + 1} 个字符的填充符 = 只能出现在字符串末尾`, position: firstPad } };
    }
    padCount = tail.length;
    if (padCount > 2) {
      return { ok: false, error: { message: `填充符 = 最多 2 个，当前有 ${padCount} 个`, position: firstPad } };
    }
    if (cleaned.length % 4 !== 0) {
      return { ok: false, error: { message: `带填充时总长度必须是 4 的倍数，当前 ${cleaned.length} 个字符`, position: firstPad } };
    }
    core = cleaned.slice(0, firstPad);
  }
  if (core.length % 4 === 1) {
    return { ok: false, error: { message: `长度不合法：去掉填充后 ${core.length} 个字符，余数不能为 1（可能少粘了字符或多删了字符）` } };
  }

  const warnings = [];
  let normalized = urlSafe ? core.replace(/-/g, '+').replace(/_/g, '/') : core;
  const needPad = (4 - (normalized.length % 4)) % 4;
  if (padCount === 0 && needPad > 0) {
    warnings.push('缺少结尾填充 =，已自动补齐后解码');
  }
  normalized += '='.repeat(padCount > 0 ? padCount : needPad);

  let bytes;
  try {
    const binary = atob(normalized);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch (e) {
    return { ok: false, error: { message: `解码失败：${e.message}` } };
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, text, bytes: bytes.length, inputChars: cleaned.length, alphabet: urlSafe ? 'URL-safe' : '标准', warnings };
  } catch {
    return {
      ok: false,
      error: {
        message: `解出的 ${bytes.length} 字节不是合法的 UTF-8 文本：这段 Base64 编码的可能是图片、文件等二进制数据，而不是文本`
      }
    };
  }
}

// 膨胀率文案：编码后字符数相对 UTF-8 字节数的增长比例。
export function base64GrowthText(bytes, outputChars) {
  if (!bytes) return '';
  const ratio = ((outputChars / bytes - 1) * 100).toFixed(1);
  return `约为原始字节的 ${(outputChars / bytes).toFixed(2)} 倍（+${ratio}%）`;
}
