// 二维码内容识别（纯本地）：把解码出的原始文本分类并拆出结构化字段
// 支持 URL / WiFi（WIFI:）/ 电话（tel:）/ 邮件（mailto: 与 MATMSG:）/ 短信（sms:/smsto:）/
// 地理位置（geo:）/ 名片（vCard 与 MECARD）/ 纯文本

function unescapeWifiValue(v) {
  // WIFI 格式里 \ 转义 ; , : " \
  return v.replace(/\\(.)/g, '$1');
}

function parseWifi(body) {
  const fields = {};
  // 按未被转义的 ; 分段，每段 KEY:VALUE
  const parts = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) { cur += ch + body[i + 1]; i++; continue; }
    if (ch === ';') { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).toUpperCase();
    fields[key] = unescapeWifiValue(part.slice(idx + 1));
  }
  const authMap = { WEP: 'WEP', WPA: 'WPA/WPA2', WPA2: 'WPA2', WPA3: 'WPA3', SAE: 'WPA3（SAE）', WPA2WPA3: 'WPA2/WPA3', NOPASS: '开放网络（无密码）' };
  const rows = [];
  if (fields.S !== undefined) rows.push({ label: '网络名称（SSID）', value: fields.S });
  if (fields.T) rows.push({ label: '加密方式', value: authMap[fields.T.toUpperCase()] || fields.T });
  if (fields.P !== undefined) rows.push({ label: '密码', value: fields.P });
  if (fields.H) rows.push({ label: '隐藏网络', value: /^(true|1)$/i.test(fields.H) ? '是' : '否' });
  return { ssid: fields.S || '', rows };
}

