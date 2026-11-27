// Markdown 表格生成：纯本地。把 TSV / CSV / 空格对齐的粘贴内容转成 Markdown 表格。
// 解析：优先 Tab 分隔，其次已有的 Markdown 行（行首竖线或含未转义竖线），其次 CSV（支持引号、
// 引号内逗号/换行与双引号转义），最后单列。无 ASCII 分隔符时全角逗号/竖线也可作分隔符。
// 已有 Markdown 的分隔行会被跳过，其对齐（:---: 等）在「自动」模式下按列保留。
// 生成：单元格内 | 转义为 \|、换行转 <br>；对齐支持 left/center/right/auto（纯数字列右对齐）；
// pretty 模式按视觉宽度补齐（CJK 字符计 2 宽、组合符/连接符计 0 宽），紧凑模式不补空格。

const MAX_CHARS = 1000000;
const MAX_ROWS = 500;
const MAX_COLS = 30;

export function visualWidth(str) {
  let w = 0;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    // 组合附加符、变体选择符、零宽连接符不占宽
    if ((cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x1ab0 && cp <= 0x1aff) || (cp >= 0x1dc0 && cp <= 0x1dff) ||
        (cp >= 0x20d0 && cp <= 0x20ff) || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xfe20 && cp <= 0xfe2f) ||
        cp === 0x200d || (cp >= 0xe0100 && cp <= 0xe01ef)) continue;
    // CJK 表意文字、全角符号、假名、谚文等按 2 宽估算
    if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)) w += 2;
    else w += 1;
  }
  return w;
}

// CSV 单行（可含引号内换行）解析：引号只在字段开头才是引号，字段中部的引号按普通字符。
function parseCsvLine(line) {
  const cells = [];
  let cur = ''; let inQuote = false; let fieldStart = true;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else if (c === '"' && fieldStart) { inQuote = true; fieldStart = false; }
    else if (c === ',') { cells.push(cur); cur = ''; fieldStart = true; }
    else { cur += c; if (c !== ' ') fieldStart = false; }
  }
  if (inQuote) return { ok: false, error: 'CSV 引号未闭合' };
  cells.push(cur);
  return { ok: true, cells };
}

// 扫描一行是否在 CSV 引号内结束（用于把引号内换行的多行字段拼回一行）
function endsInsideQuote(line) {
  let inQuote = false; let fieldStart = true;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') { if (line[i + 1] === '"') i++; else inQuote = false; }
    } else if (c === '"' && fieldStart) { inQuote = true; fieldStart = false; }
    else if (c === ',') fieldStart = true;
    else if (c !== ' ') fieldStart = false;
  }
  return inQuote;
}

// 按未转义的 | 拆分 Markdown 行：竖线前有奇数个反斜杠才是转义竖线，偶数个（如 \\|）仍是分隔符
function splitMarkdownRow(line) {
  const parts = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '|') {
      let bs = 0;
      for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) bs++;
      if (bs % 2 === 1) { cur += c; continue; }
      parts.push(cur); cur = '';
    } else cur += c;
  }
  parts.push(cur);
  // 首尾竖线产生的空段去掉
  if (parts.length > 1 && parts[0].trim() === '') parts.shift();
  if (parts.length > 1 && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map(c => c.replace(/\\\|/g, '|'));
}

function parseSeparatorAlign(cell) {
  const t = cell.trim();
  if (!/^:?-+:?$/.test(t)) return undefined;
  const left = t.startsWith(':'); const right = t.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null; // 纯横线：未指定，交给自动判断
}

