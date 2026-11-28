<template>
  <div class="morse-code">
    <h1>摩尔斯电码编解码</h1>
    <p class="description">文本与摩尔斯电码互转，支持点画播放试听，全程本地、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="swap" class="btn btn-secondary" :disabled="!output"><span class="icon" aria-hidden="true">🔄</span> 结果作输入</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!output"><span class="icon" aria-hidden="true">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="mode-row" role="group" aria-label="转换方向与播放">
        <div class="seg">
          <button :class="{ active: mode === 'encode' }" :aria-pressed="mode === 'encode'" @click="mode = 'encode'">编码（文本 → 电码）</button>
          <button :class="{ active: mode === 'decode' }" :aria-pressed="mode === 'decode'" @click="mode = 'decode'">解码（电码 → 文本）</button>
        </div>
        <label class="wpm">速度
          <select v-model.number="wpm" aria-label="播放速度">
            <option :value="10">10 WPM</option>
            <option :value="15">15 WPM</option>
            <option :value="20">20 WPM</option>
            <option :value="25">25 WPM</option>
          </select>
        </label>
        <button class="btn btn-secondary play-btn" :disabled="!playableCode || playing" @click="play">▶ {{ playing ? '播放中…' : '播放电码' }}</button>
        <button v-if="playing" class="btn btn-danger play-btn" @click="stopPlay">⏹ 停止</button>
        <span v-if="playableCode && !error" class="dur">时长约 {{ durationText }}</span>
      </div>
      <div class="panels">
        <ToolEditorPanel :title="mode === 'encode' ? '输入文本' : '输入电码'" :info="input ? `${[...input].length} 字符` : ''">
          <textarea v-model="input" class="ta" rows="6" spellcheck="false" :placeholder="mode === 'encode' ? '输入英文、数字或标点，如 SOS 或 Hello World' : '粘贴电码，如 ... --- ... ，字母间空格、单词间用 / 分隔'" aria-label="输入" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'morse-code-error' : undefined"></textarea>
        </ToolEditorPanel>
        <ToolEditorPanel :title="mode === 'encode' ? '电码结果' : '解码结果'" :info="info">
          <textarea :value="output" class="ta" rows="6" readonly spellcheck="false" placeholder="结果实时显示" aria-label="输出"></textarea>
        </ToolEditorPanel>
      </div>
      <p v-if="notes.length" class="notes" role="status" aria-live="polite">{{ notes.join('；') }}</p>
      <p v-if="error" id="morse-code-error" class="error" role="alert">✗ {{ error }}</p>
      <div class="ref">
        <div v-for="g in MORSE_GROUPS" :key="g.name" class="ref-group">
          <span class="ref-title">{{ g.name }}</span>
          <button v-for="ch in g.chars" :key="ch" class="ref-cell" @click="appendChar(ch)" :title="'插入 ' + ch">
            <b>{{ ch }}</b><code>{{ MORSE_TABLE[ch] }}</code>
          </button>
        </div>
        <p class="ref-hint">点码表可插入：编码模式插入字符，解码模式插入电码。</p>
      </div>
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { MORSE_TABLE, MORSE_GROUPS, encodeMorse, decodeMorse, buildPlayEvents } from '@/utils/morseCode.js';
const features = [
  { icon: '📡', title: '国际标准码表', description: 'ITU 摩尔斯电码：26 字母、10 数字与 18 个常用标点' },
  { icon: '🔊', title: '点画播放试听', description: '按标准节奏（点 1、划 3、词间隔 7 单位）用蜂鸣声播放，可调 10–25 WPM' },
  { icon: '🧩', title: '解码容错', description: '兼容 / 、换行、多空格分词与 • · − 等点画变体，错误符号精确定位' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['选择方向（编码/解码）', '输入文本或电码，结果实时生成', '点「播放电码」试听点画节奏', '点码表可快速插入字符或电码，再复制结果带走'];
const faqs = [
  { question: '摩尔斯电码怎么分隔字母和单词？', answer: '通行写法：同一单词内字母之间用一个空格分隔，单词之间用「 / 」分隔。发报节奏上字母间隔 3 个单位、单词间隔 7 个单位。' },
  { question: 'SOS 为什么是 ... --- ...？', answer: 'S 是 ...、O 是 ---，连起来短长分明、极易辨认，1906 年被定为国际遇险信号。' },
  { question: '能编码中文吗？', answer: '不能。摩尔斯电码只定义了拉丁字母、数字与少量标点；历史上中文电报先把汉字转成四位数字电码本再发送。本工具遇到不支持的字符会指出位置。' },
  { question: 'WPM 是什么？', answer: 'Words Per Minute，每分钟单词数，以 PARIS 一词 50 个单位为基准：1 单位 = 1200 / WPM 毫秒，WPM 越高点画越快。' },
  { question: '从文档/网页粘贴来的内容要注意什么？', answer: '全角字母数字（如 ＳＯＳ）会自动转半角，解码时 • · − － ／ 等变体符号也会统一成标准 . - /，页面会给出提示；但零宽空格等不可见字符会点名报错，删掉后重试即可。' },
  { question: '报错位置是怎么数的？', answer: '按 Unicode 码点计数，一个 Emoji 算 1 个字符，报错会原样显示出问题字符，不会出现乱码占位。' },
  { question: '输入出错时为什么还显示着上一次的结果？', answer: '这是故意的：改错一个字符不会把之前的结果清掉，方便对照修正；把输入全部清空或切换方向后，保留的结果才会清掉。' }
];
const input = ref(''); const mode = ref('encode'); const wpm = ref(15);
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const playing = ref(false);
let audioCtx = null; let playTimers = [];
const fresh = computed(() => {
  if (!input.value || !input.value.trim()) return { output: '', error: '', stats: null };
  try {
    const r = mode.value === 'encode' ? encodeMorse(input.value) : decodeMorse(input.value);
    return { output: r.output, error: '', stats: r };
  } catch (e) { return { output: '', error: e.message, stats: null }; }
});
// 出错时保留上一次成功结果，不清空（输入清空时由 fresh 的空结果覆盖，切换方向时模式标记失效）。
const lastGood = ref({ mode: '', output: '', stats: null });
watch(fresh, (r) => { if (!r.error) lastGood.value = { mode: mode.value, output: r.output, stats: r.stats }; });
const result = computed(() => (fresh.value.error && lastGood.value.mode === mode.value)
  ? { output: lastGood.value.output, error: fresh.value.error, stats: lastGood.value.stats }
  : fresh.value);
const output = computed(() => result.value.output);
const error = computed(() => result.value.error);
const notes = computed(() => (fresh.value.error ? [] : (result.value.stats?.notes || [])));
const info = computed(() => {
  const s = result.value.stats;
  if (!s) return '';
  if (mode.value === 'encode') return `${s.charCount} 字符 · ${s.wordCount} 词 · 点 ${s.dotCount} / 划 ${s.dashCount}`;
  return `${s.letterCount} 字符 · ${s.wordCount} 词`;
});
const playableCode = computed(() => (mode.value === 'encode' ? output.value : input.value.trim()));
const durationText = computed(() => {
  if (!playableCode.value || error.value) return '';
  const units = buildPlayEvents(playableCode.value).reduce((sum, e) => sum + e.units, 0);
  const sec = units * (1200 / wpm.value) / 1000;
  return sec < 10 ? `${sec.toFixed(1)} 秒` : `${Math.round(sec)} 秒`;
});
const appendChar = (ch) => {
  if (mode.value === 'encode') { input.value += ch; return; }
  const code = MORSE_TABLE[ch];
  const cur = input.value;
  input.value = cur && !/\s$/.test(cur) ? `${cur} ${code} ` : `${cur}${code} `;
};
const loadExample = () => { input.value = mode.value === 'encode' ? 'SOS Hello 2026' : '... --- ... / .... . .-.. .-.. ---'; };
const swap = () => { if (!output.value) return; input.value = output.value; mode.value = mode.value === 'encode' ? 'decode' : 'encode'; };
const clearAll = () => { stopPlay(); input.value = ''; statusMessage.value = ''; };
const copyOutput = async () => clipboard.copyText(output.value, '✓ 已复制结果');
const stopPlay = () => {
  playTimers.forEach((t) => clearTimeout(t)); playTimers = [];
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  playing.value = false;
};
const play = () => {
  const code = playableCode.value;
  if (!code || error.value) return;
  stopPlay();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) { statusMessage.value = '✗ 当前浏览器不支持 Web Audio，无法播放'; statusType.value = 'error'; return; }
  audioCtx = new Ctx();
  const unitMs = 1200 / wpm.value;
  const events = buildPlayEvents(code);
  let at = audioCtx.currentTime + 0.05;
  for (const e of events) {
    if (e.on) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.008);
      gain.gain.setValueAtTime(0.2, at + (e.units * unitMs) / 1000 - 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + (e.units * unitMs) / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(at); osc.stop(at + (e.units * unitMs) / 1000 + 0.02);
    }
    at += (e.units * unitMs) / 1000;
  }
  playing.value = true;
  const totalMs = (at - audioCtx.currentTime) * 1000 + 100;
  playTimers.push(setTimeout(() => { playing.value = false; if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; } }, totalMs));
};
onBeforeUnmount(stopPlay);
</script>
<style scoped>
.notes { margin: 10px 0 0; color: var(--text-2); font-size: 13px; background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
.mode-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.seg { display: flex; gap: 6px; flex-wrap: wrap; }
.seg button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.seg button.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.wpm { font-size: 13px; color: var(--text); display: inline-flex; gap: 4px; align-items: center; }
.wpm select { padding: 5px 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 13px; }
.play-btn { font-size: 13px; padding: 6px 10px; }
.dur { font-size: 13px; color: var(--text-2); }
.panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ta { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: ui-monospace, monospace; font-size: 13px; resize: vertical; word-break: break-all; }
.error { color: var(--danger-text); font-size: 14px; margin: 10px 0 0; }
.ref { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.ref-group { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
.ref-title { font-size: 13px; color: var(--text-2); width: 34px; flex: none; }
.ref-cell { display: inline-flex; flex-direction: column; align-items: center; gap: 0; padding: 4px 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; line-height: 1.25; }
.ref-cell b { font-size: 13px; }
.ref-cell code { font-family: ui-monospace, monospace; font-size: 11px; color: var(--text-2); }
.ref-cell:hover { border-color: var(--accent); }
.ref-hint { font-size: 12px; color: var(--text-2); margin: 0; }
@media (max-width: 760px) { .panels { grid-template-columns: 1fr; } h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
