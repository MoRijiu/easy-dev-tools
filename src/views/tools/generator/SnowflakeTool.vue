<template>
  <div class="snowflake-tool">
    <h1>雪花 ID 解析/生成</h1>
    <p class="description">解析 Snowflake 雪花 ID 的生成时间、数据中心、机器与序列号，也可按布局反向生成；支持 Twitter 经典、Discord 与自定义布局，全程本地 BigInt 计算不上传</p>
    <div class="tool-container">
      <div class="layout-bar">
        <label class="opt">布局预设
          <select v-model="presetId" class="select" @change="onPresetChange">
            <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <span class="layout-note">{{ layoutNote }}</span>
      </div>
      <div v-if="presetId === 'custom'" class="custom-grid">
        <label class="opt">纪元 epoch（毫秒）<input id="snowflake-epoch" aria-label="纪元 epoch（毫秒）" v-model.number="custom.epoch" type="number" class="num wide" :aria-invalid="layoutErrorFields(parseErrorFields).includes('epoch') || layoutErrorFields(genErrorFields).includes('epoch') ? 'true' : undefined" :aria-describedby="layoutErrorDesc(parseErrorFields, genErrorFields, 'epoch')" @input="reparse" /></label>
        <label class="opt">时间戳位<input id="snowflake-timestamp-bits" aria-label="时间戳位" v-model.number="custom.timestampBits" type="number" class="num" min="1" max="62" :aria-invalid="layoutErrorFields(parseErrorFields).includes('timestampBits') || layoutErrorFields(genErrorFields).includes('timestampBits') ? 'true' : undefined" :aria-describedby="layoutErrorDesc(parseErrorFields, genErrorFields, 'timestampBits')" @input="reparse" /></label>
        <label class="opt">数据中心位<input id="snowflake-datacenter-bits" aria-label="数据中心位" v-model.number="custom.datacenterBits" type="number" class="num" min="0" max="62" :aria-invalid="layoutErrorFields(parseErrorFields).includes('datacenterBits') || layoutErrorFields(genErrorFields).includes('datacenterBits') ? 'true' : undefined" :aria-describedby="layoutErrorDesc(parseErrorFields, genErrorFields, 'datacenterBits')" @input="reparse" /></label>
        <label class="opt">机器位<input id="snowflake-worker-bits" aria-label="机器位" v-model.number="custom.workerBits" type="number" class="num" min="0" max="62" :aria-invalid="layoutErrorFields(parseErrorFields).includes('workerBits') || layoutErrorFields(genErrorFields).includes('workerBits') ? 'true' : undefined" :aria-describedby="layoutErrorDesc(parseErrorFields, genErrorFields, 'workerBits')" @input="reparse" /></label>
        <label class="opt">序列位<input id="snowflake-sequence-bits" aria-label="序列位" v-model.number="custom.sequenceBits" type="number" class="num" min="1" max="62" :aria-invalid="layoutErrorFields(parseErrorFields).includes('sequenceBits') || layoutErrorFields(genErrorFields).includes('sequenceBits') ? 'true' : undefined" :aria-describedby="layoutErrorDesc(parseErrorFields, genErrorFields, 'sequenceBits')" @input="reparse" /></label>
      </div>

      <h2 class="section-title">解析</h2>
      <div class="parse-row">
        <input id="snowflake-id-input" v-model="idInput" class="text-input" placeholder="粘贴雪花 ID，如 175928847299117063（选 Discord 布局）" spellcheck="false" aria-label="雪花 ID 输入" :aria-invalid="parseErrorFields.includes('idInput') ? 'true' : undefined" :aria-describedby="parseErrorFields.includes('idInput') ? 'snowflake-parse-status' : undefined" @input="reparse" />
        <button @click="loadDiscordExample" class="btn btn-secondary">Discord 示例</button>
        <button @click="loadTwitterExample" class="btn btn-secondary">Twitter 示例</button>
        <button @click="clearParse" class="btn btn-danger">清空</button>
      </div>
      <ToolStatusMessage id="snowflake-parse-status" :message="parseMessage" :type="parseType" />
      <p v-if="parseNotes.length" class="notes" role="status" aria-live="polite">{{ parseNotes.join('；') }}</p>
      <p v-if="parsed?.warnings?.length" class="notes warn" role="status" aria-live="polite">{{ parsed.warnings.join('；') }}</p>
      <div v-if="parsed" class="table-wrap">
      <table class="result-table">
        <tbody>
          <tr><th scope="row">生成时间（UTC）</th><td>{{ parsed.iso ?? '超出可表示范围' }}</td><td><button class="copy-btn" @click="copyText(String(parsed.timestampMs))">复制时间戳</button></td></tr>
          <tr><th scope="row">生成时间（本地）</th><td>{{ localTime }}</td><td></td></tr>
          <tr><th scope="row">距纪元</th><td>{{ parsed.deltaMs }} 毫秒</td><td></td></tr>
          <tr v-if="parsed.datacenterId !== null"><th scope="row">数据中心 ID</th><td>{{ parsed.datacenterId }}</td><td></td></tr>
          <tr><th scope="row">机器 ID</th><td>{{ parsed.workerId }}</td><td></td></tr>
          <tr><th scope="row">序列号</th><td>{{ parsed.sequence }}（同一毫秒内第 {{ parsed.sequence + 1 }} 个）</td><td></td></tr>
          <tr><th scope="row">十六进制</th><td>{{ parsed.hex }}</td><td><button class="copy-btn" aria-label="复制十六进制" @click="copyText(parsed.hex)">复制</button></td></tr>
          <tr v-for="g in parsed.groups" :key="g.label"><th scope="row">{{ g.label }}</th><td class="mono">{{ g.bits }}</td><td></td></tr>
        </tbody>
      </table>
      </div>
      <p v-if="parsed" class="actions"><button @click="copySummary" class="btn btn-success">📋 复制解析摘要</button></p>

      <h2 class="section-title">生成</h2>
      <div class="gen-grid">
        <label class="opt">时间戳（毫秒）<input id="snowflake-gen-timestamp" aria-label="生成时间戳（毫秒）" v-model.number="gen.timestampMs" type="number" class="num wide" :aria-invalid="genErrorFields.includes('timestampMs') ? 'true' : undefined" :aria-describedby="genErrorFields.includes('timestampMs') ? 'snowflake-gen-status' : undefined" /></label>
        <label v-if="layout.datacenterBits > 0" class="opt">数据中心 ID<input id="snowflake-gen-datacenter" aria-label="数据中心 ID" v-model.number="gen.datacenterId" type="number" class="num" min="0" :aria-invalid="genErrorFields.includes('datacenterId') ? 'true' : undefined" :aria-describedby="genErrorFields.includes('datacenterId') ? 'snowflake-gen-status' : undefined" /></label>
        <label class="opt">机器 ID<input id="snowflake-gen-worker" aria-label="机器 ID" v-model.number="gen.workerId" type="number" class="num" min="0" :aria-invalid="genErrorFields.includes('workerId') ? 'true' : undefined" :aria-describedby="genErrorFields.includes('workerId') ? 'snowflake-gen-status' : undefined" /></label>
        <label class="opt">序列号<input id="snowflake-gen-sequence" aria-label="序列号" v-model.number="gen.sequence" type="number" class="num" min="0" :aria-invalid="genErrorFields.includes('sequence') ? 'true' : undefined" :aria-describedby="genErrorFields.includes('sequence') ? 'snowflake-gen-status' : undefined" /></label>
        <button @click="useNow" class="btn btn-secondary">当前时间</button>
        <button @click="randomSeq" class="btn btn-secondary">随机序列</button>
        <button @click="doGenerate" class="btn btn-success">生成 ID</button>
      </div>
      <ToolStatusMessage id="snowflake-gen-status" :message="genMessage" :type="genType" />
      <div v-if="generatedId" class="gen-result">
        <span class="mono">{{ generatedId }}</span>
        <button class="copy-btn" aria-label="复制生成的 ID" @click="copyText(generatedId)">复制</button>
        <button class="copy-btn" @click="sendToParse">送到上方解析</button>
      </div>

      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { SNOWFLAKE_PRESETS, TWITTER_EPOCH, DISCORD_EPOCH, parseSnowflake, generateSnowflake, buildSnowflakeSummary } from '@/utils/snowflake.js';

