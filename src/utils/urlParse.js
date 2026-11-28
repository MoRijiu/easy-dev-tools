// URL 解析核心（纯本地）：拆解各组件 + 查询参数表；参数可编辑后重组 URL。
// 无协议时自动补 https://（输入像域名/路径时）；纯查询串（?a=1 或 a=1&b=2）也能解析参数部分。
// R8i 打磨：主机:端口不再误判为协议、端口与 % 转义定位报错、重组保留用户信息、默认端口说明。

const MAX_URL_LENGTH = 8192

const DEFAULT_PORTS = { http: '80', https: '443', ws: '80', wss: '443', ftp: '21' }
// 无 // 层级结构的 scheme：没有主机/路径段可拆，点名说明而不是给一张空表
const NON_HIERARCHICAL = new Set(['mailto', 'tel', 'sms', 'smsto', 'data', 'geo', 'urn', 'bitcoin', 'magnet'])

// 「主机:端口」形态（example.com:8080/x、localhost:3000、127.0.0.1:8080、[::1]:8080）：
// 旧版被 scheme 正则误吞成协议名，现优先按主机识别
function looksLikeHostPort(t) {
  const m = /^(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+):(\d*)([/?#].*)?$/.exec(t)
  if (!m) return false
  const host = m[1]
  return host.includes('.') || host === 'localhost' || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)
}

function normalizeInput(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return t
  if (looksLikeHostPort(t)) return 'https://' + t
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return t // 已带协议（含 data:/mailto: 等）
  if (t.startsWith('//')) return 'https:' + t
  if (t.startsWith('?') || t.startsWith('#') || t.startsWith('/')) return 'https://example.com' + (t.startsWith('/') ? t : '/' + t)
  // 形如 a=1&b.c=2 的纯查询串（键名可含点/横线/下标括号；旧版因含点被误当主机）
  if (/^[^/?#\s=&]+=[^&#]*(&[^/?#\s=&]+=[^&#]*)*$/.test(t)) return 'https://example.com/?' + t
  return 'https://' + t
}

// % 转义逐字校验：% 后必须跟两位十六进制；旧版 %ZZ / %2 被 URLSearchParams 静默保留
function validatePercentEscapes(text) {
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '%') continue
    const hex = s.slice(i + 1, i + 3)
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
      throw new Error(`第 ${i + 1} 个字符处的 % 转义不完整或非法：「${s.slice(i, i + 3)}」，% 后应跟两位十六进制（如 %20）`)
    }
    i += 2
  }
}

// 解析前先单独验端口，给出点名报错（new URL 只会笼统抛错）
function validatePort(original, normalized) {
  const m = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)/.exec(normalized)
  if (!m) return
  let authority = m[1]
  const at = authority.lastIndexOf('@')
  if (at >= 0) authority = authority.slice(at + 1)
  let portStr = null
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']')
    const rest = close >= 0 ? authority.slice(close + 1) : ''
    if (rest.startsWith(':')) portStr = rest.slice(1)
  } else {
    const colon = authority.lastIndexOf(':')
    if (colon >= 0) portStr = authority.slice(colon + 1)
  }
  if (portStr === null || portStr === '') return
  if (!/^\d+$/.test(portStr)) throw new Error(`端口「${portStr}」不是数字，请检查冒号后的端口部分`)
  if (Number(portStr) > 65535) throw new Error(`端口 ${portStr} 超出范围（0–65535），请检查输入`)
}

export function parseUrl(raw) {
  const original = String(raw ?? '').trim()
  if (!original) throw new Error('输入为空，请粘贴一个 URL')
  if (original.length > MAX_URL_LENGTH) throw new Error(`输入过长（${original.length} 字符），URL 解析上限为 ${MAX_URL_LENGTH} 字符`)
  if (/\s/.test(original)) throw new Error('URL 中包含空格或换行，请检查输入（空格应编码为 %20）')
  validatePercentEscapes(original)
  const normalized = normalizeInput(original)
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized)
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : ''
  if (scheme && NON_HIERARCHICAL.has(scheme) && !normalized.slice(scheme.length + 1).startsWith('//')) {
    throw new Error(`这是 ${scheme}: 形式的非层级 URL，没有主机与查询参数可拆解；本工具解析 http/https 等带 // 主机的 URL`)
  }
  validatePort(original, normalized)
  let u
  try { u = new URL(normalized) } catch { throw new Error('无法解析这个 URL，请检查格式（如域名、端口是否合法）') }
  if ((u.protocol === 'http:' || u.protocol === 'https:') && !u.hostname) {
    throw new Error('URL 缺少主机名，请检查 // 后面的域名部分')
  }
  const params = []
  u.searchParams.forEach((value, key) => params.push({ key, value }))
  const segments = u.pathname.split('/').filter(Boolean).map(s => {
    try { return decodeURIComponent(s) } catch { return s }
  })
  const protocol = u.protocol.replace(/:$/, '')
  const defaultPort = DEFAULT_PORTS[protocol] || ''
  const warnings = []
  if (u.username || u.password) warnings.push('URL 含用户信息（用户名/密码），重组会原样保留；分享前请先删掉密码部分')
  if (!u.port && defaultPort) warnings.push(`未显式写端口，实际使用 ${protocol} 默认端口 ${defaultPort}`)
  return {
    href: u.href,
    normalized,
    autoProtocol: normalized !== original,
    protocol,
    username: u.username ? safeDecode(u.username) : '',
    password: u.password ? safeDecode(u.password) : '',
    usernameRaw: u.username,
    passwordRaw: u.password,
    hasCredentials: Boolean(u.username || u.password),
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    defaultPort,
    effectivePort: u.port || defaultPort,
    pathname: u.pathname,
    pathnameDecoded: safeDecode(u.pathname),
    segments,
    search: u.search,
    hash: u.hash ? u.hash.slice(1) : '',
    hashDecoded: u.hash ? safeDecode(u.hash.slice(1)) : '',
    origin: u.origin && u.origin !== 'null' ? u.origin : '',
    params,
    warnings,
  }
}

function safeDecode(s) { try { return decodeURIComponent(s) } catch { return s } }

// 用编辑后的参数重组 URL：保留协议/主机（含用户信息）/路径/锚点，参数按 URLSearchParams 编码
export function buildUrl(parsed, params) {
  if (!parsed.host) throw new Error('该 URL 没有可重组的主机部分')
  // usernameRaw/passwordRaw 取自 URL 对象、已是编码形态，直接拼回避免二次编码
  const auth = parsed.usernameRaw ? parsed.usernameRaw + (parsed.passwordRaw ? ':' + parsed.passwordRaw : '') + '@' : ''
  const base = parsed.protocol + '://' + auth + parsed.host + (parsed.pathname || '/')
  const sp = new URLSearchParams()
  ;(params || []).forEach(p => { if (p.key !== '') sp.append(p.key, p.value ?? '') })
  const qs = sp.toString()
  return base + (qs ? '?' + qs : '') + (parsed.hash ? '#' + parsed.hash : '')
}

