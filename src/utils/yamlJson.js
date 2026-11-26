// YAML <-> JSON 互转核心（纯本地，无第三方库）
// JSON->YAML：块式输出，字符串按需加引号（会与保留字/数字/特殊字符冲突时用双引号），
//   多行字符串用双引号转义形式，保证输出可被常见 YAML 解析器读回。
// YAML->JSON：支持常见子集——缩进映射/序列、序列内映射、行内流式 [ ] { }、
//   单/双引号字符串、数字/布尔/null 推断、注释、| 与 > 块标量、--- 文档标记。
//   锚点(&)/别名(*)/标签(!)等高级特性会明确报错，不静默误解析。

const RESERVED = /^(true|false|null|~|yes|no|on|off)$/i
const NUMERIC_LIKE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const PLAIN_BAD_START = /^[\s\-?:,[\]{}#&*!|>'"%@`]/

function needsQuote(s) {
  if (s === '') return true
  if (s !== s.trim()) return true
  if (RESERVED.test(s) || NUMERIC_LIKE.test(s)) return true
  if (PLAIN_BAD_START.test(s)) return true
  if (/[:#\n\r\t]/.test(s)) return true
  if (/[\[\]{},&*!|>'"%@`]/.test(s)) return true
  if (/\s#/.test(s) || s.endsWith(':')) return true
  return false
}

function scalarToYaml(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('JSON 含 Infinity/NaN，YAML 无法可靠表示')
    return String(v)
  }
  if (typeof v === 'string') {
    if (v.includes('\n')) return JSON.stringify(v)
    return needsQuote(v) ? JSON.stringify(v) : v
  }
  throw new Error('不支持的值类型：' + typeof v)
}

function keyToYaml(k) {
  return needsQuote(k) ? JSON.stringify(k) : k
}

function emit(value, indent, lines) {
  const pad = ' '.repeat(indent)
  if (Array.isArray(value)) {
    if (!value.length) { lines.push(pad + '[]'); return }
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        if (Array.isArray(item) && !item.length) { lines.push(pad + '- []'); continue }
        if (!Array.isArray(item) && !Object.keys(item).length) { lines.push(pad + '- {}'); continue }
        const sub = []
        emit(item, indent + 2, sub)
        sub[0] = pad + '- ' + sub[0].slice(indent + 2)
        lines.push(...sub)
      } else {
        lines.push(pad + '- ' + scalarToYaml(item))
      }
    }
    return
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value)
    if (!keys.length) { lines.push(pad + '{}'); return }
    for (const k of keys) {
      const v = value[k]
      const key = keyToYaml(k)
      if (v !== null && typeof v === 'object') {
        if (Array.isArray(v) && !v.length) { lines.push(pad + key + ': []'); continue }
        if (!Array.isArray(v) && !Object.keys(v).length) { lines.push(pad + key + ': {}'); continue }
        lines.push(pad + key + ':')
        emit(v, indent + 2, lines)
      } else {
        lines.push(pad + key + ': ' + scalarToYaml(v))
      }
    }
    return
  }
  lines.push(pad + scalarToYaml(value))
}

// 返回 { yaml, topType }
export function jsonToYaml(input) {
  let data = input
  if (typeof input === 'string') {
    const t = input.trim()
    if (!t) throw new Error('输入为空，请粘贴 JSON 内容')
    try { data = JSON.parse(t) } catch (e) { throw new Error('JSON 解析失败：' + e.message) }
  }
  const lines = []
  emit(data, 0, lines)
  const topType = Array.isArray(data) ? '数组' : (data !== null && typeof data === 'object' ? '对象' : '标量')
  return { yaml: lines.join('\n'), topType }
}

// ---------- YAML 解析 ----------

function stripComment(line) {
  let inS = false, inD = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inD) { if (ch === '\\') i++; else if (ch === '"') inD = false; continue }
    if (inS) { if (ch === "'") inS = false; continue }
    if (ch === '"') inD = true
    else if (ch === "'") inS = true
    else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i)
  }
  return line
}

function parsePlainScalar(s) {
  const t = s.trim()
  if (t === '' || t === '~' || /^null$/i.test(t)) return null
  if (/^true$/i.test(t)) return true
  if (/^false$/i.test(t)) return false
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) && !/^[-+]?0\d/.test(t.replace(/^\./, '0.'))) {
    const n = Number(t)
    if (Number.isFinite(n)) return n
  }
  if (/^0x[0-9a-fA-F]+$/.test(t)) return parseInt(t, 16)
  if (/^0o[0-7]+$/.test(t)) return parseInt(t.slice(2), 8)
  return t
}

