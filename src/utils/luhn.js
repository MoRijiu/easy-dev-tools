// Luhn 校验：纯本地实现（ISO/IEC 7812-1 模 10 算法）。
// 用途：银行卡号、IMEI、部分会员卡/条码号的末位校验；只能发现抄写错误，不能证明号码真实存在或可支付。
// 输入容错：忽略空格与连字符（常见分组写法），其余非数字字符定位报错。

export function cleanNumber(raw) {
  const s = String(raw ?? '');
  if (!s.trim()) return { ok: false, error: '输入为空，请输入数字号码' };
  let digits = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ' || ch === '-' || ch === '\t') continue;
    if (ch >= '0' && ch <= '9') { digits += ch; continue; }
    return { ok: false, error: `第 ${i + 1} 个字符「${ch}」不是数字（仅允许数字、空格与连字符分组）` };
  }
  if (digits.length < 2) return { ok: false, error: '号码至少需要 2 位数字（含校验位）' };
  if (digits.length > 32) return { ok: false, error: `号码共 ${digits.length} 位，超过 32 位上限` };
  return { ok: true, digits };
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
  const cleaned = cleanNumber(payload);
  if (!cleaned.ok) return cleaned;
  const digits = cleaned.digits;
  // 在末尾占位 0 后按完整号码规则求和，校验位 = (10 - sum % 10) % 10
  const { sum } = luhnSteps(digits + '0');
  const check = (10 - (sum % 10)) % 10;
  return { ok: true, digits, checkDigit: String(check), complete: digits + String(check) };
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
  if ((len === 16 || len === 19) && (p4 === 6011 || p2 === 65 || (p3 >= 644 && p3 <= 649))) out.push('Discover（发现卡）');
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
  return {
    ok: true,
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

// 多行批量校验：每行一个号码，空行跳过
export function validateBatch(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const results = [];
  let validCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = analyzeNumber(lines[i]);
    if (!r.ok) results.push({ line: i + 1, raw: lines[i].trim(), ok: false, error: r.error });
    else {
      if (r.valid) validCount += 1;
      results.push({ line: i + 1, raw: lines[i].trim(), ok: true, valid: r.valid, digits: r.digits, formatted: r.formatted, length: r.length, issuers: r.issuers });
    }
  }
  if (!results.length) return { ok: false, error: '输入为空，请每行输入一个号码' };
  return { ok: true, results, total: results.length, validCount, invalidCount: results.length - validCount };
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
  return lines.join('\n');
}
