// TOML <-> JSON 互转核心（纯本地，无第三方库）
// TOML->JSON：支持表 [a.b]、数组表 [[a]]、点分键、基本/字面字符串（含多行）、
//   整数（十/十六/八/二进制，含下划线分隔）、浮点（含 inf/nan）、布尔、
//   日期时间（按字符串保留原文）、数组、内联表与 # 注释；重复键/表、
//   未闭合字符串等错误定位到行。
// JSON->TOML：顶层必须是对象；标量与普通数组先行、子表随后、对象数组用 [[表]]；
//   null 无法用 TOML 表示会明确报错指出路径。

const BARE_KEY = /^[A-Za-z0-9_-]+/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}(?:[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?$/
const TIME_RE = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// 由 [[ ]] 创建的数组（与普通数组值区分）
const arrayTableSet = new WeakSet()

class TomlParser {
  constructor(text) {
    this.s = String(text).replace(/\r\n?/g, '\n')
    this.i = 0
    this.line = 1
    this.root = {}
    this.current = this.root
    this.explicitTables = new Set()
  }

  err(msg) { return new Error(`第 ${this.line} 行：${msg}`) }
  eof() { return this.i >= this.s.length }
  peek() { return this.s[this.i] }
  peekAt(n) { return this.s[this.i + n] }

  advance(n = 1) {
    for (let k = 0; k < n; k++) {
      if (this.s[this.i] === '\n') this.line++
      this.i++
    }
  }

  skipSpaces() {
    while (!this.eof() && (this.peek() === ' ' || this.peek() === '\t')) this.advance()
  }

  skipComment() {
    if (this.peek() === '#') while (!this.eof() && this.peek() !== '\n') this.advance()
  }

  skipWsNewlinesComments() {
    for (;;) {
      const c = this.peek()
      if (c === ' ' || c === '\t' || c === '\n') this.advance()
      else if (c === '#') this.skipComment()
      else return
    }
  }

  expect(ch, what) {
    if (this.peek() !== ch) throw this.err(`期望 ${what || ch}，实际为 ${this.eof() ? '文件结尾' : `「${this.peek()}」`}`)
    this.advance()
  }

  parse() {
    for (;;) {
      this.skipSpaces()
      this.skipComment()
      if (this.eof()) break
      if (this.peek() === '\n') { this.advance(); continue }
      if (this.peek() === '[') this.parseTableHeader()
      else this.parseKeyValue(this.current)
      this.skipSpaces()
      this.skipComment()
      if (!this.eof() && this.peek() !== '\n') throw this.err(`行尾有多余内容「${this.peek()}」`)
    }
    return this.root
  }

  resolveParent(parts) {
    let node = this.root
    for (const part of parts) {
      let next = node[part]
      if (next === undefined) { next = {}; node[part] = next }
      if (Array.isArray(next)) {
        if (!arrayTableSet.has(next)) throw this.err(`键「${part}」已是普通数组，不能作为表路径`)
        next = next[next.length - 1]
      }
      if (!isPlainObject(next)) throw this.err(`键「${part}」已是标量值，不能作为表`)
      node = next
    }
    return node
  }

  parseTableHeader() {
    const startLine = this.line
    const isArray = this.peekAt(1) === '['
    this.advance(isArray ? 2 : 1)
    this.skipSpaces()
    const parts = this.parseKey()
    this.skipSpaces()
    if (isArray) {
      if (!(this.peek() === ']' && this.peekAt(1) === ']')) { this.line = startLine; throw this.err('数组表头缺少 ]]') }
      this.advance(2)
      const parent = this.resolveParent(parts.slice(0, -1))
      const last = parts[parts.length - 1]
      let arr = parent[last]
      if (arr === undefined) { arr = []; parent[last] = arr; arrayTableSet.add(arr) }
      if (!Array.isArray(arr) || !arrayTableSet.has(arr)) throw this.err(`「${parts.join('.')}」不是数组表，不能用 [[ ]] 追加`)
      const item = {}
      arr.push(item)
      this.current = item
    } else {
      if (this.peek() !== ']') { this.line = startLine; throw this.err('表头缺少 ]') }
      this.advance()
      const pathKey = parts.join('\u0000')
      if (this.explicitTables.has(pathKey)) throw this.err(`表 [${parts.join('.')}] 重复定义`)
      const table = this.resolveParent(parts)
      if (Array.isArray(table)) throw this.err(`「${parts.join('.')}」已是数组表，不能再用 [ ] 定义`)
      this.explicitTables.add(pathKey)
      this.current = table
    }
  }

  parseKey() {
    const parts = []
    for (;;) {
      this.skipSpaces()
      const c = this.peek()
      if (c === '"' || c === "'") {
        parts.push(this.parseString())
      } else {
        const m = BARE_KEY.exec(this.s.slice(this.i))
        if (!m) throw this.err('键名不合法（应为裸键、"引号键" 或 \'引号键\'）')
        parts.push(m[0])
        this.advance(m[0].length)
      }
      this.skipSpaces()
      if (this.peek() === '.') { this.advance(); continue }
      return parts
    }
  }

  setValue(target, parts, value) {
    let node = target
    for (let k = 0; k < parts.length - 1; k++) {
      const part = parts[k]
      let next = node[part]
      if (next === undefined) { next = {}; node[part] = next }
      if (Array.isArray(next)) {
        if (!arrayTableSet.has(next)) throw this.err(`键「${part}」已是普通数组，不能再展开为表`)
        next = next[next.length - 1]
      }
      if (!isPlainObject(next)) throw this.err(`键「${part}」已是标量值，不能再展开`)
      node = next
    }
    const last = parts[parts.length - 1]
    if (Object.prototype.hasOwnProperty.call(node, last)) throw this.err(`键「${parts.join('.')}」重复赋值`)
    node[last] = value
  }

  parseKeyValue(target) {
    const parts = this.parseKey()
    this.skipSpaces()
    this.expect('=', '键后的 =')
    this.skipSpaces()
    const value = this.parseValue()
    this.setValue(target, parts, value)
  }

  parseValue() {
    const c = this.peek()
    if (c === '"' || c === "'") return this.parseString()
    if (c === '[') return this.parseArray()
    if (c === '{') return this.parseInlineTable()
    return this.parseBareValue()
  }

  parseString() {
    const quote = this.peek()
    const triple = this.peekAt(1) === quote && this.peekAt(2) === quote
    if (triple) {
      this.advance(3)
      if (this.peek() === '\n') this.advance() // 多行首个换行被修剪
      let out = ''
      for (;;) {
        if (this.eof()) throw this.err('多行字符串未闭合')
        if (this.peek() === quote && this.peekAt(1) === quote && this.peekAt(2) === quote) {
          this.advance(3)
          return out
        }
        if (quote === '"' && this.peek() === '\\') {
          // 行尾反斜杠续行：跳过其后全部空白（含换行）
          let k = this.i + 1
          while (k < this.s.length && (this.s[k] === ' ' || this.s[k] === '\t' || this.s[k] === '\n')) k++
          if (this.s.slice(this.i + 1, k).includes('\n')) {
            while (this.i < k) this.advance()
            continue
          }
          out += this.parseEscape()
          continue
        }
        out += this.peek()
        this.advance()
      }
    }
    this.advance()
    let out = ''
    for (;;) {
      if (this.eof() || this.peek() === '\n') throw this.err('字符串未闭合')
      const ch = this.peek()
      if (ch === quote) { this.advance(); return out }
      if (quote === '"' && ch === '\\') { out += this.parseEscape(); continue }
      out += ch
      this.advance()
    }
  }

  parseEscape() {
    this.advance() // 反斜杠
    const c = this.peek()
    const simple = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' }
    if (Object.prototype.hasOwnProperty.call(simple, c)) { this.advance(); return simple[c] }
    if (c === 'u' || c === 'U') {
      const len = c === 'u' ? 4 : 8
      this.advance()
      const hex = this.s.slice(this.i, this.i + len)
      if (!new RegExp(`^[0-9A-Fa-f]{${len}}$`).test(hex)) throw this.err(`\\${c} 转义需要 ${len} 位十六进制`)
      const code = parseInt(hex, 16)
      if (code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) throw this.err('Unicode 转义码点不合法')
      this.advance(len)
      return String.fromCodePoint(code)
    }
    throw this.err(`不认识的转义 \\${c || ''}`)
  }

  parseBareValue() {
    const start = this.i
    while (!this.eof() && !/[\s,\]}#]/.test(this.peek())) this.advance()
    const tok = this.s.slice(start, this.i)
    if (!tok) throw this.err('缺少值')
    if (tok === 'true') return true
    if (tok === 'false') return false
    if (DATETIME_RE.test(tok) || TIME_RE.test(tok)) return tok
    const sign = tok.startsWith('-') ? -1 : 1
    if (/^[+-]?(inf|nan)$/.test(tok)) return tok.includes('nan') ? NaN : sign * Infinity
    const unsigned = tok.replace(/^[+-]/, '')
    if (/^0x[0-9A-Fa-f_]+$/.test(unsigned)) return sign * parseInt(unsigned.slice(2).replace(/_/g, ''), 16)
    if (/^0o[0-7_]+$/.test(unsigned)) return sign * parseInt(unsigned.slice(2).replace(/_/g, ''), 8)
    if (/^0b[01_]+$/.test(unsigned)) return sign * parseInt(unsigned.slice(2).replace(/_/g, ''), 2)
    if (/^[+-]?[\d_]+$/.test(tok)) {
      const v = Number(tok.replace(/_/g, ''))
      if (!Number.isSafeInteger(v)) throw this.err(`整数 ${tok} 超出安全范围，请改用字符串`)
      return v
    }
    if (/^[+-]?(?:[\d_]+(?:\.[\d_]+)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?$/.test(tok) && /[.eE]/.test(tok)) {
      return Number(tok.replace(/_/g, ''))
    }
    throw this.err(`无法识别的值「${tok}」（字符串请加引号）`)
  }

  parseArray() {
    this.expect('[')
    const arr = []
    for (;;) {
      this.skipWsNewlinesComments()
      if (this.eof()) throw this.err('数组未闭合，缺少 ]')
      if (this.peek() === ']') { this.advance(); return arr }
      arr.push(this.parseValue())
      this.skipWsNewlinesComments()
      if (this.peek() === ',') { this.advance(); continue }
      if (this.peek() === ']') { this.advance(); return arr }
      throw this.err('数组元素之间缺少逗号')
    }
  }

  parseInlineTable() {
    this.expect('{')
    const obj = {}
    this.skipSpaces()
    if (this.peek() === '}') { this.advance(); return obj }
    for (;;) {
      this.skipSpaces()
      const parts = this.parseKey()
      this.skipSpaces()
      this.expect('=', '内联表键后的 =')
      this.skipSpaces()
      this.setValue(obj, parts, this.parseValue())
      this.skipSpaces()
      if (this.peek() === ',') { this.advance(); continue }
      if (this.peek() === '}') { this.advance(); return obj }
      throw this.err('内联表元素之间缺少逗号')
    }
  }
}

export function tomlToJson(text) {
  if (!String(text).trim()) throw new Error('输入为空')
  const data = new TomlParser(text).parse()
  return { data, topType: '对象' }
}

// ---------- JSON -> TOML ----------

function tomlKey(k) {
  return /^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k)
}

function tomlValue(v, path) {
  if (v === null || v === undefined) throw new Error(`路径 ${path || '(根)'} 的值为 null，TOML 没有 null，请先删除该字段或改为空字符串`)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return 'nan'
    if (v === Infinity) return 'inf'
    if (v === -Infinity) return '-inf'
    return String(v)
  }
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map((x) => tomlValue(x, path)).join(', ') + ']'
  if (isPlainObject(v)) {
    return '{ ' + Object.entries(v).map(([k, x]) => `${tomlKey(k)} = ${tomlValue(x, path + '.' + k)}`).join(', ') + ' }'
  }
  throw new Error(`路径 ${path} 的值类型不受支持`)
}

function isArrayTable(v) {
  return Array.isArray(v) && v.length > 0 && v.every(isPlainObject)
}

function emitTable(obj, path, lines) {
  const scalars = []
  const tables = []
  const arrayTables = []
  for (const [k, v] of Object.entries(obj)) {
    if (isPlainObject(v)) tables.push([k, v])
    else if (isArrayTable(v)) arrayTables.push([k, v])
    else scalars.push([k, v])
  }
  for (const [k, v] of scalars) {
    lines.push(`${tomlKey(k)} = ${tomlValue(v, [...path, k].join('.'))}`)
  }
  for (const [k, v] of tables) {
    const p = [...path, k]
    if (lines.length && lines[lines.length - 1] !== '') lines.push('')
    lines.push(`[${p.map(tomlKey).join('.')}]`)
    emitTable(v, p, lines)
  }
  for (const [k, v] of arrayTables) {
    const p = [...path, k]
    for (const item of v) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      lines.push(`[[${p.map(tomlKey).join('.')}]]`)
      emitTable(item, p, lines)
    }
  }
}

export function jsonToToml(text) {
  let data
  try { data = JSON.parse(text) } catch (e) { throw new Error('JSON 解析失败：' + e.message) }
  if (!isPlainObject(data)) throw new Error('TOML 顶层必须是对象（表），JSON 顶层为数组/标量时无法转换')
  const lines = []
  emitTable(data, [], lines)
  return { toml: lines.length ? lines.join('\n') + '\n' : '', topType: '对象' }
}
