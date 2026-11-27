// Chmod 权限计算：纯本地。支持八进制（3/4 位）、符号形式（rwxr-xr-x / -rwxr-xr-x）、
// chmod 符号模式（u+x / a=rwx，相对当前权限修改）互转、特殊位与 umask 计算。
// 全角数字/字母自动转半角（中文输入法粘贴友好）。
export function normalizeChmodInput(input) {
  return String(input ?? '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
}
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
  const s = normalizeChmodInput(input).trim();
  if (!s) throw new Error('请输入八进制权限，如 755 或 4755');
  if (/^[0-9]+$/.test(s)) {
    const bad = s.search(/[89]/);
    if (bad !== -1) throw new Error(`第 ${bad + 1} 位「${s[bad]}」不是八进制数字（每位只能 0–7）`);
  }
  if (!/^[0-7]{3,4}$/.test(s)) throw new Error('八进制权限须为 3 或 4 位、每位 0–7，如 644、755、4755');
  const digits = s.length === 3 ? [0, ...s.split('').map(Number)] : s.split('').map(Number);
  const [special, o, g, ot] = digits;
  const bits = emptyBits();
  bits.setuid = !!(special & 4); bits.setgid = !!(special & 2); bits.sticky = !!(special & 1);
  bits.owner = digitToPerms(o); bits.group = digitToPerms(g); bits.other = digitToPerms(ot);
  return bits;
}
export function parseSymbolic(input) {
  let s = normalizeChmodInput(input).trim();
  if (!s) throw new Error('请输入符号权限，如 rwxr-xr-x');
  // ls -l 末尾的 ACL/扩展属性标记（+ . @）不属于权限本身，剥掉再解析
  if ((s.length === 10 || s.length === 11) && /[+.@]$/.test(s)) s = s.slice(0, -1);
  // 允许 ls -l 的 10 位形式（首位文件类型：- 文件 d 目录 l 链接 b/c 设备 p 管道 s 套接字）
  if (s.length === 10 && /^[bcdlps\-]/.test(s)) s = s.slice(1);
  if (s.length !== 9) throw new Error('符号权限须为 9 位，如 rwxr-xr-x（也可粘贴 ls 的 10 位形式，末尾 +/. /@ 标记可带）');
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
const MODE_RE = /^[ugoa]*[+\-=]/;
export function isChmodMode(input) {
  const s = normalizeChmodInput(input).trim();
  return MODE_RE.test(s) && /[+\-=]/.test(s) && !/^[rwx\-]{9}/.test(s);
}
// chmod 符号模式：以当前 bits 为基底相对修改，如 u+x、ug+rw-x、a=rwx、o+t、g=u（复制组权限）。
// 省略 who 按 a 处理（真实 chmod 省略时受 umask 影响，本工具无 umask 上下文，按 a 并在使用说明中注明）。
// X 为条件执行：任一组已有执行位时才生效；= 对 u/g 同时决定 setuid/setgid、对 o 决定 sticky（perms 含 s/t 才置位）。
export function applyChmodMode(base, input) {
  const raw = normalizeChmodInput(input).trim();
  if (!raw) throw new Error('请输入 chmod 符号模式，如 u+x、a=rwx');
  if (raw.length > 64) throw new Error('符号模式过长（上限 64 字符）');
  const bits = JSON.parse(JSON.stringify(base));
  const keyOf = { u: 'owner', g: 'group', o: 'other' };
  const clauses = raw.split(',');
  clauses.forEach((clause, ci) => {
    if (!clause) throw new Error(`第 ${ci + 1} 段为空（逗号分隔的每段都要有内容）`);
    let i = 0;
    let who = '';
    while (i < clause.length && 'ugoa'.includes(clause[i])) { who += clause[i]; i++; }
    if (i < clause.length && !'+-='.includes(clause[i])) throw new Error(`第 ${ci + 1} 段第 ${i + 1} 个字符「${clause[i]}」无法识别（who 只能是 u/g/o/a，后接 +、- 或 =）`);
    if (i >= clause.length) throw new Error(`第 ${ci + 1} 段「${clause}」缺少操作符（+、- 或 =）`);
    const viaAll = !who || who.includes('a');
    const targets = viaAll ? ['u', 'g', 'o'] : [...new Set(who.split(''))];
    let groupsTouched = false;
    while (i < clause.length) {
      const op = clause[i];
      if (!'+-='.includes(op)) throw new Error(`第 ${ci + 1} 段第 ${i + 1} 个字符「${op}」无法识别（应为 +、- 或 =）`);
      i++;
      let perms = '';
      while (i < clause.length && 'rwxXstugo'.includes(clause[i])) { perms += clause[i]; i++; }
      if (i < clause.length && !'+-='.includes(clause[i])) throw new Error(`第 ${ci + 1} 段第 ${i + 1} 个字符「${clause[i]}」无法识别（权限只能是 r/w/x/X/s/t 或复制源 u/g/o）`);
      if (!perms && op !== '=') throw new Error(`第 ${ci + 1} 段操作符「${op}」后缺少权限字母`);
      groupsTouched = true;
      // 复制源快照（perms 中至多一个 u/g/o 复制字母，取当前状态）
      const copyFrom = ['u', 'g', 'o'].find((c) => perms.includes(c));
      const copyPerms = copyFrom ? { ...bits[keyOf[copyFrom]] } : null;
      const anyX = ['owner', 'group', 'other'].some((k) => bits[k].x);
      for (const t of targets) {
        const key = keyOf[t];
        if (op === '=') {
          bits[key] = { r: perms.includes('r'), w: perms.includes('w'), x: perms.includes('x') || (perms.includes('X') && anyX) };
          if (copyPerms) bits[key] = { ...copyPerms };
          if (t === 'u') bits.setuid = perms.includes('s');
          if (t === 'g') bits.setgid = perms.includes('s');
          if (t === 'o') bits.sticky = perms.includes('t');
        } else {
          const delta = copyPerms ? copyPerms : { r: perms.includes('r'), w: perms.includes('w'), x: perms.includes('x') || (perms.includes('X') && anyX) };
          for (const pk of ['r', 'w', 'x']) if (delta[pk]) bits[key][pk] = op === '+';
          if (perms.includes('s')) {
            // a 整体应用时 s 只落 u/g、跳过 o；显式 o+s 才报错
            if (t === 'o') { if (!viaAll) throw new Error('s（setuid/setgid）对其他人（o）无效，只能用于 u 或 g'); }
            else if (t === 'u') bits.setuid = op === '+';
            else bits.setgid = op === '+';
          }
          if (perms.includes('t')) {
            // a 整体应用时 t 只落 o、跳过 u/g；显式 u+t/g+t 才报错
            if (t !== 'o') { if (!viaAll) throw new Error('t（sticky）只能用于其他人（o）或 a'); }
            else bits.sticky = op === '+';
          }
        }
      }
    }
    if (!groupsTouched) throw new Error(`第 ${ci + 1} 段「${clause}」缺少操作符（+、- 或 =）`);
  });
  return bits;
}
export function parseChmod(input) {
  const s = normalizeChmodInput(input).trim();
  if (!s) throw new Error('请输入权限：八进制（如 755）、符号串（如 rwxr-xr-x）或符号模式（如 u+x）');
  if (s.length > 64) throw new Error('输入过长（上限 64 字符）');
  if (/^[0-9]+$/.test(s)) return parseOctal(s);
  if (isChmodMode(s)) throw new Error('这是 chmod 符号模式（相对修改），需基于当前勾选应用，请直接点解析');
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
  const s = normalizeChmodInput(umaskInput).trim();
  if (/^[0-9]+$/.test(s)) {
    const bad = s.search(/[89]/);
    if (bad !== -1) throw new Error(`umask 第 ${bad + 1} 位「${s[bad]}」不是八进制数字（每位只能 0–7）`);
  }
  if (!/^[0-7]{3,4}$/.test(s)) throw new Error('umask 须为 3 或 4 位八进制，如 022');
  const mask = parseInt(s, 8);
  const file = 0o666 & ~mask & 0o777;
  const dir = 0o777 & ~mask & 0o777;
  const fmt = (n) => n.toString(8).padStart(3, '0');
  // 四位写法（含特殊位掩码）原样保留展示，不再静默截成三位；文件/目录默认权限本身不带特殊位
  const shown = s.length === 4 ? s : fmt(mask & 0o777);
  return { umask: shown, hasSpecial: (mask & 0o7000) !== 0, file: fmt(file), dir: fmt(dir), fileBits: parseOctal(fmt(file)), dirBits: parseOctal(fmt(dir)) };
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
