// XML 格式化 / 压缩 / 校验（纯本地，字符串分词实现，不依赖 DOMParser 以便在 Node 下可测）
// 支持：XML 声明、处理指令、DOCTYPE、注释、CDATA、属性引号、命名空间标签、自闭合标签。
// 校验：标签嵌套匹配、单个根元素、属性（名合法/必带引号值/不重复/值内禁 <）、
// 实体与字符引用（裸 &、未定义实体、非法码点）、文本禁 ]]>、注释禁 --、
// CDATA 与 DOCTYPE 与 XML 声明的位置、非法控制字符；错误带行号。

const TAG_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const MAX_INPUT_LENGTH = 1000000;
const PREDEFINED_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

function lineAt(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

function fail(src, idx, msg) {
  throw new Error(`第 ${lineAt(src, idx)} 行：${msg}`);
}

function isValidXmlChar(cp) {
  return cp === 0x9 || cp === 0xA || cp === 0xD
    || (cp >= 0x20 && cp <= 0xD7FF)
    || (cp >= 0xE000 && cp <= 0xFFFD)
    || (cp >= 0x10000 && cp <= 0x10FFFF);
}

// 校验一段文本/属性值里的 & 引用形式与字符引用码点（src/baseIdx 仅用于报错定位）。
// 命名实体是否已定义不在此处判断（需要 DOCTYPE 上下文，见 validateXml 的 checkNamedEntities）。
function checkRefSyntax(src, baseIdx, text) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '&') {
      const m = text.slice(i).match(/^&(#x[0-9A-Fa-f]+|#\d+|[A-Za-z_][A-Za-z0-9_.:-]*);/);
      if (!m) {
        fail(src, baseIdx + i, `裸 & 或引用写法不完整：「${text.slice(i, i + 12)}…」，普通文本里的 & 必须写成 &amp;，引用须以 ; 结尾`);
      }
      if (m[1].startsWith('#')) {
        const cp = m[1][1] === 'x' ? parseInt(m[1].slice(2), 16) : parseInt(m[1].slice(1), 10);
        if (!isValidXmlChar(cp)) {
          fail(src, baseIdx + i, `字符引用 &${m[1]}; 不是合法的 XML 字符（NUL、孤代理与超范围码点不可用）`);
        }
      }
      i += m[0].length - 1;
    } else if (c < ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
      fail(src, baseIdx + i, '包含不可见控制字符（XML 文本只允许 Tab、换行与回车）');
    }
  }
}

