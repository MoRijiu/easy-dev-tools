// 密码强度检查（纯本地）：字符集熵估算 + 模式扣分（常见弱口令 / 连续序列 / 键盘连排 /
// 重复字符 / 整体重复 / 年份日期 / 常见词），并按 zxcvbn 常用速率估算破解耗时。
// 注意：这是启发式估算，不是密码学承诺；结果只用于提示改进方向。

const COMMON_PASSWORDS = new Set([
  '123456', '123456789', '12345678', '12345', '1234567', '1234567890', '123123', '123321',
  '111111', '11111111', '000000', '666666', '7777777', '888888', '654321', '987654321',
  'password', 'password1', 'passw0rd', 'p@ssw0rd', 'qwerty', 'qwerty123', 'qwertyuiop',
  'abc123', 'abcdef', '1q2w3e', '1q2w3e4r', 'qazwsx', 'zxcvbn', 'zxcvbnm', '123qwe',
  'admin', 'admin123', 'administrator', 'root', 'letmein', 'welcome', 'login', 'guest',
  'test', 'user', 'changeme', 'default', 'secret', 'iloveyou', 'monkey', 'dragon',
  'football', 'baseball', 'sunshine', 'shadow', 'master', 'superman', 'batman',
  'charlie', 'jordan', 'michael', 'computer', 'michelle', 'jessica', 'pepper',
  'starwars', 'whatever', 'freedom', 'hello', 'world', 'pass', 'aa123456', '121212'
]);

// 常见词（小写子串命中即扣分）：多为弱口令高频组成词
const COMMON_WORDS = [
  'password', 'qwerty', 'admin', 'welcome', 'secret', 'hello', 'world', 'dragon',
  'monkey', 'master', 'sunshine', 'shadow', 'computer', 'internet', 'server',
  'login', 'guest', 'football', 'baseball', 'superman', 'batman', 'iloveyou',
  'love', 'angel', 'happy', 'flower', 'summer', 'winter', 'spring', 'autumn'
];

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const SEQUENCE_SOURCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789'
];

const SCORE_LEVELS = [
  { score: 0, label: '很弱', hint: '几乎可以被瞬间猜出' },
  { score: 1, label: '弱', hint: '字典或简单暴力即可破解' },
  { score: 2, label: '中等', hint: '能挡住随手尝试，挡不住针对性爆破' },
  { score: 3, label: '强', hint: '离线爆破也需要很久' },
  { score: 4, label: '很强', hint: '在可预见算力下难以破解' }
];

// 破解场景（次/秒），口径与 zxcvbn 一致
export const CRACK_SCENARIOS = [
  { id: 'online-throttled', label: '在线攻击（网站限速）', rate: 100 / 3600 },
  { id: 'online', label: '在线攻击（不限速）', rate: 10 },
  { id: 'offline-slow', label: '离线爆破（慢哈希 bcrypt 等）', rate: 1e4 },
  { id: 'offline-fast', label: '离线爆破（快速哈希 MD5 等）', rate: 1e10 }
];

function charClasses(chars) {
  const classes = { lower: false, upper: false, digit: false, symbol: false, other: false };
  for (const ch of chars) {
    if (ch >= 'a' && ch <= 'z') classes.lower = true;
    else if (ch >= 'A' && ch <= 'Z') classes.upper = true;
    else if (ch >= '0' && ch <= '9') classes.digit = true;
    else if (ch.charCodeAt(0) < 128) classes.symbol = true;
    else classes.other = true;
  }
  return classes;
}

function poolSizeOf(classes) {
  let pool = 0;
  if (classes.lower) pool += 26;
  if (classes.upper) pool += 26;
  if (classes.digit) pool += 10;
  if (classes.symbol) pool += 33;
  if (classes.other) pool += 100;
  return pool;
}

