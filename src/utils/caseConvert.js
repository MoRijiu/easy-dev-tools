// 命名格式转换核心（纯本地）：把任意标识符/短语拆成单词，再拼成各种命名风格
// 拆词规则（按码点逐字分类，Unicode 字母/数字都算单词字符，不再静默丢弃 é/中文等非 ASCII 字母）：
// - 非字母数字一律分隔符切分；
// - 小写/无大小写字母/数字 → 大写处切分（如 userName、caféMenu、用户Name、HTTP2Server 的 2→S）；
// - 连续大写缩略词与后续单词间切分（如 HTTPServer -> HTTP + Server）；
// - 字母与数字之间不切分（version2、sha256 保持整词，数字后接大写已由上一条切开）。

const RE_UPPER = /^\p{Lu}$/u
const RE_LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u

function charKind(ch) {
  if (!RE_LETTER_OR_DIGIT.test(ch)) return 'sep'
  if (RE_UPPER.test(ch)) return 'upper'
  return 'other' // 小写、无大小写字母（中文等）、数字、其他字母
}

export function splitWords(input) {
  const chars = [...String(input ?? '')]
  const words = []
  let cur = ''
  const flush = () => { if (cur) { words.push(cur.toLowerCase()); cur = '' } }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const kind = charKind(ch)
    if (kind === 'sep') { flush(); continue }
    if (cur && kind === 'upper') {
      const prevKind = charKind(chars[i - 1])
      const next = chars[i + 1]
      const nextKind = next !== undefined ? charKind(next) : 'sep'
      // 前一字非大写（小写/中文/数字）→ 大写：驼峰边界
      // 前一字也是大写、且后一字是小写类：缩略词收尾，边界在本大写之前（HTTP|Server）
      if (prevKind === 'other' || (prevKind === 'upper' && nextKind === 'other' && !/^\p{N}$/u.test(next ?? ''))) {
        flush()
      }
    }
    cur += ch
  }
  flush()
  return words
}

const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)

export const CASE_STYLES = [
  { id: 'camel', label: 'camelCase 小驼峰', build: (ws) => ws.map((w, i) => (i === 0 ? w : cap(w))).join('') },
  { id: 'pascal', label: 'PascalCase 大驼峰', build: (ws) => ws.map(cap).join('') },
  { id: 'snake', label: 'snake_case 下划线', build: (ws) => ws.join('_') },
  { id: 'screaming', label: 'SCREAMING_SNAKE 常量', build: (ws) => ws.join('_').toUpperCase() },
  { id: 'kebab', label: 'kebab-case 短横线', build: (ws) => ws.join('-') },
  { id: 'train', label: 'Train-Case 标题短横线', build: (ws) => ws.map(cap).join('-') },
  { id: 'title', label: 'Title Case 标题', build: (ws) => ws.map(cap).join(' ') },
  { id: 'sentence', label: 'Sentence case 句子', build: (ws) => { const t = ws.join(' '); return cap(t) } },
  { id: 'dot', label: 'dot.case 点分隔', build: (ws) => ws.join('.') },
  { id: 'path', label: 'path/case 路径', build: (ws) => ws.join('/') },
  { id: 'lower', label: 'lowercase 全小写', build: (ws) => ws.join('') },
  { id: 'upper', label: 'UPPERCASE 全大写', build: (ws) => ws.join('').toUpperCase() },
]

// 单行转换：返回 [{id,label,value}]
export function convertCaseLine(input) {
  const ws = splitWords(input)
  if (!ws.length) return CASE_STYLES.map(s => ({ id: s.id, label: s.label, value: '' }))
  return CASE_STYLES.map(s => ({ id: s.id, label: s.label, value: s.build(ws) }))
}

// 多行转换：逐行转换、保留空行（\r\n / \r / \n 都认），返回与 CASE_STYLES 对齐的 [{id,label,value}]
export function convertCase(input) {
  const lines = String(input ?? '').split(/\r\n|\r|\n/)
  return CASE_STYLES.map(s => ({
    id: s.id,
    label: s.label,
    value: lines.map(line => {
      const ws = splitWords(line)
      return ws.length ? s.build(ws) : ''
    }).join('\n')
  }))
}

export const MAX_INPUT_CHARS = 20000
export const MAX_INPUT_LINES = 1000

// 输入体检：供 UI 给出点名提示，避免「假成功」与静默丢内容
// 返回 { lineCount, wordCount, emptyResultLines:[行号], leadingDigitLines:[行号], tooLong, tooManyLines }
export function analyzeCaseInput(input) {
  const text = String(input ?? '')
  const lines = text.split(/\r\n|\r|\n/)
  const emptyResultLines = []
  const leadingDigitLines = []
  let wordCount = 0
  lines.forEach((line, idx) => {
    const ws = splitWords(line)
    wordCount += ws.length
    if (line.trim() && !ws.length) emptyResultLines.push(idx + 1)
    if (ws.length && /^\p{N}/u.test(ws[0])) leadingDigitLines.push(idx + 1)
  })
  return {
    lineCount: lines.length,
    wordCount,
    emptyResultLines,
    leadingDigitLines,
    tooLong: [...text].length > MAX_INPUT_CHARS,
    tooManyLines: lines.length > MAX_INPUT_LINES,
  }
}
