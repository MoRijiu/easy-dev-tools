// 文本 Diff 核心逻辑（纯本地）：基于 LCS 的行级对比 + 字符级行内高亮
// 供 TextDiff.vue 使用，也可独立在 Node 下测试。

export const MAX_LINES = 2000;
// LCS 动态规划表上限（行数乘积），超出时退化为逐行位置对比，避免浏览器卡死
export const MAX_CELLS = 1000000;

function normalizeLine(line, opts) {
  let s = line;
  if (opts.ignoreWhitespace) s = s.replace(/\s+/g, ' ').trim();
  if (opts.ignoreCase) s = s.toLowerCase();
  return s;
}

export function splitLines(text) {
  if (!text) return [];
  const normalized = String(text).replace(/\r\n?/g, '\n');
  // 末尾单个换行不产生空行，与常见编辑器/Diff 工具口径一致
  const body = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return body === '' ? [] : body.split('\n');
}

/**
 * 行级 Diff。
 * @returns {{ rows: Array<{type:'same'|'del'|'add', text:string, oldNo:number|null, newNo:number|null}>,
 *             stats: {added:number, deleted:number, unchanged:number}, truncated:boolean, fallback:boolean }}
 */
export function diffLines(oldText, newText, options = {}) {
  const opts = { ignoreWhitespace: !!options.ignoreWhitespace, ignoreCase: !!options.ignoreCase };
  let oldLines = splitLines(oldText);
  let newLines = splitLines(newText);
  let truncated = false;
  if (oldLines.length > MAX_LINES) { oldLines = oldLines.slice(0, MAX_LINES); truncated = true; }
  if (newLines.length > MAX_LINES) { newLines = newLines.slice(0, MAX_LINES); truncated = true; }

  const rows = [];
  const pushStats = () => {
    const stats = { added: 0, deleted: 0, unchanged: 0 };
    rows.forEach(r => {
      if (r.type === 'add') stats.added += 1;
      else if (r.type === 'del') stats.deleted += 1;
      else stats.unchanged += 1;
    });
    return stats;
  };

  if (oldLines.length * newLines.length > MAX_CELLS) {
    // 退化：按行号逐行对比（同位置不同即一删一增）
    const max = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < max; i += 1) {
      const a = oldLines[i]; const b = newLines[i];
      if (a !== undefined && b !== undefined && normalizeLine(a, opts) === normalizeLine(b, opts)) {
        rows.push({ type: 'same', text: b, oldNo: i + 1, newNo: i + 1 });
      } else {
        if (a !== undefined) rows.push({ type: 'del', text: a, oldNo: i + 1, newNo: null });
        if (b !== undefined) rows.push({ type: 'add', text: b, oldNo: null, newNo: i + 1 });
      }
    }
    return { rows, stats: pushStats(), truncated, fallback: true };
  }

  const n = oldLines.length; const m = newLines.length;
  const aNorm = oldLines.map(l => normalizeLine(l, opts));
  const bNorm = newLines.map(l => normalizeLine(l, opts));
  // dp[i][j] = oldLines[i:] 与 newLines[j:] 的 LCS 长度
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = aNorm[i] === bNorm[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (aNorm[i] === bNorm[j]) {
      rows.push({ type: 'same', text: newLines[j], oldNo: i + 1, newNo: j + 1 });
      i += 1; j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', text: oldLines[i], oldNo: i + 1, newNo: null });
      i += 1;
    } else {
      rows.push({ type: 'add', text: newLines[j], oldNo: null, newNo: j + 1 });
      j += 1;
    }
  }
  while (i < n) { rows.push({ type: 'del', text: oldLines[i], oldNo: i + 1, newNo: null }); i += 1; }
  while (j < m) { rows.push({ type: 'add', text: newLines[j], oldNo: null, newNo: j + 1 }); j += 1; }
  return { rows, stats: pushStats(), truncated, fallback: false };
}

/**
 * 字符级 Diff（供修改行行内高亮）：返回 [{type:'same'|'del'|'add', text}]
 * 字符数乘积过大时退化为整行一删一增。
 */
export function diffChars(oldStr, newStr) {
  const a = Array.from(oldStr || '');
  const b = Array.from(newStr || '');
  if (!a.length) return b.length ? [{ type: 'add', text: newStr }] : [];
  if (!b.length) return [{ type: 'del', text: oldStr }];
  if (a.length * b.length > 40000) {
    return [{ type: 'del', text: oldStr }, { type: 'add', text: newStr }];
  }
  const n = a.length; const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segs = [];
  const push = (type, ch) => {
    const last = segs[segs.length - 1];
    if (last && last.type === type) last.text += ch;
    else segs.push({ type, text: ch });
  };
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', a[i]); i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', a[i]); i += 1; }
    else { push('add', b[j]); j += 1; }
  }
  while (i < n) { push('del', a[i]); i += 1; }
  while (j < m) { push('add', b[j]); j += 1; }
  return segs;
}

/**
 * 把行级 rows 配成左右双栏：连续的 del 块与紧随的 add 块按序配对，
 * 配对行附带行内字符高亮（oldSegs/newSegs）。
 * @returns {Array<{left:object|null, right:object|null, type:'same'|'change'|'del'|'add'}>}
 */
export function pairRows(rows) {
  const pairs = [];
  let k = 0;
  while (k < rows.length) {
    if (rows[k].type === 'same') {
      pairs.push({ left: rows[k], right: rows[k], type: 'same' });
      k += 1;
      continue;
    }
    const dels = []; const adds = [];
    while (k < rows.length && rows[k].type === 'del') { dels.push(rows[k]); k += 1; }
    while (k < rows.length && rows[k].type === 'add') { adds.push(rows[k]); k += 1; }
    const max = Math.max(dels.length, adds.length);
    for (let t = 0; t < max; t += 1) {
      const left = dels[t] || null; const right = adds[t] || null;
      const pair = { left, right, type: left && right ? 'change' : (left ? 'del' : 'add') };
      if (left && right) {
        const segs = diffChars(left.text, right.text);
        pair.oldSegs = segs.filter(s => s.type !== 'add');
        pair.newSegs = segs.filter(s => s.type !== 'del');
      }
      pairs.push(pair);
    }
  }
  return pairs;
}

/** 生成 unified diff 文本（供复制） */
export function toUnifiedText(rows) {
  return rows.map(r => `${r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '} ${r.text}`).join('\n');
}

/** 相似度：未变更行占总行数（两侧取大）的百分比 0-100 */
export function similarity(stats, oldCount, newCount) {
  const total = Math.max(oldCount, newCount);
  if (!total) return 100;
  return Math.round((stats.unchanged / total) * 100);
}
