// IP 地址解析与互转：纯本地。IPv4 点分/整数/十六进制/二进制互转与性质判定；IPv6 展开/压缩（RFC 5952）与性质判定。
export const MAX_IP_INPUT_LENGTH = 1024;
export function normalizeIpInput(input = '') {
  return String(input ?? '').replace(/[\uFF01-\uFF5E\u3000]/g, (ch) => (ch === '\u3000' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)));
}
export function parseIpv4(input = '') {
  const s = normalizeIpInput(String(input ?? '')).trim();
  if (!s) return { ok: false, error: '请输入 IPv4 地址' };
  const parts = s.split('.');
  if (parts.length !== 4) return { ok: false, error: `IPv4 应为 4 段点分格式，当前 ${parts.length} 段` };
  const octets = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '') return { ok: false, error: `第 ${i + 1} 段为空，IPv4 每段都应是 0–255 的数字` };
    if (!/^\d+$/.test(p)) return { ok: false, error: `第 ${i + 1} 段「${p}」不是有效的十进制数字段` };
    if (p.length > 1 && p.startsWith('0')) return { ok: false, error: `第 ${i + 1} 段「${p}」带前导零，易与八进制混淆，请去掉` };
    const v = Number(p);
    if (v > 255) return { ok: false, error: `第 ${i + 1} 段「${p}」超出范围，每段应为 0–255` };
    octets.push(v);
  }
  const value = octets.reduce((acc, o) => acc * 256 + o, 0);
  return { ok: true, octets, value };
}
export function ipv4Class(octets) {
  const [a, b] = octets;
  if (a < 128) return 'A 类';
  if (a < 192) return 'B 类';
  if (a < 224) return 'C 类';
  if (a < 240) return 'D 类（组播）';
  return 'E 类（保留）';
}
export function ipv4Kind(octets) {
  const [a, b, c, d] = octets;
  if (a === 0 && b === 0 && c === 0 && d === 0) return { kind: '未指定地址', note: '0.0.0.0 表示未指定/任意地址，常作监听地址或默认路由' };
  if (a === 255 && b === 255 && c === 255 && d === 255) return { kind: '受限广播', note: '255.255.255.255 向本地网络段广播，不会被路由器转发' };
  if (a === 0) return { kind: '本网络（软件保留）', note: '0.0.0.0/8，本网络源地址段' };
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return { kind: '私有地址', note: 'RFC 1918 私有地址，只能在局域网内使用' };
  if (a === 100 && b >= 64 && b <= 127) return { kind: '运营商级 NAT', note: '100.64.0.0/10 CGNAT 共享地址空间' };
  if (a === 127) return { kind: '环回地址', note: '127.0.0.0/8，指向本机自身' };
  if (a === 169 && b === 254) return { kind: '链路本地', note: '169.254.0.0/16，DHCP 失败时自动分配（APIPA）' };
  if (a === 192 && b === 0 && c === 0) return { kind: 'IETF 协议分配', note: '192.0.0.0/24 特殊用途协议分配（含 NAT64/DNS64 发现等），不是文档示例段' };
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return { kind: '文档示例', note: 'TEST-NET-1/2/3（192.0.2.0/24、198.51.100.0/24、203.0.113.0/24），保留给文档与示例' };
  if (a === 198 && (b === 18 || b === 19)) return { kind: '基准测试', note: '198.18.0.0/15，网络设备基准测试专用' };
  if (a === 192 && b === 88 && c === 99) return { kind: '6to4 中继（已废弃）', note: '192.88.99.0/24 原 6to4 中继任播段，RFC 7526 已废弃' };
  if (a >= 224 && a < 240) return { kind: '组播地址', note: 'D 类组播，一对多分发' };
  if (a >= 240) return { kind: '保留地址', note: 'E 类保留（240.0.0.0/4）' };
  return { kind: '公网地址', note: '可在互联网上路由的地址' };
}
export function ipv4Info(input = '') {
  const r = parseIpv4(input);
  if (!r.ok) return r;
  const { octets, value } = r;
  const k = ipv4Kind(octets);
  return {
    ok: true, version: 4, normalized: octets.join('.'), octets, value,
    hex: '0x' + value.toString(16).toUpperCase().padStart(8, '0'),
    hexDotted: octets.map((o) => '0x' + o.toString(16).toUpperCase().padStart(2, '0')).join('.'),
    binaryDotted: octets.map((o) => o.toString(2).padStart(8, '0')).join('.'),
    reverseDns: [...octets].reverse().join('.') + '.in-addr.arpa',
    ipClass: ipv4Class(octets), kind: k.kind, note: k.note, warnings: []
  };
}
export function ipv4FromInteger(input = '') {
  const s = normalizeIpInput(String(input ?? '')).trim();
  if (!s) return { ok: false, error: '请输入整数或 0x 十六进制整数' };
  if (/^-\d+$/.test(s)) return { ok: false, error: '负数不在 IPv4 整数范围内，应为 0–4294967295' };
  let v;
  try { v = /^0[xX][0-9a-fA-F]+$/.test(s) ? BigInt(s) : /^\d+$/.test(s) ? BigInt(s) : null; } catch { v = null; }
  if (v === null) return { ok: false, error: '整数格式应为十进制数字或 0x 开头的十六进制' };
  if (v < 0n || v > 4294967295n) return { ok: false, error: '整数超出 IPv4 范围 0–4294967295' };
  const n = Number(v);
  return ipv4Info([Math.floor(n / 16777216), Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join('.'));
}
export function expandIpv6(input = '') {
  let s = normalizeIpInput(String(input ?? '')).trim();
  if (!s) return { ok: false, error: '请输入 IPv6 地址' };
  if (s.includes('%')) return { ok: false, error: '暂不支持带区域 ID（%eth0）的链路本地地址' };
  let v4Groups = null;
  if (s.includes('.')) {
    const idx = s.lastIndexOf(':');
    if (idx < 0) return { ok: false, error: '内嵌 IPv4 的 IPv6 地址格式不正确' };
    const v4 = parseIpv4(s.slice(idx + 1));
    if (!v4.ok) return { ok: false, error: '内嵌 IPv4 部分无效：' + v4.error };
    v4Groups = [v4.octets[0] * 256 + v4.octets[1], v4.octets[2] * 256 + v4.octets[3]];
    // 用两个占位组顶替内嵌 IPv4，展开后在末尾换回真实组
    s = s.slice(0, idx + 1) + '0:0';
  }
  const halves = s.split('::');
  if (halves.length > 2) return { ok: false, error: 'IPv6 地址最多只能出现一次 :: 压缩' };
  const parseSide = (side) => {
    if (!side) return [];
    const out = [];
    for (const g of side.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const tailCount = 0; // 内嵌 IPv4 已用占位组计数
  let groups;
  if (halves.length === 2) {
    const left = parseSide(halves[0]); const right = parseSide(halves[1]);
    if (left === null || right === null) return { ok: false, error: 'IPv6 每组应为 1–4 位十六进制' };
    const used = left.length + right.length + tailCount;
    if (used > 7) return { ok: false, error: ':: 压缩至少要省略一组，当前组数过多' };
    groups = [...left, ...Array(8 - used).fill(0), ...right];
  } else {
    const all = parseSide(s);
    if (all === null) return { ok: false, error: 'IPv6 每组应为 1–4 位十六进制' };
    if (all.length + tailCount !== 8) return { ok: false, error: `未压缩的 IPv6 应为 8 组，当前 ${all.length + tailCount} 组` };
    groups = all;
  }
  if (v4Groups) groups = [...groups.slice(0, 6), ...v4Groups];
  if (groups.length !== 8) return { ok: false, error: 'IPv6 组数不正确' };
  return { ok: true, groups };
}
function embeddedV4(groups) {
  return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.');
}
export function compressIpv6(groups) {
  // RFC 5952 §5：内嵌 IPv4 的映射/兼容地址用混合点分写法更易读
  if (groups.slice(0, 5).every((x) => x === 0) && groups[5] === 0xffff) return '::ffff:' + embeddedV4(groups);
  if (groups.slice(0, 6).every((x) => x === 0) && !(groups[6] === 0 && (groups[7] === 0 || groups[7] === 1))) return '::' + embeddedV4(groups);
  const hex = groups.map((g) => g.toString(16));
  let bestStart = -1; let bestLen = 0; let curStart = -1; let curLen = 0;
  groups.forEach((g, i) => {
    if (g === 0) { if (curStart < 0) curStart = i; curLen++; if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } }
    else { curStart = -1; curLen = 0; }
  });
  if (bestLen < 2) return hex.join(':');
  const left = hex.slice(0, bestStart).join(':'); const right = hex.slice(bestStart + bestLen).join(':');
  return (left ? left : '') + '::' + (right ? right : '');
}
export function ipv6Kind(groups) {
  const g = groups;
  if (g.every((x) => x === 0)) return { kind: '未指定地址', note: '::，表示任意/未指定地址' };
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return { kind: '环回地址', note: '::1，指向本机自身' };
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return { kind: 'IPv4 映射地址', note: '::ffff:0:0/96，把 IPv4 地址嵌入 IPv6 表示' };
  if (g.slice(0, 6).every((x) => x === 0)) return { kind: 'IPv4 兼容地址（已废弃）', note: '::/96 旧兼容写法，已被映射地址取代，现代系统不再使用' };
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return { kind: '丢弃前缀', note: '100::/64，路由器应直接丢弃发往该段的报文' };
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) return { kind: 'NAT64 公共前缀', note: '64:ff9b::/96，末 32 位内嵌被转换的 IPv4 地址' };
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0x0001) return { kind: 'NAT64 本地前缀', note: '64:ff9b:1::/48，本地网络专用的 NAT64 转换前缀' };
  if (g[0] === 0x2001 && g[1] === 0x0000) return { kind: 'Teredo 隧道', note: '2001::/32，Teredo 隧道封装地址，内嵌服务器与客户端 IPv4 信息' };
  if (g[0] === 0x2001 && g[1] === 0x0002 && g[2] === 0) return { kind: '基准测试', note: '2001:2::/48，网络设备基准测试专用' };
  if (g[0] === 0x2001 && (g[1] & 0xfff0) === 0x0020) return { kind: 'ORCHIDv2 实验标识', note: '2001:20::/28，密码学生成的实验性标识，不可路由' };
  if (g[0] === 0x2001 && (g[1] & 0xfff0) === 0x0010) return { kind: 'ORCHID 实验标识（已废弃）', note: '2001:10::/28，第一代 ORCHID，已被 ORCHIDv2 取代' };
  if (g[0] === 0x2002) return { kind: '6to4 隧道', note: '2002::/16，第 2–3 组内嵌站点公网 IPv4 地址' };
  if ((g[0] & 0xffc0) === 0xfe80) return { kind: '链路本地', note: 'fe80::/10，只在同一链路内有效' };
  if ((g[0] & 0xfe00) === 0xfc00) return { kind: '唯一本地地址', note: 'fc00::/7，类似 IPv4 的私有地址' };
  if ((g[0] & 0xff00) === 0xff00) return { kind: '组播地址', note: 'ff00::/8，一对多分发' };
  if (g[0] === 0x2001 && g[1] === 0x0db8) return { kind: '文档示例', note: '2001:db8::/32，保留给文档与示例' };
  return { kind: '全球单播', note: '可在互联网上路由的公网地址' };
}
export function ipv6Info(input = '') {
  const r = expandIpv6(input);
  if (!r.ok) return r;
  const { groups } = r;
  const value = groups.reduce((acc, g) => acc * 65536n + BigInt(g), 0n);
  const k = ipv6Kind(groups);
  const v4Mapped = groups.slice(0, 5).every((x) => x === 0) && groups[5] === 0xffff;
  let embeddedIpv4 = ''; let embeddedLabel = '';
  if (v4Mapped) { embeddedIpv4 = embeddedV4(groups); embeddedLabel = '映射的 IPv4'; }
  else if (k.kind.startsWith('IPv4 兼容')) { embeddedIpv4 = embeddedV4(groups); embeddedLabel = '兼容地址内嵌 IPv4'; }
  else if (k.kind.startsWith('NAT64')) { embeddedIpv4 = embeddedV4(groups); embeddedLabel = 'NAT64 内嵌 IPv4'; }
  else if (k.kind.startsWith('6to4')) { embeddedIpv4 = [groups[1] >> 8, groups[1] & 255, groups[2] >> 8, groups[2] & 255].join('.'); embeddedLabel = '6to4 内嵌 IPv4'; }
  return {
    ok: true, version: 6, groups,
    expanded: groups.map((g) => g.toString(16).padStart(4, '0')).join(':'),
    compressed: compressIpv6(groups),
    value: value.toString(),
    hex: '0x' + value.toString(16).padStart(32, '0'),
    reverseDns: value.toString(16).padStart(32, '0').split('').reverse().join('.') + '.ip6.arpa',
    mappedIpv4: v4Mapped ? embeddedIpv4 : '',
    embeddedIpv4, embeddedLabel,
    kind: k.kind, note: k.note, warnings: []
  };
}
function checkPort(text) {
  const port = Number(text);
  if (!Number.isInteger(port) || port < 0 || port > 65535) return { ok: false, error: `端口「${text}」超出范围，应为 0–65535` };
  return { ok: true, port };
}
export function parseIp(input = '') {
  const s0 = normalizeIpInput(String(input ?? '')).trim();
  if (!s0) return { ok: false, error: '请输入 IP 地址或 IPv4 整数' };
  if (s0.length > MAX_IP_INPUT_LENGTH) return { ok: false, error: `输入过长（${s0.length} 字符），IP 地址最长不过数十字符，上限 ${MAX_IP_INPUT_LENGTH}` };
  if (s0.includes('/')) return { ok: false, error: '输入含 / 前缀长度，是 CIDR 网段写法；本工具只解析单个地址，网段计算请用「CIDR 子网计算器」' };
  const warnings = [];
  let s = s0;
  if (s.startsWith('[')) {
    const close = s.indexOf(']');
    if (close < 0) return { ok: false, error: '方括号未闭合：URL 写法应为 [IPv6 地址] 或 [IPv6 地址]:端口' };
    const inner = s.slice(1, close);
    const rest = s.slice(close + 1);
    if (rest) {
      const m = /^:(\d+)$/.exec(rest);
      if (!m) return { ok: false, error: `方括号后出现无法识别的内容「${rest}」，URL 写法里只能跟 :端口` };
      const pc = checkPort(m[1]);
      if (!pc.ok) return pc;
      warnings.push(`已按 URL 写法忽略端口 ${pc.port}，只解析地址本身`);
    } else {
      warnings.push('已去除 URL 写法的方括号');
    }
    if (!inner) return { ok: false, error: '方括号内没有地址' };
    s = inner;
  }
  // IPv4 带端口（单个冒号且含点分）：旧版会被误当 IPv6 给出看不懂的报错
  if (s.includes('.') && s.includes(':') && s.split(':').length === 2) {
    const [host, portText] = s.split(':');
    if (!/^\d+$/.test(portText)) return { ok: false, error: `端口「${portText}」不是数字，地址带端口的写法应如 192.168.1.1:8080` };
    const pc = checkPort(portText);
    if (!pc.ok) return pc;
    const r = ipv4Info(host);
    if (r.ok) r.warnings = [`已忽略地址后的端口 ${pc.port}，只解析地址本身`, ...warnings];
    return r;
  }
  let r;
  if (s.includes(':')) r = ipv6Info(s);
  else if (s.includes('.')) r = ipv4Info(s);
  else r = ipv4FromInteger(s);
  if (r.ok && warnings.length) r.warnings = [...warnings, ...(r.warnings || [])];
  return r;
}
export function buildIpSummary(info) {
  if (!info || !info.ok) return '';
  if (info.version === 4) return `${info.normalized}（${info.kind}，整数 ${info.value}，十六进制 ${info.hex}）`;
  return `${info.compressed}（${info.kind}，展开 ${info.expanded}）`;
}
