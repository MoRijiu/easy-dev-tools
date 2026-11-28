// 文本行处理核心（纯本地）：按行修剪、删空行、去重、排序、反转、加行号与前后缀。
// 处理顺序固定：修剪 → 删空行 → 去重 → 排序 → 反转 → 前后缀 → 行号，便于预期结果。
// 长度口径统一按 Unicode 码点计（一个 Emoji 算 1），不用 UTF-16 的 String.length。

const MAX_INPUT_CHARS = 1000000
const MAX_INPUT_LINES = 100000
const MAX_AFFIX_CHARS = 100

const textEncoder = new TextEncoder()

function codePointLength(text) {
  return [...String(text ?? '')].length
}

function utf8ByteLength(text) {
  return textEncoder.encode(String(text ?? '')).length
}

function splitLines(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n')
  if (normalized === '') return []
  const lines = normalized.split('\n')
  // 末尾换行产生的最后一个空字符串不算一行（与编辑器行数直觉一致）
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

function sortLines(lines, sort) {
  const arr = [...lines]
  switch (sort) {
    case 'asc': arr.sort((a, b) => collator.compare(a, b)); break
    case 'desc': arr.sort((a, b) => collator.compare(b, a)); break
    case 'length-asc': arr.sort((a, b) => codePointLength(a) - codePointLength(b) || collator.compare(a, b)); break
    case 'length-desc': arr.sort((a, b) => codePointLength(b) - codePointLength(a) || collator.compare(a, b)); break
    default: break
  }
  return arr
}

// 校验并归一化选项：行号起始与前后缀在页面手输时可能是字符串/越界值，点名报错而不是静默乱排。
function normalizeLineOptions(options = {}) {
  const numberStartRaw = options.numberStart ?? 1
  const numberStart = typeof numberStartRaw === 'string' && numberStartRaw.trim() !== '' ? Number(numberStartRaw) : numberStartRaw
  if (!Number.isInteger(numberStart) || numberStart < -999999 || numberStart > 999999) {
    throw new Error(`行号起始须是 -999999 到 999999 的整数，当前为「${numberStartRaw}」`)
  }
  const prefix = String(options.prefix ?? '')
  const suffix = String(options.suffix ?? '')
  if (codePointLength(prefix) > MAX_AFFIX_CHARS) throw new Error(`行前缀最多 ${MAX_AFFIX_CHARS} 个字符`)
  if (codePointLength(suffix) > MAX_AFFIX_CHARS) throw new Error(`行后缀最多 ${MAX_AFFIX_CHARS} 个字符`)
  return { ...options, numberStart, prefix, suffix }
}

export function processLines(text, options = {}) {
  const raw = String(text ?? '')
  if (codePointLength(raw) > MAX_INPUT_CHARS) {
    throw new Error(`输入最多 ${MAX_INPUT_CHARS} 个字符，当前 ${codePointLength(raw)} 个，请分批处理`)
  }
  const {
    trim = 'both', // none | both | start | end
    removeEmpty = false,
    dedupe = false,
    dedupeIgnoreCase = false,
    sort = 'none', // none | asc | desc | length-asc | length-desc
    reverse = false,
    prefix = '',
    suffix = '',
    addNumbers = false,
    numberStart = 1
  } = normalizeLineOptions(options)

  const inputLines = splitLines(raw)
  if (inputLines.length > MAX_INPUT_LINES) {
    throw new Error(`输入最多 ${MAX_INPUT_LINES} 行，当前 ${inputLines.length} 行，请分批处理`)
  }
  let lines = [...inputLines]

  if (trim === 'both') lines = lines.map((l) => l.trim())
  else if (trim === 'start') lines = lines.map((l) => l.trimStart())
  else if (trim === 'end') lines = lines.map((l) => l.trimEnd())

  let removedEmpty = 0
  if (removeEmpty) {
    const before = lines.length
    lines = lines.filter((l) => l.trim() !== '')
    removedEmpty = before - lines.length
  }

  let removedDuplicates = 0
  if (dedupe) {
    const seen = new Set()
    const kept = []
    for (const line of lines) {
      const key = dedupeIgnoreCase ? line.toLowerCase() : line
      if (seen.has(key)) { removedDuplicates++; continue }
      seen.add(key)
      kept.push(line)
    }
    lines = kept
  }

  lines = sortLines(lines, sort)
  if (reverse) lines = [...lines].reverse()

  if (prefix || suffix) lines = lines.map((l) => `${prefix}${l}${suffix}`)

  if (addNumbers) {
    // 仅正数起始才零填充对齐；负数/零起始直接写数字，避免 -1、00 这类怪对齐
    const width = numberStart > 0 ? String(numberStart + lines.length - 1).length : 0
    lines = lines.map((l, i) => {
      const n = String(numberStart + i)
      return `${width ? n.padStart(width, '0') : n}. ${l}`
    })
  }

  const outputText = lines.join('\n')
  return {
    text: outputText,
    lines,
    stats: {
      inputLines: inputLines.length,
      outputLines: lines.length,
      removedEmpty,
      removedDuplicates,
      inputChars: codePointLength(raw),
      inputBytes: utf8ByteLength(raw),
      outputChars: codePointLength(outputText),
      outputBytes: utf8ByteLength(outputText)
    }
  }
}
