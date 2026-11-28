// JSON 格式化核心逻辑：纯本地处理，不上传任何数据。
// 在原生 JSON.parse 之上补三件事：错误精确定位（行/列/出错行/指针）、
// 常见错误原因提示、解析成功后的结构统计。

// 从不同引擎的报错文案里提取位置：
// - Chrome/Node 新版：「... at position 12 (line 2 column 3)」或旧版「... at position 12」
// - Firefox：「JSON.parse: ... at line 2 column 3 of the JSON data」
function extractErrorPosition(text, message) {
  const src = String(text ?? '');
  const msg = String(message ?? '');
  let position = null;
  const posMatch = msg.match(/position\s+(\d+)/i);
  if (posMatch) position = Number(posMatch[1]);
  const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  let line = null;
  let column = null;
  if (lineColMatch) {
    line = Number(lineColMatch[1]);
    column = Number(lineColMatch[2]);
    if (position === null) {
      // 由行列反推字符位置
      const lines = src.split('\n');
      let acc = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) acc += lines[i].length + 1;
      position = acc + column - 1;
    }
  }
  if (position === null) return null;
  position = Math.max(0, Math.min(position, src.length));
  if (line === null) {
    const before = src.slice(0, position);
    line = before.split('\n').length;
    column = position - before.lastIndexOf('\n');
  }
  const lines = src.split('\n');
  const lineText = lines[line - 1] ?? '';
  return { position, line, column, lineText };
}

// 基于出错位置附近文本与全文特征，给出最可能的修复提示（只提示最靠前命中一条主因，其余作次要提示）。
function guessJsonErrorHint(text, info) {
  const src = String(text ?? '');
  const hints = [];
  if (/,\s*[}\]]/.test(src)) hints.push('存在多余的尾随逗号：JSON 不允许在 } 或 ] 前多写一个逗号，删掉它即可');
  if (/(^|[\s{[,])\/\/|(^|[\s{[,])\/\*/.test(src)) hints.push('JSON 不支持 // 或 /* */ 注释，请先删掉注释再解析');
  if (/'[^'\n]*'\s*:/.test(src) || /:\s*'[^'\n]*'/.test(src)) hints.push('疑似用了单引号：JSON 的键名和字符串值必须用双引号');
  if (/(^|[\s{,])[$A-Za-z_][$\w]*\s*:/.test(src.replace(/"([^"\\]|\\.)*"/g, '""'))) hints.push('疑似有未加引号的键名：JSON 的键名必须用双引号包起来');
  if (/\b(NaN|Infinity|undefined)\b/.test(src.replace(/"([^"\\]|\\.)*"/g, '""'))) hints.push('包含 NaN / Infinity / undefined：这些不是合法 JSON 值，数字异常可用 null 代替');
  if (info) {
    const around = src.slice(Math.max(0, info.position - 1), info.position + 1);
    if (src[info.position] === undefined) hints.push('内容在出错位置提前结束：多半是少了闭合的 }、] 或引号');
    else if (around.includes('}{') || around.includes('][')) hints.push('两个值之间疑似少了逗号分隔');
  }
  // 字符串未闭合：全文双引号（未转义）为奇数个
  const unescapedQuotes = (src.replace(/\\./g, '').match(/"/g) || []).length;
  if (unescapedQuotes % 2 === 1) hints.push('双引号数量为奇数：疑似有字符串少了结尾引号');
  return hints;
}

// 解析 JSON：成功返回 { ok, value }，失败返回带定位信息的结构化错误。
export function parseJsonDetailed(text) {
  const src = String(text ?? '');
  if (!src.trim()) return { ok: false, error: { message: '输入为空，请输入 JSON 数据' } };
  try {
    return { ok: true, value: JSON.parse(src) };
  } catch (e) {
    const info = extractErrorPosition(src, e.message);
    const hints = guessJsonErrorHint(src, info);
    return {
      ok: false,
      error: {
        message: e.message,
        position: info?.position ?? null,
        line: info?.line ?? null,
        column: info?.column ?? null,
        lineText: info?.lineText ?? '',
        hints
      }
    };
  }
}

// 递归排序对象键（数组顺序不变）。
export function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortObjectKeys(value[key]);
      return acc;
    }, {});
  }
  return value;
}

const ROOT_TYPE_NAMES = { object: '对象', array: '数组', string: '字符串', number: '数字', boolean: '布尔值', null: 'null' };

// 结构统计：根类型、对象/数组/键/各类型值计数、最大深度。
export function jsonStats(value) {
  const stats = {
    rootType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    objects: 0, arrays: 0, keys: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0, values: 0, maxDepth: 0
  };
  const walk = (node, depth) => {
    stats.values++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    if (node === null) { stats.nulls++; return; }
    if (Array.isArray(node)) { stats.arrays++; node.forEach(item => walk(item, depth + 1)); return; }
    if (typeof node === 'object') {
      stats.objects++;
      const ks = Object.keys(node);
      stats.keys += ks.length;
      ks.forEach(k => walk(node[k], depth + 1));
      return;
    }
    if (typeof node === 'string') stats.strings++;
    else if (typeof node === 'number') stats.numbers++;
    else if (typeof node === 'boolean') stats.booleans++;
  };
  walk(value, 1);
  stats.rootTypeName = ROOT_TYPE_NAMES[stats.rootType] || stats.rootType;
  return stats;
}

export function buildJsonStatsSummary(stats) {
  if (!stats) return '';
  return `根类型 ${stats.rootTypeName} · 对象 ${stats.objects} · 数组 ${stats.arrays} · 键 ${stats.keys} · 值 ${stats.values} · 最大深度 ${stats.maxDepth}`;
}

// 把结构化错误拼成可复制的诊断文本。
export function buildJsonErrorSummary(error) {
  if (!error) return '';
  const parts = [`JSON 格式错误：${error.message}`];
  if (error.line != null) parts.push(`位置：第 ${error.line} 行第 ${error.column} 列（字符 ${error.position}）`);
  if (error.lineText) parts.push(`出错行：${error.lineText}`);
  (error.hints || []).forEach(h => parts.push(`可能原因：${h}`));
  return parts.join('\n');
}
