<template>
  <div class="ascii-table">
    <h1>ASCII码查询</h1>
    <p class="description">速查 0–127 ASCII 码表（十/十六/八/二进制），并支持文本与 ASCII 码互转，全程本地、不上传</p>
    <div class="tool-container">
      <section class="convert">
        <div class="row">
          <label>文本 <textarea spellcheck="false" v-model="textInput" rows="2" placeholder="输入文本，如 Hello" aria-label="待转文本" :aria-invalid="convertError && convertErrorSource === 'text' ? 'true' : undefined" :aria-describedby="convertError && convertErrorSource === 'text' ? 'ascii-convert-error' : undefined"></textarea></label>
          <label>格式
            <select v-model="format" aria-label="码值格式">
              <option value="dec">十进制</option><option value="hex">十六进制</option><option value="escape">\xHH 转义</option>
            </select>
          </label>
          <button class="btn" @click="doEncode">文本 → 码</button>
          <button class="btn ghost" @click="loadExample">示例</button>
        </div>
        <div class="row">
          <label>ASCII 码 <textarea spellcheck="false" v-model="codeInput" rows="2" placeholder="输入码值，如 72 101 108 108 111" aria-label="待转码值" :aria-invalid="convertError && convertErrorSource === 'code' ? 'true' : undefined" :aria-describedby="convertError && convertErrorSource === 'code' ? 'ascii-convert-error' : undefined"></textarea></label>
          <button class="btn" @click="doDecode">码 → 文本</button>
          <button v-if="convertOutput" class="btn ghost" @click="copyText(convertOutput)">复制结果</button>
        </div>
        <p v-if="convertError" id="ascii-convert-error" class="error" role="alert">{{ convertError }}</p>
        <pre v-if="convertOutput" class="output">{{ convertOutput }}</pre>
        <p v-if="convertNote" class="count">{{ convertNote }}</p>
      </section>
      <div class="controls">
        <input v-model="query" type="search" placeholder="搜索：如 65 / A / 换行 / LF / 0x0A" aria-label="搜索 ASCII 码表" class="search" />
        <div class="chips" role="group" aria-label="按分类筛选">
          <button v-for="c in ASCII_CATEGORIES" :key="c.id" :class="{ active: category === c.id }" :aria-pressed="category === c.id" @click="category = c.id">{{ c.name }} {{ counts[c.id] ?? '' }}</button>
        </div>
      </div>
      <p class="count">共 128 条，当前显示 {{ results.length }} 条 · 控制字符（0–31 与 127，共 33 条）多不可见，表中以缩写展示；空格（32）是可打印字符</p>
      <div v-if="results.length" class="table-wrap">
        <table>
          <thead><tr><th scope="col">字符</th><th scope="col">十进制</th><th scope="col">十六进制</th><th scope="col">八进制</th><th scope="col">二进制</th><th scope="col">名称/说明</th><th scope="col"></th></tr></thead>
          <tbody>
            <tr v-for="t in results" :key="t.code">
              <td class="char">{{ t.display }}</td><td>{{ t.code }}</td><td>0x{{ t.hex }}</td><td>{{ t.oct }}</td><td class="mono">{{ t.binary }}</td>
              <td>{{ t.name }}<span v-if="t.note" class="note"> · {{ t.note }}</span></td>
              <td><button class="copy" :aria-label="`复制字符（十进制 ${t.code}）`" @click="copyItem(t)">复制</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">没找到匹配项，换个关键词试试，如「换行」「空格」「数字」。</p>
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
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { ASCII_CATEGORIES, searchAscii, buildAsciiSummary, textToAscii, asciiToText, countByCategory } from '@/utils/asciiTable.js';
const counts = countByCategory();
const features = [
  { icon: '🔎', title: '全表速查', description: '按码值、字符、中文名或缩写搜索 128 个 ASCII 条目' },
  { icon: '🔀', title: '文本互转', description: '文本与十进制/十六进制/\\xHH 转义码互转，非 ASCII 明确报错' },
  { icon: '🧩', title: '四种进制', description: '每条同时给出十进制、十六进制、八进制与二进制' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['在上方输入文本选格式，点「文本 → 码」；或输入码值点「码 → 文本」', '在搜索框输入码值、字符或中文名查表', '点分类 chips 只看控制字符/数字/字母等，点「复制」带走对应关系'];
const faqs = [
  { question: 'ASCII 和 Unicode 是什么关系？', answer: 'ASCII 是 0–127 的基础字符集，Unicode 的前 128 个码点与 ASCII 完全一致；中文、Emoji 等不在 ASCII 范围内，本工具会明确提示。' },
  { question: '为什么换行有 10 和 13 两个码？', answer: '10 是 LF（换行），13 是 CR（回车）。Unix/Linux 文本只用 LF，Windows 文本用 CRLF 两个一起，源于打字机回车与换行的两个动作。' },
  { question: '空格的 ASCII 码是多少？', answer: '32。它是第一个可打印字符；0–31 与 127 是控制字符（共 33 个），在屏幕上通常不可见。' },
  { question: '十六进制可以连着写吗？', answer: '可以。十六进制格式下，像 48656C6C6F 这种无分隔的连续串会按每 2 位一个字节拆开解码；长度为奇数时会点名报错。也可以用空格分隔或带 0x 前缀。' },
  { question: '全角输入能查吗？', answer: '能。搜索与码值输入会先把全角数字/字母（如 ６５、Ａ、４８）转成半角再处理，中文输入法下粘贴也不怕。' },
  { question: '报错时会不会丢掉上次结果？', answer: '不会。转换出错只更新错误提示，之前的结果保留，改对输入后重新转换即可覆盖。' }
];
const query = ref(''); const category = ref('all');
const results = computed(() => searchAscii(query.value, category.value));
const textInput = ref(''); const codeInput = ref(''); const format = ref('dec');
const convertOutput = ref(''); const convertError = ref(''); const convertNote = ref(''); const convertErrorSource = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const clipboard = useClipboard(status);
const doEncode = () => { const r = textToAscii(textInput.value, format.value); if (!r.ok) { convertError.value = r.error; convertErrorSource.value = 'text'; return; } convertError.value = ''; convertErrorSource.value = ''; convertOutput.value = r.output; convertNote.value = r.count ? `共 ${r.count} 个字符` : ''; codeInput.value = r.output; };
const doDecode = () => { const r = asciiToText(codeInput.value, format.value); if (!r.ok) { convertError.value = r.error; convertErrorSource.value = 'code'; return; } convertError.value = ''; convertErrorSource.value = ''; convertOutput.value = r.output; convertNote.value = r.count ? `共 ${r.count} 个字符（控制字符可能不可见）` : ''; textInput.value = r.output; };
const loadExample = () => { textInput.value = 'Hello'; format.value = 'dec'; doEncode(); };
const copyText = async (txt) => clipboard.copyText(txt, '✓ 已复制结果');
const copyItem = async (t) => clipboard.copyText(buildAsciiSummary(t), '✓ 已复制 ' + t.code);
</script>
<style scoped>
.convert { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
.row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); flex: 1; min-width: 220px; }
textarea, select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent-solid); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; }
.error { color: var(--danger-text); font-size: 14px; margin: 0; }
.output { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; word-break: break-all; margin: 0; color: var(--text); font-size: 14px; }
.controls { display: flex; flex-direction: column; gap: 10px; }
.search { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; width: 100%; box-sizing: border-box; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.chips button.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.count { font-size: 13px; color: var(--text-2); margin: 12px 0 8px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--text); }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td.char { font-weight: 700; color: var(--text-strong); }
td.mono { font-family: monospace; }
.note { color: var(--text-2); }
.copy { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.empty { color: var(--text-2); font-size: 14px; padding: 16px 0; }
</style>
