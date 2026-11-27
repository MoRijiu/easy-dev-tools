<template>
  <div class="port-finder">
    <h1>常用端口查询</h1>
    <p class="description">按端口号、服务名或用途速查常用端口、协议与安全提示，全程本地、不上传</p>
    <div class="tool-container">
      <div class="controls">
        <input v-model="query" type="search" placeholder="输入端口或服务，如 3306 / redis / 远程桌面" aria-label="搜索常用端口" class="search" />
        <div class="chips" role="group" aria-label="按分类筛选">
          <button v-for="c in PORT_CATEGORIES" :key="c.id" :class="{ active: category === c.id }" :aria-pressed="category === c.id" @click="category = c.id">{{ c.name }} {{ categoryCounts[c.id] || 0 }}</button>
        </div>
        <div class="chips" role="group" aria-label="按协议筛选">
          <button v-for="p in PROTOCOLS" :key="p.id" :class="{ active: protocol === p.id }" :aria-pressed="protocol === p.id" @click="protocol = p.id">{{ p.name }}</button>
        </div>
      </div>
      <div v-if="exactInfo" class="exact">
        <strong>{{ exactInfo.title }}</strong>
        <span>{{ exactInfo.detail }}</span>
      </div>
      <p class="count">端口表共 {{ totalCount }} 条，当前显示 {{ results.length }} 条 · 提示：数据库与远程管理端口不要直接暴露公网，优先走内网、VPN 或跳板机</p>
      <div v-if="results.length" class="list">
        <article v-for="t in results" :key="t.port + t.service" class="item">
          <div class="head"><span class="port">{{ t.port }}</span><code class="svc">{{ t.service }}</code><span class="proto">{{ t.protocol }}</span><span class="zh">{{ t.nameZh }}</span><button class="copy" @click="copyItem(t)">复制</button></div>
          <p v-if="t.note" class="desc">{{ t.note }}</p>
        </article>
      </div>
      <p v-else class="empty">没找到匹配的端口，换个关键词试试，如「数据库」「vpn」「邮件」；任意端口号的所属段可在上方输入纯数字查看。</p>
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
import { PORT_CATEGORIES, COMMON_PORTS, searchPorts, buildPortSummary, getByPort, classifyPort, normalizePortInput, countByCategory } from '@/utils/commonPorts.js';
const totalCount = COMMON_PORTS.length; const categoryCounts = countByCategory();
const PROTOCOLS = [{ id: 'all', name: '全部协议' }, { id: 'TCP', name: 'TCP' }, { id: 'UDP', name: 'UDP' }];
const features = [
  { icon: '🔎', title: '多维速查', description: '可按端口号、服务英文名、中文用途或场景关键词搜索' },
  { icon: '🗂️', title: '分类与协议', description: '按 Web、数据库、远程、邮件等分类及 TCP/UDP 缩小范围' },
  { icon: '⚠️', title: '安全提示', description: '标注 Telnet 明文、Docker 2375、数据库端口等暴露风险' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['在搜索框输入端口号、服务名或中文关键词', '或点分类/协议 chips 只看某一类', '输入任意纯数字端口可看它属于熟知/注册/动态哪一段，点「复制」带走对应关系'];
const faqs = [
  { question: '3306、5432、6379 能直接开公网吗？', answer: '强烈不建议。数据库端口一旦暴露常被扫描爆破，应只监听内网或本机，再通过 SSH 隧道、VPN 或跳板机访问。' },
  { question: 'TCP 和 UDP 端口是同一套编号吗？', answer: '是独立的：同一个数字可以同时是 TCP 端口和 UDP 端口，如 DNS 的 53 同时用 UDP（主）和 TCP。' },
  { question: '查不到的端口怎么判断用途？', answer: '先看所属段：0–1023 熟知、1024–49151 注册、49152–65535 多为临时客户端端口；再结合服务器上实际监听的进程确认，不要只凭端口号下结论。' },
  { question: '搜 80 为什么 8000、8080 也会出现？', answer: '纯数字查询按精确命中 > 端口前缀 > 说明中提及的顺序排列：80 本身排第一，8000/8080 是以 80 开头的前缀命中，1080 这类只是数字里包含 80 的会排在最后。' },
  { question: '全角数字（如 ３３０６）能查吗？', answer: '可以。中文输入法粘来的全角数字与字母会自动转成半角再查询，服务名同理（如 ｒｅｄｉｓ）。' },
  { question: '端口 0 是什么？', answer: '0 是保留端口、不能监听；程序里把端口填 0 表示让操作系统随机分配一个空闲端口，实际拿到的是动态段里的某个端口。' }
];
const query = ref(''); const category = ref('all'); const protocol = ref('all');
const results = computed(() => searchPorts(query.value, category.value, protocol.value));
const exactInfo = computed(() => {
  const raw = normalizePortInput(query.value.trim());
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw); const cls = classifyPort(n);
  if (!cls) return { title: `${raw} 不是有效端口`, detail: '端口范围是 0–65535' };
  const hit = getByPort(raw);
  return { title: `${n} · ${cls.range} ${cls.rangeEn}`, detail: hit ? `常用服务：${hit.service}（${hit.nameZh}）。${cls.hint}` : cls.hint };
});
const statusMessage = ref(''); const statusType = ref('');
const copyItem = async (t) => { try { await navigator.clipboard.writeText(buildPortSummary(t)); statusMessage.value = '✓ 已复制 ' + t.port; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
</script>
<style scoped>
.port-finder { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.controls { display: flex; flex-direction: column; gap: 10px; }
.search { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; width: 100%; box-sizing: border-box; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.chips button.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.exact { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); display: flex; gap: 8px; flex-wrap: wrap; font-size: 14px; color: var(--text); }
.count { font-size: 13px; color: var(--text-2); margin: 12px 0 8px; }
.list { display: flex; flex-direction: column; gap: 8px; }
.item { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.port { font-size: 16px; font-weight: 700; color: var(--text-strong); min-width: 52px; }
.svc { font-size: 13px; color: var(--text); word-break: break-all; }
.proto { font-size: 12px; color: var(--text-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; }
.zh { color: var(--text-2); font-size: 13px; }
.copy { margin-left: auto; padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.desc { margin: 6px 0 0; font-size: 14px; color: var(--text); line-height: 1.55; }
.empty { color: var(--text-2); font-size: 14px; padding: 16px 0; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
