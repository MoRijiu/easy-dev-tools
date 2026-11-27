// Luhn 校验：纯本地实现（ISO/IEC 7812-1 模 10 算法）。
// 用途：银行卡号、IMEI、部分会员卡/条码号的末位校验；只能发现抄写错误，不能证明号码真实存在或可支付。
// 输入容错：全角数字转半角；空格/换行/不换行空格/全角空格与连字符类作分隔，其余非数字字符按码点定位报错。

const MAX_INPUT_CHARS = 100000;
// 分隔符：常见分组写法。空格/制表/换行/不换行空格/全角空格作分隔，
// 连字符与粘贴常见的 en/em 横线也作分隔。
const SEPARATORS = new Set([' ', '\t', '\n', '\r', '\u00A0', '\u3000', '-', '\u2013', '\u2014']);

function displayChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp <= 0x20 || cp === 0x7f || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff) {
    return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return ch;
}

// 归一：全角数字转半角（记 notes），其余原样；按 Unicode 码点遍历，报错位置与字符与原文一致
export function normalizeLuhnInput(raw) {
  const notes = [];
  let fullwidth = 0;
  let out = '';
  for (const ch of String(raw ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xff10 && cp <= 0xff19) { out += String.fromCharCode(cp - 0xff10 + 48); fullwidth += 1; continue; }
    out += ch;
  }
  if (fullwidth) notes.push(`已将 ${fullwidth} 个全角数字按半角数字处理`);
  return { text: out, notes };
}

export function cleanNumber(raw, options = {}) {
  const minDigits = options.minDigits ?? 2;
  const maxDigits = options.maxDigits ?? 32;
  const subject = options.subject ?? '号码';
  const rawStr = String(raw ?? '');
  if ([...rawStr].length > MAX_INPUT_CHARS) {
    return { ok: false, error: `输入共 ${[...rawStr].length} 个字符，超过 ${MAX_INPUT_CHARS} 字符上限` };
  }
  if (!rawStr.trim()) return { ok: false, error: '输入为空，请输入数字号码' };
  const { text, notes } = normalizeLuhnInput(rawStr);
  let digits = '';
  let pos = 0;
  for (const ch of text) {
    pos += 1;
    if (ch === '\uFEFF' && pos === 1) continue;
    if (SEPARATORS.has(ch)) continue;
    if (ch >= '0' && ch <= '9') { digits += ch; continue; }
    return { ok: false, error: `第 ${pos} 个字符「${displayChar(ch)}」不是数字（仅允许数字、空格与连字符分组）` };
  }
  if (digits.length < minDigits) {
    return { ok: false, error: minDigits === 1 ? `${subject}至少需要 1 位数字` : `${subject}至少需要 ${minDigits} 位数字（含校验位）` };
  }
  if (digits.length > maxDigits) return { ok: false, error: `${subject}共 ${digits.length} 位，超过 ${maxDigits} 位上限` };
  return { ok: true, digits, notes };
}

// 从右往左：校验位（最右）不翻倍，其后隔一位翻倍，翻倍大于 9 减 9，求和
export function luhnSteps(digits) {
  const steps = [];
  const n = digits.length;
  let sum = 0;
  for (let pos = 0; pos < n; pos++) {
    const digit = digits.charCodeAt(n - 1 - pos) - 48;
    const doubled = pos % 2 === 1;
    const value = doubled ? (digit * 2 > 9 ? digit * 2 - 9 : digit * 2) : digit;
    sum += value;
    steps.push({ index: n - pos, digit, doubled, value, isCheck: pos === 0 });
  }
  return { steps: steps.reverse(), sum };
}

export function isValidLuhn(digits) {
  return luhnSteps(digits).sum % 10 === 0;
}

// 给定不含校验位的载荷数字，算出应追加的校验位
export function computeCheckDigit(payload) {
  // 载荷不含校验位：1 位即可算，完整号码上限 32 位故载荷上限 31 位
  const cleaned = cleanNumber(payload, { minDigits: 1, maxDigits: 31, subject: '载荷号码' });
  if (!cleaned.ok) return cleaned;
  const digits = cleaned.digits;
  // 在末尾占位 0 后按完整号码规则求和，校验位 = (10 - sum % 10) % 10
  const { sum } = luhnSteps(digits + '0');
  const check = (10 - (sum % 10)) % 10;
  return { ok: true, digits, checkDigit: String(check), complete: digits + String(check), notes: cleaned.notes || [] };
}

// 完整号码里，末位「本应是」多少（载荷不变时）
export function expectedCheckDigit(digits) {
  if (!digits || digits.length < 2) return null;
  return computeCheckDigit(digits.slice(0, -1)).checkDigit;
}