// 按未被反斜杠转义的 ; 分段（MECARD / MATMSG 与 WIFI 共用同一转义规则）
function splitEscaped(body) {
  const parts = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) { cur += ch + body[i + 1]; i++; continue; }
    if (ch === ';') { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function unescapeCardValue(v) {
  return String(v).replace(/\\n/gi, '\n').replace(/\\(.)/g, '$1');
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function classifyQrContent(text) {
  const raw = String(text ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return { type: 'empty', typeName: '空内容', rows: [], link: '', warnings: [] };

  // WiFi
  const wifiMatch = /^WIFI:/i.exec(trimmed);
  if (wifiMatch) {
    const { ssid, rows } = parseWifi(trimmed.slice(wifiMatch[0].length));
    const warnings = [];
    if (!ssid) warnings.push('这条 WiFi 配置没有写网络名称（SSID），可能扫错了码或生成不规范');
    return { type: 'wifi', typeName: 'WiFi 网络', rows, link: '', warnings, summary: ssid ? `WiFi：${ssid}` : 'WiFi 配置' };
  }

  // vCard / MECARD
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const rows = [];
    let name = '';
    let nFallback = '';
    // 折行展开：以空格/Tab 开头的续行并入上一行
    const lines = [];
    for (const rawLine of trimmed.split(/\r\n|\r|\n/)) {
      if (/^[ \t]/.test(rawLine) && lines.length) lines[lines.length - 1] += rawLine.slice(1);
      else lines.push(rawLine);
    }
    for (const line of lines) {
      const m = /^([^;:]+)(?:;[^:]*)?:(.*)$/.exec(line.trim());
      if (!m) continue;
      const key = m[1].toUpperCase(); const value = unescapeCardValue(m[2].trim());
      if (key === 'FN') { name = value; rows.push({ label: '姓名', value }); }
      else if (key === 'N') { nFallback = value.split(';').filter(Boolean).reverse().join(' '); }
      else if (key === 'ORG') rows.push({ label: '单位', value });
      else if (key === 'TITLE') rows.push({ label: '职位', value });
      else if (key === 'TEL') rows.push({ label: '电话', value });
      else if (key === 'EMAIL') rows.push({ label: '邮箱', value });
      else if (key === 'URL') rows.push({ label: '网址', value });
      else if (key === 'ADR') rows.push({ label: '地址', value: value.split(';').filter(Boolean).join(' ') });
      else if (key === 'NOTE') rows.push({ label: '备注', value });
    }
    if (!name && nFallback) { name = nFallback; rows.unshift({ label: '姓名', value: nFallback }); }
    return { type: 'vcard', typeName: '名片（vCard）', rows, link: '', warnings: [], summary: name ? `名片：${name}` : 'vCard 名片' };
  }
  if (/^MECARD:/i.test(trimmed)) {
    const rows = [];
    let name = '';
    for (const part of splitEscaped(trimmed.slice(7))) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).toUpperCase(); const value = unescapeCardValue(part.slice(idx + 1));
      if (key === 'N') { name = value; rows.push({ label: '姓名', value }); }
      else if (key === 'TEL') rows.push({ label: '电话', value });
      else if (key === 'EMAIL') rows.push({ label: '邮箱', value });
      else if (key === 'ORG') rows.push({ label: '单位', value });
      else if (key === 'URL') rows.push({ label: '网址', value });
      else if (key === 'ADR') rows.push({ label: '地址', value });
      else if (key === 'NOTE') rows.push({ label: '备注', value });
      else if (key === 'BDAY') rows.push({ label: '生日', value });
    }
    return { type: 'vcard', typeName: '名片（MECARD）', rows, link: '', warnings: [], summary: name ? `名片：${name}` : 'MECARD 名片' };
  }

  // 邮件 MATMSG
  if (/^MATMSG:/i.test(trimmed)) {
    const rows = [];
    const matParts = splitEscaped(trimmed.slice(7));
    for (let pi = 0; pi < matParts.length; pi++) {
      const part = matParts[pi];
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).toUpperCase();
      // BODY 通常是最后一项且正文常含未转义的 ; 与 :，其余分段并回正文
      let value = key === 'BODY'
        ? unescapeCardValue([part.slice(idx + 1), ...matParts.slice(pi + 1)].join(';'))
        : unescapeCardValue(part.slice(idx + 1));
      if (key === 'BODY' && trimmed.endsWith(';;') && value.endsWith(';')) value = value.slice(0, -1);
      if (key === 'TO') rows.push({ label: '收件人', value });
      else if (key === 'SUB') rows.push({ label: '主题', value });
      else if (key === 'BODY') { rows.push({ label: '正文', value }); break; }
    }
    const to = rows.find(r => r.label === '收件人');
    return { type: 'email', typeName: '邮件（MATMSG）', rows, link: to ? `mailto:${to.value}` : '', warnings: [], summary: to ? `邮件：${to.value}` : '邮件' };
  }

  // mailto:
  if (/^mailto:/i.test(trimmed)) {
    const rest = trimmed.slice(7);
    const [addr, query] = rest.split('?');
    const rows = [{ label: '收件人', value: safeDecode(addr) }];
    if (query) {
      const params = new URLSearchParams(query);
      if (params.get('subject')) rows.push({ label: '主题', value: params.get('subject') });
      if (params.get('body')) rows.push({ label: '正文', value: params.get('body') });
      if (params.get('cc')) rows.push({ label: '抄送', value: params.get('cc') });
    }
    return { type: 'email', typeName: '邮件链接', rows, link: trimmed, warnings: [], summary: `邮件：${safeDecode(addr)}` };
  }

  // 电话
  if (/^tel:/i.test(trimmed)) {
    const number = trimmed.slice(4);
    const warnings = [];
    if (!number) warnings.push('号码为空，这条电话二维码不完整');
    else if (/[^+\d*#;,().\-\s]/.test(number)) warnings.push('号码里含有电话号码不常见的字符，请核对后再拨打');
    return { type: 'phone', typeName: '电话号码', rows: [{ label: '号码', value: number }], link: trimmed, warnings, summary: `电话：${number}` };
  }

  // 短信
  const smsMatch = /^(sms|smsto):/i.exec(trimmed);
  if (smsMatch) {
    let rest = trimmed.slice(smsMatch[0].length);
    let number = '';
    let bodyText = '';
    const qIdx = rest.search(/[?&]/);
    if (qIdx >= 0) {
      // sms:号码?body=内容 或 iOS 的 sms:号码&body=内容
      number = rest.slice(0, qIdx);
      const params = new URLSearchParams(rest.slice(qIdx + 1));
      bodyText = params.get('body') || '';
      rest = number;
    } else if (smsMatch[1].toLowerCase() === 'smsto') {
      // SMSTO:号码:正文 —— 正文可含冒号，只切第一个
      const cIdx = rest.indexOf(':');
      if (cIdx >= 0) { number = rest.slice(0, cIdx); bodyText = rest.slice(cIdx + 1); }
      else number = rest;
    } else {
      // sms:号码:正文（部分生成器写法）
      const cIdx = rest.indexOf(':');
      if (cIdx >= 0) { number = rest.slice(0, cIdx); bodyText = rest.slice(cIdx + 1); }
      else number = rest;
    }
    const rows = [{ label: '号码', value: number }];
    if (bodyText) rows.push({ label: '短信内容', value: safeDecode(bodyText) });
    const warnings = number ? [] : ['号码为空，这条短信二维码不完整'];
    return { type: 'sms', typeName: '短信', rows, link: `sms:${number}`, warnings, summary: `短信：${number}` };
  }

  // 地理位置
  if (/^geo:/i.test(trimmed)) {
    const warnings = [];
    const afterScheme = trimmed.slice(4);
    const [mainPart, queryPart] = afterScheme.split('?');
    const segments = mainPart.split(';');
    const coords = segments[0].split(',');
    const lat = Number(coords[0]); const lon = Number(coords[1]);
    const rows = [];
    if (coords[0]) rows.push({ label: '纬度', value: coords[0] });
    if (coords[1]) rows.push({ label: '经度', value: coords[1] });
    if (coords[2]) rows.push({ label: '海拔（米）', value: coords[2] });
    for (const seg of segments.slice(1)) {
      const um = /^u=(.+)$/i.exec(seg.trim());
      if (um) rows.push({ label: '定位精度（米）', value: um[1] });
    }
    if (queryPart) {
      const q = new URLSearchParams(queryPart).get('q');
      if (q) rows.push({ label: '地点', value: q });
    }
    if (!Number.isFinite(lat)) warnings.push('纬度不是有效数字，这条位置二维码可能已损坏');
    else if (lat < -90 || lat > 90) warnings.push(`纬度 ${coords[0]} 超出 -90 到 90 的范围`);
    if (!Number.isFinite(lon)) warnings.push('经度不是有效数字，这条位置二维码可能已损坏');
    else if (lon < -180 || lon > 180) warnings.push(`经度 ${coords[1]} 超出 -180 到 180 的范围`);
    if (coords[2] !== undefined && coords[2] !== '' && !Number.isFinite(Number(coords[2]))) warnings.push('海拔不是有效数字');
    return { type: 'geo', typeName: '地理位置', rows, link: trimmed, warnings, summary: `位置：${coords.slice(0, 2).join(', ')}` };
  }

  // URL
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    let host = '';
    let hasUserinfo = false;
    try { const u = new URL(trimmed); host = u.host; hasUserinfo = !!(u.username || u.password); } catch { /* 保持空 */ }
    const rows = host ? [{ label: '域名', value: host }] : [];
    const warnings = hasUserinfo ? ['链接里内嵌了用户名/密码（@ 之前部分），真实域名是 @ 之后的主机名，打开前请仔细核对'] : [];
    return { type: 'url', typeName: '网址链接', rows, link: trimmed, warnings, summary: `链接：${trimmed}` };
  }
  if (/^www\.\S+$/i.test(trimmed)) {
    return { type: 'url', typeName: '网址链接', rows: [{ label: '域名', value: trimmed.split('/')[0] }], link: `https://${trimmed}`, warnings: [], summary: `链接：${trimmed}` };
  }

  return { type: 'text', typeName: '纯文本', rows: [], link: '', warnings: [], summary: [...trimmed].length > 60 ? `${[...trimmed].slice(0, 60).join('')}…` : trimmed };
}

export function buildDecodeSummary(info, rawText) {
  const lines = [`类型：${info.typeName}`, `内容：${rawText}`];
  for (const row of info.rows || []) lines.push(`${row.label}：${row.value}`);
  for (const w of info.warnings || []) lines.push(`提示：${w}`);
  return lines.join('\n');
}
