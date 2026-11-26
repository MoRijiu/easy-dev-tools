// HTML 格式化 / 压缩 / 校验（纯本地，字符串级解析，不依赖 DOMParser 以便 Node 下可测）
// 支持：DOCTYPE、注释、CDATA（原样）、开始/结束/自闭合标签、属性（含引号内 > 与 =）、
// 原始文本元素 script/style/pre/textarea（内容原样保留，不重排）、空元素（void）。
// 校验：标签嵌套匹配、未闭合标签/注释/引号/原始文本元素，错误定位到行。
// 美化：块级子元素逐行缩进；仅含文本或行内元素的元素单行呈现；混合内容中连续文本/行内片段合并成一行。

export const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'pre', 'textarea']);

const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i',
  'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong',
  'sub', 'sup', 'time', 'u', 'var', 'wbr', 'img', 'input', 'button', 'label',
  'select', 'textarea', 'svg', 'path', 'use', 'slot'
]);

function lineAt(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}
function fail(src, idx, msg) {
  throw new Error(`第 ${lineAt(src, idx)} 行：${msg}`);
}

const isNameStart = (c) => /[A-Za-z]/.test(c || '');
const isNameChar = (c) => /[A-Za-z0-9._:-]/.test(c || '');

// 解析开始标签（i 指向 '<' 且 src[i+1] 为字母），返回 { node, next }
function parseOpenTag(src, i) {
  const start = i;
  let j = i + 1;
  let name = '';
  while (j < src.length && isNameChar(src[j])) { name += src[j]; j++; }
  const attrs = [];
  let selfClosing = false;
  for (;;) {
    while (j < src.length && /\s/.test(src[j])) j++;
    if (j >= src.length) fail(src, start, `标签 <${name}> 未闭合（缺少 >）`);
    if (src[j] === '>') { j++; break; }
    if (src[j] === '/' && src[j + 1] === '>') { selfClosing = true; j += 2; break; }
    if (src[j] === '/') { j++; continue; } // 容忍孤立的 /
    // 属性名
    let attrName = '';
    while (j < src.length && !/[\s=/>]/.test(src[j])) { attrName += src[j]; j++; }
    if (!attrName) fail(src, j, `标签 <${name}> 属性写法有误`);
    while (j < src.length && /\s/.test(src[j])) j++;
    let attrValue = null;
    let quote = '';
    if (src[j] === '=') {
      j++;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '"' || src[j] === "'") {
        quote = src[j];
        const end = src.indexOf(quote, j + 1);
        if (end === -1) fail(src, j, `属性 ${attrName} 的引号未闭合`);
        attrValue = src.slice(j + 1, end);
        j = end + 1;
      } else {
        let v = '';
        while (j < src.length && !/[\s>]/.test(src[j])) { v += src[j]; j++; }
        attrValue = v;
      }
    }
    attrs.push({ name: attrName, value: attrValue, quote });
  }
  return { name, attrs, selfClosing, next: j, index: start };
}

function renderAttrs(attrs) {
  if (!attrs.length) return '';
  return ' ' + attrs.map((a) => {
    if (a.value === null) return a.name;
    const q = a.quote || '"';
    // 值里含所选引号时改用另一种引号
    if (a.value.includes(q)) {
      const alt = q === '"' ? "'" : '"';
      if (!a.value.includes(alt)) return `${a.name}=${alt}${a.value}${alt}`;
    }
    return `${a.name}=${q}${a.value}${q}`;
  }).join(' ');
}

