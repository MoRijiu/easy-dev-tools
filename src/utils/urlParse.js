// URL 解析核心（纯本地）：拆解各组件 + 查询参数表；参数可编辑后重组 URL。
// 无协议时自动补 https://（输入像域名/路径时）；纯查询串（?a=1 或 a=1&b=2）也能解析参数部分。

export function normalizeInput(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return t
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return t // 已带协议（含 data:/mailto: 等）
  if (t.startsWith('//')) return 'https:' + t
  if (t.startsWith('?') || t.startsWith('#') || t.startsWith('/')) return 'https://example.com' + (t.startsWith('/') ? t : '/' + t)
  // 形如 a=1&b=2 的纯查询串
  if (!t.includes('/') && t.includes('=') && !t.includes(' ') && !t.includes('.')) return 'https://example.com/?' + t
  return 'https://' + t
}

export function parseUrl(raw) {
  const original = String(raw ?? '').trim()
  if (!original) throw new Error('输入为空，请粘贴一个 URL')
  if (/\s/.test(original)) throw new Error('URL 中包含空格或换行，请检查输入（空格应编码为 %20）')
  const normalized = normalizeInput(original)
  let u
  try { u = new URL(normalized) } catch { throw new Error('无法解析这个 URL，请检查格式（如域名、端口是否合法）') }
  const params = []
  u.searchParams.forEach((value, key) => params.push({ key, value }))
  const segments = u.pathname.split('/').filter(Boolean).map(s => {
    try { return decodeURIComponent(s) } catch { return s }
  })
  return {
    href: u.href,
    normalized,
    autoProtocol: normalized !== original,
    protocol: u.protocol.replace(/:$/, ''),
    username: u.username ? safeDecode(u.username) : '',
    password: u.password ? safeDecode(u.password) : '',
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    segments,
    search: u.search,
    hash: u.hash ? u.hash.slice(1) : '',
    origin: u.origin && u.origin !== 'null' ? u.origin : '',
    params,
  }
}

function safeDecode(s) { try { return decodeURIComponent(s) } catch { return s } }

// 用编辑后的参数重组 URL：保留协议/主机/路径/锚点，参数按 URLSearchParams 编码
export function buildUrl(parsed, params) {
  if (!parsed.host) throw new Error('该 URL 没有可重组的主机部分')
  const base = parsed.protocol + '://' + parsed.host + (parsed.pathname || '/')
  const sp = new URLSearchParams()
  ;(params || []).forEach(p => { if (p.key !== '') sp.append(p.key, p.value ?? '') })
  const qs = sp.toString()
  return base + (qs ? '?' + qs : '') + (parsed.hash ? '#' + parsed.hash : '')
}

export function parseQueryString(qs) {
  const t = String(qs ?? '').trim().replace(/^\?/, '')
  const out = []
  if (!t) return out
  new URLSearchParams(t).forEach((value, key) => out.push({ key, value }))
  return out
}
