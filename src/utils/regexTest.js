// 正则测试核心逻辑（纯本地）：编译正则、收集全部匹配（含捕获组与命名组）
// 供 RegexTester.vue 使用，也可独立在 Node 下测试。

export const MAX_MATCHES = 1000;
export const VALID_FLAGS = 'dgimsuvy';

/**
 * 解析用户输入：支持直接粘贴字面量形式 /pattern/flags（最后一个未转义的 / 之后为标志）。
 * 返回 { pattern, literalFlags }；不是字面量时 literalFlags 为 ''、pattern 为原文。
 * 字面量里的 \/ 还原为 /。
 */
export function parsePatternInput(input) {
  const raw = String(input ?? '');
  if (!raw.startsWith('/')) return { pattern: raw, literalFlags: '' };
  // 找最后一个未被反斜杠转义的 /
  let lastSlash = -1;
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === '/' && raw[i - 1] !== '\\') lastSlash = i;
  }
  if (lastSlash <= 0) return { pattern: raw, literalFlags: '' };
  const tail = raw.slice(lastSlash + 1);
  if (!/^[a-z]*$/.test(tail) || [...tail].some(c => !VALID_FLAGS.includes(c))) {
    return { pattern: raw, literalFlags: '' };
  }
  return { pattern: raw.slice(1, lastSlash).replace(/\\\//g, '/'), literalFlags: tail };
}

/** 常见语法错误的中文定位提示（按 V8/SpiderMonkey 报错关键词匹配） */
const ERROR_HINTS = [
  [/unterminated character class|未终止的字符类/i, '字符类 [ 没有闭合：检查是否漏写 ]，或 [ 本意是字面量时写成 \\['],
  [/unterminated group|未终止的分组/i, '分组 ( 没有闭合：检查是否漏写 )'],
  [/unmatched '\)'|unexpected token.*\)/i, '多了一个 )：括号没有配对'],
  [/nothing to repeat|量词.*无目标/i, '量词（* + ? {m,n}）前面没有可重复的内容：检查是否多写了量词或漏写了字符'],
  [/invalid quantifier|量词范围/i, '{m,n} 量词写法有误：n 不能小于 m，且只能是数字与逗号'],
  [/duplicate capture group name|重复.*命名/i, '命名捕获组重名：同一正则里 (?<name>…) 的 name 不能重复'],
  [/invalid named capture|invalid group name/i, '命名捕获组名不合法：只能用字母、数字、下划线和 $，且不能以数字开头'],
  [/invalid escape|无效.*转义/i, '转义写法有误：反斜杠后跟了不认识的字符，字面量反斜杠请写成 \\\\'],
  [/backreference|反向引用/i, '反向引用编号不存在：\\k 或 \\1 引用的分组还没有定义'],
  [/invalid unicode|unicode/i, 'u/v 标志下转义或码点写法有误：\\u{...} 的码点需在 0–10FFFF 内'],
  [/range out of order|字符范围/i, '字符类范围顺序反了：如 [z-a] 应写成 [a-z]'],
];

export function explainRegexError(message) {
  const msg = String(message || '');
  for (const [re, hint] of ERROR_HINTS) if (re.test(msg)) return hint;
  return '';
}

/**
 * 编译正则。flags 由调用方传入（如 'gi'）；内部强制带 g 以便遍历全部匹配，
 * 但保留调用方是否设置 g 的信息（affectsReplace）。
 * u 与 v 互斥：同时出现时明确报错（原生只会给一句英文提示）。
 * @returns {{ regex: RegExp, hasGlobal: boolean }}
 */
