// cURL 命令解析（纯本地）：shell 分词 -> 结构化请求 -> fetch / Python requests 代码生成
// 支持常用选项：-X/-H/-d/--data-*/-F/-u/-A/-e/-b/-G/-I/--url/--data-urlencode 等

export function tokenizeShell(input) {
  const tokens = []
  let cur = ''
  let started = false
  let i = 0
  const s = String(input || '')
  const push = () => { if (started) { tokens.push(cur); cur = ''; started = false } }
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '\n') { i += 2; continue }
    if (c === '\\' && s[i + 1] === '\r' && s[i + 2] === '\n') { i += 3; continue }
    if (/\s/.test(c)) { push(); i++; continue }
    if (c === "'") {
      started = true; i++
      let closed = false
      while (i < s.length) { if (s[i] === "'") { closed = true; i++; break } cur += s[i]; i++ }
      if (!closed) throw new Error('单引号未闭合，请检查命令引号配对')
      continue
    }
    if (c === '"') {
      started = true; i++
      let closed = false
      while (i < s.length) {
        if (s[i] === '"') { closed = true; i++; break }
        if (s[i] === '\\' && i + 1 < s.length && ['"', '\\', '$', '`'].includes(s[i + 1])) { cur += s[i + 1]; i += 2; continue }
        cur += s[i]; i++
      }
      if (!closed) throw new Error('双引号未闭合，请检查命令引号配对')
      continue
    }
    if (c === '$' && s[i + 1] === "'") {
      started = true; i += 2
      let closed = false
      while (i < s.length) {
        if (s[i] === "'") { closed = true; i++; break }
        if (s[i] === '\\' && i + 1 < s.length) {
          const n = s[i + 1]
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'" }
          cur += (n in map ? map[n] : '\\' + n); i += 2; continue
        }
        cur += s[i]; i++
      }
      if (!closed) throw new Error("$'...' 引号未闭合，请检查命令引号配对")
      continue
    }
    if (c === '\\' && i + 1 < s.length) { started = true; cur += s[i + 1]; i += 2; continue }
    started = true; cur += c; i++
  }
  push()
  return tokens
}

const VALUE_FLAGS = new Map([
  ['-X', 'method'], ['--request', 'method'],
  ['-H', 'header'], ['--header', 'header'],
  ['-d', 'data'], ['--data', 'data'], ['--data-raw', 'data'], ['--data-binary', 'data'], ['--data-ascii', 'data'],
  ['--data-urlencode', 'dataUrlencode'],
  ['-F', 'form'], ['--form', 'form'],
  ['-u', 'user'], ['--user', 'user'],
  ['-A', 'userAgent'], ['--user-agent', 'userAgent'],
  ['-e', 'referer'], ['--referer', 'referer'],
  ['-b', 'cookie'], ['--cookie', 'cookie'],
  ['--url', 'url'],
  ['-o', 'ignore'], ['--output', 'ignore'], ['--connect-timeout', 'ignore'], ['--max-time', 'ignore'],
  ['-m', 'ignore'], ['--retry', 'ignore'],
])

function splitHeader(h) {
  const idx = h.indexOf(':')
  if (idx < 0) throw new Error('请求头格式不正确（缺少冒号）：' + h)
  return { name: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim() }
}

