<template>
  <div class="keycode-finder">
    <h1>键盘按键查询</h1>
    <p class="description">点下方区域后按任意键，实时查看 key / code / keyCode 与修饰键；下方可搜索常用键码表，全程本地、不上传</p>
    <div class="tool-container">
      <div
        class="capture"
        :class="{ focused }"
        tabindex="0"
        role="button"
        aria-label="按键捕获区，点击后按任意键查看按键信息"
        @focus="focused = true"
        @blur="focused = false"
        @keydown="onKeydown"
      >
        <template v-if="current">
          <span class="big-key">{{ current.keyDisplay }}</span>
          <span class="combo">{{ current.combo }}</span>
        </template>
        <template v-else>
          <span class="big-key placeholder">⌨️</span>
          <span class="combo">{{ focused ? '已聚焦，按任意键试试（如 Enter、F5、Ctrl+S）' : '点击此处聚焦，然后按任意键' }}</span>
        </template>
      </div>
      <p class="hint">提示：捕获区聚焦时 Tab / 空格 / 方向键等会被拦截用于识别，不会切换焦点或滚动页面；按 Esc 或点页面其他区域退出。</p>

      <div v-if="current" class="cards">
        <div class="card"><span class="label">event.key</span><span class="value">{{ current.keyDisplay }}</span></div>
        <div class="card"><span class="label">event.code</span><span class="value">{{ current.code || '-' }}</span></div>
        <div class="card"><span class="label">keyCode（已废弃）</span><span class="value">{{ current.keyCode === null ? '-' : current.keyCode }}</span></div>
        <div class="card"><span class="label">位置 location</span><span class="value">{{ current.location }} · {{ current.locationLabel }}</span></div>
        <div class="card"><span class="label">修饰键</span><span class="value">{{ current.modifiers.length ? current.modifiers.join(' + ') : '无' }}</span></div>
        <div class="card"><span class="label">中文名</span><span class="value">{{ current.nameZh || '-' }}</span></div>
      </div>
      <div v-if="current" class="actions">
        <button @click="copySummary">复制按键信息</button>
        <button @click="copySnippet">复制 JS 判断代码</button>
        <span v-if="current.repeat" class="repeat">长按重复触发中（repeat）</span>
      </div>
      <div v-if="history.length" class="history">
        <span class="history-label">最近按键：</span>
        <button v-for="(h, i) in history" :key="i" class="chip" @click="current = h">{{ h.keyDisplay }}</button>
        <button class="chip clear" @click="history = []">清空</button>
      </div>

      <div class="controls">
        <input v-model="query" type="search" placeholder="搜索键表，如 Enter / 13 / 方向 / f5" aria-label="搜索键表" class="search" />
        <div class="chips" role="group" aria-label="按分类筛选">
          <button v-for="c in KEY_CATEGORIES" :key="c.id" :class="{ active: category === c.id }" :aria-pressed="category === c.id" @click="category = c.id">{{ c.name }} {{ counts[c.id] || 0 }}</button>
        </div>
      </div>
      <p class="count">键表共 {{ counts.all }} 项，当前显示 {{ results.length }} 项<span v-if="query.trim()">（纯数字按 keyCode 精确命中优先、全角输入自动转半角）</span></p>
      <div v-if="results.length" class="table-wrap">
        <table>
          <thead><tr><th scope="col">key</th><th scope="col">code</th><th scope="col">keyCode</th><th scope="col">中文名</th><th scope="col"></th></tr></thead>
          <tbody>
            <tr v-for="k in results" :key="k.code">
              <td><code>{{ displayKey(k.key) }}</code></td>
              <td><code>{{ k.code }}</code></td>
              <td>{{ k.keyCode }}</td>
              <td>{{ k.nameZh }}</td>
              <td><button class="copy" :aria-label="`复制按键 ${k.code}`" @click="copyRow(k)">复制</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">没找到匹配的按键，换个关键词试试，如「回车」「方向」「f1」。</p>

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
import { KEY_CATEGORIES, describeKeyEvent, buildEventSummary, buildCodeSnippet, searchKeys, displayKey, countByCategory } from '@/utils/keyCodes.js';
const counts = countByCategory();
const features = [
  { icon: '⌨️', title: '按键实时识别', description: '按任意键立即显示 key、code、keyCode、位置与修饰键组合' },
  { icon: '📖', title: '常用键码表', description: '收录修饰/编辑/导航/功能键与字母数字符号，可按名称、code 或键码搜索' },
  { icon: '🧩', title: '代码片段', description: '一键复制 event.code 判断代码，省去查文档手写' },
  { icon: '🔒', title: '纯本地处理', description: '按键只在浏览器内处理，不上传任何服务器' }
];
const usageSteps = ['点击页面上方捕获区聚焦', '按任意键或组合键查看 event 信息', '或在下方键表按名称/code/键码搜索并复制'];
const faqs = [
  { question: 'event.key 和 event.code 有什么区别？', answer: 'key 是按键产生的字符或语义值，会随输入法与键盘布局变化（如 Shift 后是 A）；code 是物理按键位置（如 KeyA），与布局无关，做快捷键与游戏控制优先用 code。' },
  { question: 'keyCode 为什么标了已废弃？', answer: 'keyCode/which 是早期 API，数值随布局变化且新按键支持差，已被标准废弃；新代码应优先用 key 与 code，本工具保留它是为了维护老代码时对照。' },
  { question: '为什么空格的 key 显示为 Space？', answer: '空格键的 event.key 实际是一个空格字符 " "，直接显示看不见，本工具将其标注为 Space（空格）；其 code 为 Space、keyCode 为 32。' },
  { question: '左右 Shift/Ctrl 怎么区分？', answer: '看 event.code（ShiftLeft/ShiftRight）或 event.location（1=左、2=右），仅靠 key 与 keyCode 无法区分。' },
  { question: '为什么按 Esc 后捕获区失焦了？', answer: '这是有意设计：Esc 先被记录为一次按键，随后捕获区自动失焦退出捕获，方便继续用键盘操作页面；想继续识别再点回捕获区即可。' },
  { question: '菜单键和右 Meta 键的 keyCode 都是 93，怎么区分？', answer: '靠 event.code 区分：菜单键是 ContextMenu、右 Meta 是 MetaRight；只看 keyCode 无法分辨，这也是 keyCode 被废弃的原因之一。键表已补齐 NumLock、ScrollLock、Pause、PrintScreen、ContextMenu 等常用键。' },
  { question: '搜索框支持全角输入吗？', answer: '支持：全角数字与字母（如 ４０４、Ｅｎｔｅｒ）会自动转成半角再查；输入纯数字时 keyCode 精确命中的按键排在最前。' }
];
const focused = ref(false);
const current = ref(null);
const history = ref([]);
const query = ref(''); const category = ref('all');
const results = computed(() => searchKeys(query.value, category.value));
const statusMessage = ref(''); const statusType = ref('');
const onKeydown = (e) => {
  e.preventDefault();
  const d = describeKeyEvent(e);
  current.value = d;
  // 历史去重带上组合（Ctrl+S 与单独 S 不是同一次按键，旧版只按 code/key 去重会互相顶掉）
  history.value = [d, ...history.value.filter(h => h.combo !== d.combo)].slice(0, 8);
  // 提示文案承诺「按 Esc 退出」：记录完本次 Esc 后真的失焦（旧版只拦截不退出）
  if (e.key === 'Escape') e.currentTarget.blur();
};
const copyText = async (text, okText) => { try { await navigator.clipboard.writeText(text); statusMessage.value = '✓ ' + okText; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
const copySummary = () => copyText(buildEventSummary(current.value), '已复制按键信息');
const copySnippet = () => copyText(buildCodeSnippet(current.value), '已复制 JS 代码');
const copyRow = (k) => copyText('key: ' + displayKey(k.key) + '\ncode: ' + k.code + '\nkeyCode: ' + k.keyCode + '\n中文名: ' + k.nameZh, '已复制 ' + k.code);
</script>
<style scoped>
.keycode-finder { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.capture { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 22px 16px; border: 2px dashed var(--border); border-radius: 12px; background: var(--bg-softer); cursor: pointer; }
.capture.focused { border-style: solid; border-color: var(--accent); }
.big-key { font-size: 34px; font-weight: 700; color: var(--text-strong); line-height: 1.2; word-break: break-all; text-align: center; }
.big-key.placeholder { font-size: 30px; }
.combo { font-size: 14px; color: var(--text-2); }
.hint { font-size: 12px; color: var(--text-2); margin: 8px 0 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 14px; }
.card { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.card .label { font-size: 12px; color: var(--text-2); }
.card .value { font-size: 15px; font-weight: 600; color: var(--text-strong); word-break: break-all; }
.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.actions button, .copy { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.repeat { font-size: 12px; color: var(--text-2); }
.history { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.history-label { font-size: 13px; color: var(--text-2); }
.chip { padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.chip.clear { color: var(--text-2); }
.controls { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
.search { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; width: 100%; box-sizing: border-box; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.chips button.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.count { font-size: 13px; color: var(--text-2); margin: 12px 0 8px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); color: var(--text); white-space: nowrap; }
th { color: var(--text-2); font-weight: 600; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; }
.empty { color: var(--text-2); font-size: 14px; padding: 16px 0; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .big-key { font-size: 26px; } }
</style>
