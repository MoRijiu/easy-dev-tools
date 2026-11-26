// Chmod 权限计算：纯本地。支持八进制（3/4 位）、符号形式（rwxr-xr-x / -rwxr-xr-x）互转、特殊位与 umask 计算。
export const GROUPS = [
  { key: 'owner', label: '所有者', short: 'u' },
  { key: 'group', label: '所属组', short: 'g' },
  { key: 'other', label: '其他人', short: 'o' }
];
export const PERMS = [
  { key: 'r', label: '读', value: 4 },
  { key: 'w', label: '写', value: 2 },
  { key: 'x', label: '执行', value: 1 }
];
// bits: { setuid,setgid,sticky, owner:{r,w,x}, group:{...}, other:{...} }
export function emptyBits() {
  return { setuid: false, setgid: false, sticky: false, owner: { r: false, w: false, x: false }, group: { r: false, w: false, x: false }, other: { r: false, w: false, x: false } };
}
function digitToPerms(d) { return { r: !!(d & 4), w: !!(d & 2), x: !!(d & 1) }; }
function permsToDigit(p) { return (p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0); }
export function parseOctal(input) {
  const s = String(input ?? '').trim();
  if (!s) throw new Error('请输入八进制权限，如 755 或 4755');
  if (!/^[0-7]{3,4}$/.test(s)) throw new Error('八进制权限须为 3 或 4 位、每位 0–7，如 644、755、4755');
  const digits = s.length === 3 ? [0, ...s.split('').map(Number)] : s.split('').map(Number);
  const [special, o, g, ot] = digits;
  const bits = emptyBits();
  bits.setuid = !!(special & 4); bits.setgid = !!(special & 2); bits.sticky = !!(special & 1);
  bits.owner = digitToPerms(o); bits.group = digitToPerms(g); bits.other = digitToPerms(ot);
  return bits;
}
export function parseSymbolic(input) {
  let s = String(input ?? '').trim();
  if (!s) throw new Error('请输入符号权限，如 rwxr-xr-x');
  // 允许 ls -l 的 10 位形式（首位文件类型）
  if (s.length === 10 && /^[bcdlps\-]/.test(s)) s = s.slice(1);
  if (s.length !== 9) throw new Error('符号权限须为 9 位，如 rwxr-xr-x（也可粘贴 ls 的 10 位形式）');
  const bits = emptyBits();
  const keys = ['owner', 'group', 'other'];
  for (let gi = 0; gi < 3; gi++) {
    const seg = s.slice(gi * 3, gi * 3 + 3);
    const [rc, wc, xc] = seg.split('');
    if (rc !== 'r' && rc !== '-') throw new Error(`第 ${gi * 3 + 1} 位应为 r 或 -，收到「${rc}」`);
    if (wc !== 'w' && wc !== '-') throw new Error(`第 ${gi * 3 + 2} 位应为 w 或 -，收到「${wc}」`);
    bits[keys[gi]].r = rc === 'r'; bits[keys[gi]].w = wc === 'w';
    if (xc === 'x') bits[keys[gi]].x = true;
    else if (xc === '-') bits[keys[gi]].x = false;
    else if (xc === 's' || xc === 'S') {
      bits[keys[gi]].x = xc === 's';
      if (gi === 0) bits.setuid = true; else if (gi === 1) bits.setgid = true; else throw new Error('其他人执行位不能是 s');
    } else if (xc === 't' || xc === 'T') {
      if (gi !== 2) throw new Error('t 只能出现在其他人执行位');
      bits[keys[gi]].x = xc === 't'; bits.sticky = true;
    } else throw new Error(`第 ${gi * 3 + 3} 位应为 x、-、s 或 t，收到「${xc}」`);
  }
  return bits;
}
export function parseChmod(input) {
  const s = String(input ?? '').trim();
  if (/^[0-7]+$/.test(s)) return parseOctal(s);
  return parseSymbolic(s);
}
export function toOctal(bits, alwaysFour = false) {
  const special = (bits.setuid ? 4 : 0) + (bits.setgid ? 2 : 0) + (bits.sticky ? 1 : 0);
  const rest = GROUPS.map(g => permsToDigit(bits[g.key])).join('');
  return (alwaysFour || special > 0) ? `${special}${rest}` : rest;
}
export function toSymbolic(bits) {
  let out = '';
  GROUPS.forEach((g, gi) => {
    const p = bits[g.key];
    let x = p.x ? 'x' : '-';
    if (gi === 0 && bits.setuid) x = p.x ? 's' : 'S';
    if (gi === 1 && bits.setgid) x = p.x ? 's' : 'S';
    if (gi === 2 && bits.sticky) x = p.x ? 't' : 'T';
    out += (p.r ? 'r' : '-') + (p.w ? 'w' : '-') + x;
  });
  return out;
}
export function describeBits(bits) {
  const parts = GROUPS.map(g => {
    const p = bits[g.key];
    const list = PERMS.filter(per => p[per.key]).map(per => per.label);
    return `${g.label}：${list.length ? list.join('、') : '无权限'}`;
  });
  const special = [];
  if (bits.setuid) special.push('setuid');
  if (bits.setgid) special.push('setgid');
  if (bits.sticky) special.push('sticky');
  if (special.length) parts.push(`特殊位：${special.join('、')}`);
  return parts;
}
export function buildSummary(bits) {
  return `chmod ${toOctal(bits)}（${toSymbolic(bits)}）：${describeBits(bits).join('；')}`;
}
// umask：文件默认 666、目录默认 777，再按位清掉 umask 置位部分
export function applyUmask(umaskInput) {
  const s = String(umaskInput ?? '').trim();
  if (!/^[0-7]{3,4}$/.test(s)) throw new Error('umask 须为 3 或 4 位八进制，如 022');
  const mask = parseInt(s, 8);
  const file = 0o666 & ~mask & 0o777;
  const dir = 0o777 & ~mask & 0o777;
  const fmt = (n) => n.toString(8).padStart(3, '0');
  return { umask: fmt(parseInt(s, 8) & 0o777), file: fmt(file), dir: fmt(dir), fileBits: parseOctal(fmt(file)), dirBits: parseOctal(fmt(dir)) };
}
export const PRESETS = [
  { octal: '644', note: '普通文件：所有者读写、其余只读' },
  { octal: '755', note: '目录/可执行文件：所有者全权、其余读与执行' },
  { octal: '600', note: '私钥/敏感文件：仅所有者读写' },
  { octal: '700', note: '私有目录：仅所有者全权' },
  { octal: '664', note: '协作文件：所有者与组可读写' },
  { octal: '775', note: '协作目录：所有者与组全权' },
  { octal: '400', note: '只读密钥：仅所有者只读' },
  { octal: '777', note: '全开放（不推荐）：所有人全权' }
];