export function parseHtml(src) {
  if (!src || !src.trim()) throw new Error('输入为空');
  const root = { type: 'root', children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  let sawElement = false;

  const pushText = (text, index) => {
    if (text) top().children.push({ type: 'text', text, index });
  };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { pushText(src.slice(i), i); i = src.length; break; }
    if (lt > i) pushText(src.slice(i, lt), i);
    i = lt;
    const next = src[i + 1];

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) fail(src, i, '注释未闭合（缺少 -->）');
      top().children.push({ type: 'comment', text: src.slice(i, end + 3), index: i });
      i = end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) fail(src, i, 'CDATA 未闭合（缺少 ]]>）');
      top().children.push({ type: 'raw', text: src.slice(i, end + 3), index: i });
      i = end + 3;
      continue;
    }
    if (next === '!' || next === '?') {
      // DOCTYPE / 声明 / 处理指令：读到 >（DOCTYPE 内部子集 [ ... ] 里的 > 不算）
      let j = i + 2;
      let bracket = 0;
      let quote = '';
      while (j < src.length) {
        const c = src[j];
        if (quote) { if (c === quote) quote = ''; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '[') bracket++;
        else if (c === ']') bracket = Math.max(0, bracket - 1);
        else if (c === '>' && bracket === 0) break;
        j++;
      }
      if (j >= src.length) fail(src, i, '声明未闭合（缺少 >）');
      top().children.push({ type: 'doctype', text: src.slice(i, j + 1), index: i });
      i = j + 1;
      continue;
    }
    if (next === '/') {
      // 结束标签
      let j = i + 2;
      let name = '';
      while (j < src.length && isNameChar(src[j])) { name += src[j]; j++; }
      if (!name) fail(src, i, '结束标签缺少标签名');
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] !== '>') fail(src, i, `结束标签 </${name}> 写法有误（缺少 >）`);
      j++;
      const lower = name.toLowerCase();
      if (VOID_ELEMENTS.has(lower)) fail(src, i, `空元素 <${lower}> 不应有结束标签 </${name}>`);
      if (stack.length === 1) fail(src, i, `多余的结束标签 </${name}>，没有对应的开始标签`);
      const open = top();
      if (open.name.toLowerCase() !== lower) {
        fail(src, i, `标签不匹配：<${open.name}>（第 ${lineAt(src, open.index)} 行开始）未闭合，却遇到 </${name}>`);
      }
      stack.pop();
      i = j;
      continue;
    }
    if (isNameStart(next)) {
      const tag = parseOpenTag(src, i);
      const lower = tag.name.toLowerCase();
      const node = {
        type: 'element', name: tag.name, attrs: tag.attrs,
        children: [], index: i, rawContent: null
      };
      top().children.push(node);
      sawElement = true;
      i = tag.next;
      if (tag.selfClosing || VOID_ELEMENTS.has(lower)) {
        node.selfClosed = true;
        continue;
      }
      if (RAW_TEXT_ELEMENTS.has(lower)) {
        // 原始内容读到对应结束标签为止，内容原样保留
        const closeRe = new RegExp(`</${lower}\\s*>`, 'i');
        const rest = src.slice(i);
        const m = closeRe.exec(rest);
        if (!m) fail(src, tag.index, `原始文本元素 <${tag.name}> 未闭合（缺少 </${lower}>）`);
        node.rawContent = rest.slice(0, m.index);
        i += m.index + m[0].length;
        continue;
      }
      stack.push(node);
      continue;
    }
    // '<' 后不是标签起始（如正文里的 a < b），按普通文本处理
    pushText('<', i);
    i++;
  }

  if (stack.length > 1) {
    const open = top();
    fail(src, open.index, `标签 <${open.name}> 未闭合（缺少 </${open.name.toLowerCase()}>）`);
  }
  if (!sawElement) throw new Error('没有解析到任何 HTML 标签');
  return root;
}

function collectStats(node, stats, depth) {
  for (const child of node.children || []) {
    if (child.type === 'element') {
      stats.elements++;
      stats.attributes += child.attrs.length;
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      collectStats(child, stats, depth + 1);
    } else if (child.type === 'comment') stats.comments++;
    else if (child.type === 'doctype') stats.doctypes++;
  }
}
function makeStats(root) {
  const stats = { elements: 0, attributes: 0, comments: 0, doctypes: 0, maxDepth: 0 };
  collectStats(root, stats, 1);
  return stats;
}

const collapseText = (text) => text.replace(/\s+/g, ' ');

// 行内片段（文本/行内元素）渲染为单行字符串
function renderInline(node) {
  if (node.type === 'text') return collapseText(node.text);
  if (node.type === 'comment') return node.text;
  if (node.type === 'raw' || node.type === 'doctype') return node.text;
  const open = `<${node.name}${renderAttrs(node.attrs)}>`;
  if (node.selfClosed) {
    return VOID_ELEMENTS.has(node.name.toLowerCase()) ? open : open.replace(/>$/, `></${node.name}>`);
  }
  const close = `</${node.name}>`;
  if (node.rawContent !== null) return open + node.rawContent + close;
  return open + node.children.map(renderInline).join('') + close;
}

const isInlineNode = (node) =>
  node.type === 'text' ||
  (node.type === 'element' && INLINE_ELEMENTS.has(node.name.toLowerCase()));