// 命名实体定义检查：预定义 5 个之外，必须在 DOCTYPE 内部子集里用 <!ENTITY 名 ...> 声明过。
function checkNamedEntities(src, baseIdx, text, definedEntities) {
  const re = /&([A-Za-z_][A-Za-z0-9_.:-]*);/g;
  let m;
  while ((m = re.exec(text))) {
    if (!PREDEFINED_ENTITIES.has(m[1]) && !definedEntities.has(m[1])) {
      fail(src, baseIdx + m.index, `实体 &${m[1]}; 未定义：XML 只有 amp/lt/gt/quot/apos 五个预定义实体，其余须先在 DOCTYPE 里用 <!ENTITY ${m[1]} "..."> 声明`);
    }
  }
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

// 逐个扫描属性区：名合法、必有 ="..." 值、不重复、值内禁 <、引用形式合法。返回属性名与值列表。
function parseAttributes(src, tagIndex, attrsText, attrsBase) {
  const names = [];
  const values = [];
  const seen = new Set();
  let p = 0;
  while (p < attrsText.length) {
    while (p < attrsText.length && /\s/.test(attrsText[p])) p++;
    if (p >= attrsText.length) break;
    const nameMatch = attrsText.slice(p).match(/^[^\s=/>]+/);
    if (!nameMatch) fail(src, tagIndex, `属性写法不合法：「${attrsText.slice(p, p + 12)}…」`);
    const name = nameMatch[0];
    if (!TAG_NAME_RE.test(name)) fail(src, tagIndex, `属性名不合法：${name}（须以字母或下划线开头）`);
    if (seen.has(name)) fail(src, tagIndex, `属性 ${name} 重复出现：同一元素上同名属性只能写一次`);
    seen.add(name);
    p += name.length;
    while (p < attrsText.length && /\s/.test(attrsText[p])) p++;
    if (attrsText[p] !== '=') fail(src, tagIndex, `属性 ${name} 缺少 ="值"：XML 属性必须带引号值，不能只写属性名`);
    p++;
    while (p < attrsText.length && /\s/.test(attrsText[p])) p++;
    const quote = attrsText[p];
    if (quote !== '"' && quote !== "'") fail(src, tagIndex, `属性 ${name} 的值需要引号：${attrsText.slice(p, p + 12)}`);
    const valueStart = p + 1;
    const valueEnd = attrsText.indexOf(quote, valueStart);
    if (valueEnd === -1) fail(src, tagIndex, `属性 ${name} 的引号未闭合`);
    const value = attrsText.slice(valueStart, valueEnd);
    const lt = value.indexOf('<');
    if (lt !== -1) fail(src, tagIndex, `属性 ${name} 的值里不能出现 <，需要时请写成 &lt;`);
    checkRefSyntax(src, attrsBase + valueStart, value);
    names.push(name);
    values.push(value);
    p = valueEnd + 1;
    if (p < attrsText.length && !/\s/.test(attrsText[p])) {
      fail(src, tagIndex, `属性 ${name} 的值之后缺少空格分隔`);
    }
  }
  return { names, values };
}

function tokenizeXml(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '<') {
      let j = src.indexOf('<', i);
      if (j === -1) j = src.length;
      const value = src.slice(i, j);
      const cdataEnd = value.indexOf(']]>');
      if (cdataEnd !== -1) fail(src, i + cdataEnd, '文本内容里不能出现 ]]>（它是 CDATA 的结束标记，需要时请把 > 写成 &gt;）');
      checkRefSyntax(src, i, value);
      tokens.push({ type: 'text', value, index: i });
      i = j;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) fail(src, i, '注释未闭合（缺少 -->）');
      const content = src.slice(i + 4, end);
      if (content.includes('--') || content.endsWith('-')) {
        fail(src, i, '注释内容里不能出现 --（含以 - 结尾），请改写注释文字');
      }
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
      const targetMatch = src.slice(i + 2, end).match(/^[^\s?]+/);
      const target = targetMatch ? targetMatch[0] : '';
      const isDecl = target === 'xml';
      if (!isDecl && target.toLowerCase() === 'xml') {
        fail(src, i, `处理指令目标 ${target} 是保留名：XML 声明必须写作小写 <?xml ...?> 并位于文档最开头`);
      }
      tokens.push({ type: isDecl ? 'decl' : 'pi', value: src.slice(i, end + 2), index: i });
      i = end + 2;
    } else if (src.startsWith('<!', i)) {
      const end = findTagEnd(src, i + 2);
      if (end === -1) fail(src, i, 'DOCTYPE 未闭合（缺少 >）');
      tokens.push({ type: 'doctype', value: src.slice(i, end + 1), index: i });
      i = end + 1;
    } else if (src.startsWith('</', i)) {
      if (/\s/.test(src[i + 2] || '')) fail(src, i, '结束标签 </ 后不能有空格');
      const end = findTagEnd(src, i + 2);
      if (end === -1) fail(src, i, '结束标签未闭合（缺少 >）');
      const raw = src.slice(i, end + 1);
      const name = raw.slice(2, -1).trim();
      if (!TAG_NAME_RE.test(name)) fail(src, i, `结束标签名不合法：</${name}>`);
      tokens.push({ type: 'close', name, value: raw, index: i });
      i = end + 1;
    } else {
      if (/\s/.test(src[i + 1] || '')) fail(src, i, '标签名不能以空格开头（< 后须紧跟标签名）');
      const end = findTagEnd(src, i + 1);
      if (end === -1) fail(src, i, '标签未闭合（缺少 > 或属性引号未闭合）');
      const raw = src.slice(i, end + 1);
      const inner = raw.slice(1, -1);
      // 自闭合的 / 必须在引号外：属性值以 / 结尾（如 href="foo/"）不能误判
      let quote = null;
      let lastSignificant = -1;
      for (let p = 0; p < inner.length; p++) {
        const c = inner[p];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (!/\s/.test(c)) lastSignificant = p;
      }
      const selfClosing = lastSignificant !== -1 && inner[lastSignificant] === '/';
      const body = selfClosing ? inner.slice(0, lastSignificant) : inner;
      const nameMatch = body.match(/^([^\s/>]+)/);
      const name = nameMatch ? nameMatch[1] : '';
      if (!TAG_NAME_RE.test(name)) fail(src, i, `标签名不合法：<${name || '?'}>`);
      const attrsText = body.slice(nameMatch[0].length);
      const { values } = parseAttributes(src, i, attrsText, i + 1 + nameMatch[0].length);
      tokens.push({ type: selfClosing ? 'selfclose' : 'open', name, value: raw, attrCount: values.length, attrValues: values, index: i });
      i = end + 1;
    }
  }
  return tokens;
}

