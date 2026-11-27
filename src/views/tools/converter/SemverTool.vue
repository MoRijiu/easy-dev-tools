<template>
  <div class="semver-tool">
    <h1>SemVer 版本工具</h1>
    <p class="description">解析语义化版本、比较大小、递增版本号并校验版本范围（^ / ~ / 区间），全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="copySummary" class="btn btn-success" :disabled="!parsed"><span class="icon">📋</span> 复制解析摘要</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <section class="block">
        <h2>版本解析</h2>
        <div class="row">
          <label class="grow">版本号 <input v-model="versionInput" placeholder="如 1.2.3-rc.1+build.5，可带 v 前缀" aria-label="版本号" @input="process" /></label>
        </div>
        <p v-if="error" class="error">✗ {{ error }}</p>
        <div v-if="parsed" class="grid">
          <div class="card"><span class="num">{{ parsed.major }}</span><span class="label">主版本 Major（不兼容变更）</span></div>
          <div class="card"><span class="num">{{ parsed.minor }}</span><span class="label">次版本 Minor（向后兼容功能）</span></div>
          <div class="card"><span class="num">{{ parsed.patch }}</span><span class="label">修订号 Patch（向后兼容修复）</span></div>
          <div class="card"><span class="num small">{{ parsed.prerelease.length ? parsed.prerelease.join('.') : '—' }}</span><span class="label">预发布（无 = 正式版）</span></div>
          <div class="card"><span class="num small">{{ parsed.build || '—' }}</span><span class="label">构建元数据（不参与优先级）</span></div>
          <div class="card"><span class="num small">{{ parsed.version }}</span><span class="label">规范化版本</span></div>
        </div>
        <div v-if="parsed" class="row bump">
          <span class="bump-label">递增：</span>
          <button v-for="b in bumps" :key="b.type" @click="applyBump(b.type)">{{ b.label }} → {{ bumpPreview(b.type) }}</button>
        </div>
      </section>
      <section class="block">
        <h2>版本比较</h2>
        <div class="row">
          <label class="grow">版本 A <input v-model="versionA" placeholder="如 1.0.0-alpha" aria-label="版本 A" /></label>
          <button type="button" class="swap-btn" @click="swapCompare" title="交换 A / B">⇄ 交换</button>
          <label class="grow">版本 B <input v-model="versionB" placeholder="如 1.0.0" aria-label="版本 B" /></label>
        </div>
        <p v-if="compareError" class="error">✗ {{ compareError }}</p>
        <p v-else-if="compareText" class="result-line">{{ compareText }}</p>
      </section>
      <section class="block">
        <h2>范围校验</h2>
        <div class="row">
          <label class="grow">待校验版本 <input v-model="rangeVersion" placeholder="如 1.4.2" aria-label="待校验版本" /></label>
          <label class="grow">范围表达式 <input v-model="rangeExpr" placeholder="如 ^1.2.3、~1.2、>=1.0.0 <2.0.0、1.2.x" aria-label="范围表达式" /></label>
        </div>
        <p v-if="rangeError" class="error">✗ {{ rangeError }}</p>
        <p v-else-if="rangeResult !== null" class="result-line">{{ rangeResult ? '✓ 满足范围' : '✗ 不满足范围' }}：{{ rangeVersion }} {{ rangeResult ? '∈' : '∉' }} {{ rangeExpr }}</p>
        <div class="quick"><button v-for="p in presets" :key="p" @click="rangeExpr = p">{{ p }}</button></div>
      </section>
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
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { parseSemver, compareSemver, bumpVersion, satisfiesRange, buildSemverSummary } from '@/utils/semver.js';
const features = [
  { icon: '🔍', title: '规范解析', description: '按 SemVer 2.0.0 校验前导零、预发布与构建元数据，错误精确指出问题段' },
  { icon: '⚖️', title: '优先级比较', description: '按规范比较预发布优先级：正式版高于预发布，构建元数据不参与比较' },
  { icon: '⬆️', title: '一键递增', description: '主/次/修订/预发布四种递增一键生成并回填继续操作' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = [
  { title: '输入版本号', description: '粘贴如 1.2.3-rc.1 的版本，自动拆解各段含义' },
  { title: '比较与递增', description: '填两个版本看谁更新，或点递增按钮生成下一版' },
  { title: '校验范围', description: '用 ^、~、>=、连字符区间或 x 通配写范围，判断某版本是否满足' }
];
const faqs = [
  { question: '1.0.0-alpha 和 1.0.0 谁更新？', answer: '1.0.0 更新。带预发布标识的版本优先级低于同号正式版：1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-beta < 1.0.0。' },
  { question: '^1.2.3 和 ~1.2.3 有什么区别？', answer: '^1.2.3 允许次版本与修订变化（>=1.2.3 <2.0.0）；~1.2.3 只允许修订变化（>=1.2.3 <1.3.0）。主版本为 0 时 ^ 的范围会收紧到次版本。' },
  { question: '构建元数据（+build）影响比较吗？', answer: '不影响。SemVer 规定构建元数据不参与优先级，1.0.0+build1 与 1.0.0+build2 优先级相等。' },
  { question: '为什么 ^1.2.3 不放行 1.5.0-beta？', answer: '这是 npm 的预发布门控规则：带预发布标识的版本，只有当范围里有某个比较器同样带预发布标识、且主/次/修订三段与它相同时才算满足。所以 ^1.2.3 只放行正式版，想放行 1.2.3 的预发布要用 ^1.2.3-beta 这类带预发布的下限。' },
  { question: '版本号段特别大时会怎样？', answer: '主/次/修订超过 JavaScript 安全整数（9007199254740991）时无法精确比较，本工具会点名报错而不是给出可能错误的结果；预发布里的纯数字标识符则按任意大整数精确比较。中文输入法打出的全角数字（如 １.２.３）会自动转半角再解析。' }
];
const versionInput = ref(''); const versionA = ref(''); const versionB = ref('');
const rangeVersion = ref(''); const rangeExpr = ref('');
const parsed = ref(null); const error = ref('');
const statusMessage = ref(''); const statusType = ref('info');
const bumps = [{ type: 'major', label: '主版本 +1' }, { type: 'minor', label: '次版本 +1' }, { type: 'patch', label: '修订 +1' }, { type: 'prerelease', label: '预发布递增' }];
const presets = ['^1.2.3', '~1.2.3', '>=1.0.0 <2.0.0', '1.2.x', '1.0.0 - 2.0.0', '^1.0.0 || ^2.0.0'];
const process = () => {
  error.value = '';
  if (!versionInput.value.trim()) { parsed.value = null; return; }
  try { parsed.value = parseSemver(versionInput.value); } catch (e) { parsed.value = null; error.value = e.message; }
};
const bumpPreview = (t) => { try { return bumpVersion(parsed.value, t).version; } catch { return '-'; } };
const applyBump = (t) => { if (!parsed.value) return; versionInput.value = bumpVersion(parsed.value, t).version; process(); };
const compareResult = computed(() => {
  if (!versionA.value.trim() || !versionB.value.trim()) return null;
  try { return { cmp: compareSemver(versionA.value, versionB.value) }; } catch (e) { return { err: e.message }; }
});
const compareError = computed(() => compareResult.value?.err || '');
const compareText = computed(() => {
  const r = compareResult.value; if (!r || r.err) return '';
  const rel = r.cmp === 0 ? '优先级相等（构建元数据不参与比较）' : (r.cmp < 0 ? `${versionA.value} < ${versionB.value}，B 更新` : `${versionA.value} > ${versionB.value}，A 更新`);
  return `比较结果：${rel}`;
});
const rangeResult = computed(() => {
  if (!rangeVersion.value.trim() || !rangeExpr.value.trim()) return null;
  try { return satisfiesRange(rangeVersion.value, rangeExpr.value); } catch { return null; }
});
const rangeError = computed(() => {
  if (!rangeVersion.value.trim() || !rangeExpr.value.trim()) return '';
  try { satisfiesRange(rangeVersion.value, rangeExpr.value); return ''; } catch (e) { return e.message; }
});
const swapCompare = () => { const t = versionA.value; versionA.value = versionB.value; versionB.value = t; };
const loadExample = () => { versionInput.value = '1.2.3-rc.1+build.5'; versionA.value = '1.0.0-beta.11'; versionB.value = '1.0.0-rc.1'; rangeVersion.value = '1.4.2'; rangeExpr.value = '^1.2.3'; process(); };
const copySummary = async () => { if (!parsed.value) return; try { await navigator.clipboard.writeText(buildSemverSummary(parsed.value)); statusMessage.value = '✓ 已复制解析摘要'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
loadExample();
</script>
<style scoped>
.semver-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.block { margin-bottom: 20px; } .block h2 { font-size: 16px; color: var(--text-strong); margin: 0 0 10px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); }
label.grow { flex: 1 1 220px; }
input { padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; width: 100%; box-sizing: border-box; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.card { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px 6px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
.num { font-size: 20px; font-weight: 700; color: var(--text-strong); word-break: break-all; } .num.small { font-size: 15px; } .label { font-size: 12px; color: var(--text-2); }
.error { color: var(--danger, #d33); font-size: 13px; margin-top: 8px; }
.bump { margin-top: 12px; align-items: center; } .bump-label { font-size: 13px; color: var(--text-2); }
.bump button, .quick button, .swap-btn { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; white-space: nowrap; }
.quick { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.result-line { margin-top: 12px; font-size: 14px; color: var(--text); background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .grid { grid-template-columns: repeat(2, 1fr); } }
</style>