export function parseTableInput(input) {
  const notes = [];
  const rawText = String(input ?? '');
  if (rawText.length > MAX_CHARS) return { ok: false, error: `输入过长（${rawText.length} 字符），最多 ${MAX_CHARS} 字符，请拆分后再生成` };
  const raw = rawText.replace(/\r\n?/g, '\n');
  // 保留物理行号，报错定位到原文行；空白行跳过但不影响行号
  let physical = raw.split('\n')
    .map((text, i) => ({ text, lineNo: i + 1 }))
    .filter(l => l.text.trim() !== '');
  // CSV 引号内换行：以逗号或引号开头且引号未闭合的行，与后续行拼回（含 Tab 的行是 TSV，不参与）
  const joined = [];
  for (let i = 0; i < physical.length; i++) {
    let { text, lineNo } = physical[i];
    if (!text.includes('\t') && (text.includes(',') || text.trimStart().startsWith('"'))) {
      let guard = 0;
      while (endsInsideQuote(text) && i + 1 < physical.length && guard < 100) {
        i++; guard++;
        text += '\n' + physical[i].text;
      }
    }
    joined.push({ text, lineNo });
  }
  physical = joined;
  if (!physical.length) return { ok: false, error: '请输入表格内容：每行一行数据，列之间用 Tab、逗号或 | 分隔' };
  if (physical.length > MAX_ROWS) return { ok: false, error: `最多 ${MAX_ROWS} 行，请拆分后再生成` };
  const rows = [];
  let alignments = null;
  let usedFullWidth = false;
  for (const { text, lineNo } of physical) {
    let line = text;
    // 无 ASCII 分隔符时，全角逗号/竖线也可作分隔符（中文输入法粘贴常见）
    if (!line.includes('\t') && !line.includes(',') && !line.includes('|') && /[，｜]/.test(line)) {
      line = line.replace(/，/g, ',').replace(/｜/g, '|');
      usedFullWidth = true;
    }
    let cells;
    const trimmed = line.trim();
    if (line.includes('\t')) cells = line.split('\t');
    else if (trimmed.startsWith('|')) cells = splitMarkdownRow(trimmed);
    else if (line.includes(',')) {
      const r = parseCsvLine(line);
      if (!r.ok) return { ok: false, error: `第 ${lineNo} 行：${r.error}` };
      cells = r.cells;
    } else if (line.includes('|')) cells = splitMarkdownRow(trimmed);
    else cells = [line];
    // 分隔行（如 |---|---|、|:---:|）跳过，并记录其对齐供「自动」模式保留
    const seps = cells.map(parseSeparatorAlign);
    if (cells.length > 0 && seps.every(s => s !== undefined)) {
      if (!alignments) alignments = seps;
      continue;
    }
    rows.push(cells.map(c => c.trim()));
  }
  if (usedFullWidth) notes.push('已按全角逗号/竖线（，｜）识别分隔符');
  if (!rows.length) return { ok: false, error: '没有可用的表格行（输入可能只有分隔行）' };
  const cols = Math.max(...rows.map(r => r.length));
  if (cols > MAX_COLS) return { ok: false, error: `最多 ${MAX_COLS} 列` };
  rows.forEach(r => { while (r.length < cols) r.push(''); });
  return { ok: true, rows, cols, alignments, notes };
}

const NUM_RE = /^[+-]?((\d{1,3}(,\d{3})+|\d+)(\.\d*)?|\.\d+)([eE][+-]?\d+)?%?$/;
export function resolveAlignments(rows, hasHeader, align, parsedAlignments = null) {
  const cols = rows[0].length;
  if (align !== 'auto') return Array(cols).fill(align);
  const body = hasHeader ? rows.slice(1) : rows;
  return Array.from({ length: cols }, (_, c) => {
    if (parsedAlignments && parsedAlignments[c]) return parsedAlignments[c];
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

export function buildMarkdownTable(rows, { hasHeader = true, align = 'auto', pretty = true, parsedAlignments = null } = {}) {
  if (!rows.length) return '';
  const cols = rows[0].length;
  const header = hasHeader ? rows[0] : Array.from({ length: cols }, (_, i) => `列${i + 1}`);
  const body = hasHeader ? rows.slice(1) : rows;
  const aligns = resolveAlignments(rows, hasHeader, align, parsedAlignments);
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
  const markdown = buildMarkdownTable(parsed.rows, { ...options, parsedAlignments: parsed.alignments });
  return { ok: true, markdown, rows: parsed.rows.length, dataRows: options.hasHeader === false ? parsed.rows.length : parsed.rows.length - 1, cols: parsed.cols, notes: parsed.notes || [] };
}
