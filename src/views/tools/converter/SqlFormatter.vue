<template>
  <div class="sql-formatter">
    <h1>SQL格式化</h1>
    <p class="description">美化或压缩 SQL：主子句分行、SELECT 列表与 AND/OR 缩进、子查询括号缩进，字符串与注释原样保留，全程本地处理、不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon">🗑️</span> 清空</button>
        <button @click="useOutputAsInput" class="btn btn-secondary" :disabled="!result"><span class="icon">↩️</span> 结果作输入</button>
        <button @click="copyOutput" class="btn btn-success" :disabled="!result"><span class="icon">📋</span> 复制结果</button>
      </ToolToolbar>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <div class="options" aria-label="格式化选项">
        <label>模式
          <select v-model="mode" @change="process">
            <option value="format">美化</option>
            <option value="minify">压缩一行</option>
          </select>
        </label>
        <label>关键词
          <select v-model="options.keywordCase" @change="process">
            <option value="upper">大写 SELECT</option>
            <option value="lower">小写 select</option>
            <option value="preserve">保持原样</option>
          </select>
        </label>
        <label v-if="mode === 'format'">缩进
          <select v-model.number="options.indentSize" @change="process">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
          </select>
        </label>
      </div>
      <div class="panes">
        <textarea v-model="inputText" class="text-input" placeholder="粘贴 SQL，如 select id, name from users where age > 18 order by name limit 10" spellcheck="false" aria-label="输入 SQL" @input="process"></textarea>
        <textarea :value="result ? result.text : ''" class="text-input" placeholder="格式化结果将显示在这里" spellcheck="false" aria-label="格式化结果" readonly></textarea>
      </div>
      <p v-if="result" class="stats">共 {{ result.stats.statements }} 条语句 · 输出 {{ result.stats.lines }} 行</p>
      <ToolExamples :examples="examples" @use-example="useExample" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { formatSql, minifySql } from '@/utils/sqlFormat.js';

const features = [
  { icon: '🧱', title: '子句分行缩进', description: 'SELECT/FROM/WHERE 等主子句顶格，字段列表与 AND/OR 条件缩进对齐' },
  { icon: '🛡️', title: '字符串不受影响', description: '引号内文本、美元引号、方括号标识符与行/块注释完整保留，不会被误拆或改大小写；未闭合与括号不配平会定位报错' },
  { icon: '🗜️', title: '美化 / 压缩', description: '一键美化阅读，也可压缩成一行方便嵌入代码或日志排查' },
  { icon: '🔒', title: '纯本地处理', description: 'SQL 不离开浏览器，不上传任何服务器，可放心粘贴业务语句' }
];
const usageSteps = ['粘贴 SQL 到左侧输入框', '选择关键词大小写与缩进，右侧实时出结果', '点「复制结果」，或切到压缩模式生成单行 SQL'];
const faqs = [
  { question: '它会校验 SQL 语法吗？', answer: '不会校验完整语法，拼写错误的关键词不会报错；但未闭合的字符串、引号标识符、块注释、美元引号与方括号标识符，以及括号不配平，都会定位到行报错，不再静默排出怪版式。执行前请仍在数据库里验证。' },
  { question: '字符串里的关键词会被格式化吗？', answer: '不会。单引号字符串（含 \' 与 \'\' 两种转义）、双引号/反引号标识符、-- 与 # 行注释、块注释在分词阶段就被整体保护，内容与大小写都不动。' },
  { question: '支持 PostgreSQL 与 T-SQL 的特殊写法吗？', answer: '支持。PostgreSQL 的 $$...$$ / $tag$...$tag$ 美元引号字符串整体保护、$1/$2 位置参数保持原样；T-SQL 的 [方括号标识符]（含 ]] 转义）也不会被拆开。' },
  { question: '语句数是怎么数的？', answer: '按分号切段、每段有实际内容才算一条：末尾不带分号的语句也算，;; 之类的空段不算，字符串里的分号不切段。' },
  { question: '支持子查询吗？', answer: '支持。括号后紧跟 SELECT 的子查询会自动换行并加深一层缩进，闭合括号回到外层对齐。' }
];
const examples = [
  { input: "select id, name, age from users where age > 18 and city = 'Beijing' order by name limit 10", output: "SELECT\n  id,\n  name,\n  age\nFROM users\nWHERE age > 18\n  AND city = 'Beijing'\nORDER BY name\nLIMIT 10", description: '基础查询美化（关键词大写）' },
  { input: 'select u.id, o.total from users u left join orders o on o.user_id = u.id group by u.id', output: 'SELECT\n  u.id,\n  o.total\nFROM users u\nLEFT JOIN orders o\nON o.user_id = u.id\nGROUP BY u.id', description: 'JOIN 查询' },
  { input: 'select id, $$select from where$$ as note from docs where id = $1', output: 'SELECT\n  id,\n  $$select from where$$ AS note\nFROM docs\nWHERE id = $1', description: 'PostgreSQL 美元引号与 $1 参数不被拆改' }
];
const inputText = ref('');
const result = ref(null);
const statusMessage = ref('');
const statusType = ref('');
const mode = ref('format');
const options = reactive({ keywordCase: 'upper', indentSize: 2 });
const process = () => {
  if (!inputText.value.trim()) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = mode.value === 'format'
      ? formatSql(inputText.value, { ...options })
      : minifySql(inputText.value, { keywordCase: options.keywordCase });
    statusMessage.value = '✓ 处理完成';
    statusType.value = 'success';
  } catch (e) {
    // 出错保留上一次结果，只更新提示，避免改坏一处就丢掉已排好的版本
    statusMessage.value = '✗ ' + (e?.message || '处理失败');
    statusType.value = 'error';
  }
};
const loadExample = () => { inputText.value = examples[0].input; process(); };
const useExample = (ex) => { inputText.value = ex.input; process(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const useOutputAsInput = () => { if (result.value) { inputText.value = result.value.text; process(); } };
const copyOutput = async () => {
  if (!result.value) return;
  try { await navigator.clipboard.writeText(result.value.text); statusMessage.value = '✓ 已复制结果'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.sql-formatter { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.options { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 12px; font-size: 13px; color: var(--text-2); }
.options select { margin-left: 4px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-softer); color: var(--text); font-size: 13px; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.text-input { width: 100%; min-height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.stats { margin-top: 10px; font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .panes { grid-template-columns: 1fr; } }
</style>
