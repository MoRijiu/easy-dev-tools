// CSS 格式化 / 压缩 / 校验（纯本地，字符级递归解析，不依赖浏览器 CSSOM 以便 Node 下可测）
// 通用块解析：块内条目以第一个顶层 { ; } 判别——{ 为嵌套规则（@media/@keyframes/普通规则统一处理），
// ; 或 } 为声明（须含顶层冒号）。字符串、注释、括号/方括号内符号不参与判别。
// 校验：大括号配平、注释/字符串闭合、声明缺冒号、空选择器、多余 }；错误带行号。

function lineAt(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}
function fail(src, idx, msg) {
  throw new Error(`第 ${lineAt(src, idx)} 行：${msg}`);
}

// 从 i 起跳过一个字符串（i 指向引号），返回引号后下标；未闭合报错
function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === q) return j + 1;
    if (src[j] === '\n') break;
    j++;
  }
  fail(src, i, '字符串未闭合');
  return j;
}
// 从 i 起跳过一个注释（i 指向 /*），返回 */ 后下标
function skipComment(src, i) {
  const end = src.indexOf('*/', i + 2);
  if (end === -1) fail(src, i, '注释未闭合（缺少 */）');
  return end + 2;
}

const MAX_CSS_LENGTH = 1000000;
const MAX_CSS_DEPTH = 100;

// 全角标点/字母数字转半角（U+FF01–FF5E → ASCII，1:1 字符映射不改变下标与行号）；
// 字符串与注释内容原样保留。此处扫描不抛错，未闭合的引号/注释留给正式解析报错。
function normalizeCssInput(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      if (j < src.length && src[j] === c) j++;
      out += src.slice(i, j);
      i = j;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end === -1 ? src.length : end + 2;
      out += src.slice(i, j);
      i = j;
    } else {
      const code = c.charCodeAt(0);
      out += code >= 0xff01 && code <= 0xff5e ? String.fromCharCode(code - 0xfee0) : c;
      i++;
    }
  }
  return out;
}

// 折叠空白（字符串/注释内容原样保留），并可去掉注释
function collapseWs(text, { dropComments = false } = {}) {
  let out = '';
  let i = 0;
  let pendingSpace = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const j = skipString(text, i);
      if (pendingSpace && out) out += ' ';
      pendingSpace = false;
      out += text.slice(i, j);
      i = j;
    } else if (c === '/' && text[i + 1] === '*') {
      const j = skipComment(text, i);
      if (!dropComments) {
        if (pendingSpace && out) out += ' ';
        pendingSpace = false;
        out += text.slice(i, j);
      }
      i = j;
    } else if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
    } else {
      if (pendingSpace && out) out += ' ';
      pendingSpace = false;
      out += c;
      i++;
    }
  }
  return out;
}

// 选择器美化：逗号后空格、组合器两侧空格（括号/方括号/字符串内不动）
function prettySelector(sel) {
  const flat = collapseWs(sel);
  let out = '';
  let depth = 0; let bracket = 0; let i = 0;
  while (i < flat.length) {
    const c = flat[i];
    if (c === '"' || c === "'") { const j = skipString(flat, i); out += flat.slice(i, j); i = j; continue; }
    if (c === '\\') { out += flat.slice(i, i + 2); i += 2; continue; }
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (c === '[') bracket++;
    if (c === ']') bracket = Math.max(0, bracket - 1);
    if (depth === 0 && bracket === 0 && c === ',') {
      out = out.replace(/\s+$/, '') + ', ';
      i++;
      while (flat[i] === ' ') i++;
      continue;
    }
    if (depth === 0 && bracket === 0 && (c === '>' || c === '+' || c === '~')) {
      out = out.replace(/\s+$/, '') + ` ${c} `;
      i++;
      while (flat[i] === ' ') i++;
      continue;
    }
    out += c;
    i++;
  }
  return out.trim();
}

// 选择器压缩：去掉组合器/逗号旁空格（括号/方括号/字符串内不动）
function minifySelector(sel) {
  const flat = collapseWs(sel, { dropComments: true });
  let out = '';
  let depth = 0; let bracket = 0; let i = 0;
  while (i < flat.length) {
    const c = flat[i];
    if (c === '"' || c === "'") { const j = skipString(flat, i); out += flat.slice(i, j); i = j; continue; }
    if (c === '\\') { out += flat.slice(i, i + 2); i += 2; continue; }
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (c === '[') bracket++;
    if (c === ']') bracket = Math.max(0, bracket - 1);
    if (depth === 0 && bracket === 0 && (c === ',' || c === '>' || c === '+' || c === '~')) {
      out = out.replace(/\s+$/, '') + c;
      i++;
      while (flat[i] === ' ') i++;
      continue;
    }
    out += c;
    i++;
  }
  return out.trim();
}