function parseFlowOrScalar(s, lineNo) {
  const t = s.trim()
  if (!t) return null
  if (t.startsWith('&') || t.startsWith('*') || t.startsWith('!')) {
    throw new Error('第 ' + lineNo + ' 行使用了锚点/别名/标签，本工具暂不支持，请先展开')
  }
  if (t.startsWith('"')) {
    try { return JSON.parse(t) } catch { throw new Error('第 ' + lineNo + ' 行双引号字符串解析失败') }
  }
  if (t.startsWith("'")) {
    if (!t.endsWith("'") || t.length < 2) throw new Error('第 ' + lineNo + ' 行单引号字符串未闭合')
    return t.slice(1, -1).replace(/''/g, "'")
  }
  if (t.startsWith('[') || t.startsWith('{')) return parseFlow(t, lineNo)
  return parsePlainScalar(t)
}

function splitFlow(inner, lineNo) {
  const parts = []
  let depth = 0, inS = false, inD = false, cur = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (inD) { cur += ch; if (ch === '\\') { cur += inner[++i] ?? '' } else if (ch === '"') inD = false; continue }
    if (inS) { cur += ch; if (ch === "'") inS = false; continue }
    if (ch === '"') { inD = true; cur += ch; continue }
    if (ch === "'") { inS = true; cur += ch; continue }
    if (ch === '[' || ch === '{') depth++
    if (ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim() !== '' || parts.length) parts.push(cur)
  return parts
}

function parseFlow(t, lineNo) {
  if (t.startsWith('[')) {
    if (!t.endsWith(']')) throw new Error('第 ' + lineNo + ' 行流式序列未闭合')
    const inner = t.slice(1, -1).trim()
    if (!inner) return []
    return splitFlow(inner, lineNo).map(p => parseFlowOrScalar(p, lineNo))
  }
  if (!t.endsWith('}')) throw new Error('第 ' + lineNo + ' 行流式映射未闭合')
  const inner = t.slice(1, -1).trim()
  const obj = {}
  if (!inner) return obj
  for (const part of splitFlow(inner, lineNo)) {
    const idx = findKeyColon(part)
    if (idx < 0) throw new Error('第 ' + lineNo + ' 行流式映射缺少冒号：' + part.trim())
    const k = String(parseFlowOrScalar(part.slice(0, idx), lineNo))
    obj[k] = parseFlowOrScalar(part.slice(idx + 1), lineNo)
  }
  return obj
}

// 找映射键与值之间的冒号（冒号后须为空格或行尾，且不在引号/流式括号内）
function findKeyColon(s) {
  let depth = 0, inS = false, inD = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inD) { if (ch === '\\') i++; else if (ch === '"') inD = false; continue }
    if (inS) { if (ch === "'") inS = false; continue }
    if (ch === '"') inD = true
    else if (ch === "'") inS = true
    else if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') depth--
    else if (ch === ':' && depth === 0 && (i === s.length - 1 || s[i + 1] === ' ')) return i
  }
  return -1
}

// 把原始文本整理成 { indent, content, lineNo, raw } 行数组，处理块标量
function toLines(text) {
  const rawLines = String(text).replace(/\r\n?/g, '\n').split('\n')
  const lines = []
  let i = 0
  while (i < rawLines.length) {
    const raw = rawLines[i]
    const lineNo = i + 1
    i++
    if (/^\s*$/.test(raw)) continue
    const trimmedStart = raw.replace(/^\s+/, '')
    if (trimmedStart.startsWith('#')) continue
    if (trimmedStart === '---' || trimmedStart === '...') continue
    if (raw.includes('\t')) throw new Error('第 ' + lineNo + ' 行含 Tab，YAML 缩进必须用空格')
    const indent = raw.length - trimmedStart.length
    const content = stripComment(trimmedStart).replace(/\s+$/, '')
    if (!content) continue
    // 块标量：key: | / key: > 或 - | 等，收集其后更深缩进的原始行
    const blockMatch = content.match(/^(.*?)([|>])\s*$/)
    const isBlockHead = blockMatch && (findKeyColon(content) >= 0 || content.startsWith('- '))
    if (isBlockHead) {
      const folded = blockMatch[2] === '>'
      const buf = []
      let blockIndent = null
      while (i < rawLines.length) {
        const braw = rawLines[i]
        if (/^\s*$/.test(braw)) {
          // 空行先暂存，后续若仍在块内则计入
          let j = i
          while (j < rawLines.length && /^\s*$/.test(rawLines[j])) j++
          if (j < rawLines.length) {
            const nIndent = rawLines[j].length - rawLines[j].replace(/^\s+/, '').length
            if (blockIndent !== null && nIndent >= blockIndent) { buf.push(''); i++; continue }
          }
          break
        }
        const bIndent = braw.length - braw.replace(/^\s+/, '').length
        if (blockIndent === null) {
          if (bIndent <= indent) break
          blockIndent = bIndent
        }
        if (bIndent < blockIndent) break
        buf.push(braw.slice(blockIndent))
        i++
      }
      const text2 = folded ? buf.join(' ') : buf.join('\n')
      lines.push({ indent, content, lineNo, block: text2 })
      continue
    }
    lines.push({ indent, content, lineNo })
  }
  return lines
}

