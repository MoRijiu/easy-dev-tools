// 文本统计核心（纯本地）：字符/词数/行段句/字节/阅读时长/高频词。
// 口径：字符按 Unicode 码点计；词数 = 中日韩单字数 + 英文单词数；
// 阅读时长按中文 400 字/分钟、英文 200 词/分钟估算。
// 句子计数：连续终止标点（。！？.!?…）只算一处句末；数字间的小数点（3.14、版本号 1.0.0）
// 不算句末；纯标点/纯空白不算句子；无标点结尾但有实际内容的残段算一句。

export const MAX_TEXT_LENGTH = 1000000

const CJK_SEQ_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]+/g
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g
const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g
const TERMINATORS = new Set(['。', '！', '？', '.', '!', '?', '…'])
const CONTENT_RE = /[\p{L}\p{N}]/u

function utf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  // 兜底：按码点估算 UTF-8 字节
  let n = 0
  for (const ch of text) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4 }
  return n
}

export function countSentences(text) {
  const raw = String(text ?? '')
  if (raw.trim() === '') return 0
  // 保护数字间的小数点：3.14 / 1.0.0 里的点不是句末
  const protectedText = raw.replace(/(?<=\d)\.(?=\d)/g, '\u0001')
  let count = 0
  let hasContent = false
  for (const ch of protectedText) {
    if (TERMINATORS.has(ch)) {
      if (hasContent) { count += 1; hasContent = false }
    } else if (CONTENT_RE.test(ch)) {
      hasContent = true
    }
  }
  if (hasContent) count += 1
  return count
}

export function extractTokens(text) {
  const tokens = []
  const en = String(text).match(WORD_RE) || []
  for (const w of en) tokens.push(w.toLowerCase())
  // 中日韩高频词用双字组合（bigram）近似，单字片段保留单字；
  // 序列范围与词数统计的 CJK 口径保持一致（假名/谚文同样计入）
  const cjkSeqs = String(text).match(CJK_SEQ_RE) || []
  for (const seq of cjkSeqs) {
    if (seq.length === 1) tokens.push(seq)
    else for (let i = 0; i < seq.length - 1; i++) tokens.push(seq.slice(i, i + 2))
  }
  return tokens
}

export function analyzeText(text, { topLimit = 10 } = {}) {
  const raw = String(text ?? '')
  const chars = [...raw].length
  if (chars > MAX_TEXT_LENGTH) {
    throw new Error(`文本过长：最多支持 ${MAX_TEXT_LENGTH.toLocaleString('en-US')} 个字符，当前 ${chars.toLocaleString('en-US')} 个，请删减后再统计`)
  }
  const charsNoSpaces = [...raw.replace(/\s/g, '')].length
  const cjkChars = (raw.match(CJK_RE) || []).length
  const englishWordsArr = raw.match(WORD_RE) || []
  const englishWords = englishWordsArr.length
  const words = cjkChars + englishWords
  const digits = (raw.match(/[\d０-９]/g) || []).length
  const letters = (raw.match(/[A-Za-z]/g) || []).length
  const spaces = (raw.match(/[ 　\t]/g) || []).length
  const linesArr = raw === '' ? [] : raw.replace(/\r\n?/g, '\n').split('\n')
  // 末尾换行不额外算一行
  const lines = raw === '' ? 0 : (linesArr.length > 1 && linesArr[linesArr.length - 1] === '' ? linesArr.length - 1 : linesArr.length)
  const paragraphs = raw.trim() === '' ? 0 : raw.trim().split(/\n\s*\n/).filter(p => p.trim() !== '').length
  const sentences = countSentences(raw)
  const bytes = utf8Bytes(raw)
  const readMin = words === 0 ? 0 : (cjkChars / 400 + englishWords / 200)
  const speakMin = words === 0 ? 0 : (cjkChars / 300 + englishWords / 150)
  const tokens = extractTokens(raw)
  const freq = new Map()
  for (const t of tokens) {
    if (/^[a-z0-9]+$/.test(t) && t.length < 2) continue
    freq.set(t, (freq.get(t) || 0) + 1)
  }
  // 百分比分母用实际计入统计的词次总数，与分子口径一致
  const countedTokens = [...freq.values()].reduce((sum, n) => sum + n, 0)
  const topWords = [...freq.entries()].map(([word, count]) => ({ word, count, percent: countedTokens ? +(count / countedTokens * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, topLimit)
  const longestLine = linesArr.reduce((m, l) => Math.max(m, [...l].length), 0)
  return {
    chars, charsNoSpaces, cjkChars, englishWords, words, digits, letters, spaces,
    lines, paragraphs, sentences, bytes, longestLine,
    readingMinutes: +readMin.toFixed(2), speakingMinutes: +speakMin.toFixed(2),
    readingText: formatDuration(readMin), speakingText: formatDuration(speakMin),
    topWords, uniqueWords: freq.size
  }
}

export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 秒'
  const totalSec = Math.max(1, Math.round(minutes * 60))
  if (totalSec < 60) return `${totalSec} 秒`
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  return s ? `${m} 分 ${s} 秒` : `${m} 分钟`
}

export function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US')
}

export function buildSummary(stats) {
  if (!stats) return ''
  return [
    `字符数：${formatCount(stats.chars)}（不含空白 ${formatCount(stats.charsNoSpaces)}）`,
    `词数：${formatCount(stats.words)}（中日韩 ${formatCount(stats.cjkChars)} 字 + 英文 ${formatCount(stats.englishWords)} 词）`,
    `行数：${formatCount(stats.lines)}，段落：${formatCount(stats.paragraphs)}，句子：${formatCount(stats.sentences)}`,
    `字节数（UTF-8）：${formatCount(stats.bytes)}`,
    `预计阅读：${stats.readingText}，朗读：${stats.speakingText}`
  ].join('\n')
}