const features = [
  { icon: '🔍', title: '逐段解析', description: '时间戳、数据中心、机器、序列号逐段拆开，附二进制分组' },
  { icon: '🧩', title: '多布局支持', description: 'Twitter 经典、Discord、简化版预设，外加完全自定义布局' },
  { icon: '🏭', title: '反向生成', description: '按时间/机器/序列拼出 ID，可送回解析区验证往返一致' },
  { icon: '🔒', title: '纯本地 BigInt', description: 'ID 超过 JS 安全整数范围，全程 BigInt 精确计算，不上传服务器' }
];
const usageSteps = ['先选对布局预设（不知道来源时优先试 Twitter 经典）', '粘贴雪花 ID 即实时解析出生成时间与各段数值', '在生成区填时间、机器与序列可反向拼出 ID，并送回解析验证'];
const faqs = [
  { question: '什么是雪花 ID？', answer: 'Twitter 提出的分布式 ID 方案：把 64 位整数按时间戳、机器编号、序列号分段拼装，天然按时间递增、全局不重复，数据库里常见到它。' },
  { question: '为什么要用字符串粘贴，不能直接填数字？', answer: '雪花 ID 通常超过 2^53，超出 JavaScript Number 的安全整数范围，直接当数字处理会丢精度。后端返回 ID 时也应序列化为字符串，接口里用数字传雪花 ID 是常见事故源。' },
  { question: 'Discord 示例解析出的机器 ID 为什么是 32？', answer: 'Discord 布局里 worker 与 process 各占 5 位，本工具合并为 10 位机器位展示：32 = worker 1 左移 5 位再拼 process 0。' },
  { question: '解析出的时间明显不对怎么办？', answer: '多半是布局或纪元选错了：不同系统纪元不同（如 Twitter 2010 年、Discord 2015 年），自研系统常改纪元与位数，请切换预设或用自定义布局对齐。' },
  { question: '粘贴时有什么讲究？', answer: '全角数字会自动按半角处理，复制时被空格或换行折断的 ID 会自动拼回；0X 大写前缀也可识别，十六进制非法字符会定位到第几个。负数、小数与科学计数法会点名报错，因为它们都会丢精度。' },
  { question: '为什么解析成功还会给提示？', answer: 'ID 为 0 或解析出的生成时间在未来时，数值本身合法但几乎不可能是真实生成的 ID，多半是布局或纪元选错，页面会给出警告请你复核。' },
  { question: '输入报错后旧结果为什么还在？', answer: '这是有意保留的：报错只提示问题，不清掉上一次成功解析，方便你对照着改输入；清空按钮可以手动清掉。生成区同理，生成失败保留上一个 ID。' }
];
const presets = SNOWFLAKE_PRESETS;
const presetId = ref('discord');
const custom = ref({ epoch: TWITTER_EPOCH, timestampBits: 41, datacenterBits: 5, workerBits: 5, sequenceBits: 12 });
const layout = computed(() => {
  if (presetId.value === 'custom') return { ...custom.value };
  const p = presets.find((x) => x.id === presetId.value);
  return { epoch: p.epoch, timestampBits: p.timestampBits, datacenterBits: p.datacenterBits, workerBits: p.workerBits, sequenceBits: p.sequenceBits };
});
const layoutNote = computed(() => {
  if (presetId.value === 'custom') return '总位数不超过 64 位（雪花 ID 为 64 位整数）';
  return presets.find((x) => x.id === presetId.value).note + `，纪元 ${layout.value.epoch}`;
});
const idInput = ref('175928847299117063');
const parsed = ref(null);
const parseStatus = useStatusMessage();
const { statusMessage: parseMessage, statusType: parseType } = parseStatus;
const parseClipboard = useClipboard(parseStatus);
const parseNotes = ref([]);
// 解析/生成错误单独留存全文：解析状态区还兼报复制结果，只有当前展示的正是该错误时才做字段关联（R9bb 口径）
const parseError = ref('');
const parseErrorFull = ref('');
const genError = ref('');
const genErrorFull = ref('');
// 布局校验错误按文案自带字段名归到自定义布局字段；总位数超限是跨字段约束、同时归四个位数
const layoutFieldsOf = (msg) => {
  if (/总位数/.test(msg)) return ['timestampBits', 'datacenterBits', 'workerBits', 'sequenceBits'];
  if (/纪元/.test(msg)) return ['epoch'];
  if (/时间戳位数/.test(msg)) return ['timestampBits'];
  if (/数据中心位数/.test(msg)) return ['datacenterBits'];
  if (/机器位数/.test(msg)) return ['workerBits'];
  if (/序列号?位数/.test(msg)) return ['sequenceBits'];
  return null;
};
const layoutErrorFields = (fields) => fields;
const layoutErrorDesc = (parseFields, genFields, field) => {
  const ids = [];
  if (parseFields.includes(field)) ids.push('snowflake-parse-status');
  if (genFields.includes(field)) ids.push('snowflake-gen-status');
  return ids.length ? ids.join(' ') : undefined;
};
// 解析错误：布局错误归布局字段；「超出当前布局…位范围」布局与输入都有可能、不归任何字段；其余均为 ID 输入本身的格式错误
const parseErrorFields = computed(() => {
  if (!parseError.value || parseType.value !== 'error' || parseMessage.value !== parseErrorFull.value) return [];
  const lf = layoutFieldsOf(parseError.value);
  if (lf) return lf;
  if (/超出当前布局/.test(parseError.value)) return [];
  return ['idInput'];
});
// 生成错误：布局错误归布局字段；其余按文案自带字段名（生成时间/数据中心/机器 ID/序列号）归对应生成字段
const genErrorFields = computed(() => {
  if (!genError.value || genType.value !== 'error' || genMessage.value !== genErrorFull.value) return [];
  const lf = layoutFieldsOf(genError.value);
  if (lf) return lf;
  if (/生成时间/.test(genError.value)) return ['timestampMs'];
  if (/数据中心/.test(genError.value)) return ['datacenterId'];
  if (/机器 ID/.test(genError.value)) return ['workerId'];
  if (/序列号/.test(genError.value)) return ['sequence'];
  return [];
});
const localTime = computed(() => {
  if (!parsed.value || !parsed.value.iso) return parsed.value ? '超出可表示范围' : '';
  return new Date(parsed.value.timestampMs).toLocaleString('zh-CN', { hour12: false });
});
const reparse = () => {
  if (!idInput.value.trim()) { parsed.value = null; parseNotes.value = []; parseMessage.value = ''; parseError.value = ''; parseErrorFull.value = ''; return; }
  try {
    const r = parseSnowflake(idInput.value, layout.value);
    parsed.value = r;
    parseNotes.value = r.notes || [];
    parseMessage.value = '✓ 解析成功';
    parseType.value = 'success';
    parseError.value = ''; parseErrorFull.value = '';
  } catch (e) {
    parseNotes.value = [];
    parseError.value = e.message;
    parseErrorFull.value = '✗ ' + e.message + '（已保留上一次结果）';
    parseMessage.value = parseErrorFull.value;
    parseType.value = 'error';
  }
};
const onPresetChange = () => reparse();
const loadDiscordExample = () => { presetId.value = 'discord'; idInput.value = '175928847299117063'; reparse(); };
const loadTwitterExample = () => {
  presetId.value = 'twitter';
  try { idInput.value = generateSnowflake({ timestampMs: 1700000000000, datacenterId: 1, workerId: 2, sequence: 3 }, layout.value); } catch { idInput.value = ''; }
  reparse();
};
const clearParse = () => { idInput.value = ''; parsed.value = null; parseNotes.value = []; parseMessage.value = ''; parseError.value = ''; parseErrorFull.value = ''; };
const gen = ref({ timestampMs: Date.now(), datacenterId: 1, workerId: 1, sequence: 0 });
const generatedId = ref('');
const genStatus = useStatusMessage();
const { statusMessage: genMessage, statusType: genType } = genStatus;
const useNow = () => { gen.value.timestampMs = Date.now(); };
const randomSeq = () => { gen.value.sequence = Math.floor(Math.random() * (2 ** layout.value.sequenceBits)); };
const doGenerate = () => {
  try {
    // 当前布局没有数据中心位时该字段不渲染，生成时按 0 处理（保留用户填的值、切回有数据中心位的布局仍在）；
    // 此前直接透传默认值 1，Discord/简化版布局点生成必报「数据中心必须为 0」
    generatedId.value = generateSnowflake({ ...gen.value, datacenterId: layout.value.datacenterBits > 0 ? gen.value.datacenterId : 0 }, layout.value);
    genMessage.value = '✓ 生成成功';
    genType.value = 'success';
    genError.value = ''; genErrorFull.value = '';
  } catch (e) {
    genError.value = e.message;
    genErrorFull.value = '✗ ' + e.message + (generatedId.value ? '（已保留上一次结果）' : '');
    genMessage.value = genErrorFull.value;
    genType.value = 'error';
  }
};
const sendToParse = () => { idInput.value = generatedId.value; reparse(); };
const copyText = async (text) => {
  await parseClipboard.copyText(text, '✓ 已复制');
};
const copySummary = () => { if (parsed.value) copyText(buildSnowflakeSummary(parsed.value, layout.value)); };
reparse();
</script>

