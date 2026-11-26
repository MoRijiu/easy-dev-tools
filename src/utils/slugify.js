// URL Slug 生成：纯本地。
// 拉丁字母去重音（NFD 分解后去掉组合记号），其余非字母数字字符折叠为分隔符。
// 中文等非拉丁文字默认移除并计数提示（无拼音词库，不做不可靠的音译）；
// 可选保留 Unicode 字母（keepUnicode），生成含中文的 slug。

export const MAX_LENGTH = 20000;
export const MAX_LINES = 500;

const DEFAULT_OPTS = { separator: '-', lowercase: true, keepUnicode: false, dedupe: false, maxLength: 0 };

export function slugifyLine(text, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  const sep = opts.separator === '_' ? '_' : '-';
  const raw = String(text ?? '').trim();
  if (!raw) return { slug: '', removed: 0, keptUnicode: 0 };
  // 去重音：é -> e, ü -> u
  const decomposed = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let removed = 0;
  let keptUnicode = 0;
  let out = '';
  for (const ch of decomposed) {
    if (/[A-Za-z0-9]/.test(ch)) { out += ch; continue; }
    if (opts.keepUnicode && /[\p{L}\p{N}]/u.test(ch)) { out += ch; keptUnicode++; continue; }
    if (/\s/.test(ch) || ch === '-' || ch === '_' || ch === '.' || ch === '/') { out += sep; continue; }
    // 其余标点/符号：若是可打印字符计为移除，并以分隔符隔开单词（如 C++ -> c, don't -> don-t 的撇号处理）
    if (ch.codePointAt(0) > 0x20) removed++;
    out += sep;
  }
  let slug = out.split(sep).filter(Boolean).join(sep);
  if (opts.lowercase) slug = slug.toLowerCase();
  const max = Number(opts.maxLength) || 0;
  if (max > 0 && slug.length > max) {
    const cut = slug.slice(0, max);
    if (slug[max] === sep) {
      slug = cut;
    } else {
      const idx = cut.lastIndexOf(sep);
      slug = idx >= Math.floor(max / 2) ? cut.slice(0, idx) : cut;
    }
    slug = slug.replace(new RegExp(`\\${sep}+$`), '') || cut;
  }
  return { slug, removed, keptUnicode };
}

export function slugifyBatch(text, options = {}) {
  const input = String(text ?? '');
  if (!input.trim()) return { ok: false, error: '请先输入要生成 Slug 的文本' };
  if (input.length > MAX_LENGTH) return { ok: false, error: `文本过长：最多 ${MAX_LENGTH} 个字符` };
  const opts = { ...DEFAULT_OPTS, ...options };
  if (opts.separator !== '-' && opts.separator !== '_') return { ok: false, error: '分隔符只能是 - 或 _' };
  const max = Number(opts.maxLength) || 0;
  if (max < 0 || max > 500) return { ok: false, error: '最大长度应在 0（不限）到 500 之间' };
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > MAX_LINES) return { ok: false, error: `行数过多：最多 ${MAX_LINES} 行` };
  const seen = new Map();
  const results = [];
  let removedTotal = 0;
  let emptyCount = 0;
  for (const line of lines) {
    const r = slugifyLine(line, opts);
    removedTotal += r.removed;
    if (!r.slug) { emptyCount++; results.push({ source: line.trim(), slug: '' }); continue; }
    let slug = r.slug;
    if (opts.dedupe) {
      const base = slug;
      let n = seen.get(base) || 0;
      if (n > 0) slug = `${base}${opts.separator}${n + 1}`;
      seen.set(base, n + 1);
    }
    results.push({ source: line.trim(), slug });
  }
  const slugs = results.filter((r) => r.slug).map((r) => r.slug);
  if (!slugs.length) {
    return { ok: false, error: '没有生成任何 Slug：输入可能只含中文或符号。可勾选「保留中文等 Unicode 字母」后重试' };
  }
  return { ok: true, results, text: slugs.join('\n'), total: lines.length, generated: slugs.length, emptyCount, removedTotal };
}
