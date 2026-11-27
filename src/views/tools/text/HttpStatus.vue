<template>
  <div class="http-status">
    <h1>HTTP状态码查询</h1>
    <p class="description">按状态码、英文名或中文关键词速查 HTTP 状态码含义与排查提示，全程本地、不上传</p>
    <div class="tool-container">
      <div class="controls">
        <input v-model="query" type="search" placeholder="输入状态码或关键词，如 404 / 网关 / 限流" aria-label="搜索状态码" class="search" />
        <div class="chips" role="group" aria-label="按分类筛选">
          <button v-for="c in HTTP_CATEGORIES" :key="c.id" :class="{ active: category === c.id }" @click="category = c.id">{{ c.name }} · {{ counts[c.id] || 0 }}</button>
        </div>
      </div>
      <p class="count">共 {{ results.length }} 个状态码<span class="hint">支持搜「4xx」看整类、全角数字会自动转半角</span></p>
      <div v-if="results.length" class="list">
        <article v-for="s in results" :key="s.code" class="item" :data-cat="s.category">
          <div class="head"><span class="code">{{ s.code }}</span><span class="name">{{ s.name }}</span><span class="zh">{{ s.nameZh }}</span><button class="copy" @click="copyItem(s)">复制</button></div>
          <p class="desc">{{ s.description }}</p>
        </article>
      </div>
      <article v-else-if="unknown" class="item unknown">
        <div class="head"><span class="code">{{ unknown.code }}</span><span class="name">未登记状态码</span><span v-if="unknown.categoryName" class="zh">{{ unknown.categoryName }}区段</span></div>
        <p class="desc">{{ unknown.note }}</p>
      </article>
      <p v-else class="empty">没找到匹配的状态码，换个关键词试试，如「超时」「缓存」「权限」，或搜「4xx」看整类。</p>
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
import { HTTP_CATEGORIES, searchHttpStatus, buildStatusSummary, describeUnknownCode, countByCategory } from '@/utils/httpStatus.js';
const features = [
  { icon: '🔎', title: '多维搜索', description: '可按状态码、英文名、中文名或「限流/网关/缓存」等场景关键词搜索' },
  { icon: '🗂️', title: '分类筛选', description: '按 1xx 到 5xx 五大类快速缩小范围' },
  { icon: '💡', title: '排查提示', description: '常见状态码附联调与排障提示，不只是字典释义' },
  { icon: '🔒', title: '纯本地处理', description: '数据不离开浏览器，不上传任何服务器' }
];
const usageSteps = ['在搜索框输入状态码或关键词', '或点分类 chips 只看某一类', '点条目右侧「复制」带走完整说明'];
const faqs = [
  { question: '401 和 403 有什么区别？', answer: '401 是未认证（没登录或凭据失效），403 是已认证但没有权限；403 重新登录通常解决不了。' },
  { question: '502 和 504 有什么区别？', answer: '502 是网关从上游收到无效响应，504 是网关等上游响应超时；前者先查后端是否存活，后者先查后端是否太慢。' },
  { question: '429 应该怎么重试？', answer: '说明触发了限流，应按响应头 Retry-After 或指数退避重试，立即猛重试只会延长限制。' },
  { question: '查不到的状态码（如 522、419、999）是什么意思？', answer: '522/524 是 Cloudflare 自定义码、419 是 Laravel 等框架的「页面已过期」、499 是 Nginx 日志里的客户端断开；999 等三位数字超出 100–599 范围则根本不是 HTTP 状态码。在搜索框输入这类码，本页会直接给出对应解释。' },
  { question: '搜「4xx」为什么能出一整类？', answer: '搜索支持类别词 1xx–5xx，可与关键词组合，如「4xx 超时」只看客户端错误里的超时码；从中文输入法粘来的全角数字也会自动转成半角再查。' }
];
const query = ref(''); const category = ref(0);
const counts = countByCategory();
const results = computed(() => searchHttpStatus(query.value, category.value));
const unknown = computed(() => (results.value.length ? null : describeUnknownCode(query.value)));
const statusMessage = ref(''); const statusType = ref('');
const copyItem = async (s) => { try { await navigator.clipboard.writeText(buildStatusSummary(s)); statusMessage.value = '✓ 已复制 ' + s.code; statusType.value = 'success'; } catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; } };
</script>
<style scoped>
.http-status { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.hint { margin-left: 8px; color: var(--text-3); }
.item.unknown { border-style: dashed; }
.controls { display: flex; flex-direction: column; gap: 10px; }
.search { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-size: 14px; width: 100%; box-sizing: border-box; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; }
.chips button.active { background: var(--accent-solid); color: #fff; border-color: transparent; }
.count { font-size: 13px; color: var(--text-2); margin: 12px 0 8px; }
.list { display: flex; flex-direction: column; gap: 8px; }
.item { background: var(--bg-softer); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.code { font-size: 18px; font-weight: 700; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.name { font-weight: 600; color: var(--text); } .zh { color: var(--text-2); font-size: 13px; }
.copy { margin-left: auto; padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; }
.desc { margin: 6px 0 0; font-size: 14px; color: var(--text); line-height: 1.55; }
.empty { color: var(--text-2); font-size: 14px; padding: 16px 0; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } }
</style>
