// 摩尔斯电码编解码：纯本地实现（ITU 国际摩尔斯电码）。
// 编码：字母间一个空格、单词间用 / 分隔；全角字母/数字/标点先转半角并提示。
// 解码兼容 / 、换行、两个以上空格作单词分隔，并容忍 • · − – 等点画变体符号（含全角 － ／ ．），
// 转换发生时通过 notes 告知；零宽等不可见字符定位点名拒绝。
// 仅支持字母、数字与常用标点，中文等字符按 Unicode 码点定位报错。
export const MORSE_TABLE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....',
  6: '-....', 7: '--...', 8: '---..', 9: '----.', 0: '-----',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', $: '...-..-', '@': '.--.-.'
};

const REVERSE_TABLE = new Map(Object.entries(MORSE_TABLE).map(([ch, code]) => [code, ch]));

export const MORSE_GROUPS = [
  { name: '字母', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  { name: '数字', chars: '1234567890'.split('') },
  { name: '标点', chars: ['.', ',', '?', "'", '!', '/', '(', ')', '&', ':', ';', '=', '+', '-', '_', '"', '$', '@'] }
];

export const MAX_INPUT = 100000;

const INVISIBLE_NAMES = {
  '\u200B': '零宽空格', '\u200C': '零宽非连接符', '\u200D': '零宽连接符',
  '\u2060': '单词连接符', '\uFEFF': '字节顺序标记（BOM）'
};

function countCodePoints(s) {
  return [...s].length;
}

function assertLength(raw) {
  const n = countCodePoints(raw);
  if (n > MAX_INPUT) throw new Error(`输入过长：最多 ${MAX_INPUT} 个字符，收到 ${n} 个`);
  return n;
}

// 全角 ASCII 区（U+FF01–U+FF5E）与全角空格转半角，返回 { text, count }。
export function normalizeFullwidth(text) {
  let count = 0;
  const out = String(text ?? '').replace(/[！-～　]/g, (ch) => {
    count++;
    return ch === '　' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  return { text: out, count };
}

// 找出首个零宽/BOM 等不可见字符（首尾的会被空白规则吞掉，只查内部），返回 { index(码点), ch }。
function findInvisible(text) {
  const cps = [...text];
  for (let i = 0; i < cps.length; i++) {
    if (Object.prototype.hasOwnProperty.call(INVISIBLE_NAMES, cps[i])) return { index: i, ch: cps[i] };
  }
  return null;
}

function invisibleError(text) {
  const hit = findInvisible(text);
  if (!hit) return null;
  const hex = hit.ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  return new Error(`第 ${hit.index + 1} 个字符是不可见字符（${INVISIBLE_NAMES[hit.ch]} U+${hex}），多为从网页/文档粘贴时混入，请删除后重试`);
}

export function encodeMorse(text) {
  const raw = String(text ?? '');
  assertLength(raw);
  const inv = invisibleError(raw.trim());
  if (inv) throw inv;
  const { text: half, count: fwCount } = normalizeFullwidth(raw);
  const notes = [];
  if (fwCount) notes.push(`已将 ${fwCount} 个全角字符转半角`);
  const words = [];
  let current = [];
  let charCount = 0;
  let dotCount = 0;
  let dashCount = 0;
  const flush = () => { if (current.length) { words.push(current.join(' ')); current = []; } };
  // 按码点遍历：报错位置与字符与原文一一对应（Emoji 不再显示为 �、ß 转大写扩长也不错位）。
  const cps = [...half];
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    if (/\s/.test(ch)) { flush(); continue; }
    // 逐码点转大写：ß→SS 这类扩长在本字符内消化，不影响后续定位。
    for (const up of ch.toUpperCase()) {
      const code = MORSE_TABLE[up];
      if (!code) {
        throw new Error(`第 ${i + 1} 个字符「${ch}」没有对应的摩尔斯电码（仅支持英文字母、数字与常用标点）`);
      }
      current.push(code);
      charCount++;
      for (const s of code) { if (s === '.') dotCount++; else dashCount++; }
    }
  }
  flush();
  return { output: words.join(' / '), charCount, wordCount: words.length, dotCount, dashCount, notes };
}

// 把常见点画变体统一为 . 与 -：• · ● ． → .，− – — ― － → -
export function normalizeMorseSymbols(input) {
  return String(input ?? '')
    .replace(/[•·●.．]/g, '.')
    .replace(/[−–—―－-]/g, '-');
}

// 统计原文中会被统一转换的变体符号个数（含全角 ／ 分隔符），用于 notes 提示。
function countVariantSymbols(raw) {
  const m = raw.match(/[•·●．−–—―－／]/g);
  return m ? m.length : 0;
}

export function decodeMorse(input) {
  const raw = String(input ?? '');
  assertLength(raw);
  const inv = invisibleError(raw.trim());
  if (inv) throw inv;
  const variantCount = countVariantSymbols(raw);
  const withSlash = raw.replace(/／/g, '/');
  const normalized = normalizeMorseSymbols(withSlash).trim();
  if (!normalized) throw new Error('请输入摩尔斯电码');
  // 单词分隔：/ 或换行或两个以上连续空白；字母分隔：单个空白。
  const wordChunks = normalized.split(/\s*\/\s*|\n+|\s{2,}/).filter((w) => w.trim() !== '');
  const words = [];
  let letterCount = 0;
  for (let w = 0; w < wordChunks.length; w++) {
    const tokens = wordChunks[w].trim().split(/\s+/).filter(Boolean);
    let word = '';
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (!/^[.-]+$/.test(token)) {
        throw new Error(`第 ${w + 1} 个单词第 ${t + 1} 个符号「${token}」含非法字符（只应由 . 与 - 组成）`);
      }
      const ch = REVERSE_TABLE.get(token);
      if (!ch) {
        throw new Error(`第 ${w + 1} 个单词第 ${t + 1} 个符号「${token}」没有对应的字符`);
      }
      word += ch;
      letterCount++;
    }
    words.push(word);
  }
  if (letterCount === 0) throw new Error('未解析到任何摩尔斯符号，请检查输入');
  const notes = [];
  if (variantCount) notes.push(`已将 ${variantCount} 个变体符号（• · − － ／ 等）统一为标准 . - /`);
  return { output: words.join(' '), letterCount, wordCount: words.length, notes };
}

// 播放时序：点 1 单位、划 3 单位、符号内间隔 1、字母间隔 3、单词间隔 7（标准 PARIS 节奏）。
// 返回事件序列 [{ on: true/false, units }]，on=true 表示发声。
// 非 . - 字符直接跳过（旧版一律按划处理，非法 token 会播出错误长音）。
export function buildPlayEvents(code) {
  const normalized = normalizeMorseSymbols(String(code ?? '').replace(/／/g, '/')).trim();
  const events = [];
  if (!normalized) return events;
  const wordChunks = normalized.split(/\s*\/\s*|\n+|\s{2,}/).filter((w) => w.trim() !== '');
  wordChunks.forEach((chunk, wi) => {
    const tokens = chunk.trim().split(/\s+/).filter(Boolean)
      .map((token) => [...token].filter((s) => s === '.' || s === '-').join(''))
      .filter(Boolean);
    tokens.forEach((token, ti) => {
      [...token].forEach((sym, si) => {
        events.push({ on: true, units: sym === '.' ? 1 : 3 });
        if (si < token.length - 1) events.push({ on: false, units: 1 });
      });
      if (ti < tokens.length - 1) events.push({ on: false, units: 3 });
    });
    if (wi < wordChunks.length - 1) events.push({ on: false, units: 7 });
  });
  return events;
}

export function playDurationUnits(code) {
  return buildPlayEvents(code).reduce((sum, e) => sum + e.units, 0);
}
