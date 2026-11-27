// URL 编解码核心逻辑：纯本地处理，不上传任何数据。
// 相比直接裸调 encodeURIComponent/decodeURIComponent，这里补齐：
// 三种编码模式（参数 component / 完整 URL uri / 表单 form）、
// 编码前未配对代理字符定位、解码前 % 转义逐字校验与 UTF-8 序列校验
// （旧版解码失败只会抛一句英文 URI malformed，不知道错在哪）、
// 查询字符串里 + 按空格处理的选项、转义个数等统计。

export const URL_ENCODE_MODES = [
  { id: 'component', label: '参数（encodeURIComponent）' },
  { id: 'uri', label: '完整 URL（encodeURI）' },
  { id: 'form', label: '表单（x-www-form-urlencoded）' }
];

const HEX2 = /^[0-9A-Fa-f]{2}$/;

// 找未配对的代理字符（这类输入裸调 encodeURIComponent 会直接抛 URIError）
function findLoneSurrogate(src) {
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = src.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return i;
      i++; // 跳过已配对的低代理
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return i;
    }
  }
  return -1;
}

function countEscapes(text) {
  const matches = String(text).match(/%[0-9A-Fa-f]{2}/g);
  return matches ? matches.length : 0;
}

// 编码文本。options: { mode='component' }
// 成功 { ok:true, output, mode, inputChars, bytes, escapes, outputChars }
export function encodeUrlText(text, options = {}) {
  const src = String(text ?? '');
  const mode = options.mode || 'component';
  if (!src) return { ok: false, error: { message: '输入为空，请输入需要编码的内容' } };

  const lone = findLoneSurrogate(src);
  if (lone >= 0) {
    return {
      ok: false,
      error: {
        message: `第 ${lone + 1} 个字符是未配对的代理字符（通常是 Emoji 或生僻字被截断了一半），无法编码，请检查输入是否完整`,
        position: lone
      }
    };
  }

  let output;
  try {
    if (mode === 'uri') output = encodeURI(src);
    else if (mode === 'form') output = new URLSearchParams([['v', src]]).toString().slice(2);
    else output = encodeURIComponent(src);
  } catch (e) {
    return { ok: false, error: { message: `编码失败：${e.message}` } };
  }
  return {
    ok: true,
    output,
    mode,
    inputChars: src.length,
    bytes: new TextEncoder().encode(src).length,
    escapes: countEscapes(output),
    outputChars: output.length
  };
}

// 校验一段 %XX 字节（同一连续转义段）是不是合法 UTF-8。
// 返回第一个非法字节在 bytes 数组中的下标，合法返回 -1。
function firstInvalidUtf8Byte(bytes) {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { i++; continue; }
    let len;
    if (b >= 0xc2 && b <= 0xdf) len = 2;
    else if (b >= 0xe0 && b <= 0xef) len = 3;
    else if (b >= 0xf0 && b <= 0xf4) len = 4;
    else return i; // 0x80–0xC1、0xF5 以上都不能作首字节
    if (i + len > bytes.length) return i; // 序列被截断
    for (let j = 1; j < len; j++) {
      const cb = bytes[i + j];
      if (cb < 0x80 || cb > 0xbf) return i;
    }
    const second = bytes[i + 1];
    if (b === 0xe0 && second < 0xa0) return i; // 过长编码
    if (b === 0xed && second > 0x9f) return i; // UTF-16 代理区，UTF-8 里非法
    if (b === 0xf0 && second < 0x90) return i; // 过长编码
    if (b === 0xf4 && second > 0x8f) return i; // 超出 U+10FFFF
    i += len;
  }
  return -1;
}

// 解码文本。options: { mode='component'|'uri', plusAsSpace=false }
// 成功 { ok:true, output, escapes, plusCount, keptEscapes, outputChars }
export function decodeUrlText(text, options = {}) {
  const raw = String(text ?? '');
  const mode = options.mode === 'uri' ? 'uri' : 'component';
  if (!raw) return { ok: false, error: { message: '输入为空，请输入需要解码的内容' } };

  const plusCount = options.plusAsSpace ? (raw.match(/\+/g) || []).length : 0;
  const work = options.plusAsSpace ? raw.replace(/\+/g, ' ') : raw;

  // 1) % 转义逐字校验：每个 % 后面必须跟两位十六进制数字
  for (let i = 0; i < work.length; i++) {
    if (work[i] !== '%') continue;
    const tail = work.slice(i + 1, i + 3);
    if (tail.length < 2 || !HEX2.test(tail)) {
      return {
        ok: false,
        error: {
          message: `第 ${i + 1} 个字符的「%」后面不是两位十六进制数字（实际是「%${tail}」）：百分号本身应编码为 %25，后面只能跟 0–9、A–F`,
          position: i
        }
      };
    }
    i += 2;
  }

  // 2) 每个连续 %XX 段按 UTF-8 校验，定位无效序列（旧版只会报 URI malformed）
  let runBytes = [];
  let runPositions = [];
  const flushRun = () => {
    if (!runBytes.length) return null;
    const bad = firstInvalidUtf8Byte(runBytes);
    const result = bad >= 0 ? runPositions[bad] : null;
    runBytes = [];
    runPositions = [];
    return result;
  };
  for (let i = 0; i < work.length; i++) {
    if (work[i] === '%' && HEX2.test(work.slice(i + 1, i + 3))) {
      runBytes.push(parseInt(work.slice(i + 1, i + 3), 16));
      runPositions.push(i);
      i += 2;
    } else {
      const badPos = flushRun();
      if (badPos !== null) {
        return {
          ok: false,
          error: {
            message: `第 ${badPos + 1} 个字符开始的 %XX 序列不是有效的 UTF-8 编码：中文等非 ASCII 字符应是连续完整的 %XX%XX%XX，可能被截断或混入了其他编码（如 GBK）的字节`,
            position: badPos
          }
        };
      }
    }
  }
  const tailBad = flushRun();
  if (tailBad !== null) {
    return {
      ok: false,
      error: {
        message: `第 ${tailBad + 1} 个字符开始的 %XX 序列不是有效的 UTF-8 编码：中文等非 ASCII 字符应是连续完整的 %XX%XX%XX，可能被截断或混入了其他编码（如 GBK）的字节`,
        position: tailBad
      }
    };
  }

  // 3) 真正解码
  let output;
  try {
    output = mode === 'uri' ? decodeURI(work) : decodeURIComponent(work);
  } catch (e) {
    return { ok: false, error: { message: `解码失败：${e.message}` } };
  }
  return {
    ok: true,
    output,
    mode,
    escapes: countEscapes(work),
    plusCount,
    // 完整 URL 模式下 decodeURI 会保留 # ? & 等结构字符的转义，统计没解开的个数
    keptEscapes: mode === 'uri' ? countEscapes(output) : 0,
    outputChars: output.length
  };
}
