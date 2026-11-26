// XML 格式化 / 压缩 / 校验（纯本地，字符串分词实现，不依赖 DOMParser 以便在 Node 下可测）
// 支持：XML 声明、处理指令、DOCTYPE、注释、CDATA、属性引号、命名空间标签、自闭合标签。
// 校验：标签嵌套匹配、单个根元素、属性引号闭合、非法标签名；错误带行号。

const TAG_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function lineAt(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

function fail(src, idx, msg) {
  throw new Error(`第 ${lineAt(src, idx)} 行：${msg}`);
}

// 在 tag 内部（从 '<' 后开始）找 '>'，跳过引号内内容；doctype 的内部子集 [...] 也跳过。
function findTagEnd(src, start) {
  let quote = null;
  let bracket = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[') bracket++;
    else if (c === ']') bracket = Math.max(0, bracket - 1);
    else if (c === '>' && bracket === 0) return i;
  }
  return -1;
}

export function tokenizeXml(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '<') {
      let j = src.indexOf('<', i);
      if (j === -1) j = src.length;
      tokens.push({ type: 'text', value: src.slice(i, j), index: i });
      i = j;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) fail(src, i, '注释未闭合（缺少 -->）');
      tokens.push({ type: 'comment', value: src.slice(i, end + 3), index: i });
      i = end + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) fail(src, i, 'CDATA 未闭合（缺少 ]]>）');
      tokens.push({ type: 'cdata', value: src.slice(i, end + 3), index: i });
      i = end + 3;
    } else if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      if (end === -1) fail(src, i, '处理指令未闭合（缺少 ?>）');
      const isDecl = src.startsWith('<?xml', i) && /[\s?]/.test(src[i + 5] || '?');
      tokens.push({ type: isDecl ? 'decl' : 'pi', value: src.slice(i, end + 2), index: i });
      i = end + 2;
    } else if (src.startsWith('<!', i)) {
      const end = findTagEnd(src, i + 2);
      if (end === -1) fail(src, i, 'DOCTYPE 未闭合（缺少 >）');
      tokens.push({ type: 'doctype', value: src.slice(i, end + 1), index: i });
      i = end + 1;
    } else if (src.startsWith('</', i)) {
      const end = findTagEnd(src, i + 2);
      if (end === -1) fail(src, i, '结束标签未闭合（缺少 >）');
      const raw = src.slice(i, end + 1);
      const name = raw.slice(2, -1).trim();
      if (!TAG_NAME_RE.test(name)) fail(src, i, `结束标签名不合法：</${name}>`);
      tokens.push({ type: 'close', name, value: raw, index: i });
      i = end + 1;
    } else {
      const end = findTagEnd(src, i + 1);
      if (end === -1) fail(src, i, '标签未闭合（缺少 > 或属性引号未闭合）');
      const raw = src.slice(i, end + 1);
      const inner = raw.slice(1, -1);
      const selfClosing = /\/\s*$/.test(inner);
      const body = selfClosing ? inner.replace(/\/\s*$/, '') : inner;
      const nameMatch = body.match(/^\s*([^\s/>]+)/);
      const name = nameMatch ? nameMatch[1] : '';
      if (!TAG_NAME_RE.test(name)) fail(src, i, `标签名不合法：<${name || '?'}>`);
      // 粗校验属性引号成对（findTagEnd 已保证引号闭合到 >，此处查等号后裸值）
      const attrs = body.slice(nameMatch[0].length);
      const badAttr = attrs.match(/=\s*(?![\"'])[^\s>]+/);
      if (badAttr) fail(src, i, `属性值需要引号：${badAttr[0].slice(0, 30)}`);
      const attrCount = (attrs.match(/[A-Za-z_][A-Za-z0-9_.:-]*\s*=/g) || []).length;
      tokens.push({ type: selfClosing ? 'selfclose' : 'open', name, value: raw, attrCount, index: i });
      i = end + 1;
    }
  }
  return tokens;
}

// 校验嵌套并给 token 标注深度；返回统计。非法时抛带行号错误。
export function validateXml(src) {
  const tokens = tokenizeXml(src);
  const stack = [];
  let roots = 0;
  let elements = 0;
  let attributes = 0;
  let maxDepth = 0;
  let hasTextOutsideRoot = false;
  for (const t of tokens) {
    if (t.type === 'open') {
      if (stack.length === 0) roots++;
      t.depth = stack.length;
      stack.push(t);
      elements++;
      attributes += t.attrCount || 0;
      maxDepth = Math.max(maxDepth, stack.length);
    } else if (t.type === 'selfclose') {
      if (stack.length === 0) roots++;
      t.depth = stack.length;
      elements++;
      attributes += t.attrCount || 0;
      maxDepth = Math.max(maxDepth, stack.length + 1);
    } else if (t.type === 'close') {
      const top = stack.pop();
      if (!top) fail(src, t.index, `多余的结束标签 </${t.name}>，没有对应的开始标签`);
      if (top.name !== t.name) {
        fail(src, t.index, `标签不匹配：<${top.name}>（第 ${lineAt(src, top.index)} 行）应由 </${top.name}> 结束，却遇到 </${t.name}>`);
      }
      t.depth = stack.length;
    } else {
      t.depth = stack.length;
      if (t.type === 'text' && stack.length === 0 && t.value.trim()) hasTextOutsideRoot = true;
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1];
    fail(src, top.index, `标签 <${top.name}> 未闭合`);
  }
  if (elements === 0) throw new Error('没有找到任何 XML 元素');
  if (roots > 1) throw new Error(`XML 只能有一个根元素，这里有 ${roots} 个`);
  if (hasTextOutsideRoot) throw new Error('根元素外不能有文本内容');
  return { tokens, stats: { elements, attributes, maxDepth, roots } };
}

export function formatXml(src, { indentSize = 2 } = {}) {
  const { tokens, stats } = validateXml(src);
  const indent = ' '.repeat(indentSize);
  const lines = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'text') {
      const text = t.value.trim();
      if (!text) continue;
      // 纯文本内容且父元素随即闭合的情形已在 open 分支内联处理；这里是混合内容，独立成行
      lines.push(indent.repeat(t.depth) + text);
    } else if (t.type === 'open') {
      const next = tokens[k + 1];
      const after = tokens[k + 2];
      if (next && next.type === 'text' && next.value.trim() && after && after.type === 'close' && after.name === t.name) {
        lines.push(indent.repeat(t.depth) + t.value + next.value.trim() + after.value);
        k += 2;
      } else {
        lines.push(indent.repeat(t.depth) + t.value);
      }
    } else if (t.type === 'close') {
      lines.push(indent.repeat(t.depth) + t.value);
    } else {
      lines.push(indent.repeat(t.depth) + t.value.trim());
    }
  }
  return { text: lines.join('\n'), stats: { ...stats, lines: lines.length } };
}

export function minifyXml(src) {
  const { tokens, stats } = validateXml(src);
  const parts = [];
  for (const t of tokens) {
    if (t.type === 'text') {
      if (!t.value.trim()) continue; // 标签间纯空白去掉
      parts.push(t.value.trim());
    } else {
      parts.push(t.value.trim());
    }
  }
  return { text: parts.join(''), stats: { ...stats, lines: 1 } };
}
