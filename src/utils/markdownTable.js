// Markdown 表格生成：纯本地。把 TSV / CSV / 空格对齐的粘贴内容转成 Markdown 表格。
// 解析：优先 Tab 分隔，其次 CSV（支持引号、引号内逗号与双引号转义），最后按竖线拆分已有的 Markdown 行。
// 生成：单元格内 | 转义为 \|、换行转 <br>；对齐支持 left/center/right/auto（纯数字列右对齐）；
// pretty 模式按视觉宽度补齐（CJK 字符计 2 宽），紧凑模式不补空格。

export function visualWidth(str) {
  let w = 0;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    // CJK 表意文字、全角符号、假名、谚文等按 2 宽估算
    if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)) w += 2;
    else w += 1;
  }
  return w;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = ''; let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else if (c === '"') inQuote = true;
    else if (c === ',') { cells.push(cur); cur = ''; }
    else cur += c;
  }
  if (inQuote) return { ok: false, error: 'CSV 引号未闭合' };
  cells.push(cur);
  return { ok: true, cells };
}

export function parseTableInput(input) {
  const raw = String(input ?? '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n').filter(l => l.trim() !== '');
  if (!lines.length) return { ok: false, error: '请输入表格内容：每行一行数据，列之间用 Tab、逗号或 | 分隔' };
  if (lines.length > 500) return { ok: false, error: '最多 500 行，请拆分后再生成' };
  const rows = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let cells;
    if (line.includes('\t')) cells = line.split('\t');
    else if (line.trim().startsWith('|')) {
      // 已有 Markdown 行：去掉首尾竖线后按未转义的 | 拆分
      const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
      cells = body.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|'));
      // 分隔行（如 |---|---|）直接跳过
      if (cells.every(c => /^:?-{3,}:?$/.test(c.trim()))) continue;
    } else if (line.includes(',')) {
      const r = parseCsvLine(line);
      if (!r.ok) return { ok: false, error: `第 ${li + 1} 行：${r.error}` };
      cells = r.cells;
    } else cells = [line];
    rows.push(cells.map(c => c.trim()));
  }
  if (!rows.length) return { ok: false, error: '没有可用的表格行（输入可能只有分隔行）' };
  const cols = Math.max(...rows.map(r => r.length));
  if (cols > 30) return { ok: false, error: '最多 30 列' };
  rows.forEach(r => { while (r.length < cols) r.push(''); });
  return { ok: true, rows, cols };
}

const NUM_RE = /^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$/;
export function resolveAlignments(rows, hasHeader, align) {
  const cols = rows[0].length;
  if (align !== 'auto') return Array(cols).fill(align);
  const body = hasHeader ? rows.slice(1) : rows;
  return Array.from({ length: cols }, (_, c) => {
    const vals = body.map(r => r[c]).filter(v => v !== '');
    return vals.length > 0 && vals.every(v => NUM_RE.test(v)) ? 'right' : 'left';
  });
}

function escapeCell(cell) {
  return String(cell).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function sepCell(align, width) {
  const w = Math.max(3, width);
  if (align === 'center') return ':' + '-'.repeat(w - 2) + ':';
  if (align === 'right') return '-'.repeat(w - 1) + ':';
  return '-'.repeat(w);
}

export function buildMarkdownTable(rows, { hasHeader = true, align = 'auto', pretty = true } = {}) {
  if (!rows.length) return '';
  const cols = rows[0].length;
  const header = hasHeader ? rows[0] : Array.from({ length: cols }, (_, i) => `列${i + 1}`);
  const body = hasHeader ? rows.slice(1) : rows;
  const aligns = resolveAlignments(rows, hasHeader, align);
  const escHeader = header.map(escapeCell);
  const escBody = body.map(r => r.map(escapeCell));
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(3, visualWidth(escHeader[c]), ...escBody.map(r => visualWidth(r[c]))));
  const fmtRow = (cells) => pretty
    ? '| ' + cells.map((c, i) => c + ' '.repeat(widths[i] - visualWidth(c))).join(' | ') + ' |'
    : '|' + cells.join('|') + '|';
  const sep = pretty
    ? '| ' + aligns.map((a, i) => sepCell(a, widths[i])).join(' | ') + ' |'
    : '|' + aligns.map(a => sepCell(a, 3)).join('|') + '|';
  return [fmtRow(escHeader), sep, ...escBody.map(fmtRow)].join('\n');
}

export function generateMarkdownTable(input, options = {}) {
  const parsed = parseTableInput(input);
  if (!parsed.ok) return parsed;
  const markdown = buildMarkdownTable(parsed.rows, options);
  return { ok: true, markdown, rows: parsed.rows.length, dataRows: options.hasHeader === false ? parsed.rows.length : parsed.rows.length - 1, cols: parsed.cols };
}