// 值压缩：折叠空白、逗号后不留空格（字符串内不动；calc/var 内逗号同样安全）
function minifyValue(v) {
  const flat = collapseWs(v, { dropComments: true });
  let out = '';
  let i = 0;
  while (i < flat.length) {
    const c = flat[i];
    if (c === '"' || c === "'") { const j = skipString(flat, i); out += flat.slice(i, j); i = j; continue; }
    if (c === ',') {
      out = out.replace(/\s+$/, '') + ',';
      i++;
      while (flat[i] === ' ') i++;
      continue;
    }
    out += c;
    i++;
  }
  return out.trim();
}

// 找声明里顶层冒号位置（属性与值分隔），无则 -1
function topColon(text) {
  let depth = 0; let bracket = 0; let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") { i = skipString(text, i); continue; }
    if (c === '/' && text[i + 1] === '*') { i = skipComment(text, i); continue; }
    if (c === '\\') { i += 2; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === '[') bracket++;
    else if (c === ']') bracket = Math.max(0, bracket - 1);
    else if (c === ':' && depth === 0 && bracket === 0) return i;
    i++;
  }
  return -1;
}

class Parser {
  constructor(src) { this.src = src; this.i = 0; }
  eof() { return this.i >= this.src.length; }
  peek() { return this.src[this.i]; }

  // 解析一串条目；inBlock 时以 } 结束（并消费它）
  parseItems(inBlock, blockStart, depth = 0) {
    if (depth > MAX_CSS_DEPTH) fail(this.src, blockStart, `嵌套层级过深（超过 ${MAX_CSS_DEPTH} 层）`);
    const items = [];
    for (;;) {
      this.skipWsComments(items);
      if (this.eof()) {
        if (inBlock) fail(this.src, blockStart, '大括号未闭合（缺少 }）');
        return items;
      }
      if (this.peek() === '}') {
        if (!inBlock) fail(this.src, this.i, '多余的 }，没有对应的 {');
        this.i++;
        return items;
      }
      const item = this.parseItem(inBlock, depth);
      if (item) items.push(item);
    }
  }

  // 跳过空白；把独立注释收为 comment 条目
  skipWsComments(items) {
    for (;;) {
      while (!this.eof() && /\s/.test(this.peek())) this.i++;
      if (this.src.startsWith('/*', this.i)) {
        const start = this.i;
        this.i = skipComment(this.src, this.i);
        items.push({ type: 'comment', text: this.src.slice(start, this.i), index: start });
        continue;
      }
      return;
    }
  }

  // 读一个条目：从当前位置扫到第一个顶层 { ; } 判别类型
  parseItem(inBlock, depth = 0) {
    const src = this.src;
    const start = this.i;
    let paren = 0; let bracket = 0; let j = this.i;
    const parenStack = [];
    let term = null;
    while (j < src.length) {
      const c = src[j];
      if (c === '"' || c === "'") { j = skipString(src, j); continue; }
      if (c === '/' && src[j + 1] === '*') { j = skipComment(src, j); continue; }
      if (c === '\\') { j += 2; continue; }
      if (c === '(') { paren++; parenStack.push(j); }
      else if (c === ')') {
        if (paren === 0) fail(src, j, '多余的 )');
        paren--; parenStack.pop();
      } else if (c === '[') bracket++;
      else if (c === ']') bracket = Math.max(0, bracket - 1);
      else if (c === '}' && paren > 0) fail(src, parenStack[0], '括号未闭合（缺少 )）');
      else if (paren === 0 && bracket === 0 && (c === '{' || c === ';' || c === '}')) { term = c; break; }
      j++;
    }
    if (term === null) {
      // 到 EOF 仍无终止符
      if (parenStack.length) fail(src, parenStack[0], '括号未闭合（缺少 )）');
      if (inBlock) fail(src, start, '大括号未闭合（缺少 }）');
      const rest = src.slice(start).trim();
      this.i = j;
      if (!rest) return null;
      // 顶层裸声明/语句允许省略末尾分号（如直接粘贴 color:red 片段）
      if (rest.startsWith('@')) return { type: 'statement', text: rest, index: start };
      const head = src.slice(start, j);
      const colon = topColon(head);
      if (colon === -1) fail(src, start, `内容不完整，缺少 { 或 ;：${rest.slice(0, 30)}`);
      return this.makeDecl(head, colon, start);
    }
    const head = src.slice(start, j);
    if (term === '{') {
      const prelude = head.trim();
      if (!prelude) fail(src, start, '{ 前缺少选择器或 @ 规则名');
      this.i = j + 1;
      const children = this.parseItems(true, start, depth + 1);
      return { type: 'rule', prelude, children, index: start };
    }
    // ; 或 } 终止：声明或语句
    this.i = term === ';' ? j + 1 : j; // } 留给 parseItems 消费
    const text = head.trim();
    if (!text) return null; // 空语句（如多余的 ;）忽略
    if (text.startsWith('@')) return { type: 'statement', text, index: start };
    const colon = topColon(head);
    if (colon === -1) fail(src, start, `声明缺少冒号：${text.slice(0, 40)}`);
    return this.makeDecl(head, colon, start);
  }

