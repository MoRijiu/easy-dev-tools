// URL Slug 生成：纯本地。
// 拉丁字母去重音（NFD 分解后去掉组合记号），其余非字母数字字符折叠为分隔符。
// 中文等非拉丁文字默认移除并计数提示（无拼音词库，不做不可靠的音译）；
// 可选保留 Unicode 字母（keepUnicode），生成含中文的 slug。

const MAX_LENGTH = 20000;
const MAX_LINES = 500;

const DEFAULT_OPTS = { separator: '-', lowercase: true, keepUnicode: false, dedupe: false, maxLength: 0 };

// NFD 分解不了的拉丁字母按通行 slugify 惯例音译（ß→ss、æ→ae、ø→o、ł→l、đ→d、þ→th、ð→d、ı→i）
const SPECIAL_LATIN = {
  ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE',
  ø: 'o', Ø: 'O', ł: 'l', Ł: 'L', đ: 'd', Đ: 'D',
  ð: 'd', Ð: 'D', þ: 'th', Þ: 'TH', ı: 'i',
  ŋ: 'n', Ŋ: 'N', ħ: 'h', Ħ: 'H', ŧ: 't', Ŧ: 'T', ƒ: 'f',
};

// 全角字符（U+FF01–FF5E 与全角空格 U+3000）转半角，返回转换个数
function normalizeFullWidth(text) {
  let count = 0;
  const out = text.replace(/[\uFF01-\uFF5E\u3000]/g, (ch) => {
    count++;
    return ch === '\u3000' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  return { text: out, count };
}

function countCodePoints(text) {
  return [...String(text ?? '')].length;
}

function truncateSlug(slug, max, sep) {
  const chars = [...slug];
  if (chars.length <= max) return slug;
  const cutChars = chars.slice(0, max);
  let result;
  if (chars[max] === sep) {
    result = cutChars.join('');
  } else {
    const cut = cutChars.join('');
    const idx = cut.lastIndexOf(sep);
    result = idx >= Math.floor(max / 2) ? cut.slice(0, idx) : cut;
  }
  result = result.replace(new RegExp(`\\${sep}+$`), '');
  return result || cutChars.join('').replace(new RegExp(`\\${sep}+$`), '') || cutChars.join('');
}

function slugifyLine(text, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  const sep = opts.separator === '_' ? '_' : '-';
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { slug: '', removed: 0, keptUnicode: 0, fullWidth: 0, transliterated: 0 };
  const fw = normalizeFullWidth(trimmed);
  // 特殊拉丁字母音译（在去重音之前，否则会被当作非拉丁字符移除）
  let transliterated = 0;
  const special = fw.text.replace(/[ßẞæÆœŒøØłŁđĐðÐþÞıŋŊħĦŧŦƒ]/g, (ch) => { transliterated++; return SPECIAL_LATIN[ch]; });
  // 去重音：é -> e, ü -> u
  const decomposed = special.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  if (max > 0 && countCodePoints(slug) > max) slug = truncateSlug(slug, max, sep);
  return { slug, removed, keptUnicode, fullWidth: fw.count, transliterated };
}

// 给 slug 追加 -n 序号；有最大长度时先截短基底，保证序号版不超限
function withSuffix(base, n, sep, max) {
  const suffix = `${sep}${n}`;
  if (!max || countCodePoints(base) + countCodePoints(suffix) <= max) return base + suffix;
  const room = max - countCodePoints(suffix);
  if (room <= 0) return suffix.replace(sep, '') ? [...suffix].slice(1).join('') : String(n);
  const cut = [...base].slice(0, room).join('').replace(new RegExp(`\\${sep}+$`), '');
  return (cut || [...base].slice(0, room).join('')) + suffix;
}

export function slugifyBatch(text, options = {}) {
  const input = String(text ?? '');
  if (!input.trim()) return { ok: false, error: '请先输入要生成 Slug 的文本' };
  if (countCodePoints(input) > MAX_LENGTH) return { ok: false, error: `文本过长：最多 ${MAX_LENGTH} 个字符（按 Unicode 码点计）` };
  const opts = { ...DEFAULT_OPTS, ...options };
  if (opts.separator !== '-' && opts.separator !== '_') return { ok: false, error: '分隔符只能是 - 或 _' };
  const max = Number(opts.maxLength) || 0;
  if (!Number.isInteger(max) || max < 0 || max > 500) return { ok: false, error: '最大长度应为 0（不限）到 500 之间的整数' };
  const lines = input.split(/\r\n|\r|\n/).filter((l) => l.trim());
  if (lines.length > MAX_LINES) return { ok: false, error: `行数过多：最多 ${MAX_LINES} 行` };
  const used = new Set();
  const results = [];
  let removedTotal = 0;
  let emptyCount = 0;
  let fullWidthTotal = 0;
  let transliteratedTotal = 0;
  for (const line of lines) {
    const r = slugifyLine(line, opts);
    removedTotal += r.removed;
    fullWidthTotal += r.fullWidth;
    transliteratedTotal += r.transliterated;
    if (!r.slug) { emptyCount++; results.push({ source: line.trim(), slug: '' }); continue; }
    let slug = r.slug;
    if (opts.dedupe && used.has(slug)) {
      // 与已生成的全部 slug 比对（不只是同名计数），避免序号与天然 slug 撞车产出重复
      let n = 2;
      let candidate = withSuffix(r.slug, n, opts.separator, max);
      while (used.has(candidate)) { n++; candidate = withSuffix(r.slug, n, opts.separator, max); }
      slug = candidate;
    }
    used.add(slug);
    results.push({ source: line.trim(), slug });
  }
  const slugs = results.filter((r) => r.slug).map((r) => r.slug);
  if (!slugs.length) {
    return { ok: false, error: '没有生成任何 Slug：输入可能只含中文或符号。可勾选「保留中文等 Unicode 字母」后重试' };
  }
  const notes = [];
  if (fullWidthTotal) notes.push(`已把 ${fullWidthTotal} 个全角字符转为半角后处理`);
  if (transliteratedTotal) notes.push(`已把 ${transliteratedTotal} 个特殊拉丁字母音译（如 ß→ss、æ→ae、ø→o）`);
  return { ok: true, results, text: slugs.join('\n'), total: lines.length, generated: slugs.length, emptyCount, removedTotal, notes };
}
