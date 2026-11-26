// 文本行处理核心（纯本地）：按行修剪、删空行、去重、排序、反转、加行号与前后缀。
// 处理顺序固定：修剪 → 删空行 → 去重 → 排序 → 反转 → 前后缀 → 行号，便于预期结果。

export function splitLines(text) {
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
    case 'length-asc': arr.sort((a, b) => a.length - b.length || collator.compare(a, b)); break
    case 'length-desc': arr.sort((a, b) => b.length - a.length || collator.compare(a, b)); break
    default: break
  }
  return arr
}

export function processLines(text, options = {}) {
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
  } = options

  const inputLines = splitLines(text)
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
    const width = String(numberStart + lines.length - 1).length
    lines = lines.map((l, i) => `${String(numberStart + i).padStart(width, '0')}. ${l}`)
  }

  return {
    text: lines.join('\n'),
    lines,
    stats: {
      inputLines: inputLines.length,
      outputLines: lines.length,
      removedEmpty,
      removedDuplicates,
      inputChars: String(text ?? '').length,
      outputChars: lines.join('\n').length
    }
  }
}
