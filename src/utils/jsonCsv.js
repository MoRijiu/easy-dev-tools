// JSON <-> CSV 互转核心（纯本地）
// JSON->CSV：接受对象数组（或单个对象）；表头为所有对象键的并集（按首次出现顺序）；
//   嵌套对象/数组用 JSON.stringify 压平为单元格文本；按 RFC 4180 转义（逗号/引号/换行时加引号、引号双写）。
// CSV->JSON：完整引号解析（引号内换行/分隔符、"" 转义）；首行为表头；可选类型推断（数字/布尔/null）。

export const DELIMITERS = [
  { id: ',', label: '逗号 ,' },
  { id: ';', label: '分号 ;' },
  { id: '\t', label: '制表符 Tab' },
]

function escapeCell(text, delimiter) {
  const s = String(text ?? '')
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// 返回 { csv, headers, rowCount }
export function jsonToCsv(input, delimiter = ',') {
  let data = input
  if (typeof input === 'string') {
    const t = input.trim()
    if (!t) throw new Error('输入为空，请粘贴 JSON 内容')
    try { data = JSON.parse(t) } catch (e) { throw new Error('JSON 解析失败：' + e.message) }
  }
  let rows
  if (Array.isArray(data)) rows = data
  else if (data && typeof data === 'object') rows = [data]
  else throw new Error('仅支持对象数组或单个对象（顶层是数字/字符串/布尔时无法转成表格）')
  if (!rows.length) throw new Error('数组为空，没有可转换的行')
  rows.forEach((r, i) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('第 ' + (i + 1) + ' 行不是对象，无法转成表格')
  })
  const headers = []
  const seen = new Set()
  rows.forEach(r => Object.keys(r).forEach(k => { if (!seen.has(k)) { seen.add(k); headers.push(k) } }))
  const lines = [headers.map(h => escapeCell(h, delimiter)).join(delimiter)]
  rows.forEach(r => lines.push(headers.map(h => escapeCell(cellText(r[h]), delimiter)).join(delimiter)))
  return { csv: lines.join('\n'), headers, rowCount: rows.length }
}

// 逐字符解析 CSV，返回二维数组 rows（每行是字符串数组）
export function parseCsv(text, delimiter = ',') {
  const src = String(text ?? '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push(row); row = [] }
  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue }
    if (ch === delimiter) { pushField(); i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { pushRow(); i++; continue }
    field += ch; i++
  }
  if (inQuotes) throw new Error('CSV 引号未闭合，请检查输入')
  // 末尾没有换行时收下最后一行；完全空尾行丢弃
  if (field !== '' || row.length) pushRow()
  return rows.filter(r => !(r.length === 1 && r[0] === ''))
}

function inferValue(s) {
  if (s === '') return ''
  if (s === 'null') return null
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return s
}

// 返回 { data, headers, rowCount }
export function csvToJson(text, { delimiter = ',', inferTypes = false } = {}) {
  const src = String(text ?? '')
  if (!src.trim()) throw new Error('输入为空，请粘贴 CSV 内容')
  const rows = parseCsv(src, delimiter)
  if (!rows.length) throw new Error('没有解析到任何行')
  const headers = rows[0].map((h, idx) => (h.trim() === '' ? 'col' + (idx + 1) : h))
  const dup = headers.find((h, idx) => headers.indexOf(h) !== idx)
  if (dup) throw new Error('表头有重复列名：' + dup)
  const data = rows.slice(1).map(r => {
    const obj = {}
    headers.forEach((h, idx) => {
      const raw = idx < r.length ? r[idx] : ''
      obj[h] = inferTypes ? inferValue(raw) : raw
    })
    return obj
  })
  return { data, headers, rowCount: data.length }
}
