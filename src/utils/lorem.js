// 占位文本生成：纯本地。数量严格校验（不再靠 input min/max、手输越界或小数被循环静默截断）；
// 选词用 Web Crypto 拒绝采样无偏随机（复用 randomNumber 的 randomBigIntBelow），且同一句内不连重复词；
// 「以 Lorem ipsum 开头」按类型正确实现（旧版对单词类型用 indexOf('. ') 截断会吞掉首字符）；
// 统计按 Unicode 码点 + UTF-8 字节计（旧版 String.length 把生僻字/Emoji 算 2）。
import { randomBigIntBelow } from './randomNumber.js';

export const COUNT_LIMITS = { paragraphs: 50, sentences: 200, words: 1000 };
export const CANONICAL_OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const CANONICAL_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];

export const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'vivamus', 'vestibulum',
  'sagittis', 'sapien', 'cum', 'sociis', 'natoque', 'penatibus', 'magnis', 'dis',
  'parturient', 'montes', 'nascetur', 'ridiculus', 'mus', 'donec', 'quam', 'felis',
  'ultricies', 'nec', 'pellentesque', 'eu', 'pretium', 'sem', 'massa', 'pede',
  'justo', 'fringilla'
];

export const CHINESE_PHRASES = [
  '天地玄黄', '宇宙洪荒', '日月盈昃', '辰宿列张', '寒来暑往', '秋收冬藏',
  '闰余成岁', '律吕调阳', '云腾致雨', '露结为霜', '金生丽水', '玉出昆冈',
  '剑号巨阙', '珠称夜光', '果珍李柰', '菜重芥姜', '海咸河淡', '鳞潜羽翔',
  '龙师火帝', '鸟官人皇', '始制文字', '乃服衣裳', '推位让国', '有虞陶唐',
  '吊民伐罪', '周发殷汤', '坐朝问道', '垂拱平章', '爱育黎首', '臣伏戎羌',
  '遐迩一体', '率宾归王', '鸣凤在竹', '白驹食场', '化被草木', '赖及万方'
];

export const HIPSTER_WORDS = [
  'artisan', 'authentic', 'biodiesel', 'brooklyn', 'cardigan', 'craft', 'crucifix',
  'distillery', 'dreamcatcher', 'ethical', 'fixie', 'flannel', 'gastropub', 'gentrify',
  'hashtag', 'helvetica', 'hoodie', 'intelligentsia', 'irony', 'jean', 'kale', 'keytar',
  'kickstarter', 'kinfolk', 'knausgaard', 'lomo', 'marfa', 'meditation', 'microdosing',
  'mustache', 'neutra', 'organic', 'paleo', 'pitchfork', 'polaroid', 'portland',
  'poutine', 'raw', 'selvage', 'semiotics', 'skateboard', 'slow', 'snackwave',
  'sustainable', 'synth', 'tacos', 'tattooed', 'taxidermy', 'tofu', 'trust',
  'tumblr', 'twee', 'typewriter', 'umami', 'vegan', 'vexillologist', 'vinyl'
];

export const WORD_LISTS = { lorem: LOREM_WORDS, chinese: CHINESE_PHRASES, hipster: HIPSTER_WORDS };
export const TYPE_LABELS = { paragraphs: '段落', sentences: '句子', words: '单词' };

export function parseCount(raw, type) {
  if (!Object.prototype.hasOwnProperty.call(COUNT_LIMITS, type)) {
    throw new Error(`未知生成类型「${type}」`);
  }
  const s = String(raw ?? '').trim();
  if (s === '') throw new Error('请输入生成数量');
  if (!/^\d+$/.test(s)) throw new Error(`生成数量必须是正整数，收到「${s}」`);
  const n = Number(s);
  const max = COUNT_LIMITS[type];
  if (n < 1) throw new Error('生成数量至少为 1');
  if (n > max) throw new Error(`${TYPE_LABELS[type]}数量最多为 ${max}，收到 ${n}`);
  return n;
}

function makeRandInt(randomBytes) {
  if (!randomBytes) {
    return (limit) => Number(randomBigIntBelow(BigInt(limit)));
  }
  return (limit) => Number(randomBigIntBelow(BigInt(limit), randomBytes));
}

function pickWord(words, randInt, prev) {
  if (words.length === 1) return words[0];
  let w = words[randInt(words.length)];
  let guard = 0;
  while (w === prev && guard++ < 10) w = words[randInt(words.length)];
  return w;
}

function makeSentence(style, words, randInt) {
  if (style === 'chinese') {
    const n = 3 + randInt(4); // 3–6 个四字短语
    const parts = [];
    let prev = null;
    for (let i = 0; i < n; i++) { const w = pickWord(words, randInt, prev); parts.push(w); prev = w; }
    return parts.join('') + '。';
  }
  const n = 5 + randInt(10); // 5–14 词
  const parts = [];
  let prev = null;
  for (let i = 0; i < n; i++) { const w = pickWord(words, randInt, prev); parts.push(w); prev = w; }
  const s = parts.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function makeParagraph(style, words, randInt) {
  const n = 3 + randInt(4); // 3–6 句
  const sentences = [];
  for (let i = 0; i < n; i++) sentences.push(makeSentence(style, words, randInt));
  return sentences.join(style === 'chinese' ? '' : ' ');
}

export function analyzeText(text, style) {
  if (!text) return { paragraphs: 0, sentences: 0, words: 0, chars: 0, bytes: 0 };
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim() !== '').length;
  const sentences = (text.match(/[。.!?！？]/g) || []).length;
  let words;
  if (style === 'chinese') {
    words = [...text.replace(/[\s。，、；：！？·""''「」『』（）]/g, '')].length;
  } else {
    words = text.split(/\s+/).filter((w) => w !== '').length;
  }
  return {
    paragraphs,
    sentences,
    words,
    chars: [...text].length,
    bytes: new TextEncoder().encode(text).length
  };
}

export function generateLorem(opts = {}, randomBytes) {
  const style = WORD_LISTS[opts.style] ? opts.style : 'lorem';
  const type = Object.prototype.hasOwnProperty.call(COUNT_LIMITS, opts.type) ? opts.type : 'paragraphs';
  const count = parseCount(opts.count, type);
  const words = WORD_LISTS[style];
  const randInt = makeRandInt(randomBytes);
  const startWithLorem = !!opts.startWithLorem && style === 'lorem';

  let text;
  if (type === 'words') {
    const out = [];
    if (startWithLorem) {
      for (const w of CANONICAL_WORDS) { if (out.length < count) out.push(w); }
    }
    let prev = out.length ? out[out.length - 1] : null;
    while (out.length < count) { const w = pickWord(words, randInt, prev); out.push(w); prev = w; }
    text = out.join(style === 'chinese' ? '' : ' ');
  } else if (type === 'sentences') {
    const sentences = [];
    for (let i = 0; i < count; i++) sentences.push(makeSentence(style, words, randInt));
    if (startWithLorem) sentences[0] = CANONICAL_OPENING;
    text = sentences.join(style === 'chinese' ? '' : ' ');
  } else {
    const paragraphs = [];
    for (let i = 0; i < count; i++) paragraphs.push(makeParagraph(style, words, randInt));
    if (startWithLorem) {
      const first = paragraphs[0];
      const idx = first.indexOf('. ');
      paragraphs[0] = idx >= 0 ? CANONICAL_OPENING + first.slice(idx + 1) : CANONICAL_OPENING;
    }
    text = paragraphs.join('\n\n');
  }
  return { text, stats: analyzeText(text, style) };
}
