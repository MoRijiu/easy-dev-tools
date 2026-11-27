<template>
  <div class="chmod-calculator">
    <h1>Chmod权限计算器</h1>
    <p class="description">勾选权限即得八进制与符号形式，也可反向解析 chmod 数字或 ls 符号串，并计算 umask 下的默认权限，全程本地、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadPreset(PRESETS[1])" class="btn btn-secondary"><span class="icon">📝</span> 示例 755</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="copySummary" class="btn btn-success"><span class="icon">📋</span> 复制摘要</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <input v-model="parseInput" class="text-input" placeholder="反向解析：755 / 4755 / rwxr-xr-x / drwxr-xr-x+ / 符号模式 u+x、a=rwx（回车解析）" spellcheck="false" aria-label="反向解析输入" @keyup.enter="doParse" />
      <div class="parse-row"><button class="btn btn-primary" @click="doParse">解析到勾选表</button></div>
      <table class="perm-table" aria-label="权限勾选表">
        <thead><tr><th></th><th>读 r（4）</th><th>写 w（2）</th><th>执行 x（1）</th><th>八进制</th></tr></thead>
        <tbody>
          <tr v-for="g in GROUPS" :key="g.key">
            <th>{{ g.label }}（{{ g.short }}）</th>
            <td v-for="p in PERMS" :key="p.key"><input type="checkbox" v-model="bits[g.key][p.key]" :aria-label="`${g.label}${p.label}`" /></td>
            <td><code>{{ digitOf(g.key) }}</code></td>
          </tr>
          <tr>
            <th>特殊位</th>
            <td colspan="3" class="special-cell">
              <label><input type="checkbox" v-model="bits.setuid" /> setuid（4）</label>
              <label><input type="checkbox" v-model="bits.setgid" /> setgid（2）</label>
              <label><input type="checkbox" v-model="bits.sticky" /> sticky（1）</label>
            </td>
            <td><code>{{ specialDigit }}</code></td>
          </tr>
        </tbody>
      </table>
      <p class="summary">chmod <code>{{ octal }}</code> · 符号 <code>{{ symbolic }}</code> · 命令 <code>chmod {{ octal }} 文件名</code> <button class="mini" @click="copyText(octal)">复制数字</button> <button class="mini" @click="copyText(symbolic)">复制符号</button></p>
      <ul class="desc-list"><li v-for="d in describeBits(bits)" :key="d">{{ d }}</li></ul>
      <div class="preset-row" aria-label="常用预设">
        <span>常用：</span>
        <button v-for="p in PRESETS" :key="p.octal" class="chip" :class="{ active: octal === p.octal }" :title="p.note" @click="loadPreset(p)">{{ p.octal }}</button>
      </div>
      <div class="umask-box">
        <h2>umask 计算</h2>
        <div class="umask-row">
          <input v-model="umaskInput" class="umask-input" aria-label="umask 输入" spellcheck="false" />
          <span v-if="umaskResult">新建文件默认 <code>{{ umaskResult.file }}</code>（{{ toSymbolic(umaskResult.fileBits) }}）· 新建目录默认 <code>{{ umaskResult.dir }}</code>（{{ toSymbolic(umaskResult.dirBits) }}）<template v-if="umaskResult.hasSpecial"> · umask 含特殊位掩码，默认权限不带特殊位</template></span>
          <span v-else class="err">{{ umaskError }}</span>
        </div>
      </div>
      <ToolExamples :examples="examples" @use-example="useExample" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { GROUPS, PERMS, PRESETS, parseChmod, parseOctal, toOctal, toSymbolic, describeBits, buildSummary, applyUmask, isChmodMode, applyChmodMode } from '@/utils/chmod.js';

