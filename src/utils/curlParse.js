// cURL 命令解析（纯本地）：shell 分词 -> 结构化请求 -> fetch / Python requests 代码生成
// 支持常用选项：-X/-H/-d/--data-*/--json/--url-query/-F/-u/-A/-e/-b/-G/-I/--url/--data-urlencode 等
// @文件、URL 内嵌 userinfo、同名重复头等易误读写法会点名警告或按 curl 语义归一化

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
          const simple = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v' }
          if (n in simple) { cur += simple[n]; i += 2; continue }
          if (n === 'x' || n === 'u' || n === 'U') {
            const max = n === 'x' ? 2 : n === 'u' ? 4 : 8
            const hex = s.slice(i + 2, i + 2 + max)
            const m = hex.match(new RegExp('^[0-9a-fA-F]{1,' + max + '}'))
            if (m) {
              const cp = parseInt(m[0], 16)
              if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new Error("$'...' 中的 \\" + n + ' 转义码点不合法：' + cp.toString(16))
              cur += String.fromCodePoint(cp); i += 2 + m[0].length; continue
            }
            cur += '\\' + n; i += 2; continue
          }
          if (n >= '0' && n <= '7') {
            const m = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)
            cur += String.fromCharCode(parseInt(m[0], 8) & 0xff); i += 1 + m[0].length; continue
          }
          cur += '\\' + n; i += 2; continue
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
  ['-d', 'data'], ['--data', 'data'], ['--data-binary', 'data'], ['--data-ascii', 'data'],
  ['--data-raw', 'dataRaw'],
  ['--json', 'jsonData'],
  ['--data-urlencode', 'dataUrlencode'],
  ['--url-query', 'urlQuery'],
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
  if (idx < 0) {
    // curl 合法语法 -H 'X-Empty;'：分号结尾表示发送一个无值的头（或移除内部同名头）
    const semi = h.indexOf(';')
    if (semi > 0 && h.slice(semi + 1).trim() === '') return { name: h.slice(0, semi).trim(), value: '', empty: true }
    throw new Error('请求头格式不正确（缺少冒号）：' + h)
  }
  const name = h.slice(0, idx).trim()
  if (!name) throw new Error('请求头名称为空：' + h)
  return { name, value: h.slice(idx + 1).trim() }
}

