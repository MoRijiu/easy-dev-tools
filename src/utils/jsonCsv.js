// JSON <-> CSV 互转核心（纯本地）
// JSON->CSV：接受对象数组（或单个对象）；表头为所有对象键的并集（按首次出现顺序）；
//   嵌套对象/数组用 JSON.stringify 压平为单元格文本；按 RFC 4180 转义（逗号/引号/换行时加引号、引号双写）。
// CSV->JSON：完整引号解析（引号内换行/分隔符、"" 转义）；首行为表头；可选类型推断（数字/布尔/null）。
// R8h 打磨：剥 BOM（Excel 导出常带，旧版会污染第一个表头名）；表头去首尾空格后判重；
//   数据行列数多于表头时定位报错（旧版静默丢弃多出内容）；列数不足时补空并回报 warnings；
//   引号未闭合/闭合引号后跟杂字符报错带行号；JSON 解析失败带行列定位；输入规模上限防卡死。

import { parseJsonDetailed } from './jsonFormat.js'

export const DELIMITERS = [
  { id: ',', label: '逗号 ,' },
  { id: ';', label: '分号 ;' },
  { id: '\t', label: '制表符 Tab' },
]

const MAX_INPUT_CHARS = 1000000
const MAX_ROWS = 20000

function checkSize(text) {
  if (text.length > MAX_INPUT_CHARS) {
    throw new Error('输入过长：' + text.length + ' 个字符，上限 ' + MAX_INPUT_CHARS + ' 个字符，请拆分后再转')
  }
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

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
    const t = stripBom(input).trim()
    if (!t) throw new Error('输入为空，请粘贴 JSON 内容')
    checkSize(t)
    const parsed = parseJsonDetailed(t)
    if (!parsed.ok) {
      const e = parsed.error
      const where = e.line ? '（第 ' + e.line + ' 行第 ' + e.column + ' 列）' : ''
      const hint = e.hints && e.hints.length ? '；' + e.hints[0] : ''
      throw new Error('JSON 解析失败' + where + '：' + e.message + hint)
    }
    data = parsed.value
  }
  let rows
  if (Array.isArray(data)) rows = data
  else if (data && typeof data === 'object') rows = [data]
  else throw new Error('仅支持对象数组或单个对象（顶层是数字/字符串/布尔时无法转成表格）')
  if (!rows.length) throw new Error('数组为空，没有可转换的行')
  if (rows.length > MAX_ROWS) throw new Error('行数过多：' + rows.length + ' 行，上限 ' + MAX_ROWS + ' 行，请拆分后再转')
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

// 逐字符解析 CSV，返回 { rows, rowLines }：rows 为二维字符串数组，rowLines 为每行起始的物理行号（1 起）。
function parseCsvDetailed(text, delimiter = ',') {
  const src = stripBom(String(text ?? ''))
  const rows = []
  const rowLines = []
  const rowTouched = [] // 该行是否出现过字符/引号/分隔符——区分真空行与「只有一个空引号字段」的行
  let row = []
  let field = ''
  let inQuotes = false
  let afterQuote = false // 已闭合引号：之后只允许分隔符/换行/结尾，出现其他字符即格式错误
  let fieldStarted = false
  let touched = false
  let line = 1
  let rowStartLine = 1
  let quoteStartLine = 0
  let i = 0
  const pushField = () => { row.push(field); field = ''; afterQuote = false; fieldStarted = false }
  const pushRow = () => { pushField(); rows.push(row); rowLines.push(rowStartLine); rowTouched.push(touched); row = []; touched = false }
  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; afterQuote = true; i++; continue
      }
      if (ch === '\n') line++
      field += ch; touched = true; i++; continue
    }
    if (afterQuote) {
      if (ch === delimiter) { pushField(); i++; continue }
      if (ch === '\r') { i++; continue }
      if (ch === '\n') { pushRow(); line++; rowStartLine = line; i++; continue }
      throw new Error('CSV 第 ' + line + ' 行：引号闭合后出现了多余字符「' + ch + '」，引号字段后只能跟分隔符或换行')
    }
    if (ch === '"' && !fieldStarted) { inQuotes = true; touched = true; quoteStartLine = line; i++; continue }
    if (ch === delimiter) { touched = true; pushField(); i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { pushRow(); line++; rowStartLine = line; i++; continue }
    field += ch; fieldStarted = true; touched = true; i++
  }
  if (inQuotes) throw new Error('CSV 引号未闭合（引号从第 ' + quoteStartLine + ' 行开始），请检查输入')
  // 末尾没有换行时收下最后一行；完全空尾行丢弃
  if (field !== '' || row.length || afterQuote) pushRow()
  const keptRows = []
  const keptLines = []
  rows.forEach((r, idx) => {
    if (!(r.length === 1 && r[0] === '' && !rowTouched[idx])) { keptRows.push(r); keptLines.push(rowLines[idx]) }
  })
  return { rows: keptRows, rowLines: keptLines }
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

// 返回 { data, headers, rowCount, warnings }
export function csvToJson(text, { delimiter = ',', inferTypes = false } = {}) {
  const src = String(text ?? '')
  if (!stripBom(src).trim()) throw new Error('输入为空，请粘贴 CSV 内容')
  checkSize(src)
  const { rows, rowLines } = parseCsvDetailed(src, delimiter)
  if (!rows.length) throw new Error('没有解析到任何行')
  if (rows.length - 1 > MAX_ROWS) throw new Error('行数过多：' + (rows.length - 1) + ' 行数据，上限 ' + MAX_ROWS + ' 行，请拆分后再转')
  // 表头去首尾空格（Excel/手写 CSV 常见），空表头补 colN，去空格后判重
  const headers = rows[0].map((h, idx) => (h.trim() === '' ? 'col' + (idx + 1) : h.trim()))
  const dup = headers.find((h, idx) => headers.indexOf(h) !== idx)
  if (dup) throw new Error('表头有重复列名：' + dup + '（含去掉首尾空格后同名的列）')
  const warnings = []
  let paddedRows = 0
  const data = rows.slice(1).map((r, rIdx) => {
    if (r.length > headers.length) {
      throw new Error('CSV 第 ' + rowLines[rIdx + 1] + ' 行有 ' + r.length + ' 列，多于表头的 ' + headers.length + ' 列；多出的内容不会被静默丢弃，请修正该行或补齐表头')
    }
    if (r.length < headers.length) paddedRows++
    const obj = {}
    headers.forEach((h, idx) => {
      const raw = idx < r.length ? r[idx] : ''
      obj[h] = inferTypes ? inferValue(raw) : raw
    })
    return obj
  })
  if (paddedRows) warnings.push(paddedRows + ' 行列数少于表头，缺失的单元格已补为空字符串')
  return { data, headers, rowCount: data.length, warnings }
}
