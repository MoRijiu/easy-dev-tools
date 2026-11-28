// 键盘按键查询：纯本地静态键表 + KeyboardEvent 描述
// 说明：keyCode（which）已废弃但仍广泛兼容；同一 keyCode 可对应左右两个 code（如 Shift）。

export const KEY_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'modifier', name: '修饰键' },
  { id: 'edit', name: '编辑键' },
  { id: 'nav', name: '导航键' },
  { id: 'function', name: '功能键' },
  { id: 'letter', name: '字母' },
  { id: 'digit', name: '数字' },
  { id: 'symbol', name: '符号' },
  { id: 'numpad', name: '小键盘' }
];

const K = (key, code, keyCode, nameZh, category, keywords = '') => ({ key, code, keyCode, nameZh, category, keywords });

const BASE_KEYS = [
  // 修饰键
  K('Shift', 'ShiftLeft', 16, 'Shift（左）', 'modifier', 'shift 换挡'),
  K('Shift', 'ShiftRight', 16, 'Shift（右）', 'modifier', 'shift 换挡'),
  K('Control', 'ControlLeft', 17, 'Ctrl（左）', 'modifier', 'ctrl control 控制'),
  K('Control', 'ControlRight', 17, 'Ctrl（右）', 'modifier', 'ctrl control 控制'),
  K('Alt', 'AltLeft', 18, 'Alt（左）', 'modifier', 'alt 选项 option'),
  K('Alt', 'AltRight', 18, 'Alt（右）', 'modifier', 'alt 选项 option'),
  K('Meta', 'MetaLeft', 91, 'Meta（左 Win/Command）', 'modifier', 'meta win command ⌘'),
  K('Meta', 'MetaRight', 93, 'Meta（右 Win/Command）', 'modifier', 'meta win command ⌘'),
  K('CapsLock', 'CapsLock', 20, '大写锁定', 'modifier', 'caps lock 大写'),
  K('NumLock', 'NumLock', 144, '数字锁定', 'modifier', 'num lock numlock 数字锁定 小键盘'),
  K('ScrollLock', 'ScrollLock', 145, '滚动锁定', 'modifier', 'scroll lock scrolllock 滚动锁定'),
  K('Pause', 'Pause', 19, 'Pause 暂停', 'function', 'pause break 暂停 中断'),
  K('PrintScreen', 'PrintScreen', 44, 'PrintScreen 截屏', 'function', 'printscreen print screen prtsc 截屏 截图'),
  K('ContextMenu', 'ContextMenu', 93, 'ContextMenu 菜单键', 'edit', 'contextmenu menu 菜单 右键菜单'),
  // 编辑键
  K('Enter', 'Enter', 13, '回车', 'edit', 'enter return 回车 确认'),
  K('Tab', 'Tab', 9, '制表键', 'edit', 'tab 跳格 焦点'),
  K('Escape', 'Escape', 27, 'Esc 退出', 'edit', 'esc escape 退出 取消'),
  K(' ', 'Space', 32, '空格', 'edit', 'space 空格'),
  K('Backspace', 'Backspace', 8, '退格', 'edit', 'backspace 退格 删除'),
  K('Delete', 'Delete', 46, 'Delete 删除', 'edit', 'delete del 删除'),
  K('Insert', 'Insert', 45, 'Insert 插入', 'edit', 'insert ins 插入'),
  // 导航键
  K('ArrowUp', 'ArrowUp', 38, '方向键 ↑', 'nav', 'arrow up 上'),
  K('ArrowDown', 'ArrowDown', 40, '方向键 ↓', 'nav', 'arrow down 下'),
  K('ArrowLeft', 'ArrowLeft', 37, '方向键 ←', 'nav', 'arrow left 左'),
  K('ArrowRight', 'ArrowRight', 39, '方向键 →', 'nav', 'arrow right 右'),
  K('Home', 'Home', 36, 'Home 行首', 'nav', 'home 行首'),
  K('End', 'End', 35, 'End 行尾', 'nav', 'end 行尾'),
  K('PageUp', 'PageUp', 33, 'PageUp 上翻页', 'nav', 'pageup pgup 翻页'),
  K('PageDown', 'PageDown', 34, 'PageDown 下翻页', 'nav', 'pagedown pgdn 翻页'),
  // 符号键（keyCode 为美式布局参考值，随布局变化）
  K('-', 'Minus', 189, '减号 -', 'symbol', 'minus 减号'),
  K('=', 'Equal', 187, '等号 =', 'symbol', 'equal 等号'),
  K('[', 'BracketLeft', 219, '左方括号 [', 'symbol', 'bracket 括号'),
  K(']', 'BracketRight', 221, '右方括号 ]', 'symbol', 'bracket 括号'),
  K('\\', 'Backslash', 220, '反斜杠 \\', 'symbol', 'backslash 反斜杠'),
  K(';', 'Semicolon', 186, '分号 ;', 'symbol', 'semicolon 分号'),
  K("'", 'Quote', 222, '引号 \'', 'symbol', 'quote 引号'),
  K(',', 'Comma', 188, '逗号 ,', 'symbol', 'comma 逗号'),
  K('.', 'Period', 190, '句点 .', 'symbol', 'period 点 小数点'),
  K('/', 'Slash', 191, '斜杠 /', 'symbol', 'slash 斜杠'),
  K('`', 'Backquote', 192, '反引号 `', 'symbol', 'backquote 反引号 波浪'),
  // 小键盘运算符
  K('*', 'NumpadMultiply', 106, '小键盘 *', 'numpad', 'numpad multiply 乘'),
  K('+', 'NumpadAdd', 107, '小键盘 +', 'numpad', 'numpad add 加'),
  K('-', 'NumpadSubtract', 109, '小键盘 -', 'numpad', 'numpad subtract 减'),
  K('.', 'NumpadDecimal', 110, '小键盘 .', 'numpad', 'numpad decimal 小数点'),
  K('/', 'NumpadDivide', 111, '小键盘 /', 'numpad', 'numpad divide 除'),
  K('Enter', 'NumpadEnter', 13, '小键盘回车', 'numpad', 'numpad enter 回车')
];

