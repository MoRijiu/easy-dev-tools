// IP 地址解析与互转：纯本地。IPv4 点分/整数/十六进制/二进制互转与性质判定；IPv6 展开/压缩（RFC 5952）与性质判定。
export function parseIpv4(input = '') {
  const s = String(input ?? '').trim();
  if (!s) return { ok: false, error: '请输入 IPv4 地址' };
  const parts = s.split('.');
  if (parts.length !== 4) return { ok: false, error: `IPv4 应为 4 段点分格式，当前 ${parts.length} 段` };
  const octets = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return { ok: false, error: `「${p}」不是有效的十进制数字段` };
    if (p.length > 1 && p.startsWith('0')) return { ok: false, error: `「${p}」带前导零，易与八进制混淆，请去掉` };
    const v = Number(p);
    if (v > 255) return { ok: false, error: `「${p}」超出范围，每段应为 0–255` };
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
  const [a, b, c] = octets;
  if (a === 0) return { kind: '软件保留', note: '0.0.0.0/8，本网络源地址段' };
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return { kind: '私有地址', note: 'RFC 1918 私有地址，只能在局域网内使用' };
  if (a === 100 && b >= 64 && b <= 127) return { kind: '运营商级 NAT', note: '100.64.0.0/10 CGNAT 共享地址空间' };
  if (a === 127) return { kind: '环回地址', note: '127.0.0.0/8，指向本机自身' };
  if (a === 169 && b === 254) return { kind: '链路本地', note: '169.254.0.0/16，DHCP 失败时自动分配（APIPA）' };
  if ((a === 192 && b === 0 && c === 0) || (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51) || (a === 203 && b === 0)) return { kind: '文档示例', note: '保留给文档与示例，不应出现在公网' };
  if (a === 198 && (b === 18 || b === 19)) return { kind: '基准测试', note: '198.18.0.0/15，网络设备基准测试专用' };
  if (a >= 224 && a < 240) return { kind: '组播地址', note: 'D 类组播，一对多分发' };
  if (a >= 240) return { kind: '保留地址', note: 'E 类保留，255.255.255.255 为受限广播' };
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
    ipClass: ipv4Class(octets), kind: k.kind, note: k.note
  };
}
export function ipv4FromInteger(input = '') {
  const s = String(input ?? '').trim();
  if (!s) return { ok: false, error: '请输入整数或 0x 十六进制整数' };
  let v;
  try { v = /^0x[0-9a-fA-F]+$/.test(s) ? BigInt(s) : /^\d+$/.test(s) ? BigInt(s) : null; } catch { v = null; }
  if (v === null) return { ok: false, error: '整数格式应为十进制数字或 0x 开头的十六进制' };
  if (v < 0n || v > 4294967295n) return { ok: false, error: '整数超出 IPv4 范围 0–4294967295' };
  const n = Number(v);
  return ipv4Info([Math.floor(n / 16777216), Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join('.'));
}
export function expandIpv6(input = '') {
  let s = String(input ?? '').trim();
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
export function compressIpv6(groups) {
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
  return {
    ok: true, version: 6, groups,
    expanded: groups.map((g) => g.toString(16).padStart(4, '0')).join(':'),
    compressed: compressIpv6(groups),
    value: value.toString(),
    hex: '0x' + value.toString(16).padStart(32, '0'),
    reverseDns: value.toString(16).padStart(32, '0').split('').reverse().join('.') + '.ip6.arpa',
    mappedIpv4: v4Mapped ? [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.') : '',
    kind: k.kind, note: k.note
  };
}
export function parseIp(input = '') {
  const s = String(input ?? '').trim();
  if (!s) return { ok: false, error: '请输入 IP 地址或 IPv4 整数' };
  if (s.includes(':')) return ipv6Info(s);
  if (s.includes('.')) return ipv4Info(s);
  return ipv4FromInteger(s);
}
export function buildIpSummary(info) {
  if (!info || !info.ok) return '';
  if (info.version === 4) return `${info.normalized}（${info.kind}，整数 ${info.value}，十六进制 ${info.hex}）`;
  return `${info.compressed}（${info.kind}，展开 ${info.expanded}）`;
}