export function parseCurl(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('请先粘贴一条 curl 命令')
  if (raw.length > 1000000) throw new Error('命令过长：粘贴内容超过 100 万字符上限')
  const tokens = tokenizeShell(raw)
  if (tokens[0] === '$') tokens.shift()
  if (!tokens.length || !/^curl(\.exe)?$/i.test(tokens[0])) throw new Error('命令需以 curl 开头')
  const headers = []
  const dataParts = []
  const urlQueryParts = []
  const formFields = []
  const ignored = []
  const warnings = []
  let url = ''
  let method = ''
  let user = ''
  let getFlag = false
  let headFlag = false
  let jsonFlag = false
  // -d/--data/--json 的 @file 表示从本地文件读数据：浏览器读不到，保留占位并点名
  const pushData = (val) => {
    if (val.startsWith('@')) warnings.push('数据来自本地文件 ' + val.slice(1) + '（@ 写法），浏览器无法读取该文件，Body 中保留了文件名占位，生成代码时请自行替换为文件内容')
    dataParts.push(val)
  }
  // --data-urlencode / --url-query 的 name@file、@file 形式同样是读文件
  const encodeParam = (val, sink, label) => {
    if (val.startsWith('@')) { warnings.push(label + ' 的内容来自本地文件 ' + val.slice(1) + '（@ 写法），浏览器无法读取，该参数已跳过'); return }
    const at = val.match(/^([^=@]+)@(.+)$/)
    if (at) { warnings.push(label + ' 的参数 ' + at[1] + ' 内容来自本地文件 ' + at[2] + '（name@文件 写法），浏览器无法读取，已按空值占位'); sink.push(at[1] + '='); return }
    const eq = val.indexOf('=')
    sink.push(eq >= 0 ? val.slice(0, eq + 1) + encodeURIComponent(val.slice(eq + 1)) : encodeURIComponent(val))
  }
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
      else if (kind === 'data') pushData(val)
      else if (kind === 'dataRaw') dataParts.push(val)
      else if (kind === 'jsonData') { jsonFlag = true; pushData(val) }
      else if (kind === 'dataUrlencode') encodeParam(val, dataParts, '--data-urlencode')
      else if (kind === 'urlQuery') {
        if (val.startsWith('+')) urlQueryParts.push(val.slice(1))
        else encodeParam(val, urlQueryParts, '--url-query')
      } else if (kind === 'form') {
        const eq = val.indexOf('=')
        const name = eq >= 0 ? val.slice(0, eq) : val
        const value = eq >= 0 ? val.slice(eq + 1) : ''
        if (value.startsWith('@')) {
          const segs = value.slice(1).split(';')
          const field = { name, value: '', file: segs[0] }
          for (const seg of segs.slice(1)) {
            const kv = seg.match(/^([^=]+)=(.*)$/)
            if (kv && kv[1].trim().toLowerCase() === 'type') field.fileType = kv[2].trim()
            if (kv && kv[1].trim().toLowerCase() === 'filename') field.fileName = kv[2].trim()
          }
          formFields.push(field)
        } else if (value.startsWith('<')) {
          warnings.push('表单字段 ' + name + ' 的内容来自本地文件 ' + value.slice(1) + '（< 写法），浏览器无法读取，已按占位处理')
          formFields.push({ name, value: '', contentFile: value.slice(1) })
        } else formFields.push({ name, value })
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
  // --json 是 -d 的快捷写法：未显式设置时补 Content-Type / Accept 两个头
  if (jsonFlag) {
    if (!headers.some(h => h.name.toLowerCase() === 'content-type')) headers.push({ name: 'Content-Type', value: 'application/json' })
    if (!headers.some(h => h.name.toLowerCase() === 'accept')) headers.push({ name: 'Accept', value: 'application/json' })
  }
  let body = dataParts.join('&')
  if (getFlag && body) {
    url += (url.includes('?') ? '&' : '?') + body
    body = ''
  }
  if (urlQueryParts.length) url += (url.includes('?') ? '&' : '?') + urlQueryParts.join('&')
  if (!method) method = headFlag ? 'HEAD' : (getFlag ? 'GET' : (body || formFields.length || jsonFlag ? 'POST' : 'GET'))
  let parsedUrl
  try { parsedUrl = new URL(url) } catch { throw new Error('URL 不合法：' + url) }
  // URL 内嵌 userinfo（https://user:pass@host）提取为 Basic 认证：fetch 禁止带凭据的 URL
  if (parsedUrl.username) {
    const dec = (x) => { try { return decodeURIComponent(x) } catch { return x } }
    if (!user) user = dec(parsedUrl.username) + (parsedUrl.password ? ':' + dec(parsedUrl.password) : '')
    parsedUrl.username = ''
    parsedUrl.password = ''
    url = parsedUrl.toString()
    warnings.push('URL 中内嵌的用户信息已提取为 Basic 认证（fetch 不允许带凭据的 URL），生成代码含明文凭据，分享前请先脱敏')
  }
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
  if (body && !contentType) warnings.push('命令未显式设置 Content-Type：curl 用 -d 发送数据时默认带 application/x-www-form-urlencoded，生成的代码不会自动补这个请求头，需要时请自行添加')
  const formParams = bodyType === 'application/x-www-form-urlencoded' && body
    ? body.split('&').filter(Boolean).map(p => { const eq = p.indexOf('='); const dec = (x) => { try { return decodeURIComponent(x.replace(/\+/g, ' ')) } catch { return x } }; return eq >= 0 ? { name: dec(p.slice(0, eq)), value: dec(p.slice(eq + 1)) } : { name: dec(p), value: '' } })
    : []
  return { method, url, origin: parsedUrl.origin, path: parsedUrl.pathname, queryParams, headers, body, bodyType, bodyJson, formFields, formParams, user, ignored, warnings }
}

const jsStr = (s) => JSON.stringify(String(s))

// 同名请求头在 fetch 的对象字面量 / Python dict 里会被后者覆盖，按 HTTP 惯例合并为逗号连接
function groupHeaders(headers) {
  const out = []
  const byKey = new Map()
  for (const h of headers) {
    const key = h.name.toLowerCase()
    if (byKey.has(key)) { const prev = out[byKey.get(key)]; prev.value = prev.value ? prev.value + ', ' + h.value : h.value }
    else { byKey.set(key, out.length); out.push({ name: h.name, value: h.value }) }
  }
  return out
}

function effectiveHeaders(p) {
  const list = groupHeaders(p.headers)
  if (p.user && !list.some(h => h.name.toLowerCase() === 'authorization')) {
    let basic
    try { basic = btoa(p.user) } catch { basic = btoa(unescape(encodeURIComponent(p.user))) }
    list.push({ name: 'Authorization', value: 'Basic ' + basic })
  }
  return list
}

export function toFetch(p) {
  const headers = effectiveHeaders(p)
  const opts = []
  opts.push('  method: ' + jsStr(p.method))
  if (headers.length) {
    opts.push('  headers: {\n' + headers.map(h => '    ' + jsStr(h.name) + ': ' + jsStr(h.value)).join(',\n') + '\n  }')
  }
  if (p.formFields.length) {
    const lines = []
    for (const f of p.formFields) {
      if (f.file) lines.push('// TODO: fileBlob 需替换为本地文件 ' + f.file + ' 的 File/Blob 对象\nform.append(' + jsStr(f.name) + ', fileBlob, ' + jsStr(f.fileName || f.file.split(/[\\/]/).pop()) + ')')
      else if (f.contentFile) lines.push('// TODO: fileContent 需替换为本地文件 ' + f.contentFile + ' 的文本内容\nform.append(' + jsStr(f.name) + ', fileContent)')
      else lines.push('form.append(' + jsStr(f.name) + ', ' + jsStr(f.value) + ')')
    }
    return 'const form = new FormData()\n' + lines.join('\n') + '\n\nconst res = await fetch(' + jsStr(p.url) + ', {\n' + opts.join(',\n') + ',\n  body: form\n})\nconst data = await res.text()\nconsole.log(data)'
  }
  if (p.body) {
    opts.push(p.bodyJson !== null && p.bodyJson !== undefined
      ? '  body: JSON.stringify(' + JSON.stringify(p.bodyJson, null, 2).replace(/\n/g, '\n  ') + ')'
      : '  body: ' + jsStr(p.body))
  }
  return 'const res = await fetch(' + jsStr(p.url) + ', {\n' + opts.join(',\n') + '\n})\nconst data = await res.text()\nconsole.log(data)'
}

export function toPython(p) {
  const headers = groupHeaders(p.headers)
  const lines = ['import requests', '']
  if (headers.length) lines.push('headers = {\n' + headers.map(h => '    ' + jsStr(h.name) + ': ' + jsStr(h.value)).join(',\n') + '\n}', '')
  const args = [jsStr(p.url)]
  if (headers.length) args.push('headers=headers')
  if (p.formFields.length) {
    const entries = p.formFields.map(f => {
      if (f.file) {
        const fname = f.fileName || f.file.split(/[\\/]/).pop()
        return '    ' + jsStr(f.name) + ': (' + jsStr(fname) + ', open(' + jsStr(f.file) + ', "rb")' + (f.fileType ? ', ' + jsStr(f.fileType) : '') + ')'
      }
      if (f.contentFile) return '    ' + jsStr(f.name) + ': (None, open(' + jsStr(f.contentFile) + ', encoding="utf-8").read())'
      return '    ' + jsStr(f.name) + ': (None, ' + jsStr(f.value) + ')'
    })
    lines.push('files = {\n' + entries.join(',\n') + '\n}', '')
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
