// Markdown 渲染核心：纯本地、安全的简易渲染器（非完整 CommonMark）。
// 安全口径：原文 HTML 一律转义；链接/图片 URL 做协议白名单校验，
// javascript:/vbscript:/data:text 等危险协议直接降级为纯文本，避免预览区 XSS。
// 支持：标题/粗斜体/删除线/行内代码/围栏代码块/链接/图片/引用/无序·有序·任务列表
// （含按缩进嵌套）/表格（含对齐行）/水平线/段落。

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_IMAGE_DATA = /^data:image\/(png|gif|jpe?g|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i;

// 返回净化后的 URL（原样字符串），危险协议返回 null
export function sanitizeUrl(rawUrl, { image = false } = {}) {
  const url = String(rawUrl ?? '').trim();
  if (!url) return null;
  if (/\s/.test(url)) return null;
  if (image && SAFE_IMAGE_DATA.test(url)) return url;
  // 相对路径 / 锚点 / 查询串 / 协议相对
  if (/^(#|\/|\.\/|\.\.\/|\?)/.test(url) || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url;
  }
  let protocol;
  try {
    protocol = new URL(url).protocol.toLowerCase();
  } catch {
    return null;
  }
  if (image) return protocol === 'http:' || protocol === 'https:' ? url : null;
  return SAFE_LINK_PROTOCOLS.has(protocol) ? url : null;
}

function renderInline(raw) {
  // 先抽行内代码（内容单独转义，不再参与其他规则）
  const codes = [];
  let text = String(raw).replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(`<code class="inline-code">${escapeHtml(code)}</code>`);
    return `\x00C${codes.length - 1}\x00`;
  });
  text = escapeHtml(text);
  // 图片 ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
    const safe = sanitizeUrl(url.replace(/&quot;/g, '"'), { image: true });
    if (!safe) return alt;
    return `<img src="${escapeHtml(safe)}" alt="${alt}" class="md-image" loading="lazy" />`;
  });
  // 链接 [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const safe = sanitizeUrl(url.replace(/&quot;/g, '"'));
    if (!safe) return label;
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');
  codes.forEach((html, i) => {
    text = text.replace(`\x00C${i}\x00`, html);
  });
  return text;
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isTableSeparator(line) {
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(line) || !line.includes('-')) return false;
  return splitTableRow(line).every((c) => /^:?-{1,}:?$/.test(c));
}

function alignmentOf(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

// 列表渲染：按缩进（2 空格一级）维护 ul/ol 栈；任务项识别 - [ ] / - [x]
function renderList(lines, start) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (!m) break;
    items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2][0]), content: m[3] });
    i++;
  }
  // 递归按最小缩进分层
  const build = (list, baseIndent) => {
    const tag = list[0].ordered ? 'ol' : 'ul';
    let html = `<${tag}>`;
    for (let k = 0; k < list.length; k++) {
      const item = list[k];
      const children = [];
      while (k + 1 < list.length && list[k + 1].indent > baseIndent) {
        children.push(list[k + 1]);
        k++;
      }
      let content = item.content;
      let cls = '';
      const task = content.match(/^\[([ xX])\]\s+(.*)$/);
      if (task && !item.ordered) {
        cls = ' class="task-item"';
        content = `<input type="checkbox" disabled${task[1].toLowerCase() === 'x' ? ' checked' : ''}> ${renderInline(task[2])}`;
      } else {
        content = renderInline(content);
      }
      html += `<li${cls}>${content}${children.length ? build(children, children[0].indent) : ''}</li>`;
    }
    return html + `</${tag}>`;
  };
  return { html: build(items, items[0].indent), next: i };
}

export function renderMarkdown(source) {
  const text = String(source ?? '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return '';
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    // 围栏代码块
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过结束围栏（未闭合则到文末为止）
      out.push(`<pre class="code-block${fence[1] ? ' language-' + fence[1] : ''}"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    // 水平线
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    // 表格：当前行含 | 且下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(alignmentOf);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      const alignAttr = (idx) => (aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '');
      let html = '<table class="md-table"><thead><tr>';
      html += headers.map((h, idx) => `<th${alignAttr(idx)}>${renderInline(h)}</th>`).join('');
      html += '</tr></thead>';
      if (bodyRows.length) {
        html += '<tbody>' + bodyRows.map((row) =>
          '<tr>' + headers.map((_, idx) => `<td${alignAttr(idx)}>${renderInline(row[idx] ?? '')}</td>`).join('') + '</tr>'
        ).join('') + '</tbody>';
      }
      out.push(html + '</table>');
      continue;
    }
    // 引用块：连续 > 行合并
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${buf.map((l) => renderInline(l)).join('<br>')}</blockquote>`);
      continue;
    }
    // 列表
    if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) {
      const { html, next } = renderList(lines, i);
      out.push(html);
      i = next;
      continue;
    }
    // 普通段落：连续非空、非特殊起始行
    const buf = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${buf.map((l) => renderInline(l)).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// 文档统计：字符/行/词（中日韩按字、英文按词）/标题/链接/图片/代码块/表格/预计阅读分钟
export function markdownStats(source) {
  const text = String(source ?? '');
  const lines = text ? text.split('\n').length : 0;
  const cjk = (text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
  const latinWords = (text.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const words = cjk + latinWords;
  return {
    chars: [...text].length,
    lines,
    words,
    headings: (text.match(/^#{1,6}\s+/gm) || []).length,
    links: (text.match(/(?<!!)\[[^\]]+\]\([^)]+\)/g) || []).length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length,
    codeBlocks: (text.match(/^```/gm) || []).length / 2 | 0,
    tables: (text.match(/^\s*\|?[\s:|-]+\|?\s*$/gm) || []).filter((l) => l.includes('-')).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 400)),
  };
}

// 导出 HTML：独立文件用具体色值（旧版误用 CSS 变量，导出后样式全失效）
export function buildStandaloneHtml(bodyHtml, title = 'Markdown Document') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #1f2937; }
pre { background: #f3f4f6; padding: 15px; border-radius: 6px; overflow-x: auto; }
code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
pre code { background: transparent; padding: 0; }
blockquote { border-left: 4px solid #d1d5db; margin: 0; padding-left: 20px; color: #4b5563; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
img { max-width: 100%; }
a { color: #4f46e5; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
