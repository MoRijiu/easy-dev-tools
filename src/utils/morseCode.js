// 摩尔斯电码编解码：纯本地实现（ITU 国际摩尔斯电码）。
// 编码：字母间一个空格、单词间用 / 分隔；解码兼容 / 、换行、两个以上空格作单词分隔，
// 并容忍 • · − – 等点画变体符号。仅支持字母、数字与常用标点，中文等字符明确报错定位。
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

export function encodeMorse(text) {
  const raw = String(text ?? '');
  if (raw.length > MAX_INPUT) throw new Error(`输入过长：最多 ${MAX_INPUT} 个字符，收到 ${raw.length} 个`);
  const upper = raw.toUpperCase();
  const words = [];
  let current = [];
  let charCount = 0;
  let dotCount = 0;
  let dashCount = 0;
  const flush = () => { if (current.length) { words.push(current.join(' ')); current = []; } };
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    if (/\s/.test(ch)) { flush(); continue; }
    const code = MORSE_TABLE[ch];
    if (!code) {
      throw new Error(`第 ${i + 1} 个字符「${raw[i]}」没有对应的摩尔斯电码（仅支持英文字母、数字与常用标点）`);
    }
    current.push(code);
    charCount++;
    for (const s of code) { if (s === '.') dotCount++; else dashCount++; }
  }
  flush();
  return { output: words.join(' / '), charCount, wordCount: words.length, dotCount, dashCount };
}

// 把常见点画变体统一为 . 与 -：• · ● → .，− – — ― → -
export function normalizeMorseSymbols(input) {
  return String(input ?? '')
    .replace(/[•·●.．]/g, '.')
    .replace(/[−–—―-]/g, '-');
}

export function decodeMorse(input) {
  const raw = String(input ?? '');
  if (raw.length > MAX_INPUT) throw new Error(`输入过长：最多 ${MAX_INPUT} 个字符，收到 ${raw.length} 个`);
  const normalized = normalizeMorseSymbols(raw).trim();
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
  return { output: words.join(' '), letterCount, wordCount: words.length };
}

// 播放时序：点 1 单位、划 3 单位、符号内间隔 1、字母间隔 3、单词间隔 7（标准 PARIS 节奏）。
// 返回事件序列 [{ on: true/false, units }]，on=true 表示发声。
export function buildPlayEvents(code) {
  const normalized = normalizeMorseSymbols(code).trim();
  const events = [];
  if (!normalized) return events;
  const wordChunks = normalized.split(/\s*\/\s*|\n+|\s{2,}/).filter((w) => w.trim() !== '');
  wordChunks.forEach((chunk, wi) => {
    const tokens = chunk.trim().split(/\s+/).filter(Boolean);
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