const generated = [];
for (let i = 1; i <= 12; i++) generated.push(K('F' + i, 'F' + i, 111 + i, 'F' + i + ' 功能键', 'function', 'f' + i + ' function 功能'));
for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(65 + i);
  generated.push(K(ch.toLowerCase(), 'Key' + ch, 65 + i, '字母 ' + ch, 'letter', 'letter key' + ch.toLowerCase() + ' 字母'));
}
for (let i = 0; i <= 9; i++) generated.push(K(String(i), 'Digit' + i, 48 + i, '数字 ' + i, 'digit', 'digit number 数字'));
for (let i = 0; i <= 9; i++) generated.push(K(String(i), 'Numpad' + i, 96 + i, '小键盘 ' + i, 'numpad', 'numpad 数字 小键盘'));

const KEY_TABLE = [...BASE_KEYS, ...generated];

const LOCATION_LABELS = ['标准位置', '左侧', '右侧', '小键盘'];

export const displayKey = (key) => {
  if (key === ' ') return 'Space（空格）';
  if (key === 'Dead') return 'Dead（组合死键）';
  if (!key) return '（空）';
  return key;
};

// key 值到修饰键标签的映射：单独按修饰键时 combo 不应重复（如 Control 的标签是 Ctrl，
// 旧版按字符串比较漏掉它，拼出「Ctrl + Control」）
const MODIFIER_LABEL_BY_KEY = { control: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta' };

// 把 KeyboardEvent 风格的对象描述成可展示/可复制的结构（纯函数，便于测试）
export const describeKeyEvent = (ev) => {
  const key = ev?.key ?? '';
  const code = ev?.code ?? '';
  const keyCode = typeof ev?.keyCode === 'number' ? ev.keyCode : (typeof ev?.which === 'number' ? ev.which : null);
  const location = typeof ev?.location === 'number' ? ev.location : 0;
  const modifiers = [];
  if (ev?.ctrlKey) modifiers.push('Ctrl');
  if (ev?.altKey) modifiers.push('Alt');
  if (ev?.shiftKey) modifiers.push('Shift');
  if (ev?.metaKey) modifiers.push('Meta');
  // 按键名大小写不敏感匹配：Shift+A 时 key 是 'A'、键表存小写 'a'，旧版严格相等查不到中文名
  const tableHit = KEY_TABLE.find(k => k.code === code)
    || KEY_TABLE.find(k => keyCode !== null && k.keyCode === keyCode && k.key.toLowerCase() === String(key).toLowerCase());
  const selfLabel = MODIFIER_LABEL_BY_KEY[String(key).toLowerCase()] || displayKey(key);
  return {
    key,
    keyDisplay: displayKey(key),
    code,
    keyCode,
    location,
    locationLabel: LOCATION_LABELS[location] || '未知',
    modifiers,
    repeat: !!ev?.repeat,
    nameZh: tableHit ? tableHit.nameZh : '',
    combo: modifiers.filter(m => m !== selfLabel).concat(key ? [selfLabel] : []).join(' + ')
  };
};

export const buildEventSummary = (d) => [
  'key: ' + d.keyDisplay,
  'code: ' + (d.code || '-'),
  'keyCode: ' + (d.keyCode === null ? '-' : d.keyCode),
  '位置: ' + d.locationLabel,
  '修饰键: ' + (d.modifiers.length ? d.modifiers.join(' + ') : '无'),
  d.repeat ? '长按重复: 是' : ''
].filter(Boolean).join('\n');

export const buildCodeSnippet = (d) => {
  if (d.code) return "if (event.code === '" + d.code + "') {\n  // TODO: 处理按键\n}";
  // 用 JSON.stringify 转义 key：反斜杠、引号、控制字符都能安全落进字符串字面量
  //（旧版只处理单引号，按 \ 键会生成未闭合的 '\' 片段）
  return 'if (event.key === ' + JSON.stringify(d.key ?? '') + ') {\n  // TODO: 处理按键\n}';
};

// 全角字符转半角（中文输入法粘来的 １３／Ｅｎｔｅｒ 也能查）
const toHalfWidth = (s) => String(s).replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');

export const searchKeys = (keyword, category = 'all') => {
  let rows = KEY_TABLE;
  if (category && category !== 'all') rows = rows.filter(k => k.category === category);
  const q = toHalfWidth(keyword || '').trim().toLowerCase();
  if (!q) return rows;
  const matched = rows.filter(k => {
    const hay = [k.key, k.code, String(k.keyCode), k.nameZh, k.keywords].join(' ').toLowerCase();
    return q.split(/\s+/).every(part => hay.includes(part));
  });
  // 纯数字查询时 keyCode 精确命中排最前（如查 13 时回车优先于描述里带 13 的行）
  if (/^\d+$/.test(q)) {
    const exact = matched.filter(k => k.keyCode === Number(q));
    if (exact.length) return [...exact, ...matched.filter(k => k.keyCode !== Number(q))];
  }
  return matched;
};

export const countByCategory = () => {
  const counts = { all: KEY_TABLE.length };
  for (const k of KEY_TABLE) counts[k.category] = (counts[k.category] || 0) + 1;
  return counts;
};

