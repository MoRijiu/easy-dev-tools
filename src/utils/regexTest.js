// 正则测试核心逻辑（纯本地）：编译正则、收集全部匹配（含捕获组与命名组）
// 供 RegexTester.vue 使用，也可独立在 Node 下测试。

export const MAX_MATCHES = 1000;

/**
 * 编译正则。flags 由调用方传入（如 'gi'）；内部强制带 g 以便遍历全部匹配，
 * 但保留调用方是否设置 g 的信息（affectsReplace）。
 * @returns {{ regex: RegExp, hasGlobal: boolean }}
 */
export function compileRegex(pattern, flags = '') {
  if (!pattern) throw new Error('正则表达式不能为空');
  const hasGlobal = flags.includes('g');
  const effective = hasGlobal ? flags : flags + 'g';
  let regex;
  try {
    regex = new RegExp(pattern, effective);
  } catch (e) {
    throw new Error(`正则语法错误：${e.message.replace(/^Invalid regular expression:\s*/i, '')}`);
  }
  return { regex, hasGlobal };
}

/**
 * 在 text 上收集全部匹配。
 * @returns {Array<{ match: string, index: number, groups: Array<string|undefined>, named: Object|null }>}
 * 空匹配（零宽）会推进 lastIndex 避免死循环。
 */
export function collectMatches(pattern, flags, text, limit = MAX_MATCHES) {
  const { regex } = compileRegex(pattern, flags);
  const matches = [];
  if (!text) return matches;
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(text)) !== null) {
    matches.push({
      match: m[0],
      index: m.index,
      groups: m.slice(1),
      named: m.groups ? { ...m.groups } : null
    });
    if (matches.length >= limit) break;
    if (m[0].length === 0) {
      regex.lastIndex += 1;
      if (regex.lastIndex > text.length) break;
    }
  }
  return matches;
}

/**
 * 把文本按匹配切成片段，供高亮渲染：[{ text, isMatch, matchIndex }]
 */
export function buildSegments(text, matches) {
  const segments = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index > cursor) segments.push({ text: text.slice(cursor, m.index), isMatch: false });
    if (m.match.length > 0) {
      segments.push({ text: m.match, isMatch: true, matchIndex: i });
      cursor = m.index + m.match.length;
    } else {
      // 零宽匹配：不产生高亮片段，仅在该位置插入一个空标记片段
      segments.push({ text: '', isMatch: true, matchIndex: i, zeroWidth: true });
      cursor = m.index;
    }
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), isMatch: false });
  return segments;
}

/**
 * 执行替换：replacement 支持 $1、$<name>、$&、$$ 等标准占位。
 * 未设置 g 标志时只替换第一处（与 JS 原生 String.replace 语义一致）。
 */
export function applyReplace(pattern, flags, text, replacement) {
  const { regex, hasGlobal } = compileRegex(pattern, flags);
  if (!hasGlobal) {
    const single = new RegExp(regex.source, flags.replace('g', ''));
    return text.replace(single, replacement);
  }
  return text.replace(regex, replacement);
}
