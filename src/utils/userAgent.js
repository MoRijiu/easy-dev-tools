// User Agent 解析核心（纯本地）：识别浏览器 / 渲染引擎 / 操作系统 / 设备 / CPU / 机器人。
// 规则顺序很重要：Edge/Opera/三星等 Chromium 衍生浏览器都带 Chrome 字样，必须先于 Chrome 判定；
// 微信/QQ 等 App 内置浏览器带宿主标记，也应优先于 Safari/Chrome。

function pick(ua, re) {
  const m = ua.match(re)
  return m ? (m[1] || '') : ''
}

export function parseUserAgent(raw) {
  const ua = String(raw ?? '').trim()
  if (!ua) throw new Error('输入为空，请粘贴一个 User Agent 字符串')
  if (ua.length < 10) throw new Error('这段文本太短，不像一个完整的 User Agent')
  if (!/Mozilla|Opera|curl|Postman|bot|spider/i.test(ua) && !ua.includes('/')) {
    throw new Error('未识别到浏览器/版本标记，请检查是否为完整的 User Agent')
  }

  const browser = detectBrowser(ua)
  const engine = detectEngine(ua, browser)
  const os = detectOS(ua)
  const device = detectDevice(ua)
  const cpu = detectCPU(ua)
  const bot = detectBot(ua)

  const summaryParts = [
    browser.name ? `${browser.name}${browser.version ? ' ' + browser.version : ''}` : '',
    os.name ? `${os.name}${os.version ? ' ' + os.version : ''}` : '',
    device.typeLabel
  ].filter(Boolean)

  return {
    ua,
    browser,
    engine,
    os,
    device,
    cpu,
    isBot: Boolean(bot),
    botName: bot || '',
    summary: summaryParts.join(' · ')
  }
}

function detectBot(ua) {
  const m = ua.match(/(Googlebot|Bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|Applebot|SemrushBot|AhrefsBot|MJ12bot|DotBot|PetalBot|Bytespider|GPTBot|ClaudeBot|CCBot)/i)
  if (m) return m[1]
  if (/bot|spider|crawler/i.test(ua)) return 'Bot / Spider'
  if (/curl\/|PostmanRuntime|python-requests|Go-http-client|okhttp|axios\//i.test(ua)) {
    const t = ua.match(/(curl|PostmanRuntime|python-requests|Go-http-client|okhttp|axios)\/?\s*([\d.]*)/i)
    return t ? `${t[1]}${t[2] ? ' ' + t[2] : ''}（HTTP 客户端）` : 'HTTP 客户端'
  }
  return ''
}

