// 命名格式转换核心（纯本地）：把任意标识符/短语拆成单词，再拼成各种命名风格
// 拆词规则：下划线/连字符/空格/点/斜杠等分隔符切分；小写→大写处切分；连续大写缩略词与后续单词间切分（如 HTTPServer -> HTTP + Server）

export function splitWords(input) {
  const s = String(input ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
  if (!s) return []
  return s.split(/\s+/).filter(Boolean).map(w => w.toLowerCase())
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

// 多行转换：逐行转换、保留空行，返回与 CASE_STYLES 对齐的 [{id,label,value}]
export function convertCase(input) {
  const lines = String(input ?? '').split(/\r?\n/)
  return CASE_STYLES.map(s => ({
    id: s.id,
    label: s.label,
    value: lines.map(line => {
      const ws = splitWords(line)
      return ws.length ? s.build(ws) : ''
    }).join('\n')
  }))
}
