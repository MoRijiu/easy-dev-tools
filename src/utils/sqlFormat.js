// SQL 格式化核心（纯本地）：分词时完整保护字符串、引号标识符与注释，
// 再按子句重排：主子句顶格、SELECT 列表与 AND/OR 缩进、子查询括号换行缩进。
// 不是完整 SQL 语法解析器：无法识别的构造原样保留，只做排版与关键词大小写。

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP',
  'ALTER', 'ADD', 'COLUMN', 'INDEX', 'VIEW', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'FULL', 'CROSS', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'BETWEEN',
  'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'DISTINCT', 'ALL', 'UNION',
  'INTERSECT', 'EXCEPT', 'ASC', 'DESC', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'CONSTRAINT', 'DEFAULT', 'CHECK', 'UNIQUE', 'RETURNING', 'WITH', 'OVER', 'PARTITION',
  'ROW_NUMBER', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CAST', 'TRUE', 'FALSE'
])

// 多词短语（按长度降序匹配）
const PHRASES = [
  ['LEFT', 'OUTER', 'JOIN'], ['RIGHT', 'OUTER', 'JOIN'], ['FULL', 'OUTER', 'JOIN'],
  ['GROUP', 'BY'], ['ORDER', 'BY'], ['LEFT', 'JOIN'], ['RIGHT', 'JOIN'],
  ['INNER', 'JOIN'], ['FULL', 'JOIN'], ['CROSS', 'JOIN'], ['DELETE', 'FROM'],
  ['INSERT', 'INTO'], ['CREATE', 'TABLE'], ['PRIMARY', 'KEY'], ['FOREIGN', 'KEY']
]

// 顶格开启新行的子句起始短语/词
const CLAUSE_START = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
  'VALUES', 'SET', 'UNION', 'INTERSECT', 'EXCEPT', 'RETURNING',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN',
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'ON'
])

export function tokenizeSql(sql) {
  const tokens = []
  const s = String(sql ?? '')
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/\s/.test(ch)) { i++; continue }
    // 行注释
    if (ch === '-' && s[i + 1] === '-') {
      let j = s.indexOf('\n', i)
      if (j === -1) j = s.length
      tokens.push({ type: 'comment', value: s.slice(i, j) })
      i = j; continue
    }
    // 块注释
    if (ch === '/' && s[i + 1] === '*') {
      let j = s.indexOf('*/', i + 2)
      j = j === -1 ? s.length : j + 2
      tokens.push({ type: 'comment', value: s.slice(i, j) })
      i = j; continue
    }
    // 字符串 / 引号标识符
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < s.length) {
        if (s[j] === ch) {
          if (s[j + 1] === ch) { j += 2; continue }
          j++; break
        }
        j++
      }
      tokens.push({ type: ch === "'" ? 'string' : 'ident', value: s.slice(i, j) })
      i = j; continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++
      const word = s.slice(i, j)
      tokens.push({ type: KEYWORDS.has(word.toUpperCase()) ? 'keyword' : 'word', value: word })
      i = j; continue
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[0-9A-Fa-fxX._]/.test(s[j])) j++
      tokens.push({ type: 'number', value: s.slice(i, j) })
      i = j; continue
    }
    const two = s.slice(i, i + 2)
    if (['>=', '<=', '<>', '!=', '||', '::'].includes(two)) {
      tokens.push({ type: 'symbol', value: two }); i += 2; continue
    }
    tokens.push({ type: 'symbol', value: ch })
    i++
  }
  return tokens
}

// 把连续 keyword token 合并成短语 token（如 GROUP BY）
function mergePhrases(tokens) {
  const out = []
  let i = 0
  while (i < tokens.length) {
    let matched = null
    if (tokens[i].type === 'keyword') {
      for (const phrase of PHRASES) {
        if (phrase.every((w, k) => {
          const t = tokens[i + k]
          return t && t.type === 'keyword' && t.value.toUpperCase() === w
        })) { matched = phrase; break }
      }
    }
    if (matched) {
      out.push({ type: 'keyword', value: matched.join(' '), phrase: true })
      i += matched.length
    } else {
      out.push(tokens[i]); i++
    }
  }
  return out
}

function applyCase(token, keywordCase) {
  if (token.type !== 'keyword') return token.value
  if (keywordCase === 'upper') return token.value.toUpperCase()
  if (keywordCase === 'lower') return token.value.toLowerCase()
  return token.value
}

