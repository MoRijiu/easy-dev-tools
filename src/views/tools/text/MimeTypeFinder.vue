<template>
  <div class="mime-finder">
    <h1>MIME类型查询</h1>
    <p class="description">按文件扩展名、MIME 类型或关键词速查对应关系与 Content-Type，全程本地、不上传</p>
    <div class="tool-container">
      <div class="controls">
        <input v-model="query" type="search" placeholder="输入扩展名或 MIME，如 .png / image/png / 视频" aria-label="搜索MIME类型" class="search" />
        <div class="chips" role="group" aria-label="按分类筛选">
          <button v-for="c in MIME_CATEGORIES" :key="c.id" :class="{ active: category === c.id }" :aria-pressed="category === c.id" @click="category = c.id">{{ c.name }} {{ counts[c.id] ?? 0 }}</button>
        </div>
      </div>
      <p class="count">共 {{ results.length }} 条 · 提示：上传接口返回的 Content-Type 应与文件真实类型一致，.jpg 与 .jpeg 共用 image/jpeg</p>
      <div v-if="results.length" class="list">
        <article v-for="t in results" :key="t.ext + t.mime" class="item">
          <div class="head"><span class="ext">.{{ t.ext }}</span><code class="mime">{{ t.mime }}</code><span class="zh">{{ t.nameZh }}</span><button class="copy" :aria-label="`复制 .${t.ext} 的 MIME 类型 ${t.mime}`" @click="copyItem(t)">复制</button></div>
          <p v-if="t.note" class="desc">{{ t.note }}</p>
        </article>
      </div>
      <div v-else class="empty">
        <p v-if="unknownHint" class="unknown">{{ unknownHint }}</p>
        <p>没找到匹配的类型，换个关键词试试，如「压缩」「字体」「视频」。</p>
      </div>
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
import { MIME_CATEGORIES, searchMimeTypes, buildMimeSummary, countByCategory, describeUnknownQuery } from '@/utils/mimeTypes.js';
const counts = countByCategory();
const features = [
  { icon: '🔎', title: '双向速查', description: '既可按 .png 查 MIME，也可按 image/png 反查扩展名' },
  { icon: '🗂️', title: '分类筛选', description: '按文本、图片、音频、视频、应用与字体分类缩小范围' },
  { icon: '💡', title: '易混提示', description: '标注 .jpg/.jpeg、.tif/.tiff 等同类型关系与旧写法' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['在搜索框输入扩展名、MIME 类型或中文关键词', '或点分类 chips 只看某一类', '点条目右侧「复制」带走对应关系'];
const faqs = [
  { question: 'Content-Type 和 MIME 类型是一回事吗？', answer: '基本是：HTTP 的 Content-Type 头使用的就是 MIME 类型，如 text/html、application/json。' },
  { question: '不知道类型时用什么兜底？', answer: '二进制下载常用 application/octet-stream，表示通用二进制流，由客户端自行保存处理。' },
  { question: '为什么 .svg 算图片却能当文本打开？', answer: 'SVG 本质是 XML 文本，MIME 为 image/svg+xml，浏览器按图片渲染，编辑器也能直接查看源码。' },
  { question: '粘贴带参数的 Content-Type 能查吗？', answer: '能：如 text/html; charset=utf-8，搜索与反查会先剥掉分号后的 charset 等参数，只按主类型匹配；全角输入（如 ．ｐｎｇ）也会自动转半角。' },
  { question: '为什么搜 .form 查得到、却说它不是扩展名？', answer: 'application/x-www-form-urlencoded 与 multipart/form-data 是表单提交的 Content-Type，不是文件扩展名；速查表把它们作伪条目收录方便查 Content-Type，但按扩展名反查时不会命中。' },
  { question: '查不到的类型怎么办？', answer: '速查表只收常用类型；厂商自定义（application/vnd.*）与新登记类型未必收录，页面会给出提示。二进制下载兜底可用 application/octet-stream。' }
];
const query = ref(''); const category = ref('all');
const results = computed(() => searchMimeTypes(query.value, category.value));
const unknownHint = computed(() => (results.value.length ? '' : describeUnknownQuery(query.value)));
const statusMessage = ref(''); const statusType = ref('');
const copyItem = async (t) => { try { await navigator.clipboard.writeText(buildMimeSummary(t)); statusMessage.value = '✓ 已复制 .' + t.ext; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
</script>
<style scoped>
.mime-finder { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.unknown { border: 1px dashed var(--border-strong, var(--border)); border-radius: 8px; padding: 10px 12px; margin: 0 0 10px; line-height: 1.6; }
.controls { display: flex; flex-direction: column; gap: 10px; }
.search { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; width: 100%; box-sizing: border-box; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.chips button.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.count { font-size: 13px; color: var(--text-2); margin: 12px 0 8px; }
.list { display: flex; flex-direction: column; gap: 8px; }
.item { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ext { font-size: 16px; font-weight: 700; color: var(--text-strong); }
.mime { font-size: 13px; color: var(--text); word-break: break-all; }
.zh { color: var(--text-2); font-size: 13px; }
.copy { margin-left: auto; padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.desc { margin: 6px 0 0; font-size: 14px; color: var(--text); line-height: 1.55; }
.empty { color: var(--text-2); font-size: 14px; padding: 16px 0; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
