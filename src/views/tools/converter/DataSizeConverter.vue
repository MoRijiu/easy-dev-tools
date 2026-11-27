<template>
  <div class="ds-tool">
    <h1>数据大小换算</h1>
    <p class="description">字节、比特与 KB/MB/GB 互转，同时给出 SI（1000）与 IEC（1024）两套结果，并按网速估算下载耗时，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label>数据大小
          <input v-model="input" type="text" placeholder="如 1.5 GB / 1024 MiB / 500" aria-label="数据大小输入" @keyup.enter="analyze" />
        </label>
        <label class="unit-label">无单位时按
          <select v-model="defaultUnit" aria-label="默认单位"><option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option></select>
        </label>
        <button class="btn" @click="analyze">换算</button>
        <button class="btn ghost" @click="clearAll">清空</button>
      </div>
      <div class="examples"><span>示例：</span><button v-for="e in examples" :key="e" class="chip" @click="pick(e)">{{ e }}</button></div>
      <p v-if="error" class="error">{{ error }}</p>
      <template v-if="parsed">
        <p class="summary">{{ summary }}</p>
        <div class="table-wrap"><table><tbody>
          <tr v-for="row in rows" :key="row.symbol"><th>{{ row.symbol }} <span class="muted">{{ row.name }}</span></th><td class="mono">{{ row.text }}</td><td><button class="copy" @click="copyText(row.text + ' ' + row.symbol)">复制</button></td></tr>
        </tbody></table></div>
        <div class="speed-row">
          <label>网速 <input v-model="speed" type="text" inputmode="decimal" aria-label="网速数值" /></label>
          <select v-model="speedUnit" aria-label="网速单位"><option v-for="u in speedUnits" :key="u" :value="u">{{ u }}</option></select>
          <span v-if="estimate?.ok" class="est">预计耗时约 <strong>{{ estimate.text }}</strong>（实际受协议开销与波动影响会更久）</span>
          <span v-else-if="estimate" class="error">{{ estimate.error }}</span>
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
import { parseDataSize, convertDataSize, estimateTransfer, buildDataSizeSummary, DATA_UNITS } from '@/utils/dataSize.js';
const features = [
  { icon: '⚖️', title: '双标准对照', description: 'SI 十进制（1000）与 IEC 二进制（1024）一屏对照，不再混淆 GB 与 GiB' },
  { icon: '⏱️', title: '耗时估算', description: '按 Mbps/Gbps 或 MB/s 网速估算文件传输与下载耗时' },
  { icon: '🔢', title: '比特与字节', description: '同时给出 bit 与 B，带宽与容量换算不再差 8 倍' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['输入数字加单位（如 1.5 GB、1024 MiB），点「换算」或按回车', '在对照表里逐项复制任意单位的结果', '改网速数值即可估算这份数据要传多久'];
const faqs = [
  { question: 'GB 和 GiB 差多少？', answer: 'GB 是 SI 十进制：1 GB = 1000³ 字节；GiB 是 IEC 二进制：1 GiB = 1024³ 字节，比 GB 大约 7.4%。硬盘厂商常用 GB 标称，操作系统常按 GiB 显示，所以新硬盘「缩水」多是单位差异。' },
  { question: '100 Mbps 宽带下载速度为什么只有约 12.5 MB/s？', answer: '带宽用比特（bit）计，下载速度用字节（Byte）计，1 Byte = 8 bit，所以 100 Mbps ÷ 8 = 12.5 MB/s，再扣协议开销实际略低。' },
  { question: 'KB 到底是 1000 还是 1024？', answer: '按现行标准 KB = 1000 字节，1024 字节应写 KiB。日常很多软件仍把 1024 叫 KB，本工具两套都列出，按你的场景对照即可。' },
  { question: '粘贴 1,5 GB 为什么报错？', answer: '逗号在本工具只作千分位分组（如 1,000）。1,5 这种欧式小数写法如果静默去掉逗号会算成 15 GB、整整差 10 倍，所以会点名提示改用点号写 1.5 GB。全角数字字母（如 １.５ ＧＢ）则会自动转半角再算。' },
  { question: 'EB、EiB 是多大的单位？', answer: 'PB 之上还有 EB（10¹⁸ 字节）与 EiB（1024⁶ 字节），再往上是 ZB/ZiB、YB/YiB，本工具已全部列出对照，数据中心与大规模存储场景会用到。' },
  { question: '输入写错了为什么还显示上一次的结果？', answer: '这是故意的：报错只提示问题、保留上一次成功结果方便对照，不用重新输入。修正输入再点换算即可刷新。' }
];
const examples = ['1.5 GB', '1024 MiB', '700 MB', '8 bit', '2 TiB', '1 EB', '１.５ ＧＢ'];
const unitOptions = DATA_UNITS.map((u) => u.symbol);
const speedUnits = ['Mbps', 'Gbps', 'Kbps', 'MB/s', 'KB/s', 'GB/s', 'MiB/s', 'KiB/s', 'GiB/s'];
const input = ref('1.5 GB'); const defaultUnit = ref('B');
const speed = ref('100'); const speedUnit = ref('Mbps');
const parsed = ref(null); const error = ref('');
const statusMessage = ref(''); const statusType = ref('');
const rows = computed(() => (parsed.value ? convertDataSize(parsed.value.bytes) : []));
const summary = computed(() => buildDataSizeSummary(parsed.value, rows.value));
const estimate = computed(() => (parsed.value ? estimateTransfer(parsed.value.bytes, speed.value, speedUnit.value) : null));
const analyze = () => { const r = parseDataSize(input.value, defaultUnit.value); if (r.ok) { parsed.value = r; error.value = ''; } else { error.value = r.error; } };
const pick = (e) => { input.value = e; analyze(); };
const clearAll = () => { input.value = ''; parsed.value = null; error.value = ''; };
const copyText = async (txt) => { try { await navigator.clipboard.writeText(txt); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
analyze();
</script>
<style scoped>
.ds-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); flex: 1; min-width: 200px; }
.row label.unit-label { flex: 0 1 140px; min-width: 120px; }
input, select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; width: 100%; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; font-family: monospace; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.summary { font-size: 14px; color: var(--text-strong); margin: 16px 0 8px; }
.table-wrap { overflow-x: auto; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--text); }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); }
th { white-space: nowrap; color: var(--text-2); font-weight: 600; }
.muted { font-weight: 400; font-size: 12px; }
td.mono { font-family: monospace; word-break: break-all; }
.copy { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; white-space: nowrap; }
.speed-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 12px 0; font-size: 13px; color: var(--text-2); }
.speed-row label { display: flex; align-items: center; gap: 6px; }
.speed-row input { width: 90px; }
.speed-row select { width: auto; }
.est { color: var(--text); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
