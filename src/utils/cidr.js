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

export function formatCount(value) {
  const text = String(value);
  if (!/^\d+$/.test(text)) return text;
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseIpv4(text) {
  const parts = text.split('.');
  if (parts.length !== 4) throw new Error(`IP 地址应为 4 段，实际 ${parts.length} 段`);
  parts.forEach((part, index) => {
    const label = `第 ${index + 1} 段`;
    if (part === '') throw new Error(`IP 地址${label}为空`);
    if (!/^\d{1,3}$/.test(part)) throw new Error(`IP 地址${label}「${part}」不是 0-255 的数字`);
    if (part.length > 1 && part.startsWith('0')) throw new Error(`IP 地址${label}「${part}」有多余的前导零`);
    if (Number(part) > 255) throw new Error(`IP 地址${label}「${part}」超过 255`);
  });
  return text;
}

// 点分掩码（如 255.255.255.0）转前缀长度；掩码必须连续，非法时抛错。
function maskToPrefix(maskIp) {
  if (maskIp.split('.').length !== 4) {
    throw new Error(`子网掩码「${maskIp}」应为 4 段点分形式，如 255.255.255.0`);
  }
  parseIpv4(maskIp);
  const bits = toBinary(maskIp).replace(/\./g, '');
  if (!/^1*0*$/.test(bits)) throw new Error(`子网掩码 ${maskIp} 不是连续掩码（1 和 0 不能交错）`);
  return bits.replace(/0/g, '').length;
}

function classify(ipBig, firstOctet) {
  const inRange = (base, prefix) => {
    const shift = BigInt(32 - prefix);
    return (ipBig >> shift) === (ipToBigInt(base) >> shift);
  };
  if (ipBig === 0xffffffffn) return { scope: '受限广播地址', isPrivate: false };
  if (inRange('0.0.0.0', 8)) return { scope: '本网络地址（0.0.0.0/8）', isPrivate: false };
  if (inRange('10.0.0.0', 8) || inRange('172.16.0.0', 12) || inRange('192.168.0.0', 16)) return { scope: '私有地址（RFC 1918）', isPrivate: true };
  if (inRange('127.0.0.0', 8)) return { scope: '环回地址', isPrivate: false };
  if (inRange('169.254.0.0', 16)) return { scope: '链路本地地址', isPrivate: false };
  if (inRange('100.64.0.0', 10)) return { scope: '运营商级 NAT 共享地址', isPrivate: false };
  if (inRange('192.0.0.0', 24)) return { scope: 'IETF 协议分配地址', isPrivate: false };
  if (inRange('192.0.2.0', 24) || inRange('198.51.100.0', 24) || inRange('203.0.113.0', 24)) return { scope: '文档示例地址（TEST-NET）', isPrivate: false };
  if (inRange('198.18.0.0', 15)) return { scope: '基准测试地址（RFC 2544）', isPrivate: false };
  if (inRange('192.88.99.0', 24)) return { scope: '保留地址（原 6to4 中继）', isPrivate: false };
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

export const MAX_CIDR_INPUT_LENGTH = 64;

/**
 * 解析 "192.168.1.10/24"、"192.168.1.10/255.255.255.0" 或纯 IP（按 /32 处理）。
 * 允许 / 两侧带空格（如从表格复制的 "192.168.1.10 / 24"）。
 * @returns 计算结果对象（含 warnings / isNetworkAddress / isBroadcastAddress / 千分位计数）；输入非法时抛 Error（中文提示）。
 */
export function parseCidr(rawInput) {
  let input = String(rawInput ?? '').trim();
  if (!input) throw new Error('请输入 IPv4 地址，如 192.168.1.10/24');
  if (input.length > MAX_CIDR_INPUT_LENGTH) {
    throw new Error(`输入过长（${input.length} 字符），CIDR 最长 ${MAX_CIDR_INPUT_LENGTH} 字符`);
  }
  if (input.includes(':')) throw new Error('暂只支持 IPv4，不支持 IPv6');
  // 只容忍 / 两侧的空格，其余位置的空格仍报错，避免把两段无关文本拼在一起误算
  input = input.replace(/\s*\/\s*/g, '/');
  if (/\s/.test(input)) throw new Error('输入中不要包含空格（仅 / 两侧可带空格）');

  let ipText = input;
  let prefix = 32;
  const slash = input.indexOf('/');
  if (slash !== -1) {
    ipText = input.slice(0, slash);
    const suffix = input.slice(slash + 1);
    if (input.indexOf('/', slash + 1) !== -1) throw new Error('只能包含一个 /');
    if (!ipText) throw new Error('/ 前面缺少 IP 地址');
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
  const broadcast = bigIntToIp(broadcastBig);

  const isNetworkAddress = prefix <= 30 && ipBig === networkBig;
  const isBroadcastAddress = prefix <= 30 && ipBig === broadcastBig;
  const warnings = [];
  if (isNetworkAddress) warnings.push('输入的 IP 正好是该网段的网络地址，通常只标识网段本身、不分配给主机');
  if (isBroadcastAddress) warnings.push('输入的 IP 正好是该网段的广播地址，不能分配给主机');
  if (prefix === 0) warnings.push('/0 覆盖全部 IPv4 地址空间，通常只用于默认路由，不是普通子网');
  if (scope.includes('组播')) warnings.push('组播地址用于一对多分发，不按普通主机子网方式分配');
  else if (scope.includes('保留') || scope.includes('本网络')) warnings.push(`「${scope}」一般不用于普通主机子网划分，结果仅供对照`);

  return {
    ip: ipText,
    prefix,
    cidr: `${network}/${prefix}`,
    netmask,
    wildcard: bigIntToIp(0xffffffffn - maskBig),
    network,
    broadcast,
    firstUsable: bigIntToIp(firstBig),
    lastUsable: bigIntToIp(lastBig),
    totalHosts: total.toString(),
    usableHosts: usable.toString(),
    totalHostsFormatted: formatCount(total.toString()),
    usableHostsFormatted: formatCount(usable.toString()),
    hostBits: 32 - prefix,
    isNetworkAddress,
    isBroadcastAddress,
    warnings,
    ipClass: ipClass(firstOctet),
    scope,
    isPrivate,
    ipInteger: ipBig.toString(),
    ipHex: '0x' + ipBig.toString(16).toUpperCase().padStart(8, '0'),
    ipBinary: toBinary(ipText),
    maskBinary: toBinary(netmask)
  };
}