// 在 sources 中找长度 >= minLen 的连续（同向）子串，返回 [{text, start}]
function findRuns(text, sources, minLen) {
  const runs = [];
  const lower = text.toLowerCase();
  for (const src of sources) {
    for (const seq of [src, [...src].reverse().join('')]) {
      let i = 0;
      while (i <= lower.length - minLen) {
        // 从 i 起在 seq 中定位并尽量延长
        const ch = lower[i];
        const pos = seq.indexOf(ch);
        if (pos === -1) { i += 1; continue; }
        let len = 0;
        while (i + len < lower.length && pos + len < seq.length && lower[i + len] === seq[pos + len]) len += 1;
        if (len >= minLen) {
          runs.push({ text: text.slice(i, i + len), start: i, length: len });
          i += len;
        } else i += 1;
      }
    }
  }
  // 同一位置可能被正/反向重复命中，保留最长
  runs.sort((a, b) => a.start - b.start || b.length - a.length);
  const deduped = [];
  let coveredUntil = -1;
  for (const r of runs) {
    if (r.start >= coveredUntil) { deduped.push(r); coveredUntil = r.start + r.length; }
  }
  return deduped;
}

function findRepeatRuns(chars) {
  const runs = [];
  let i = 0;
  while (i < chars.length) {
    let len = 1;
    while (i + len < chars.length && chars[i + len] === chars[i]) len += 1;
    if (len >= 3) runs.push({ text: chars.slice(i, i + len).join(''), start: i, length: len });
    i += len;
  }
  return runs;
}

// 整体是否为某单元的重复（如 abcabc / 121212 / aaaa 走重复字符另算）
function findWholeRepetition(chars) {
  const n = chars.length;
  for (let unit = 1; unit <= n / 2; unit += 1) {
    if (n % unit !== 0) continue;
    const head = chars.slice(0, unit).join('');
    let ok = true;
    for (let i = unit; i < n; i += unit) {
      if (chars.slice(i, i + unit).join('') !== head) { ok = false; break; }
    }
    if (ok) return { unit: head, repeats: n / unit };
  }
  return null;
}

