<template>
  <div class="rmb-tool">
    <h1>金额大写转换</h1>
    <p class="description">把数字金额转成财务规范的人民币大写（壹佰贰拾叁元肆角伍分），处理各级零与角分规则，纯本地、不上传</p>
    <div class="tool-container">
      <div class="row">
        <label>金额（元）
          <input v-model="input" type="text" inputmode="decimal" placeholder="如 1234.56" aria-label="金额输入" @keyup.enter="analyze" />
        </label>
        <button class="btn" @click="analyze">转换</button>
        <button class="btn ghost" @click="clearAll">清空</button>
      </div>
      <div class="examples"><span>示例：</span><button v-for="e in examples" :key="e" class="chip" @click="pick(e)">{{ e }}</button></div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="notes.length" class="note" role="status" aria-live="polite">{{ notes.join('；') }}</p>
      <template v-if="result">
        <p class="capital">{{ result.capital }}</p>
        <p class="summary">格式化：{{ result.formatted }}</p>
        <button class="btn ghost" @click="copyText(result.capital)">复制大写</button>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { convertAmountInput } from '@/utils/rmbCapital.js';
const features = [
  { icon: '🏦', title: '财务规范读法', description: '按 4 位分级读万/亿/兆，级内连零只读一个、级末零不读，角分缺位按规则补零或加「整」' },
  { icon: '🎯', title: '字符串精确计算', description: '金额按字符串逐位处理，不经过浮点数，大额也不会出现精度误差' },
  { icon: '🧾', title: '容错输入', description: '可直接粘贴带千分位逗号、¥ 符号的金额，小数超过两位会明确提示先四舍五入' },
  { icon: '🔒', title: '纯本地处理', description: '金额不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['输入数字金额（可带千分位或 ¥），点「转换」或按回车', '核对大写结果与下方千分位格式化金额是否一致', '点「复制大写」粘贴到合同、发票或报销单'];
const faqs = [
  { question: '为什么 10001 读「壹万零壹」而不是「壹万壹」？', answer: '个级的高位是零时要读出一个零来分隔级与个位，否则容易与「壹万壹仟」等混淆。同理 100010000 读「壹亿零壹万」。但级内的尾零不读，如 1100 读「壹仟壹佰」而不是「壹仟壹佰零零」。' },
  { question: '0.01 元的大写是什么？', answer: '不足一元时不读「零元」：0.01 读「零壹分」，0.10 读「壹角整」，0.11 读「壹角壹分」。整数金额或角位结尾的金额在末尾加「整」，如 100 元读「壹佰元整」。' },
  { question: '最多能转多大的金额？', answer: '整数部分最多 16 位（到仟兆级），覆盖任何日常财务场景。小数只支持角、分两位，超过两位会提示先自行四舍五入，避免悄悄改动金额。' },
  { question: '为什么 1,5 会报错而不是按 15 或 1.5 转换？', answer: '逗号在这里只能是千分位分隔符，必须每 3 位一组（如 1,234,567）。1,5 既可能是 15 也可能是小数 1.5，金额场景下猜错就是算错钱，所以会点名报错请你确认；空格分隔同理，1 2 不会被默默拼成 12。' },
  { question: '可以粘贴哪些格式？', answer: '全角数字与标点（如 １２３４．５６）会自动转半角；可带 ¥ 前缀、末尾「元」或「元整」、负数可写 -100 或「负100」。-0 与 -0.00 按零处理，读「零元整」而不是「负零元整」。' },
  { question: '输错时为什么还显示上一次的结果？', answer: '报错只提示问题，不清掉上一次成功的大写结果，方便你对照着改输入；改对后结果会自动更新，点「清空」才会全部清掉。' }
];
const examples = ['1234.56', '10001', '100.01', '0.07', '987654321.09'];
const input = ref('1234.56');
const result = ref(null); const error = ref(''); const notes = ref([]);
const statusMessage = ref(''); const statusType = ref('');
const analyze = () => {
  const r = convertAmountInput(input.value);
  if (r.ok) { error.value = ''; notes.value = r.notes || []; result.value = r; }
  else { error.value = r.error; notes.value = []; }
};
const pick = (e) => { input.value = e; analyze(); };
const clearAll = () => { input.value = ''; result.value = null; error.value = ''; notes.value = []; };
const copyText = async (txt) => { try { await navigator.clipboard.writeText(txt); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
analyze();
</script>
<style scoped>
.rmb-tool { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); flex: 1; min-width: 200px; }
input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; width: 100%; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.examples { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; font-family: monospace; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.note { font-size: 13px; color: var(--info-text, var(--text-2)); margin: 6px 0; }
.capital { font-size: 20px; font-weight: 600; color: var(--text-strong); margin: 16px 0 6px; word-break: break-all; }
.summary { font-size: 14px; color: var(--text-2); margin: 0 0 10px; font-family: monospace; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .capital { font-size: 17px; } }
</style>