function detectBrowser(ua) {
  let name = '', version = ''
  if ((version = pick(ua, /EdgiOS\/([\d.]+)/)) || (version = pick(ua, /EdgA\/([\d.]+)/)) || (version = pick(ua, /Edg\/([\d.]+)/)) || (version = pick(ua, /Edge\/([\d.]+)/))) name = 'Microsoft Edge'
  else if ((version = pick(ua, /OPR\/([\d.]+)/)) || (version = pick(ua, /Opera(?: Mini)?[\/ ]([\d.]+)/))) name = 'Opera'
  else if ((version = pick(ua, /SamsungBrowser\/([\d.]+)/))) name = '三星浏览器'
  else if ((version = pick(ua, /MicroMessenger\/([\d.]+)/))) name = '微信内置浏览器'
  else if ((version = pick(ua, /QQBrowser\/([\d.]+)/)) || (version = pick(ua, /\bQQ\/([\d.]+)/))) name = 'QQ 浏览器'
  else if ((version = pick(ua, /YaBrowser\/([\d.]+)/))) name = 'Yandex Browser'
  else if ((version = pick(ua, /Vivaldi\/([\d.]+)/))) name = 'Vivaldi'
  else if ((version = pick(ua, /Brave\/([\d.]+)/))) name = 'Brave'
  else if ((version = pick(ua, /FxiOS\/([\d.]+)/)) || (version = pick(ua, /Firefox\/([\d.]+)/))) name = 'Firefox'
  else if ((version = pick(ua, /CriOS\/([\d.]+)/)) || (version = pick(ua, /Chrome\/([\d.]+)/))) name = 'Chrome'
  else if ((version = pick(ua, /MSIE ([\d.]+)/))) name = 'Internet Explorer'
  else if (/Trident\//.test(ua) && (version = pick(ua, /rv:([\d.]+)/))) name = 'Internet Explorer'
  else if ((version = pick(ua, /Version\/([\d.]+).*Safari\//)) || /Safari\//.test(ua)) { name = 'Safari'; if (!version) version = pick(ua, /Safari\/([\d.]+)/) }
  return { name: name || '未知浏览器', version: version || '' }
}

function detectEngine(ua, browser) {
  const webkit = pick(ua, /AppleWebKit\/([\d.]+)/)
  const geckoVersion = pick(ua, /rv:([\d.]+)\).*Gecko/)
  if (/Firefox|FxiOS/.test(browser.name)) return { name: 'Gecko', version: geckoVersion || pick(ua, /Gecko\/([\d.]+)/) || '' }
  if (browser.name === 'Safari' || /iPhone|iPad|iPod/.test(ua)) return { name: 'WebKit', version: webkit }
  if (webkit && /Chrome|Edge|Opera|三星|Vivaldi|Brave|Yandex|QQ|微信/.test(browser.name)) return { name: 'Blink', version: webkit }
  if (webkit) return { name: 'WebKit', version: webkit }
  if (/Trident\//.test(ua)) return { name: 'Trident', version: pick(ua, /Trident\/([\d.]+)/) }
  if (/Gecko\//.test(ua)) return { name: 'Gecko', version: pick(ua, /Gecko\/([\d.]+)/) }
  return { name: '未知', version: '' }
}

function detectOS(ua) {
  let m
  if ((m = ua.match(/Windows NT ([\d.]+)/))) {
    const map = { '10.0': '10 / 11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' }
    return { name: 'Windows', version: map[m[1]] || m[1] }
  }
  if ((m = ua.match(/(?:iPhone OS|CPU OS|CPU iPhone OS) ([\d_]+)/))) return { name: 'iOS', version: m[1].replace(/_/g, '.') }
  if (/iPhone|iPad|iPod/.test(ua)) return { name: 'iOS', version: '' }
  if ((m = ua.match(/Mac OS X ([\d_]+)/))) return { name: 'macOS', version: m[1].replace(/_/g, '.') }
  if ((m = ua.match(/Android ([\d.]+)/))) return { name: 'Android', version: m[1] }
  if (/Android/.test(ua)) return { name: 'Android', version: '' }
  if ((m = ua.match(/HarmonyOS ([\d.]+)/))) return { name: 'HarmonyOS', version: m[1] }
  if (/HarmonyOS/.test(ua)) return { name: 'HarmonyOS', version: '' }
  if ((m = ua.match(/CrOS [^ ]+ ([\d.]+)/))) return { name: 'ChromeOS', version: m[1] }
  if (/Linux/.test(ua)) return { name: 'Linux', version: '' }
  return { name: '未知系统', version: '' }
}

function detectDevice(ua) {
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
  const isMobile = !isTablet && (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua))
  const type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'
  const typeLabel = isTablet ? '平板' : isMobile ? '手机' : '桌面设备'
  let vendor = '', model = ''
  if (/iPhone/.test(ua)) { vendor = 'Apple'; model = 'iPhone' }
  else if (/iPad/.test(ua)) { vendor = 'Apple'; model = 'iPad' }
  else if (/iPod/.test(ua)) { vendor = 'Apple'; model = 'iPod' }
  else if (/Macintosh/.test(ua)) { vendor = 'Apple'; model = 'Mac' }
  else {
    // Android UA 形如 (Linux; Android 13; SM-S918B Build/...) 取分号段中的机型段
    const seg = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\)|;)/)
    if (seg) {
      model = seg[1].trim()
      if (/^SM-/i.test(model)) vendor = 'Samsung'
      else if (/Pixel/i.test(model)) vendor = 'Google'
      else if (/HUAWEI|HW-|Honor/i.test(model)) vendor = 'Huawei'
      else if (/Xiaomi|Redmi|Mi\s|POCO/i.test(model)) vendor = 'Xiaomi'
      else if (/OPPO|OnePlus/i.test(model)) vendor = 'OPPO'
      else if (/vivo/i.test(model)) vendor = 'vivo'
    }
  }
  return { type, typeLabel, vendor, model }
}

function detectCPU(ua) {
  if (/Win64; x64|WOW64|x86_64|Intel Mac OS X/.test(ua)) return { architecture: 'x86_64' }
  if (/arm64|aarch64/i.test(ua)) return { architecture: 'arm64' }
  if (/ARM/i.test(ua)) return { architecture: 'arm' }
  if (/i686|i386/.test(ua)) return { architecture: 'x86' }
  return { architecture: '' }
}