export function formatCrackSeconds(seconds) {
  if (!Number.isFinite(seconds)) return '几乎不可能';
  if (seconds < 1) return '不到 1 秒';
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`;
  if (seconds < 86400 * 365) return `${Math.round(seconds / 86400)} 天`;
  const years = seconds / (86400 * 365);
  if (years < 10000) return `${Math.round(years).toLocaleString('en-US')} 年`;
  if (years < 1e8) return `${(years / 1e4).toFixed(1).replace(/\.0$/, '')} 万年`;
  if (years < 1e12) return `${(years / 1e8).toFixed(1).replace(/\.0$/, '')} 亿年`;
  return '几乎不可能';
}

export function analyzePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('请输入要检查的密码');
  }
  const chars = [...password];
  const length = chars.length;
  const classes = charClasses(chars);
  const classCount = Object.values(classes).filter(Boolean).length;
  const poolSize = poolSizeOf(classes);
  const rawEntropy = length * Math.log2(poolSize);
  const findings = [];
  let penalty = 0;

  // 常见弱口令：整体命中，或去掉尾部数字/符号后命中
  const lowered = password.toLowerCase();
  const stripped = lowered.replace(/[0-9!@#$%^&*._-]+$/, '');
  const isCommon = COMMON_PASSWORDS.has(lowered) || (stripped.length >= 4 && COMMON_PASSWORDS.has(stripped));
  if (isCommon) {
    findings.push({ type: 'common', label: '常见弱口令', detail: '在公开弱口令字典中，爆破时最先被尝试' });
  }

  // 常见词子串
  const hitWords = COMMON_WORDS.filter((w) => lowered.includes(w) && !(isCommon && w === lowered));
  if (hitWords.length > 0) {
    penalty += 8 * hitWords.length;
    findings.push({ type: 'word', label: '包含常见词', detail: hitWords.join('、') });
  }

  // 连续序列（字母/数字，正反向）
  const sequences = findRuns(password, SEQUENCE_SOURCES, 3);
  for (const run of sequences) {
    penalty += (run.length - 2) * 3;
    findings.push({ type: 'sequence', label: '连续序列', detail: `「${run.text}」是连续字符` });
  }

  // 键盘连排（字母行；数字行已被序列覆盖，只查字母行）
  const keyboardRuns = findRuns(password, KEYBOARD_ROWS.slice(0, 3), 3)
    .filter((r) => !sequences.some((s) => r.start >= s.start && r.start < s.start + s.length));
  for (const run of keyboardRuns) {
    penalty += (run.length - 2) * 3;
    findings.push({ type: 'keyboard', label: '键盘连排', detail: `「${run.text}」是键盘上相邻按键` });
  }

  // 重复字符
  const repeatRuns = findRepeatRuns(chars);
  for (const run of repeatRuns) {
    penalty += (run.length - 2) * 2;
    findings.push({ type: 'repeat', label: '字符重复', detail: `「${run.text}」同一字符连写 ${run.length} 次` });
  }

  // 年份 / 日期
  const yearMatch = password.match(/(?:19|20)\d{2}/);
  if (yearMatch) {
    penalty += 6;
    findings.push({ type: 'year', label: '包含年份', detail: `「${yearMatch[0]}」像年份，生日与年份是常见猜测目标` });
  }

  // 整体重复
  const repetition = findWholeRepetition(chars);
  let effectiveEntropy = Math.max(0, rawEntropy - penalty);
  if (repetition && repetition.unit.length >= 1 && repetition.repeats >= 2 && length >= 4) {
    const unitEntropy = repetition.unit.length * Math.log2(poolSize) + Math.log2(repetition.repeats);
    if (unitEntropy < effectiveEntropy) effectiveEntropy = unitEntropy;
    findings.push({ type: 'repetition', label: '整体重复', detail: `整体是「${repetition.unit}」重复 ${repetition.repeats} 次，实际组合数只相当于单元本身` });
  }
  if (isCommon) effectiveEntropy = Math.min(effectiveEntropy, 8);
  effectiveEntropy = Math.round(effectiveEntropy * 10) / 10;

  // 评分：按有效熵分档
  let score;
  if (effectiveEntropy < 28) score = 0;
  else if (effectiveEntropy < 40) score = 1;
  else if (effectiveEntropy < 60) score = 2;
  else if (effectiveEntropy < 80) score = 3;
  else score = 4;
  if (isCommon) score = 0;

  // 破解耗时：平均猜测次数 ≈ 2^(熵-1)
  const guesses = Math.pow(2, Math.max(0, effectiveEntropy - 1));
  const crackTimes = CRACK_SCENARIOS.map((s) => ({
    ...s,
    seconds: guesses / s.rate,
    text: formatCrackSeconds(guesses / s.rate)
  }));

  // 改进建议
  const suggestions = [];
  if (length < 12) suggestions.push(`长度只有 ${length} 位，建议至少 12 位（长度对强度的贡献最大）`);
  if (!classes.lower) suggestions.push('加入小写字母');
  if (!classes.upper) suggestions.push('加入大写字母');
  if (!classes.digit) suggestions.push('加入数字');
  if (!classes.symbol && !classes.other) suggestions.push('加入符号（如 !@#$%）可明显扩大字符集');
  if (classCount === 1) suggestions.push('当前只有一种字符类型，混合大小写、数字与符号更稳妥');
  if (isCommon) suggestions.push('这是公开弱口令字典里的高频密码，务必整段更换而不是只加后缀');
  if (sequences.length > 0) suggestions.push('避免 abc、123、cba 这类连续序列');
  if (keyboardRuns.length > 0) suggestions.push('避免 qwerty、asdf 这类键盘连排');
  if (repeatRuns.length > 0) suggestions.push('避免同一字符连写三次以上');
  if (repetition) suggestions.push('不要把同一段重复多遍当长密码');
  if (yearMatch) suggestions.push('避免在密码里放年份、生日等公开信息');
  if (hitWords.length > 0) suggestions.push('常见单词容易被字典攻击，改用无意义组合或多词短语加分隔符');
  if (suggestions.length === 0) suggestions.push('结构不错；更重要的是每个网站用不同密码，并开启两步验证');

  return {
    length,
    classes,
    classCount,
    poolSize,
    rawEntropy: Math.round(rawEntropy * 10) / 10,
    penalty: Math.round(penalty * 10) / 10,
    effectiveEntropy,
    score,
    level: SCORE_LEVELS[score],
    findings,
    suggestions,
    crackTimes
  };
}

export function buildStrengthSummary(result, passwordLength) {
  if (!result) return '';
  const lines = [
    `密码强度：${result.level.label}（${result.score}/4）`,
    `长度：${passwordLength} 位 · 字符集 ${result.poolSize} · 有效熵约 ${result.effectiveEntropy} 位`,
    `离线快速哈希爆破平均耗时：${result.crackTimes[3].text}`
  ];
  if (result.findings.length > 0) {
    lines.push(`发现问题：${result.findings.map((f) => f.label).join('、')}`);
  }
  return lines.join('\n');
}
