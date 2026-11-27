// 二维码内容识别（纯本地）：把解码出的原始文本分类并拆出结构化字段
// 支持 URL / WiFi（WIFI:）/ 电话（tel:）/ 邮件（mailto: 与 MATMSG:）/ 短信（sms:/smsto:）/
// 地理位置（geo:）/ 名片（vCard 与 MECARD）/ 纯文本

function unescapeWifiValue(v) {
  // WIFI 格式里 \ 转义 ; , : " \
  return v.replace(/\\(.)/g, '$1');
}

export function parseWifi(body) {
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
  const authMap = { WEP: 'WEP', WPA: 'WPA/WPA2', WPA2: 'WPA2', WPA3: 'WPA3', NOPASS: '开放网络（无密码）' };
  const rows = [];
  if (fields.S !== undefined) rows.push({ label: '网络名称（SSID）', value: fields.S });
  if (fields.T) rows.push({ label: '加密方式', value: authMap[fields.T.toUpperCase()] || fields.T });
  if (fields.P !== undefined) rows.push({ label: '密码', value: fields.P });
  if (fields.H) rows.push({ label: '隐藏网络', value: /^(true|1)$/i.test(fields.H) ? '是' : '否' });
  return { ssid: fields.S || '', rows };
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function classifyQrContent(text) {
  const raw = String(text ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return { type: 'empty', typeName: '空内容', rows: [], link: '' };

  // WiFi
  const wifiMatch = /^WIFI:/i.exec(trimmed);
  if (wifiMatch) {
    const { ssid, rows } = parseWifi(trimmed.slice(wifiMatch[0].length));
    return { type: 'wifi', typeName: 'WiFi 网络', rows, link: '', summary: ssid ? `WiFi：${ssid}` : 'WiFi 配置' };
  }

  // vCard / MECARD
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const rows = [];
    let name = '';
    for (const line of trimmed.split(/\r?\n/)) {
      const m = /^([^;:]+)(?:;[^:]*)?:(.*)$/.exec(line.trim());
      if (!m) continue;
      const key = m[1].toUpperCase(); const value = m[2].trim();
      if (key === 'FN') { name = value; rows.push({ label: '姓名', value }); }
      else if (key === 'ORG') rows.push({ label: '单位', value });
      else if (key === 'TITLE') rows.push({ label: '职位', value });
      else if (key === 'TEL') rows.push({ label: '电话', value });
      else if (key === 'EMAIL') rows.push({ label: '邮箱', value });
      else if (key === 'URL') rows.push({ label: '网址', value });
      else if (key === 'ADR') rows.push({ label: '地址', value: value.replace(/;/g, ' ') });
    }
    return { type: 'vcard', typeName: '名片（vCard）', rows, link: '', summary: name ? `名片：${name}` : 'vCard 名片' };
  }
  if (/^MECARD:/i.test(trimmed)) {
    const rows = [];
    let name = '';
    for (const part of trimmed.slice(7).split(';')) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).toUpperCase(); const value = part.slice(idx + 1);
      if (key === 'N') { name = value; rows.push({ label: '姓名', value }); }
      else if (key === 'TEL') rows.push({ label: '电话', value });
      else if (key === 'EMAIL') rows.push({ label: '邮箱', value });
      else if (key === 'ORG') rows.push({ label: '单位', value });
      else if (key === 'URL') rows.push({ label: '网址', value });
      else if (key === 'ADR') rows.push({ label: '地址', value });
      else if (key === 'NOTE') rows.push({ label: '备注', value });
    }
    return { type: 'vcard', typeName: '名片（MECARD）', rows, link: '', summary: name ? `名片：${name}` : 'MECARD 名片' };
  }

  // 邮件 MATMSG
  if (/^MATMSG:/i.test(trimmed)) {
    const rows = [];
    for (const part of trimmed.slice(7).split(';')) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).toUpperCase(); const value = part.slice(idx + 1);
      if (key === 'TO') rows.push({ label: '收件人', value });
      else if (key === 'SUB') rows.push({ label: '主题', value });
      else if (key === 'BODY') rows.push({ label: '正文', value });
    }
    const to = rows.find(r => r.label === '收件人');
    return { type: 'email', typeName: '邮件（MATMSG）', rows, link: to ? `mailto:${to.value}` : '', summary: to ? `邮件：${to.value}` : '邮件' };
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
    return { type: 'email', typeName: '邮件链接', rows, link: trimmed, summary: `邮件：${safeDecode(addr)}` };
  }

  // 电话
  if (/^tel:/i.test(trimmed)) {
    const number = trimmed.slice(4);
    return { type: 'phone', typeName: '电话号码', rows: [{ label: '号码', value: number }], link: trimmed, summary: `电话：${number}` };
  }

  // 短信
  const smsMatch = /^(sms|smsto):/i.exec(trimmed);
  if (smsMatch) {
    const rest = trimmed.slice(smsMatch[0].length);
    const [number, body] = rest.split(/[:?]/);
    const rows = [{ label: '号码', value: number }];
    let bodyText = body || '';
    if (rest.includes('?')) {
      const params = new URLSearchParams(rest.slice(rest.indexOf('?') + 1));
      bodyText = params.get('body') || bodyText;
    }
    if (bodyText) rows.push({ label: '短信内容', value: safeDecode(bodyText) });
    return { type: 'sms', typeName: '短信', rows, link: `sms:${number}`, summary: `短信：${number}` };
  }

  // 地理位置
  if (/^geo:/i.test(trimmed)) {
    const coords = trimmed.slice(4).split('?')[0].split(',');
    const rows = [];
    if (coords[0]) rows.push({ label: '纬度', value: coords[0] });
    if (coords[1]) rows.push({ label: '经度', value: coords[1] });
    if (coords[2]) rows.push({ label: '海拔（米）', value: coords[2] });
    return { type: 'geo', typeName: '地理位置', rows, link: trimmed, summary: `位置：${coords.slice(0, 2).join(', ')}` };
  }

  // URL
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    let host = '';
    try { host = new URL(trimmed).host; } catch { /* 保持空 */ }
    const rows = host ? [{ label: '域名', value: host }] : [];
    return { type: 'url', typeName: '网址链接', rows, link: trimmed, summary: `链接：${trimmed}` };
  }
  if (/^www\.\S+$/i.test(trimmed)) {
    return { type: 'url', typeName: '网址链接', rows: [{ label: '域名', value: trimmed.split('/')[0] }], link: `https://${trimmed}`, summary: `链接：${trimmed}` };
  }

  return { type: 'text', typeName: '纯文本', rows: [], link: '', summary: trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed };
}

export function buildDecodeSummary(info, rawText) {
  const lines = [`类型：${info.typeName}`, `内容：${rawText}`];
  for (const row of info.rows || []) lines.push(`${row.label}：${row.value}`);
  return lines.join('\n');
}
