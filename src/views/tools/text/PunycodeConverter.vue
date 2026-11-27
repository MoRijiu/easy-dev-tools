<template>
  <div class="puny-conv">
    <h1>Punycode转换</h1>
    <p class="description">中文 / 国际化域名与 Punycode（xn--）互转，支持多行批量、逐标签处理，全程本地、不上传</p>
    <div class="tool-container">
      <div class="row options">
        <label>方向
          <select v-model="direction" aria-label="转换方向">
            <option value="encode">Unicode → Punycode</option>
            <option value="decode">Punycode → Unicode</option>
          </select>
        </label>
        <span class="muted">每行一个域名，纯 ASCII 标签原样保留</span>
      </div>
      <label class="block">输入
        <textarea v-model="input" rows="6" spellcheck="false" placeholder="如：中文.com 或 xn--fiq228c.com" aria-label="转换输入"></textarea>
      </label>
      <div class="row actions">
        <button class="chip" type="button" @click="loadExample">示例</button>
        <button class="btn ghost" type="button" @click="clearAll">清空</button>
        <button class="btn ghost" type="button" :disabled="!result" @click="useAsInput">结果作输入并反向</button>
        <button class="btn" type="button" :disabled="!result" @click="copyText(result.text)">复制结果</button>
        <span class="muted">输入后实时转换</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="error && result" class="muted">当前输入有误，下面保留的是上一次成功转换的结果。</p>
      <p v-for="note in (result ? result.notes : [])" :key="note" class="note">{{ note }}</p>
      <p v-for="warn in (result && result.warnings ? result.warnings : [])" :key="warn" class="warn">{{ warn }}</p>
      <template v-if="result">
        <label class="block">输出
          <textarea :value="result.text" rows="6" readonly spellcheck="false" aria-label="转换输出"></textarea>
        </label>
        <p class="summary">共 {{ result.lines }} 行 · {{ result.converted }} 行发生转换</p>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { convertPunycode } from '@/utils/punycodeConvert.js';
const features = [
  { icon: '🌐', title: '国际化域名互转', description: '中文、日文、Emoji 等 Unicode 域名与 xn-- 开头的 Punycode 形式双向转换' },
  { icon: '📋', title: '多行批量', description: '每行一个域名批量处理，逐个点号标签转换，纯 ASCII 标签原样保留' },
  { icon: '⚠️', title: '精确报错', description: '空标签、非法字符、超长标签、损坏的 Punycode 都定位到行与标签说明原因' },
  { icon: '🔒', title: '纯本地处理', description: 'RFC 3492 算法在浏览器内实现，内容不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['粘贴域名（每行一个，可混排多个）', '选择方向：Unicode → Punycode 编码，或反向解码', '点「复制结果」使用，或「结果作输入并反向」验往返'];
const faqs = [
  { question: '什么是 Punycode？', answer: 'Punycode（RFC 3492）把 Unicode 字符编码成 ASCII 字母数字与连字符的方案，国际化域名（IDN）靠它落地：含非 ASCII 的标签编码后加 xn-- 前缀，如 中文.com 实际注册与解析的是 xn--fiq228c.com。' },
  { question: '为什么纯英文域名转换后没变化？', answer: '纯 ASCII 标签不需要编码，编码方向原样保留（并转小写）；解码方向也只处理 xn-- 开头的标签，其余标签保持不变。' },
  { question: '浏览器地址栏里为什么有时显示中文、有时显示 xn--？', answer: '浏览器按顶级域与语言策略决定展示形式：符合本地域名规则时显示原文，出于防钓鱼等考虑时会显示 xn-- 编码形式，两者指向同一个域名。' },
  { question: '粘贴时要注意什么？', answer: '直接粘 URL 也行，会自动只取主机名（端口会被忽略并提示）；中文输入法打出的全角字母、全角句点 ． 和中文句号 。 都会按半角与点处理并给出提示；末尾带点的完全限定域名（FQDN）会保留末尾点。含组合字符的标签会先做 NFC 规范化再编码，与预组合字符写法得到同一结果。' },
  { question: '哪些输入会被拒绝？', answer: '单段标签超过 63 字符、域名总长超过 253 字符（编码与解码都查）、下划线等非法字符（会定位到第几个）、未配对代理字符与零宽等不可见字符、解出纯 ASCII 却带 xn-- 前缀的非正规编码（会给出警告）。报错时回显会截断，不会把超长原文整段塞进提示。' },
  { question: '输错了为什么还显示上一次的结果？', answer: '这是故意的：报错时页面保留上一次成功转换的结果并给出提示，方便对照修改，不会一输错就把之前的结果清空。点「清空」会连保留结果一起清掉。输入上限为 10 万字符。' }
];
const EXAMPLE = '中文.com\nbücher.de\n💩.la';
const input = ref(EXAMPLE);
const direction = ref('encode');
const statusMessage = ref(''); const statusType = ref('');
const parsed = computed(() => (!input.value ? null : convertPunycode(input.value, direction.value)));
// 出错保留上一次成功结果：改错一行时输出不消失，改对自动恢复
const lastValid = ref(null);
watch(parsed, (v) => { if (v && v.ok) lastValid.value = v; }, { immediate: true });
const result = computed(() => (parsed.value && parsed.value.ok ? parsed.value : (parsed.value ? lastValid.value : null)));
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''));
function loadExample() {
  direction.value = 'encode';
  input.value = EXAMPLE;
}
function clearAll() { input.value = ''; lastValid.value = null; }
function useAsInput() {
  if (!result.value) return;
  input.value = result.value.text;
  direction.value = direction.value === 'encode' ? 'decode' : 'encode';
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}
</script>
<style scoped>
.puny-conv { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.options select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.options label { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.chip { padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.note { color: var(--info-text, var(--text-2)); background: var(--info-soft); border: 1px solid var(--info-border); border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.warn { color: var(--warning-text); background: var(--warning-soft); border: 1px solid var(--warning-border); border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.summary { font-size: 13px; margin: 6px 0 10px; color: var(--text-2); }
.muted { font-size: 12px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