export function identifyIssuer(digits) {
  const len = digits.length;
  const out = [];
  const p2 = Number(digits.slice(0, 2));
  const p3 = Number(digits.slice(0, 3));
  const p4 = Number(digits.slice(0, 4));
  if (digits[0] === '4' && [13, 16, 19].includes(len)) out.push('Visa（维萨）');
  if (len === 16 && ((p2 >= 51 && p2 <= 55) || (p4 >= 2221 && p4 <= 2720))) out.push('Mastercard（万事达）');
  if (len === 15 && (p2 === 34 || p2 === 37)) out.push('American Express（美国运通）');
  const p6 = Number(digits.slice(0, 6));
  if ((len === 16 || len === 19) && (p4 === 6011 || p2 === 65 || (p3 >= 644 && p3 <= 649) || (p6 >= 622126 && p6 <= 622925))) out.push('Discover（发现卡）');
  if (len === 14 && ((p3 >= 300 && p3 <= 305) || p2 === 36 || p2 === 38 || p2 === 39)) out.push('Diners Club（大莱卡）');
  if (len >= 16 && len <= 19 && p4 >= 3528 && p4 <= 3589) out.push('JCB');
  if (len >= 16 && len <= 19 && p2 === 62) out.push('中国银联 UnionPay');
  if (len === 15) out.push('可能为 IMEI（移动设备识别码，15 位）');
  return out;
}

export function formatGroups(digits) {
  // Amex/Diners 常见 4-6-5 / 4-6-4 分组，其余每 4 位一组
  if (digits.length === 15) return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10)].join(' ');
  if (digits.length === 14) return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10)].join(' ');
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
}

export function analyzeNumber(raw) {
  const cleaned = cleanNumber(raw);
  if (!cleaned.ok) return cleaned;
  const { digits } = cleaned;
  const { steps, sum } = luhnSteps(digits);
  const valid = sum % 10 === 0;
  const warnings = [];
  if (/^(\d)\1+$/.test(digits)) warnings.push('各位数字完全相同，通常是占位或测试号码，即使校验通过也不代表真实可用');
  return {
    ok: true,
    notes: cleaned.notes || [],
    warnings,
    digits,
    formatted: formatGroups(digits),
    length: digits.length,
    valid,
    sum,
    mod: sum % 10,
    checkDigit: digits[digits.length - 1],
    expectedCheckDigit: expectedCheckDigit(digits),
    issuers: identifyIssuer(digits),
    steps
  };
}

// 多行批量校验：每行一个号码，空行跳过；孤 CR 也分行；格式错误与 Luhn 不通过分开计数
export function validateBatch(text) {
  const rawText = String(text ?? '');
  if ([...rawText].length > MAX_INPUT_CHARS) {
    return { ok: false, error: `输入共 ${[...rawText].length} 个字符，超过 ${MAX_INPUT_CHARS} 字符上限` };
  }
  const lines = rawText.split(/\r\n|\r|\n/);
  if (lines.length > 10000) return { ok: false, error: `共 ${lines.length} 行，超过 10000 行上限` };
  const results = [];
  let validCount = 0;
  let invalidCount = 0;
  let errorCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = analyzeNumber(lines[i]);
    if (!r.ok) { errorCount += 1; results.push({ line: i + 1, raw: lines[i].trim(), ok: false, error: r.error }); }
    else {
      if (r.valid) validCount += 1; else invalidCount += 1;
      results.push({ line: i + 1, raw: lines[i].trim(), ok: true, valid: r.valid, digits: r.digits, formatted: r.formatted, length: r.length, issuers: r.issuers });
    }
  }
  if (!results.length) return { ok: false, error: '输入为空，请每行输入一个号码' };
  return { ok: true, results, total: results.length, validCount, invalidCount, errorCount };
}

export function buildSummary(r) {
  if (!r || !r.ok) return '';
  const lines = [
    `号码：${r.formatted}`,
    `位数：${r.length} 位`,
    `Luhn 校验：${r.valid ? '通过' : '不通过'}（加权和 ${r.sum}，模 10 = ${r.mod}）`,
    `校验位：${r.checkDigit}${r.valid ? '' : `（按当前载荷应为 ${r.expectedCheckDigit}）`}`
  ];
  if (r.issuers && r.issuers.length) lines.push(`可能类型：${r.issuers.join('、')}`);
  if (r.warnings && r.warnings.length) lines.push(`提示：${r.warnings.join('；')}`);
  return lines.join('\n');
}