function parseBlock(lines, start, indent) {
  let pos = start
  const first = lines[pos]
  if (!first || first.indent < indent) return { value: null, pos }
  const isSeq = first.content === '-' || first.content.startsWith('- ')
  if (isSeq) {
    const arr = []
    while (pos < lines.length) {
      const ln = lines[pos]
      if (ln.indent !== indent || !(ln.content === '-' || ln.content.startsWith('- '))) break
      const rest = ln.content === '-' ? '' : ln.content.slice(2)
      if (ln.block !== undefined) { arr.push(ln.block); pos++; continue }
      if (!rest.trim()) {
        pos++
        if (pos < lines.length && lines[pos].indent > indent) {
          const r = parseBlock(lines, pos, lines[pos].indent); arr.push(r.value); pos = r.pos
        } else arr.push(null)
        continue
      }
      if (findKeyColon(rest) >= 0 && !rest.startsWith('[') && !rest.startsWith('{') && !rest.startsWith('"') && !rest.startsWith("'")) {
        // 序列内的映射：把本行改写为虚拟行，indent 为 indent+2
        lines[pos] = { indent: indent + 2, content: rest, lineNo: ln.lineNo }
        const r = parseBlock(lines, pos, indent + 2); arr.push(r.value); pos = r.pos
        continue
      }
      arr.push(parseFlowOrScalar(rest, ln.lineNo))
      pos++
    }
    return { value: arr, pos }
  }
  if (findKeyColon(first.content) >= 0) {
    const obj = {}
    while (pos < lines.length) {
      const ln = lines[pos]
      if (ln.indent !== indent) break
      const ci = findKeyColon(ln.content)
      if (ci < 0) break
      const keyRaw = ln.content.slice(0, ci).trim()
      if (!keyRaw) throw new Error('第 ' + ln.lineNo + ' 行键名为空')
      const key = String(parseFlowOrScalar(keyRaw, ln.lineNo))
      const rest = ln.content.slice(ci + 1).trim()
      pos++
      if (ln.block !== undefined) { obj[key] = ln.block; continue }
      if (rest) { obj[key] = parseFlowOrScalar(rest, ln.lineNo); continue }
      if (pos < lines.length && lines[pos].indent > indent) {
        const r = parseBlock(lines, pos, lines[pos].indent); obj[key] = r.value; pos = r.pos
      } else if (pos < lines.length && lines[pos].indent === indent && (lines[pos].content === '-' || lines[pos].content.startsWith('- '))) {
        // YAML 允许序列与父键同缩进
        const r = parseBlock(lines, pos, indent); obj[key] = r.value; pos = r.pos
      } else obj[key] = null
    }
    return { value: obj, pos }
  }
  // 纯标量文档
  return { value: parseFlowOrScalar(first.content, first.lineNo), pos: pos + 1 }
}

// 返回 { data, topType }
export function yamlToJson(text) {
  const src = String(text ?? '')
  if (!src.trim()) throw new Error('输入为空，请粘贴 YAML 内容')
  const lines = toLines(src)
  if (!lines.length) throw new Error('没有可解析的 YAML 内容')
  const r = parseBlock(lines, 0, lines[0].indent)
  if (r.pos < lines.length) {
    throw new Error('第 ' + lines[r.pos].lineNo + ' 行缩进或结构无法解析，请检查对齐')
  }
  const data = r.value
  const topType = Array.isArray(data) ? '数组' : (data !== null && typeof data === 'object' ? '对象' : '标量')
  return { data, topType }
}