export function parseCurl(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('请先粘贴一条 curl 命令')
  const tokens = tokenizeShell(raw)
  if (!tokens.length || tokens[0] !== 'curl') throw new Error('命令需以 curl 开头')
  const headers = []
  const dataParts = []
  const formFields = []
  const ignored = []
  let url = ''
  let method = ''
  let user = ''
  let getFlag = false
  let headFlag = false
  for (let i = 1; i < tokens.length; i++) {
    let tok = tokens[i]
    let inlineVal = null
    if (tok.startsWith('--') && tok.includes('=')) { const p = tok.indexOf('='); inlineVal = tok.slice(p + 1); tok = tok.slice(0, p) }
    else if (/^-[XHduAebF]/.test(tok) && tok.length > 2 && !VALUE_FLAGS.has(tok)) { inlineVal = tok.slice(2); tok = tok.slice(0, 2) }
    if (VALUE_FLAGS.has(tok)) {
      const kind = VALUE_FLAGS.get(tok)
      const val = inlineVal !== null ? inlineVal : tokens[++i]
      if (val === undefined) throw new Error('选项 ' + tok + ' 缺少参数值')
      if (kind === 'method') method = val.toUpperCase()
      else if (kind === 'header') headers.push(splitHeader(val))
      else if (kind === 'data') dataParts.push(val)
      else if (kind === 'dataUrlencode') {
        const eq = val.indexOf('=')
        dataParts.push(eq >= 0 ? val.slice(0, eq + 1) + encodeURIComponent(val.slice(eq + 1)) : encodeURIComponent(val))
      } else if (kind === 'form') {
        const eq = val.indexOf('=')
        formFields.push(eq >= 0 ? { name: val.slice(0, eq), value: val.slice(eq + 1) } : { name: val, value: '' })
      } else if (kind === 'user') user = val
      else if (kind === 'userAgent') headers.push({ name: 'User-Agent', value: val })
      else if (kind === 'referer') headers.push({ name: 'Referer', value: val })
      else if (kind === 'cookie') headers.push({ name: 'Cookie', value: val })
      else if (kind === 'url') url = val
      else if (kind === 'ignore') ignored.push(tok)
      continue
    }
    if (tok === '-G' || tok === '--get') { getFlag = true; continue }
    if (tok === '-I' || tok === '--head') { headFlag = true; continue }
    if (tok === '--compressed' || tok === '-s' || tok === '--silent' || tok === '-k' || tok === '--insecure' || tok === '-v' || tok === '--verbose' || tok === '-L' || tok === '--location' || tok === '-i' || tok === '--include') { ignored.push(tok); continue }
    if (tok.startsWith('-')) { ignored.push(tok); continue }
    if (!url) { url = tok; continue }
    throw new Error('无法识别的多余参数：' + tok)
  }
  if (!url) throw new Error('未找到 URL：命令里需要包含请求地址')
  if (!/^https?:\/\//i.test(url)) {
    if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url
    else throw new Error('URL 不合法：' + url)
  }
  let body = dataParts.join('&')
  if (getFlag && body) {
    url += (url.includes('?') ? '&' : '?') + body
    body = ''
  }
  if (!method) method = headFlag ? 'HEAD' : (body || formFields.length ? 'POST' : 'GET')
  let parsedUrl
  try { parsedUrl = new URL(url) } catch { throw new Error('URL 不合法：' + url) }
  const queryParams = []
  parsedUrl.searchParams.forEach((value, name) => queryParams.push({ name, value }))
  const contentType = (headers.find(h => h.name.toLowerCase() === 'content-type') || {}).value || ''
  let bodyType = 'none'
  let bodyJson = null
  if (formFields.length) bodyType = 'multipart/form-data'
  else if (body) {
    if (/json/i.test(contentType)) { bodyType = 'application/json'; try { bodyJson = JSON.parse(body) } catch { bodyJson = null } }
    else if (/x-www-form-urlencoded/i.test(contentType) || /^[^=&]+=[^&]*(&[^=&]+=[^&]*)*$/.test(body)) bodyType = 'application/x-www-form-urlencoded'
    else bodyType = 'raw'
  }
  const formParams = bodyType === 'application/x-www-form-urlencoded' && body
    ? body.split('&').filter(Boolean).map(p => { const eq = p.indexOf('='); const dec = (x) => { try { return decodeURIComponent(x.replace(/\+/g, ' ')) } catch { return x } }; return eq >= 0 ? { name: dec(p.slice(0, eq)), value: dec(p.slice(eq + 1)) } : { name: dec(p), value: '' } })
    : []
  return { method, url, origin: parsedUrl.origin, path: parsedUrl.pathname, queryParams, headers, body, bodyType, bodyJson, formFields, formParams, user, ignored }
}

const jsStr = (s) => JSON.stringify(String(s))

export function toFetch(p) {
  const opts = []
  opts.push('  method: ' + jsStr(p.method))
  if (p.headers.length) {
    opts.push('  headers: {\n' + p.headers.map(h => '    ' + jsStr(h.name) + ': ' + jsStr(h.value)).join(',\n') + '\n  }')
  }
  if (p.formFields.length) {
    const lines = p.formFields.map(f => 'form.append(' + jsStr(f.name) + ', ' + jsStr(f.value) + ')').join('\n')
    return 'const form = new FormData()\n' + lines + '\n\nconst res = await fetch(' + jsStr(p.url) + ', {\n' + opts.join(',\n') + ',\n  body: form\n})\nconst data = await res.text()\nconsole.log(data)'
  }
  if (p.body) {
    opts.push(p.bodyJson !== null && p.bodyJson !== undefined
      ? '  body: JSON.stringify(' + JSON.stringify(p.bodyJson, null, 2).replace(/\n/g, '\n  ') + ')'
      : '  body: ' + jsStr(p.body))
  }
  return 'const res = await fetch(' + jsStr(p.url) + ', {\n' + opts.join(',\n') + '\n})\nconst data = await res.text()\nconsole.log(data)'
}

export function toPython(p) {
  const lines = ['import requests', '']
  if (p.headers.length) lines.push('headers = {\n' + p.headers.map(h => '    ' + jsStr(h.name) + ': ' + jsStr(h.value)).join(',\n') + '\n}', '')
  const args = [jsStr(p.url)]
  if (p.headers.length) args.push('headers=headers')
  if (p.formFields.length) {
    lines.push('files = {\n' + p.formFields.map(f => '    ' + jsStr(f.name) + ': (None, ' + jsStr(f.value) + ')').join(',\n') + '\n}', '')
    args.push('files=files')
  } else if (p.bodyJson !== null && p.bodyJson !== undefined) {
    lines.push('payload = ' + JSON.stringify(p.bodyJson, null, 4), '')
    args.push('json=payload')
  } else if (p.formParams.length) {
    lines.push('payload = {\n' + p.formParams.map(f => '    ' + jsStr(f.name) + ': ' + jsStr(f.value)).join(',\n') + '\n}', '')
    args.push('data=payload')
  } else if (p.body) args.push('data=' + jsStr(p.body))
  if (p.user) { const c = p.user.indexOf(':'); args.push('auth=(' + jsStr(c >= 0 ? p.user.slice(0, c) : p.user) + ', ' + jsStr(c >= 0 ? p.user.slice(c + 1) : '') + ')') }
  lines.push('response = requests.' + p.method.toLowerCase() + '(' + args.join(', ') + ')')
  lines.push('print(response.status_code)')
  lines.push('print(response.text)')
  return lines.join('\n')
}

export function buildCurlSummary(p) {
  const parts = [p.method + ' ' + p.url]
  if (p.headers.length) parts.push('请求头 ' + p.headers.length + ' 项')
  if (p.queryParams.length) parts.push('查询参数 ' + p.queryParams.length + ' 项')
  if (p.bodyType !== 'none') parts.push('Body：' + p.bodyType)
  return parts.join(' · ')
}
