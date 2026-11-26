<template>
  <div class="regex-tester">
    <h1>正则表达式测试工具</h1>
    <p class="description">在线测试正则表达式，实时高亮匹配、查看捕获组并预览替换结果；全程本地运行，不上传服务器</p>

    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary">
          <span class="icon">📝</span> 示例
        </button>
        <button @click="clearAll" class="btn btn-danger">
          <span class="icon">🗑️</span> 清空
        </button>
        <button @click="copyMatches" class="btn btn-success" :disabled="!matches.length">
          <span class="icon">📋</span> 复制匹配结果
        </button>
      </ToolToolbar>

      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <div class="pattern-section">
        <ToolEditorPanel title="正则表达式" :info="matches.length ? `共 ${matches.length} 处匹配` : ''">
          <div class="pattern-row">
            <span class="slash" aria-hidden="true">/</span>
            <input
              v-model="pattern"
              class="pattern-input"
              placeholder="输入正则表达式，如 \d{4}-\d{2}-\d{2}"
              spellcheck="false"
              aria-label="正则表达式输入"
            />
            <span class="slash" aria-hidden="true">/</span>
            <span class="flags-text" aria-label="当前标志">{{ flagsString || '（无标志）' }}</span>
          </div>
          <div class="flags-row" role="group" aria-label="正则标志">
            <label v-for="f in flagDefs" :key="f.key" class="flag-chip" :class="{ active: flags[f.key] }">
              <input type="checkbox" v-model="flags[f.key]" class="flag-check" />
              <code>{{ f.key }}</code><span>{{ f.label }}</span>
            </label>
          </div>
        </ToolEditorPanel>
      </div>

      <div class="presets">
        <button v-for="p in presets" :key="p.name" class="preset-chip" @click="usePreset(p)">{{ p.name }}</button>
      </div>

      <div class="text-section">
        <ToolEditorPanel title="测试文本">
          <textarea
            v-model="testText"
            class="text-input"
            rows="6"
            placeholder="在这里粘贴要测试的文本…"
            spellcheck="false"
            aria-label="测试文本输入"
          ></textarea>
        </ToolEditorPanel>
      </div>

      <div v-if="pattern && testText" class="highlight-section">
        <h3 class="section-title">匹配高亮</h3>
        <div v-if="errorMessage" class="no-match">正则有误，修正后将实时显示高亮</div>
        <p v-else-if="!matches.length" class="no-match">没有匹配到任何内容</p>
        <div v-else class="highlight-box" aria-label="匹配高亮预览"><template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.isMatch && !seg.zeroWidth" class="hl">{{ seg.text }}</mark><span v-else-if="seg.isMatch" class="hl-zero" title="零宽匹配"></span><template v-else>{{ seg.text }}</template></template></div>
      </div>

      <div v-if="matches.length" class="matches-section">
        <h3 class="section-title">匹配明细</h3>
        <div class="table-wrap">
          <table class="matches-table">
            <thead>
              <tr><th scope="col">#</th><th scope="col">匹配</th><th scope="col">位置</th><th scope="col">捕获组</th></tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in matches" :key="i">
                <td>{{ i + 1 }}</td>
                <td><code>{{ m.match === '' ? '（零宽）' : m.match }}</code></td>
                <td>{{ m.index }}</td>
                <td class="groups-cell">
                  <span v-if="!m.groups.length && !hasNamed(m)">—</span>
                  <span v-for="(g, gi) in m.groups" :key="gi" class="group-tag"><code>${{ gi + 1 }}</code> {{ g === undefined ? '（未参与）' : g }}</span>
                  <span v-for="(v, k) in (m.named || {})" :key="k" class="group-tag"><code>${{ '<' + k + '>' }}</code> {{ v === undefined ? '（未参与）' : v }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="matches.length >= MAX_MATCHES" class="limit-note">匹配数已达上限 {{ MAX_MATCHES }}，仅显示前 {{ MAX_MATCHES }} 处。</p>
      </div>

      <div class="replace-section">
        <ToolEditorPanel title="替换预览（可选）" info="支持 $1、$<name>、$&、$$ 占位">
          <input
            v-model="replacement"
            class="replace-input"
            placeholder="替换为，如 [$1]；未勾选 g 标志时只替换第一处"
            spellcheck="false"
            aria-label="替换内容输入"
          />
          <div v-if="replacement && replacedText !== null" class="replace-actions">
            <button @click="copyReplaced" class="btn btn-success btn-sm">
              <span class="icon">📋</span> 复制替换结果
            </button>
          </div>
          <pre v-if="replacement && replacedText !== null" class="replace-output">{{ replacedText }}</pre>
        </ToolEditorPanel>
      </div>

      <ToolExamples :examples="examples" @use-example="useExample" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { collectMatches, buildSegments, applyReplace, MAX_MATCHES } from '@/utils/regexTest.js';

const features = [
  { icon: '🖍️', title: '实时高亮', description: '输入即测试，匹配片段在原文中高亮显示' },
  { icon: '🎯', title: '捕获组明细', description: '每处匹配的位置、分组与命名组一目了然' },
  { icon: '🔁', title: '替换预览', description: '支持 $1、$<name> 等占位，先预览再复制结果' },
  { icon: '🔒', title: '纯本地运行', description: '文本不离开浏览器，不上传任何服务器' }
];

const usageSteps = [
  '在上方输入正则表达式，按需勾选 g / i / m 等标志',
  '在测试文本框粘贴文本，匹配会实时高亮并列出明细',
  '需要替换时填「替换预览」，确认结果无误后一键复制',
  '点常用预设可快速套用邮箱、手机号、URL 等常见正则'
];

const faqs = [
  {
    question: 'g 标志有什么影响？',
    answer: '勾选 g 表示全局匹配：明细会列出全部匹配，替换也会替换所有匹配处；不勾选时替换只作用于第一处。'
  },
  {
    question: '替换里的 $1、$& 是什么意思？',
    answer: '$1、$2… 引用第 n 个捕获组，$<name> 引用命名组，$& 是整个匹配，$$ 是字面量美元符号 $。'
  },
  {
    question: '什么是零宽匹配？',
    answer: '像 (?=\\d) 这类断言匹配的是位置而不是字符，长度为 0。明细里会标注「（零宽）」，高亮区以细标记提示位置。'
  },
  {
    question: '为什么提示灾难性回溯风险？',
    answer: '嵌套量词（如 (a+)+）在不匹配的长文本上可能让浏览器长时间无响应。建议避免这类写法，本工具也限制了单次匹配数量。'
  }
];

const flagDefs = [
  { key: 'g', label: '全局' },
  { key: 'i', label: '忽略大小写' },
  { key: 'm', label: '多行' },
  { key: 's', label: '点号匹配换行' },
  { key: 'u', label: 'Unicode' },
  { key: 'y', label: '粘性' }
];

const presets = [
  { name: '邮箱', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+', flags: 'g' },
  { name: '中国手机号', pattern: '1[3-9]\\d{9}', flags: 'g' },
  { name: 'URL', pattern: 'https?://[\\w.-]+(?:\\.[a-z]{2,})(?:/\\S*)?', flags: 'gi' },
  { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { name: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g' },
  { name: '十六进制颜色', pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b', flags: 'g' },
  { name: '单词边界的词', pattern: '\\b\\w+\\b', flags: 'g' }
];

const examples = [
  { input: '\\d{4}-\\d{2}-\\d{2}', output: '匹配 2026-11-26 这类日期', description: '日期提取' },
  { input: '(\\w+)@(\\w+)', output: '捕获用户名与域名两组', description: '捕获组示例' }
];

const pattern = ref('');
const flags = reactive({ g: true, i: false, m: false, s: false, u: false, y: false });
const testText = ref('');
const replacement = ref('');
const matches = ref([]);
const errorMessage = ref('');
const statusMessage = ref('');
const statusType = ref('');

const flagsString = computed(() => flagDefs.filter(f => flags[f.key]).map(f => f.key).join(''));
const segments = computed(() => buildSegments(testText.value, matches.value));
const hasNamed = (m) => m.named && Object.keys(m.named).length > 0;

const replacedText = computed(() => {
  if (!replacement.value || !pattern.value || errorMessage.value) return null;
  try {
    return applyReplace(pattern.value, flagsString.value, testText.value, replacement.value);
  } catch {
    return null;
  }
});

const runTest = () => {
  matches.value = [];
  errorMessage.value = '';
  if (!pattern.value) { statusMessage.value = ''; return; }
  try {
    matches.value = collectMatches(pattern.value, flagsString.value, testText.value);
    statusMessage.value = testText.value ? `✓ 找到 ${matches.value.length} 处匹配` : '✓ 正则语法正确，输入测试文本后查看匹配';
    statusType.value = 'success';
  } catch (e) {
    errorMessage.value = e.message;
    statusMessage.value = `✗ ${e.message}`;
    statusType.value = 'error';
  }
};

watch([pattern, testText, flagsString], runTest);

const setFlags = (str) => {
  flagDefs.forEach(f => { flags[f.key] = str.includes(f.key); });
};
const usePreset = (p) => { pattern.value = p.pattern; setFlags(p.flags); };
const loadExample = () => {
  pattern.value = '(\\d{4})-(\\d{2})-(\\d{2})';
  setFlags('g');
  testText.value = '发布于 2026-11-26，更新于 2026-12-01，联系 test@example.com 或 13812345678。';
};
const useExample = (example) => { pattern.value = example.input; setFlags('g'); };
const clearAll = () => {
  pattern.value = ''; testText.value = ''; replacement.value = '';
  matches.value = []; errorMessage.value = ''; statusMessage.value = '';
};
const copyText = async (text, okMsg) => {
  try {
    await navigator.clipboard.writeText(text);
    statusMessage.value = okMsg;
    statusType.value = 'success';
  } catch {
    statusMessage.value = '✗ 复制失败，请手动复制';
    statusType.value = 'error';
  }
};
const copyMatches = () => copyText(matches.value.map(m => m.match).join('\n'), '✓ 匹配结果已复制到剪贴板');
const copyReplaced = () => { if (replacedText.value !== null) copyText(replacedText.value, '✓ 替换结果已复制到剪贴板'); };
</script>

<style scoped>
.regex-tester { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); }
.pattern-section, .text-section, .replace-section { margin-bottom: 16px; }
.pattern-row { display: flex; align-items: center; gap: 6px; }
.slash { color: var(--text-2); font-size: 18px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; }
.pattern-input { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 15px; box-sizing: border-box; }
.flags-text { color: var(--accent); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; min-width: 24px; }
.flags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.flag-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; border: 1px solid var(--border); cursor: pointer; }
.flag-chip.active { color: var(--text-strong); border-color: var(--accent); background: var(--accent-soft); }
.flag-chip code { font-size: 13px; }
.flag-check { position: absolute; opacity: 0; width: 0; height: 0; }
.flag-chip:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.preset-chip { padding: 5px 10px; border-radius: 999px; background: var(--bg-soft); color: var(--text); font-size: 13px; border: 1px solid var(--border); cursor: pointer; }
.preset-chip:hover { border-color: var(--accent); }
.text-input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.6; box-sizing: border-box; resize: vertical; }
.section-title { color: var(--text-strong); font-size: 1.1rem; margin: 8px 0 12px; }
.highlight-section { margin-bottom: 16px; }
.highlight-box { padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.hl { background: var(--accent-soft); color: var(--text-strong); border: 1px solid var(--accent); border-radius: 3px; padding: 0 1px; }
.hl-zero { display: inline-block; width: 2px; height: 1em; background: var(--accent); vertical-align: text-bottom; }
.no-match { color: var(--text-2); font-size: 14px; margin: 0; }
.matches-section { margin-bottom: 16px; }
.table-wrap { overflow-x: auto; }
.matches-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.matches-table th, .matches-table td { border: 1px solid var(--border); padding: 7px 10px; text-align: left; color: var(--text); vertical-align: top; }
.matches-table thead th { background: var(--bg-soft); color: var(--text-strong); }
.matches-table td code { word-break: break-all; }
.groups-cell { display: flex; flex-wrap: wrap; gap: 6px; }
.group-tag { background: var(--bg-soft); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font-size: 12px; }
.group-tag code { color: var(--accent); margin-right: 4px; }
.limit-note { color: var(--text-2); font-size: 13px; margin: 8px 0 0; }
.replace-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; box-sizing: border-box; }
.replace-actions { margin-top: 10px; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.replace-output { margin: 10px 0 0; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow-y: auto; }
@media (max-width: 640px) {
  h1 { font-size: 2rem; }
  .tool-container { padding: 20px; }
  .flags-text { min-width: 0; }
}
</style>