const features = [
  { icon: '☑️', title: '勾选即算', description: '勾选读/写/执行与特殊位，八进制、符号形式与 chmod 命令实时生成' },
  { icon: '🔁', title: '双向解析', description: '755、4755、rwxr-xr-x、ls -l 的 10 位串乃至 u+x 符号模式都能解析回勾选表' },
  { icon: '🎭', title: 'umask 计算', description: '算出指定 umask 下新建文件与目录的默认权限' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['勾选三组权限（与特殊位），下方实时得到八进制与符号形式', '或在输入框粘贴 755 / rwxr-xr-x 点「解析到勾选表」反向查看', '点常用预设快速套用 644/755/600 等典型权限'];
const faqs = [
  { question: '目录为什么需要执行权限？', answer: '对目录而言，读是列出文件名、写是增删文件、执行是进入目录并访问其中文件。没有执行位，即使有读位也打不开里面的文件。' },
  { question: 'setuid 的 s 与 S 有什么区别？', answer: 's 表示 setuid 已设置且所有者有执行权；大写 S 表示 setuid 已设置但所有者没有执行权，通常是配置失误的信号。sticky 的 t/T 同理。' },
  { question: '777 为什么不推荐？', answer: '777 让任何本地用户都能改写甚至替换文件，可执行文件被篡改后会以所有者身份运行。共享场景优先用 775 + 所属组协作。' },
  { question: 'u+x、a=rwx 这类符号模式怎么解析？', answer: '符号模式是相对修改：以当前勾选为基底，u/g/o/a 选组、+/-/= 增删或设定、rwxst 选权限，如 ug+rw-x 表示所有者与组加读写、去执行。本工具省略 who 时按 a 处理（真实 chmod 省略时还会受 umask 影响）；X 是条件执行——任一组已有执行位时才生效；g=u 表示把所有者的权限复制给组。' },
  { question: 'ls 输出末尾的 + 和 @ 是什么？', answer: '+ 表示文件带 ACL 访问控制列表，@ 表示带扩展属性，都不是权限本身。粘贴 ls -l 的权限列时本工具会自动忽略末尾这一个标记。' },
  { question: 'umask 写四位会被截断吗？', answer: '不会。umask 022 与 0022 等价，四位写法的首位是特殊位掩码，本工具原样保留展示；新建文件/目录的默认权限本身不带特殊位，所以结果仍是三位。' }
];
const examples = [
  { input: '755', output: 'chmod 755（rwxr-xr-x）', description: '目录与可执行文件的典型权限' },
  { input: '600', output: 'chmod 600（rw-------）', description: 'SSH 私钥的推荐权限' },
  { input: 'drwxr-xr-x+', output: 'chmod 755（rwxr-xr-x），末尾 + 为 ACL 标记已忽略', description: '粘贴 ls -l 的权限列（含文件类型与 ACL 标记）' },
  { input: 'a=rw', output: 'chmod 666（rw-rw-rw-），与当前勾选无关', description: 'chmod 符号模式：三组都设为读写' }
];
const bits = reactive(parseOctal('755'));
const parseInput = ref('');
const statusMessage = ref('');
const statusType = ref('');
const umaskInput = ref('022');
const specialDigit = computed(() => (bits.setuid ? 4 : 0) + (bits.setgid ? 2 : 0) + (bits.sticky ? 1 : 0));
const digitOf = (key) => { const p = bits[key]; return (p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0); };
const octal = computed(() => toOctal(bits));
const symbolic = computed(() => toSymbolic(bits));
const umaskResult = computed(() => { try { return applyUmask(umaskInput.value); } catch { return null; } });
const umaskError = computed(() => { try { applyUmask(umaskInput.value); return ''; } catch (e) { return e.message; } });
const assign = (next) => { Object.assign(bits, next); };
const doParse = () => {
  try {
    if (isChmodMode(parseInput.value)) {
      const before = toOctal(bits);
      assign(applyChmodMode(bits, parseInput.value));
      statusMessage.value = `✓ 已按符号模式应用到当前勾选（${before} → ${toOctal(bits)}，省略 who 按 a 处理）`;
    } else { assign(parseChmod(parseInput.value)); statusMessage.value = '✓ 解析完成'; }
    statusType.value = 'success';
  }
  catch (e) { statusMessage.value = '✗ ' + e.message; statusType.value = 'error'; }
};
const loadPreset = (p) => { assign(parseOctal(p.octal)); parseInput.value = p.octal; statusMessage.value = `✓ 已套用 ${p.octal}：${p.note}`; statusType.value = 'success'; };
const useExample = (ex) => { parseInput.value = ex.input; doParse(); };
const clearAll = () => { assign(parseOctal('000')); parseInput.value = ''; statusMessage.value = ''; };
const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); statusMessage.value = '✓ 已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
const copySummary = () => copyText(buildSummary(bits));
</script>

<style scoped>
.chmod-calculator { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.text-input, .umask-input { padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; box-sizing: border-box; }
.text-input { width: 100%; }
.umask-input { width: 90px; }
.parse-row { margin: 8px 0 4px; }
.perm-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
.perm-table th, .perm-table td { border: 1px solid var(--border); padding: 7px 8px; text-align: center; }
.perm-table th { color: var(--text-2); background: var(--bg-soft); font-weight: 600; }
.special-cell { text-align: left; }
.special-cell label { margin-right: 14px; color: var(--text); white-space: nowrap; }
.summary { margin-top: 12px; font-size: 14px; font-weight: 600; color: var(--text-strong); }
.summary code, .umask-row code { color: var(--text); }
.desc-list { margin: 6px 0 0; padding-left: 18px; color: var(--text-2); font-size: 13px; }
.preset-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; color: var(--text-2); }
.chip { padding: 3px 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; }
.chip.active { background: var(--accent); color: #fff; border-color: transparent; }
.mini { padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-soft); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; }
.umask-box { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
.umask-box h2 { font-size: 15px; color: var(--text-strong); margin: 0 0 8px; }
.umask-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; color: var(--text-2); }
.err { color: var(--danger, #c0392b); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .special-cell label { display: block; margin: 2px 0; } }
</style>