export function compileRegex(pattern, flags = '') {
  if (!pattern) throw new Error('正则表达式不能为空');
  const bad = [...String(flags)].filter(c => !VALID_FLAGS.includes(c));
  if (bad.length) throw new Error(`不支持的标志「${bad[0]}」：可用标志只有 ${VALID_FLAGS.split('').join(' ')}`);
  if (flags.includes('u') && flags.includes('v')) throw new Error('u 与 v 标志不能同时使用：v（Unicode 集）是 u 的增强版，二选一');
  const hasGlobal = flags.includes('g');
  const effective = hasGlobal ? flags : flags + 'g';
  let regex;
  try {
    regex = new RegExp(pattern, effective);
  } catch (e) {
    const clean = e.message.replace(/^Invalid regular expression:\s*/i, '').replace(/^\/.*\/[a-z]*:\s*/, '');
    const hint = explainRegexError(e.message);
    throw new Error(`正则语法错误：${clean}${hint ? `。提示：${hint}` : ''}`);
  }
  return { regex, hasGlobal };
}

/** 零宽匹配后按规范推进 lastIndex：u/v 模式下跨过完整码点（不劈开代理对），否则 +1 码元 */
export function advanceIndex(text, index, unicodeAware) {
  if (!unicodeAware || index >= text.length) return index + 1;
  const hi = text.charCodeAt(index);
  if (hi >= 0xd800 && hi <= 0xdbff && index + 1 < text.length) {
    const lo = text.charCodeAt(index + 1);
    if (lo >= 0xdc00 && lo <= 0xdfff) return index + 2;
  }
  return index + 1;
}

/** 把码元下标换算成 1 起的行/列（列按码点计，Emoji 算 1 列） */
export function indexToLineCol(text, index) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') { line++; lineStart = i + 1; }
  }
  const col = [...text.slice(lineStart, index)].length + 1;
  return { line, col };
}

/**
 * 灾难性回溯风险启发式检测：嵌套量词（如 (a+)+、(a*)*、(a|aa)+$）在不匹配长文本上
 * 可能让页面长时间无响应。只提示不拦截。返回提示数组。
 */
export function detectBacktrackRisks(pattern) {
  const risks = [];
  const p = String(pattern || '');
  // 分组内含量词、分组本身又含量词：(x+)+ / (x*)* / (x?)+ 等
  if (/\([^()]*[+*][^()]*\)\s*(?:[+*]|\{\d)/.test(p) || /\([^()]*\{\d[^()]*\)\s*(?:[+*]|\{\d)/.test(p)) {
    risks.push('检测到嵌套量词（如 (a+)+）：在不匹配的长文本上可能指数级回溯、让页面卡死，建议改写为等价的单层量词或占有式思路');
  }
  // 交替分支重叠 + 量词：(a|aa)+ / (x|x)+
  if (/\([^()]*\|[^()]*\)\s*(?:[+*]|\{\d)/.test(p) && /(.)\|\1|\+\||\*\|/.test(p)) {
    risks.push('交替分支存在重叠且整体带量词，可能引发大量回溯，建议让分支互斥');
  }
  return risks;
}

/**
 * 在 text 上收集全部匹配。
 * @returns {{ matches: Array, truncated: boolean }}
 * 每项含 match/index/end/line/col/groups/named/indices（d 标志时为捕获组下标，否则 null）。
 * 空匹配（零宽）会按码点推进 lastIndex 避免死循环；达到上限时多探一处以准确判定 truncated。
 */
export function collectMatches(pattern, flags, text, limit = MAX_MATCHES) {
  const { regex } = compileRegex(pattern, flags);
  const matches = [];
  if (!text) return { matches, truncated: false };
  const unicodeAware = flags.includes('u') || flags.includes('v');
  let m;
  let truncated = false;
  regex.lastIndex = 0;
  while ((m = regex.exec(text)) !== null) {
    if (matches.length >= limit) { truncated = true; break; }
    const { line, col } = indexToLineCol(text, m.index);
    matches.push({
      match: m[0],
      index: m.index,
      end: m.index + m[0].length,
      line,
      col,
      groups: m.slice(1),
      named: m.groups ? { ...m.groups } : null,
      indices: m.indices ? m.indices.map(pair => (pair ? [...pair] : null)) : null
    });
    if (m[0].length === 0) {
      regex.lastIndex = advanceIndex(text, regex.lastIndex, unicodeAware);
      if (regex.lastIndex > text.length) break;
    }
  }
  return { matches, truncated };
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
