// IPv4 CIDR 子网计算（纯本地）：解析 IP/前缀，算网络地址、广播、可用范围、掩码、地址类别等。
// 用 BigInt 做位运算避免 JS 32 位有符号溢出。

function ipToBigInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8n) + BigInt(part), 0n);
}

function bigIntToIp(n) {
  const parts = [];
  for (let i = 3; i >= 0; i--) parts.push(String((n >> BigInt(i * 8)) & 255n));
  return parts.join('.');
}

function toBinary(ip) {
  return ip.split('.').map((p) => Number(p).toString(2).padStart(8, '0')).join('.');
}

function parseIpv4(text) {
  const parts = text.split('.');
  if (parts.length !== 4) throw new Error(`IP 地址应为 4 段，实际 ${parts.length} 段`);
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`IP 段「${part}」不是 0-255 的数字`);
    if (part.length > 1 && part.startsWith('0')) throw new Error(`IP 段「${part}」有多余的前导零`);
    if (Number(part) > 255) throw new Error(`IP 段「${part}」超过 255`);
  }
  return text;
}

// 点分掩码（如 255.255.255.0）转前缀长度；掩码必须连续，非法时抛错。
function maskToPrefix(maskIp) {
  parseIpv4(maskIp);
  const bits = toBinary(maskIp).replace(/\./g, '');
  if (!/^1*0*$/.test(bits)) throw new Error(`子网掩码 ${maskIp} 不是连续掩码`);
  return bits.replace(/0/g, '').length;
}

function classify(ipBig, firstOctet) {
  const inRange = (base, prefix) => {
    const shift = BigInt(32 - prefix);
    return (ipBig >> shift) === (ipToBigInt(base) >> shift);
  };
  if (inRange('10.0.0.0', 8) || inRange('172.16.0.0', 12) || inRange('192.168.0.0', 16)) return { scope: '私有地址（RFC 1918）', isPrivate: true };
  if (inRange('127.0.0.0', 8)) return { scope: '环回地址', isPrivate: false };
  if (inRange('169.254.0.0', 16)) return { scope: '链路本地地址', isPrivate: false };
  if (inRange('100.64.0.0', 10)) return { scope: '运营商级 NAT 共享地址', isPrivate: false };
  if (inRange('192.0.2.0', 24) || inRange('198.51.100.0', 24) || inRange('203.0.113.0', 24)) return { scope: '文档示例地址（TEST-NET）', isPrivate: false };
  if (firstOctet >= 224 && firstOctet <= 239) return { scope: '组播地址', isPrivate: false };
  if (firstOctet >= 240) return { scope: '保留地址', isPrivate: false };
  return { scope: '公网地址', isPrivate: false };
}

function ipClass(firstOctet) {
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D（组播）';
  return 'E（保留）';
}

/**
 * 解析 "192.168.1.10/24"、"192.168.1.10/255.255.255.0" 或纯 IP（按 /32 处理）。
 * @returns 计算结果对象；输入非法时抛 Error（中文提示）。
 */
export function parseCidr(rawInput) {
  const input = String(rawInput ?? '').trim();
  if (!input) throw new Error('请输入 IPv4 地址，如 192.168.1.10/24');
  if (/\s/.test(input)) throw new Error('输入中不要包含空格');
  if (input.includes(':')) throw new Error('暂只支持 IPv4，不支持 IPv6');

  let ipText = input;
  let prefix = 32;
  const slash = input.indexOf('/');
  if (slash !== -1) {
    ipText = input.slice(0, slash);
    const suffix = input.slice(slash + 1);
    if (input.indexOf('/', slash + 1) !== -1) throw new Error('只能包含一个 /');
    if (!suffix) throw new Error('/ 后面缺少前缀长度或子网掩码');
    if (suffix.includes('.')) {
      prefix = maskToPrefix(suffix);
    } else {
      if (!/^\d{1,2}$/.test(suffix)) throw new Error(`前缀「${suffix}」应为 0-32 的整数`);
      prefix = Number(suffix);
      if (prefix > 32) throw new Error(`前缀 /${prefix} 超过最大值 32`);
    }
  }
  parseIpv4(ipText);

  const ipBig = ipToBigInt(ipText);
  const hostBits = BigInt(32 - prefix);
  const total = 1n << hostBits;
  const maskBig = prefix === 0 ? 0n : ((0xffffffffn << hostBits) & 0xffffffffn);
  const networkBig = ipBig & maskBig;
  const broadcastBig = networkBig + total - 1n;

  // 可用主机范围：/32 单地址、/31 点对点两端都可用（RFC 3021）、其余去掉网络与广播地址
  let firstBig = networkBig;
  let lastBig = broadcastBig;
  let usable;
  if (prefix <= 30) { firstBig = networkBig + 1n; lastBig = broadcastBig - 1n; usable = total - 2n; }
  else if (prefix === 31) { usable = 2n; }
  else { usable = 1n; }

  const firstOctet = Number(ipText.split('.')[0]);
  const { scope, isPrivate } = classify(ipBig, firstOctet);
  const netmask = bigIntToIp(maskBig);
  const network = bigIntToIp(networkBig);

  return {
    ip: ipText,
    prefix,
    cidr: `${network}/${prefix}`,
    netmask,
    wildcard: bigIntToIp(0xffffffffn - maskBig),
    network,
    broadcast: bigIntToIp(broadcastBig),
    firstUsable: bigIntToIp(firstBig),
    lastUsable: bigIntToIp(lastBig),
    totalHosts: total.toString(),
    usableHosts: usable.toString(),
    ipClass: ipClass(firstOctet),
    scope,
    isPrivate,
    ipInteger: ipBig.toString(),
    ipHex: '0x' + ipBig.toString(16).toUpperCase().padStart(8, '0'),
    ipBinary: toBinary(ipText),
    maskBinary: toBinary(netmask)
  };
}
