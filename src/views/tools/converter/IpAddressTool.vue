<template>
  <div class="ip-tool">
    <h1>IP地址工具</h1>
    <p class="description">解析 IPv4 / IPv6 地址：整数、十六进制与二进制互转，展开/压缩 IPv6，判定私有、环回、组播等性质，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label>IP 地址或 IPv4 整数
          <input v-model="input" type="text" placeholder="如 192.168.1.10 / 2001:db8::1 / 3232235786" aria-label="IP 地址输入" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'ip-address-error' : undefined" @keyup.enter="analyze" />
        </label>
        <button class="btn" @click="analyze">解析</button>
        <button class="btn ghost" @click="clearAll">清空</button>
      </div>
      <div class="examples">
        <span>示例：</span>
        <button v-for="e in examples" :key="e" class="chip" @click="pick(e)">{{ e }}</button>
      </div>
      <p v-if="error" id="ip-address-error" class="error" role="alert">{{ error }}</p>
      <template v-if="info">
        <ul v-if="info.warnings && info.warnings.length" class="warnings-list" role="status" aria-live="polite">
          <li v-for="(w, i) in info.warnings" :key="i">⚠️ {{ w }}</li>
        </ul>
        <p class="summary">{{ summary }}</p>
        <div class="table-wrap">
          <table>
            <tbody>
              <tr v-for="row in rows" :key="row.label">
                <th scope="row">{{ row.label }}</th><td class="mono">{{ row.value }}</td>
                <td><button class="copy" :aria-label="`复制${row.label}`" @click="copyText(row.value)">复制</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="btn ghost" @click="copyText(summary)">复制摘要</button>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { parseIp, buildIpSummary } from '@/utils/ipAddress.js';
const features = [
  { icon: '🔀', title: '多格式互转', description: 'IPv4 点分、整数、十六进制、二进制与反向 DNS 一屏对照' },
  { icon: '🧩', title: 'IPv6 展开压缩', description: '按 RFC 5952 规范压缩，识别内嵌 IPv4 的映射地址' },
  { icon: '🏷️', title: '性质判定', description: '区分私有、环回、链路本地、运营商 NAT、组播与公网地址' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['输入 IPv4、IPv6 或 IPv4 的整数形式，点「解析」或按回车', '在结果表里逐项复制整数、十六进制、反向 DNS 等表示', '点示例快速试算私有地址、环回与 IPv6 压缩写法'];
const faqs = [
  { question: '192.168 开头的一定是私有地址吗？', answer: '是。私有地址有三段：10.0.0.0/8、172.16.0.0/12（注意不是整个 172 段）、192.168.0.0/16，只能在局域网内使用，出公网要经 NAT 转换。' },
  { question: 'IPv6 的 :: 是什么意思？', answer: ':: 表示一连串全零的组，只能出现一次。压缩遵循 RFC 5952：只压缩长度 ≥2 的最长零组，并列时取最左边一组，单组零不压缩。' },
  { question: '100.64 开头的地址是什么？', answer: '100.64.0.0/10 是运营商级 NAT（CGNAT）共享地址空间，宽带运营商给用户分配这类地址时，多户会共用一个公网出口 IP。' },
  { question: '文档示例地址只有三段吗？', answer: '是，且必须是精确的 /24：192.0.2.0/24、198.51.100.0/24、203.0.113.0/24。198.51.0.1、203.0.0.1 不在这三段里，是普通公网地址；192.0.0.0/24 则是 IETF 协议分配段，也不是文档段。' },
  { question: '粘贴带方括号或端口的地址会怎样？', answer: 'URL 写法如 [::1]:8080、192.168.1.1:8080 可以直接粘贴：方括号会去掉、端口会被忽略并给出提示，只解析地址本身。全角数字与字母也会自动转半角。带 /24 这类前缀长度的是 CIDR 网段写法，请用「CIDR 子网计算器」。' },
  { question: '64:ff9b:: 和 2002:: 开头的 IPv6 是什么？', answer: '64:ff9b::/96 是 NAT64 公共前缀，末 32 位内嵌被转换的 IPv4；2002::/16 是 6to4 隧道，第 2–3 组内嵌站点公网 IPv4；2001::/32 是 Teredo 隧道。本工具会把这些内嵌的 IPv4 单独列出来。' }
];
const examples = ['192.168.1.10', '8.8.8.8', '255.255.255.255', '2001:db8::1', '::ffff:192.168.0.1', '64:ff9b::8.8.8.8', '[::1]:8080', '3232235786'];
const input = ref('192.168.1.10');
const info = ref(null); const error = ref('');
const statusMessage = ref(''); const statusType = ref('');
const summary = computed(() => buildIpSummary(info.value));
const rows = computed(() => {
  const i = info.value; if (!i) return [];
  if (i.version === 4) return [
    { label: '版本 / 类别', value: `IPv4 · ${i.ipClass}` },
    { label: '地址性质', value: `${i.kind} — ${i.note}` },
    { label: '标准形式', value: i.normalized },
    { label: '整数（uint32）', value: String(i.value) },
    { label: '十六进制', value: i.hex },
    { label: '点分十六进制', value: i.hexDotted },
    { label: '二进制', value: i.binaryDotted },
    { label: '反向 DNS', value: i.reverseDns }
  ];
  const list = [
    { label: '版本 / 类别', value: 'IPv6' },
    { label: '地址性质', value: `${i.kind} — ${i.note}` },
    { label: '压缩形式', value: i.compressed },
    { label: '完整展开', value: i.expanded },
    { label: '整数', value: i.value },
    { label: '十六进制', value: i.hex },
    { label: '反向 DNS', value: i.reverseDns }
  ];
  if (i.embeddedIpv4) list.push({ label: i.embeddedLabel || '内嵌 IPv4', value: i.embeddedIpv4 });
  return list;
});
const analyze = () => { const r = parseIp(input.value); if (r.ok) { info.value = r; error.value = ''; } else { error.value = r.error; } };
const pick = (e) => { input.value = e; analyze(); };
const clearAll = () => { input.value = ''; info.value = null; error.value = ''; };
const copyText = async (txt) => { try { await navigator.clipboard.writeText(txt); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
analyze();
</script>
<style scoped>
.ip-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.warnings-list { margin: 12px 0 0; padding: 10px 14px 10px 30px; background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; line-height: 1.7; }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); flex: 1; min-width: 240px; }
input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; width: 100%; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; font-family: monospace; }
.error { color: var(--danger-text); font-size: 14px; }
.summary { font-size: 14px; color: var(--text-strong); margin: 16px 0 8px; }
.table-wrap { overflow-x: auto; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--text); }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); }
th { white-space: nowrap; color: var(--text-2); font-weight: 600; }
td.mono { font-family: monospace; word-break: break-all; }
.copy { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