// 相邻 token 之间是否需要空格（紧贴规则：函数名+(、表名.列名、逗号前等）
const FUNC_KEYWORDS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CAST', 'ROW_NUMBER'])
function needsSpace(prev, cur) {
  if (!prev) return false
  if (cur.value === ',' || cur.value === ')' || cur.value === '.' || cur.value === ';') return false
  if (prev.value === '(' || prev.value === '.') return false
  if (cur.value === '(') {
    // 子句关键词后加空格：FROM (SELECT…)、VALUES (…)
    if (prev.type === 'keyword' && CLAUSE_START.has(prev.value.toUpperCase())) return true
    // 函数调用：COUNT( / word( 不加空格
    if (prev.type === 'word') return false
    if (prev.type === 'keyword' && FUNC_KEYWORDS.has(prev.value.toUpperCase())) return false
  }
  return true
}

export function formatSql(sql, options = {}) {
  const { keywordCase = 'upper', indentSize = 2 } = options
  const raw = String(sql ?? '')
  if (!raw.trim()) return { text: '', stats: { tokens: 0, lines: 0, statements: 0 } }
  const tokens = mergePhrases(tokenizeSql(raw))
  const indentUnit = ' '.repeat(indentSize)
  const lines = []
  let cur = ''
  let depth = 0
  let inSelectList = false // SELECT 后、FROM 前：逗号换行缩进

  const flush = () => { if (cur.trim()) lines.push(cur.trimEnd()); cur = '' }
  const newLine = (extraIndent = 0) => {
    flush()
    cur = indentUnit.repeat(depth + extraIndent)
  }
  const append = (token) => {
    const v = applyCase(token, keywordCase)
    if (needsSpace(lastToken, token) && cur && !cur.endsWith(' ')) cur += ' '
    cur += v
    lastToken = token
  }
  let lastToken = null

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx]
    const upper = t.type === 'keyword' ? t.value.toUpperCase() : ''

    if (t.value === '(') {
      // 子查询：( 后跟 SELECT 则换行加深
      const next = tokens[idx + 1]
      append(t)
      if (next && next.type === 'keyword' && next.value.toUpperCase() === 'SELECT') {
        depth++
        newLine()
      }
      continue
    }
    if (t.value === ')') {
      if (inSelectList) inSelectList = false
      // 若括号内曾加深（子查询），先回退
      const wasSubquery = lines.length && depth > 0 && cur.trim() !== ''
      if (wasSubquery) { depth--; newLine() }
      append(t)
      continue
    }
    if (t.value === ';') {
      append(t)
      newLine()
      inSelectList = false
      continue
    }
    if (t.type === 'keyword' && CLAUSE_START.has(upper)) {
      if (upper === 'ON' && depth > 0) { newLine(1); append(t); continue }
      newLine()
      append(t)
      inSelectList = upper === 'SELECT'
      if (inSelectList) newLine(1)
      continue
    }
    if (t.type === 'keyword' && (upper === 'AND' || upper === 'OR')) {
      newLine(1)
      append(t)
      continue
    }
    if (t.value === ',') {
      append(t)
      if (depth === 0 && inSelectList) newLine(1)
      else if (depth > 0 && inSelectList) newLine(1)
      continue
    }
    append(t)
  }
  flush()
  const text = lines.filter((l) => l.trim() !== '').join('\n')
  return {
    text,
    stats: { tokens: tokens.length, lines: text ? text.split('\n').length : 0, statements: Math.max(text ? 1 : 0, tokens.filter((t) => t.value === ';').length) }
  }
}

export function minifySql(sql, options = {}) {
  const { keywordCase = 'preserve' } = options
  const tokens = tokenizeSql(String(sql ?? ''))
  let out = ''
  let lastToken = null
  for (const t of tokens) {
    const v = t.type === 'keyword' && keywordCase !== 'preserve'
      ? (keywordCase === 'upper' ? t.value.toUpperCase() : t.value.toLowerCase())
      : t.value
    const probe = { ...t, value: v }
    if (needsSpace(lastToken, probe) && out) out += ' '
    out += v
    lastToken = probe
  }
  return { text: out, stats: { tokens: tokens.length, lines: out ? 1 : 0, statements: Math.max(out ? 1 : 0, tokens.filter((t) => t.value === ';').length) } }
}