  makeDecl(head, colon, start) {
    const prop = head.slice(0, colon).trim();
    const value = head.slice(colon + 1).trim();
    if (!prop) fail(this.src, start, '声明缺少属性名');
    // 自定义属性（--x）允许空值，这是合法 CSS；普通声明缺值仍报错
    if (!value && !prop.startsWith('--')) fail(this.src, start, `声明 ${prop} 缺少值`);
    return { type: 'decl', prop, value, index: start };
  }
}

function parseCss(rawSrc) {
  if (!rawSrc || !rawSrc.trim()) throw new Error('输入为空');
  if (rawSrc.length > MAX_CSS_LENGTH) throw new Error(`输入过长（超过 ${MAX_CSS_LENGTH} 字符），请分段处理`);
  const src = normalizeCssInput(rawSrc);
  const parser = new Parser(src);
  const items = parser.parseItems(false, 0);
  if (!items.length) throw new Error('没有解析到任何 CSS 规则或声明');
  return items;
}

function collectStats(items, stats, depth) {
  stats.maxDepth = Math.max(stats.maxDepth, depth);
  for (const it of items) {
    if (it.type === 'rule') {
      stats.rules++;
      collectStats(it.children, stats, depth + 1);
    } else if (it.type === 'decl') stats.declarations++;
    else if (it.type === 'comment') stats.comments++;
    else if (it.type === 'statement') stats.statements++;
  }
}
function makeStats(items) {
  const stats = { rules: 0, declarations: 0, comments: 0, statements: 0, maxDepth: 0 };
  collectStats(items, stats, 1);
  return stats;
}

function isAtRule(prelude) { return prelude.trimStart().startsWith('@'); }

function formatItems(items, level, indentUnit, lines) {
  const pad = indentUnit.repeat(level);
  for (const it of items) {
    if (it.type === 'comment') {
      lines.push(pad + collapseWs(it.text));
    } else if (it.type === 'statement') {
      lines.push(pad + collapseWs(it.text) + ';');
    } else if (it.type === 'decl') {
      lines.push(pad + it.prop + ': ' + collapseWs(it.value) + ';');
    } else if (it.type === 'rule') {
      const prelude = isAtRule(it.prelude) ? collapseWs(it.prelude) : prettySelector(it.prelude);
      if (!it.children.length) {
        lines.push(pad + prelude + ' {}');
      } else {
        lines.push(pad + prelude + ' {');
        formatItems(it.children, level + 1, indentUnit, lines);
        lines.push(pad + '}');
      }
    }
  }
}

export function formatCss(src, { indentSize = 2 } = {}) {
  const items = parseCss(src);
  const lines = [];
  formatItems(items, 0, ' '.repeat(indentSize), lines);
  const stats = makeStats(items);
  return { text: lines.join('\n'), stats: { ...stats, lines: lines.length } };
}

function minifyItems(items, out) {
  for (const it of items) {
    if (it.type === 'comment') continue; // 压缩时去掉注释
    if (it.type === 'statement') { out.push(collapseWs(it.text, { dropComments: true }) + ';'); continue; }
    if (it.type === 'decl') { out.push(it.prop + ':' + minifyValue(it.value)); continue; }
    // rule
    const prelude = isAtRule(it.prelude)
      ? collapseWs(it.prelude, { dropComments: true })
      : minifySelector(it.prelude);
    const inner = [];
    // 声明之间用 ; 连接、末尾不加；声明后跟嵌套规则时补 ; 分隔
    let buf = '';
    const flush = (semi) => { if (buf) { inner.push(buf + (semi ? ';' : '')); buf = ''; } };
    for (const child of it.children) {
      if (child.type === 'decl') {
        if (buf) buf += ';';
        buf += child.prop + ':' + minifyValue(child.value);
      } else if (child.type === 'comment') {
        continue;
      } else {
        flush(true);
        const sub = [];
        minifyItems([child], sub);
        inner.push(sub.join(''));
      }
    }
    flush(false);
    out.push(prelude + '{' + inner.join('') + '}');
  }
}

function stripCommentItems(items) {
  const out = [];
  for (const it of items) {
    if (it.type === 'comment') continue;
    if (it.type === 'rule') out.push({ ...it, children: stripCommentItems(it.children) });
    else out.push(it);
  }
  return out;
}

export function minifyCss(src) {
  const parsed = parseCss(src);
  const items = stripCommentItems(parsed);
  const out = [];
  minifyItems(items, out);
  // 顶层：语句/规则直接拼接；顶层裸声明（片段）用 ; 连接
  let text = '';
  let prevDecl = false;
  for (let k = 0; k < out.length; k++) {
    const isDecl = items[k] && items[k].type === 'decl';
    if (text && prevDecl) text += ';';
    text += out[k];
    prevDecl = !!isDecl;
  }
  const stats = makeStats(parsed);
  const saved = src.length ? Math.max(0, Math.round((1 - text.length / src.length) * 100)) : 0;
  return { text, stats: { ...stats, lines: 1, saved } };
}
