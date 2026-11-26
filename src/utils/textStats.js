// 文本统计核心（纯本地）：字符/词数/行段句/字节/阅读时长/高频词。
// 口径：字符按 Unicode 码点计；词数 = 英文单词数 + 中日韩单字数；
// 阅读时长按中文 400 字/分钟、英文 200 词/分钟估算。

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g
const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g

function utf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  // 兜底：按码点估算 UTF-8 字节
  let n = 0
  for (const ch of text) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4 }
  return n
}

export function extractTokens(text) {
  const tokens = []
  const en = String(text).match(WORD_RE) || []
  for (const w of en) tokens.push(w.toLowerCase())
  // 中文高频词用双字组合（bigram）近似，单字片段保留单字
  const cjkSeqs = String(text).match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g) || []
  for (const seq of cjkSeqs) {
    if (seq.length === 1) tokens.push(seq)
    else for (let i = 0; i < seq.length - 1; i++) tokens.push(seq.slice(i, i + 2))
  }
  return tokens
}

export function analyzeText(text, { topLimit = 10 } = {}) {
  const raw = String(text ?? '')
  const chars = [...raw].length
  const charsNoSpaces = [...raw.replace(/\s/g, '')].length
  const cjkChars = (raw.match(CJK_RE) || []).length
  const englishWordsArr = raw.match(WORD_RE) || []
  const englishWords = englishWordsArr.length
  const words = cjkChars + englishWords
  const digits = (raw.match(/\d/g) || []).length
  const letters = (raw.match(/[A-Za-z]/g) || []).length
  const spaces = (raw.match(/ /g) || []).length
  const linesArr = raw === '' ? [] : raw.replace(/\r\n?/g, '\n').split('\n')
  // 末尾换行不额外算一行
  const lines = raw === '' ? 0 : (linesArr.length > 1 && linesArr[linesArr.length - 1] === '' ? linesArr.length - 1 : linesArr.length)
  const paragraphs = raw.trim() === '' ? 0 : raw.trim().split(/\n\s*\n/).filter(p => p.trim() !== '').length
  const sentenceMatches = raw.match(/[^。！？.!?]+[。！？.!?]+/g) || []
  let sentences = sentenceMatches.length
  // 无标点结尾的残余片段也算一句（有实际内容时）
  const rest = raw.replace(/[^。！？.!?]+[。！？.!?]+/g, '').trim()
  if (rest) sentences += 1
  if (raw.trim() === '') sentences = 0
  const bytes = utf8Bytes(raw)
  const readMin = words === 0 ? 0 : (cjkChars / 400 + englishWords / 200)
  const speakMin = words === 0 ? 0 : (cjkChars / 300 + englishWords / 150)
  const tokens = extractTokens(raw)
  const freq = new Map()
  for (const t of tokens) {
    if (/^[a-z0-9]+$/.test(t) && t.length < 2) continue
    freq.set(t, (freq.get(t) || 0) + 1)
  }
  const topWords = [...freq.entries()].map(([word, count]) => ({ word, count, percent: tokens.length ? +(count / tokens.length * 100).toFixed(1) : 0 }))
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
  const m = Math.floor(totalSec / 60), s = totalSec % 60
  return s ? `${m} 分 ${s} 秒` : `${m} 分钟`
}

export function buildSummary(stats) {
  if (!stats) return ''
  return [
    `字符数：${stats.chars}（不含空白 ${stats.charsNoSpaces}）`,
    `词数：${stats.words}（中文 ${stats.cjkChars} 字 + 英文 ${stats.englishWords} 词）`,
    `行数：${stats.lines}，段落：${stats.paragraphs}，句子：${stats.sentences}`,
    `字节数（UTF-8）：${stats.bytes}`,
    `预计阅读：${stats.readingText}，朗读：${stats.speakingText}`
  ].join('\n')
}