function formatChildren(children, level, indentUnit, lines) {
  const pad = indentUnit.repeat(level);
  let run = [];
  const flushRun = () => {
    if (!run.length) return;
    const hasText = run.some((c) => c.type === 'text' && c.text.trim());
    if (hasText) {
      const text = run.map(renderInline).join('').trim();
      if (text) lines.push(pad + text);
    } else {
      // 纯行内元素（如连续 img/br/input）逐个占一行
      for (const c of run) if (c.type === 'element') formatNode(c, level, indentUnit, lines);
    }
    run = [];
  };
  for (const child of children) {
    if (isInlineNode(child)) { run.push(child); continue; }
    flushRun();
    formatNode(child, level, indentUnit, lines);
  }
  flushRun();
}

function formatNode(node, level, indentUnit, lines) {
  const pad = indentUnit.repeat(level);
  if (node.type === 'comment' || node.type === 'doctype' || node.type === 'raw') {
    lines.push(pad + node.text.trim());
    return;
  }
  // element
  const open = `<${node.name}${renderAttrs(node.attrs)}>`;
  const close = `</${node.name}>`;
  if (node.selfClosed) {
    lines.push(pad + (VOID_ELEMENTS.has(node.name.toLowerCase()) ? open : open.replace(/>$/, `></${node.name}>`)));
    return;
  }
  if (node.rawContent !== null) {
    const content = node.rawContent;
    if (!content.includes('\n')) {
      lines.push(pad + open + content + close);
    } else {
      // 多行原始内容：起止标签各占一行，内容原样（仅去掉首尾空行）
      const body = content.replace(/^\n+/, '').replace(/\s+$/, '');
      lines.push(pad + open);
      for (const line of body.split('\n')) lines.push(line);
      lines.push(pad + close);
    }
    return;
  }
  const meaningful = node.children.filter(
    (c) => !(c.type === 'text' && !c.text.trim())
  );
  if (!meaningful.length) { lines.push(pad + open + close); return; }
  // 单行呈现：子节点全是文本/行内元素，且含文本、或只有一个子元素、或自身是行内元素
  const singleLine = meaningful.every(isInlineNode) &&
    (meaningful.some((c) => c.type === 'text') || meaningful.length === 1 ||
      INLINE_ELEMENTS.has(node.name.toLowerCase()));
  if (singleLine) {
    const inner = node.children.map(renderInline).join('').trim();
    lines.push(pad + open + inner + close);
    return;
  }
  lines.push(pad + open);
  formatChildren(node.children, level + 1, indentUnit, lines);
  lines.push(pad + close);
}

export function formatHtml(src, { indentSize = 2 } = {}) {
  const root = parseHtml(src);
  const lines = [];
  formatChildren(root.children, 0, ' '.repeat(indentSize), lines);
  const stats = makeStats(root);
  return { text: lines.join('\n'), stats: { ...stats, lines: lines.length } };
}

function minifyNode(node, keepComments) {
  if (node.type === 'comment') {
    // 默认去掉注释；条件注释 <!--[if ...]> 始终保留
    return keepComments || /^<!--\[if/i.test(node.text) ? node.text : '';
  }
  if (node.type === 'doctype' || node.type === 'raw') return node.text;
  if (node.type === 'text') return collapseText(node.text);
  const open = `<${node.name}${renderAttrs(node.attrs)}>`;
  if (node.selfClosed) {
    return VOID_ELEMENTS.has(node.name.toLowerCase()) ? open : open.replace(/>$/, `></${node.name}>`);
  }
  const close = `</${node.name}>`;
  if (node.rawContent !== null) return open + node.rawContent + close;
  return open + minifyChildren(node.children, keepComments) + close;
}

// 压缩子节点：块级边界处的空白文本去掉，行内之间保留单个空格
function minifyChildren(children, keepComments) {
  let out = '';
  children.forEach((child, idx) => {
    if (child.type === 'comment') { out += minifyNode(child, keepComments); return; }
    if (child.type === 'text') {
      const collapsed = collapseText(child.text);
      if (!collapsed.trim()) {
        // 纯空白：仅当两侧都是行内内容时保留一个空格
        const prev = children[idx - 1];
        const next = children[idx + 1];
        if (prev && next && isInlineNode(prev) && isInlineNode(next) && collapsed) out += ' ';
        return;
      }
      out += collapsed;
      return;
    }
    out += minifyNode(child, keepComments);
  });
  return out.trim();
}

export function minifyHtml(src, { keepComments = false } = {}) {
  const root = parseHtml(src);
  const text = minifyChildren(root.children, keepComments);
  const stats = makeStats(root);
  const saved = src.length ? Math.max(0, Math.round((1 - text.length / src.length) * 100)) : 0;
  return { text, stats: { ...stats, lines: 1, saved } };
}