// 校验嵌套与文档级规则，并给 token 标注深度；返回统计。非法时抛带行号错误。
function validateXml(src) {
  if (typeof src !== 'string') throw new Error('输入必须是字符串');
  if (src.length > MAX_INPUT_LENGTH) {
    throw new Error(`输入过长：${src.length.toLocaleString('zh-CN')} 个字符，上限为 ${MAX_INPUT_LENGTH.toLocaleString('zh-CN')} 个字符，请拆分后再处理`);
  }
  const tokens = tokenizeXml(src);
  // DOCTYPE 内部子集里声明的通用实体（<!ENTITY 名 "值">），供命名实体检查
  const definedEntities = new Set();
  for (const t of tokens) {
    if (t.type !== 'doctype') continue;
    const re = /<!ENTITY\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s/g;
    let m;
    while ((m = re.exec(t.value))) definedEntities.add(m[1]);
  }
  const stack = [];
  let roots = 0;
  let elements = 0;
  let attributes = 0;
  let maxDepth = 0;
  let hasTextOutsideRoot = false;
  let seenDoctype = false;
  let seenElement = false;
  tokens.forEach((t, tokenIndex) => {
    if (t.type === 'decl') {
      if (tokenIndex !== 0) fail(src, t.index, 'XML 声明 <?xml ...?> 必须位于文档最开头，前面不能有任何内容');
    } else if (t.type === 'doctype') {
      if (seenDoctype) fail(src, t.index, 'DOCTYPE 只能出现一次');
      if (seenElement) fail(src, t.index, 'DOCTYPE 必须位于根元素之前');
      seenDoctype = true;
    } else if (t.type === 'cdata') {
      if (stack.length === 0) fail(src, t.index, 'CDATA 段只能出现在根元素的内容里，不能放在根元素外');
      t.depth = stack.length;
    } else if (t.type === 'open') {
      seenElement = true;
      if (stack.length === 0) roots++;
      t.depth = stack.length;
      stack.push(t);
      elements++;
      attributes += t.attrCount || 0;
      maxDepth = Math.max(maxDepth, stack.length);
      (t.attrValues || []).forEach(v => checkNamedEntities(src, t.index, v, definedEntities));
    } else if (t.type === 'selfclose') {
      seenElement = true;
      if (stack.length === 0) roots++;
      t.depth = stack.length;
      elements++;
      attributes += t.attrCount || 0;
      maxDepth = Math.max(maxDepth, stack.length + 1);
      (t.attrValues || []).forEach(v => checkNamedEntities(src, t.index, v, definedEntities));
    } else if (t.type === 'close') {
      const top = stack.pop();
      if (!top) fail(src, t.index, `多余的结束标签 </${t.name}>，没有对应的开始标签`);
      if (top.name !== t.name) {
        fail(src, t.index, `标签不匹配：<${top.name}>（第 ${lineAt(src, top.index)} 行）应由 </${top.name}> 结束，却遇到 </${t.name}>`);
      }
      t.depth = stack.length;
    } else {
      t.depth = stack.length;
      if (t.type === 'text') {
        if (stack.length === 0 && t.value.trim()) hasTextOutsideRoot = true;
        checkNamedEntities(src, t.index, t.value, definedEntities);
      }
    }
  });
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
      parts.push(t.value); // 含实际内容的文本原样保留，首尾空格也是内容，不能裁掉
    } else {
      parts.push(t.value.trim());
    }
  }
  return { text: parts.join(''), stats: { ...stats, lines: 1 } };
}