<style scoped>
.snowflake-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.section-title { font-size: 1.15rem; color: var(--text-strong); margin: 22px 0 10px; }
.section-title:first-of-type { margin-top: 14px; }
.layout-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.layout-note { font-size: 13px; color: var(--text-2); }
.opt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; }
.num { width: 72px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 13px; }
.num.wide { width: 170px; }
.custom-grid, .gen-grid { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
.parse-row { display: flex; flex-wrap: wrap; gap: 8px; }
.text-input { flex: 1 1 320px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; box-sizing: border-box; }
.table-wrap { overflow-x: auto; }
.result-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
.result-table th { text-align: left; padding: 6px 10px; color: var(--text-2); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; width: 180px; }
.result-table td { padding: 6px 10px; color: var(--text); border-bottom: 1px solid var(--border); word-break: break-all; }
.mono { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; }
.notes { margin: 10px 0 0; color: var(--text-2); font-size: 13px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
.notes.warn { background: var(--warn-soft); }
.copy-btn { padding: 3px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
.actions { margin: 12px 0 0; }
.gen-result { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-soft); font-size: 15px; }
.btn { padding: 7px 14px; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
.btn-secondary { background: var(--bg-soft); color: var(--text); border: 1px solid var(--border); }
.btn-success { background: var(--accent-solid); color: #fff; }
.btn-danger { background: var(--bg-soft); color: var(--text); border: 1px solid var(--border); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .result-table th { width: 120px; } }
</style>
