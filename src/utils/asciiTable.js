// ASCII 码表与文本互转：纯本地。0-127 标准 ASCII，控制字符带英文缩写与中文说明。
export const ASCII_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'control', name: '控制字符' },
  { id: 'punct', name: '标点/符号' },
  { id: 'digit', name: '数字' },
  { id: 'upper', name: '大写字母' },
  { id: 'lower', name: '小写字母' }
];
const CONTROL = [
  ['NUL','空字符','字符串结束/填充'],['SOH','标题开始','报文头开始'],['STX','正文开始','报文正文开始'],['ETX','正文结束','报文正文结束'],
  ['EOT','传输结束','传输结束'],['ENQ','询问','请求应答'],['ACK','确认','收到通知'],['BEL','响铃','终端蜂鸣 \\a'],
  ['BS','退格','Backspace，删除前一字符'],['HT','水平制表','Tab 键 \\t'],['LF','换行','Line Feed \\n'],['VT','垂直制表','\\v'],
  ['FF','换页','\\f'],['CR','回车','Carriage Return \\r'],['SO','移出','切换字符集'],['SI','移入','恢复字符集'],
  ['DLE','数据链路转义','转义后续字符'],['DC1','设备控制1','XON，恢复发送'],['DC2','设备控制2',''],['DC3','设备控制3','XOFF，暂停发送'],
  ['DC4','设备控制4',''],['NAK','否定确认','未收到'],['SYN','同步空闲','同步传输同步信号'],['ETB','传输块结束',''],
  ['CAN','取消','取消前文'],['EM','介质结束','介质用尽'],['SUB','替换','错误字符替换'],['ESC','转义','Escape，后续字符转义'],
  ['FS','文件分隔符',''],['GS','组分隔符',''],['RS','记录分隔符',''],['US','单元分隔符','']
];
function categoryOf(code) {
  if (code <= 32 || code === 127) return 'control';
  if (code >= 48 && code <= 57) return 'digit';
  if (code >= 65 && code <= 90) return 'upper';
  if (code >= 97 && code <= 122) return 'lower';
  return 'punct';
}
function displayOf(code) {
  if (code === 32) return '(空格)';
  if (code === 127) return '⌫';
  if (code < 32) return CONTROL[code][0];
  return String.fromCharCode(code);
}
function nameOf(code) {
  if (code < 32) return CONTROL[code][1];
  if (code === 32) return '空格 Space';
  if (code === 127) return '删除 Delete';
  const ch = String.fromCharCode(code);
  if (code >= 48 && code <= 57) return `数字 ${ch}`;
  if (code >= 65 && code <= 90) return `大写字母 ${ch}`;
  if (code >= 97 && code <= 122) return `小写字母 ${ch}`;
  return `符号 ${ch}`;
}
function noteOf(code) {
  if (code < 32) return CONTROL[code][2] || '';
  if (code === 127) return 'DEL，删除字符';
  if (code === 32) return '单词间分隔，URL 中常编码为 %20 或 +';
  return '';
}
export const ASCII_TABLE = Array.from({ length: 128 }, (_, code) => ({
  code,
  char: code < 32 || code === 127 ? '' : String.fromCharCode(code),
  display: displayOf(code),
  name: nameOf(code),
  abbr: code < 32 ? CONTROL[code][0] : code === 127 ? 'DEL' : '',
  hex: code.toString(16).toUpperCase().padStart(2, '0'),
  oct: code.toString(8).padStart(3, '0'),
  binary: code.toString(2).padStart(8, '0'),
  category: categoryOf(code),
  note: noteOf(code)
}));
export function searchAscii(query = '', category = 'all') {
  const q = String(query || '').trim().toLowerCase();
  const cat = category || 'all';
  return ASCII_TABLE.filter((t) => {
    if (cat !== 'all' && t.category !== cat) return false;
    if (!q) return true;
    const hay = `${t.code} ${t.display} ${t.name} ${t.abbr} ${t.hex} 0x${t.hex} ${t.oct} ${t.binary} ${t.note}`.toLowerCase();
    return q.split(/\s+/).every((p) => hay.includes(p));
  });
}
export function textToAscii(text = '', format = 'dec') {
  const s = String(text ?? '');
  const codes = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp > 127) return { ok: false, error: `字符「${ch}」不是 ASCII（码点 ${cp}），ASCII 只包含 0–127` };
    codes.push(cp);
  }
  let output = '';
  if (format === 'hex') output = codes.map((c) => c.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  else if (format === 'escape') output = codes.map((c) => '\\x' + c.toString(16).toUpperCase().padStart(2, '0')).join('');
  else output = codes.join(' ');
  return { ok: true, output, count: codes.length };
}
export function asciiToText(input = '', format = 'dec') {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, output: '', count: 0 };
  let tokens;
  if (format === 'escape') {
    if (!/^(\\x[0-9a-fA-F]{2})+$/.test(raw.replace(/\s+/g, ''))) return { ok: false, error: '格式应为连续的 \\xHH，如 \\x48\\x69' };
    tokens = raw.replace(/\s+/g, '').match(/\\x([0-9a-fA-F]{2})/g).map((t) => parseInt(t.slice(2), 16));
  } else {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    tokens = [];
    for (const p of parts) {
      const v = format === 'hex' ? (/^[0-9a-fA-F]{1,2}$/.test(p.replace(/^0x/i, '')) ? parseInt(p.replace(/^0x/i, ''), 16) : NaN) : (/^\d{1,3}$/.test(p) ? Number(p) : NaN);
      if (!Number.isInteger(v) || v < 0 || v > 127) return { ok: false, error: `「${p}」不是有效的 ASCII 码（应为 0–127${format === 'hex' ? ' 的十六进制' : ''}）` };
      tokens.push(v);
    }
  }
  for (const v of tokens) if (v > 127) return { ok: false, error: `码值 ${v} 超出 ASCII 范围 0–127` };
  return { ok: true, output: tokens.map((c) => String.fromCharCode(c)).join(''), count: tokens.length };
}
export function buildAsciiSummary(t) {
  if (!t) return '';
  return `${t.display} → ASCII ${t.code}（十六进制 0x${t.hex}，八进制 ${t.oct}）`;
}
