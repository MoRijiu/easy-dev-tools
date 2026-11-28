<!--
 * @Author: zhengduo
 * @Date: 2025-12-05
 * @Description: Markdown 编辑器组件
-->
<template>
  <div class="markdown-editor">
    <h1>Markdown 编辑器</h1>
    <p class="description">在线 Markdown 编辑器，支持实时预览、语法高亮和导出功能</p>

    <div class="tool-container">
      <!-- 工具栏 -->
      <ToolToolbar>
        <button @click="insertBold" class="btn btn-tool" title="粗体 (Ctrl+B)" aria-label="粗体 (Ctrl+B)">
          <span class="icon" aria-hidden="true">𝐁</span>
        </button>
        <button @click="insertItalic" class="btn btn-tool" title="斜体 (Ctrl+I)" aria-label="斜体 (Ctrl+I)">
          <span class="icon" aria-hidden="true">𝐼</span>
        </button>
        <button @click="insertHeading" class="btn btn-tool" title="标题" aria-label="插入标题">
          <span class="icon" aria-hidden="true">H</span>
        </button>
        <button @click="insertLink" class="btn btn-tool" title="链接" aria-label="插入链接">
          <span class="icon" aria-hidden="true">🔗</span>
        </button>
        <button @click="insertImage" class="btn btn-tool" title="图片" aria-label="插入图片">
          <span class="icon" aria-hidden="true">🖼️</span>
        </button>
        <button @click="insertCode" class="btn btn-tool" title="代码块" aria-label="插入代码块">
          <span class="icon" aria-hidden="true">&lt;/&gt;</span>
        </button>
        <button @click="insertList" class="btn btn-tool" title="列表" aria-label="插入列表">
          <span class="icon" aria-hidden="true">☰</span>
        </button>
        <button @click="insertQuote" class="btn btn-tool" title="引用" aria-label="插入引用">
          <span class="icon" aria-hidden="true">❝</span>
        </button>
        <button @click="insertTable" class="btn btn-tool" title="表格" aria-label="插入表格">
          <span class="icon" aria-hidden="true">▦</span>
        </button>

        <div class="toolbar-divider"></div>

        <button @click="clearContent" class="btn btn-danger">
          <span class="icon" aria-hidden="true">🗑️</span> 清空
        </button>
        <button @click="copyMarkdown" class="btn btn-secondary" :disabled="!markdownText.trim()">
          <span class="icon" aria-hidden="true">📋</span> 复制
        </button>
        <button @click="copyHtml" class="btn btn-secondary" :disabled="!markdownText.trim()">
          <span class="icon" aria-hidden="true">🧩</span> 复制HTML
        </button>
        <button @click="exportMarkdown" class="btn btn-primary" :disabled="!markdownText.trim()">
          <span class="icon" aria-hidden="true">💾</span> 导出
        </button>
        <button @click="exportHtml" class="btn btn-success" :disabled="!markdownText.trim()">
          <span class="icon" aria-hidden="true">🌐</span> 导出HTML
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 编辑器区域 -->
      <ToolEditorLayout>
        <!-- 输入区 -->
        <ToolEditorPanel
          title="Markdown 编辑"
          :info="statsText"
        >
          <textarea aria-label="输入 Markdown 内容"
            ref="editorRef"
            v-model="markdownText"
            class="markdown-input"
            placeholder="在此输入 Markdown 内容...

# 标题

**粗体文本** 和 *斜体文本*

- 列表项 1
- 列表项 2

[链接文本](https://example.com)

> 引用文本

`代码` 或 ```代码块```"
            spellcheck="false"
            @keydown="handleKeydown"
            @scroll="handleEditorScroll"
          ></textarea>
        </ToolEditorPanel>

        <!-- 预览区 -->
        <ToolEditorPanel title="实时预览" header-class="preview-header">
          <template #headerExtra>
            <label class="sync-scroll">
              <input type="checkbox" v-model="syncScroll"> 同步滚动
            </label>
          </template>
          <div
            ref="previewRef"
            class="markdown-preview"
            v-html="renderedHtml"
            @scroll="handlePreviewScroll"
          ></div>
        </ToolEditorPanel>
      </ToolEditorLayout>

      <!-- 使用示例 -->
      <ToolExamples :examples="examples" @use-example="useExample" />

      <!-- 功能说明 -->
      <ToolFeatures :features="features" />

      <!-- 使用说明 -->
      <ToolUsageGuide :steps="usageSteps" />

      <!-- 常见问题 -->
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import ToolEditorLayout from '@/components/ToolEditorLayout.vue';
import ToolEditorPanel from '@/components/ToolEditorPanel.vue';
import { renderMarkdown, markdownStats, buildStandaloneHtml } from '@/utils/markdown.js';
import { useStatusMessage } from '@/composables/useStatusMessage.js';
import { useClipboard } from '@/composables/useClipboard.js';
import { useDownload } from '@/composables/useDownload.js';

const editorRef = ref(null);
const previewRef = ref(null);
const markdownText = ref('');
const status = useStatusMessage();
const { statusMessage, statusType } = status;
const { copyText } = useClipboard(status);
const download = useDownload();
const syncScroll = ref(true);

// 文档统计（字符/行/词/标题/链接/图片/代码块/表格/阅读时长）
const stats = computed(() => markdownStats(markdownText.value));
const lineCount = computed(() => stats.value.lines);
const statsText = computed(() => {
  const st = stats.value;
  if (!markdownText.value.trim()) return '0 字符 | 0 行';
  const parts = [`${st.chars} 字符`, `${st.lines} 行`, `${st.words} 词`];
  if (st.headings) parts.push(`${st.headings} 标题`);
  if (st.links) parts.push(`${st.links} 链接`);
  if (st.images) parts.push(`${st.images} 图片`);
  if (st.codeBlocks) parts.push(`${st.codeBlocks} 代码块`);
  if (st.tables) parts.push(`${st.tables} 表格`);
  if (st.readingMinutes) parts.push(`约 ${st.readingMinutes} 分钟读完`);
  return parts.join(' | ');
});

// 渲染 HTML（安全渲染核心：原文 HTML 转义、危险协议链接拦截）
const renderedHtml = computed(() => renderMarkdown(markdownText.value));

// 插入文本到光标位置
const insertText = (before, after = '', placeholder = '') => {
  const textarea = editorRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = markdownText.value.substring(start, end);
  const text = selectedText || placeholder;

  markdownText.value =
    markdownText.value.substring(0, start) +
    before + text + after +
    markdownText.value.substring(end);

  nextTick(() => {
    textarea.focus();
    const newPos = start + before.length + text.length;
    textarea.setSelectionRange(start + before.length, newPos);
  });
};

// 工具栏功能
const insertBold = () => insertText('**', '**', '粗体文本');
const insertItalic = () => insertText('*', '*', '斜体文本');
const insertHeading = () => insertText('## ', '', '标题');
const insertLink = () => insertText('[', '](https://example.com)', '链接文本');
const insertImage = () => insertText('![', '](https://example.com/image.png)', '图片描述');
const insertCode = () => insertText('\n```\n', '\n```\n', '代码');
const insertList = () => insertText('- ', '', '列表项');
const insertQuote = () => insertText('> ', '', '引用文本');
const insertTable = () => insertText('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| ', ' | 内容 | 内容 |\n', '内容');

// 快捷键支持
const handleKeydown = (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        insertBold();
        break;
      case 'i':
        e.preventDefault();
        insertItalic();
        break;
    }
  }
  // Tab 键插入空格
  if (e.key === 'Tab') {
    e.preventDefault();
    insertText('  ', '');
  }
};

// 清空内容
const clearContent = () => {
  markdownText.value = '';
  status.showInfo('已清空内容', 2000);
};

// 复制 Markdown
const copyMarkdown = async () => {
  await copyText(markdownText.value, '✓ Markdown 已复制到剪贴板！', { autoClearMs: 2000 });
};

// 复制渲染后的 HTML
const copyHtml = async () => {
  await copyText(renderedHtml.value, '✓ HTML 已复制到剪贴板！', { autoClearMs: 2000 });
};

// 导出 Markdown 文件
const exportMarkdown = () => {
  download.downloadText(markdownText.value, 'document.md', 'text/markdown');
  status.showSuccess('✓ Markdown 文件已下载！', 2000);
};

// 导出 HTML 文件
const exportHtml = () => {
  const htmlContent = buildStandaloneHtml(renderedHtml.value);
  download.downloadText(htmlContent, 'document.html', 'text/html');
  status.showSuccess('✓ HTML 文件已下载！', 2000);
};

// 同步滚动：按滚动比例联动另一侧，scrollingFrom 防回环
let scrollingFrom = '';
const syncTo = (from, to) => {
  if (!from || !to || scrollingFrom === 'syncing') return;
  const maxFrom = from.scrollHeight - from.clientHeight;
  const maxTo = to.scrollHeight - to.clientHeight;
  if (maxFrom <= 0 || maxTo <= 0) return;
  scrollingFrom = 'syncing';
  to.scrollTop = (from.scrollTop / maxFrom) * maxTo;
  requestAnimationFrame(() => { scrollingFrom = ''; });
};
const handleEditorScroll = () => {
  if (syncScroll.value) syncTo(editorRef.value, previewRef.value);
};
const handlePreviewScroll = () => {
  if (syncScroll.value) syncTo(previewRef.value, editorRef.value);
};

// 使用示例
const useExample = (example) => {
  markdownText.value = example.input;
};

// 功能特点数据
const features = [
  { icon: '✨', title: '实时预览', description: '输入 Markdown 内容时即时预览渲染效果' },
  { icon: '⌨️', title: '快捷键支持', description: '支持 Ctrl+B 粗体、Ctrl+I 斜体等快捷键' },
  { icon: '📤', title: '多种导出', description: '支持导出为 Markdown 和 HTML 格式' },
  { icon: '📱', title: '响应式布局', description: '完美适配手机和平板设备' },
  { icon: '🔧', title: '工具栏', description: '便捷的工具栏快速插入常用语法' }
];

// 使用说明数据
const usageSteps = [
  '在左侧编辑区输入 Markdown 内容',
  '右侧会实时显示渲染后的预览效果',
  '使用工具栏按钮快速插入标题、粗体、链接等格式',
  '支持 Ctrl+B（粗体）、Ctrl+I（斜体）等快捷键',
  '点击"复制"按钮复制 Markdown 源码',
  '点击"导出"按钮下载 Markdown 或 HTML 文件'
];

// 常见问题数据
const faqs = [
  {
    question: '什么是 Markdown？',
    answer: 'Markdown 是一种轻量级标记语言，使用简单的文本格式语法来编写结构化文档。它被广泛用于编写文档、README 文件、博客文章等。'
  },
  {
    question: '支持哪些 Markdown 语法？',
    answer: '支持标题（#）、粗体（**）、斜体（*）、删除线、链接、图片、代码块、引用、有序/无序/任务列表（含缩进嵌套）、带对齐的表格（|:---|---:|）与水平线。'
  },
  {
    question: '粘贴别人写的 Markdown 安全吗？',
    answer: '预览渲染会把原文里的 HTML 标签转义为纯文本，链接和图片只允许 http/https/mailto/tel 与相对路径，javascript: 等危险协议会被自动降级为纯文本，不会在预览区执行脚本。'
  },
  {
    question: '同步滚动是怎么工作的？',
    answer: '勾选「同步滚动」后，编辑区与预览区按滚动比例联动，长文档对照修改时不用两边来回拖。取消勾选即可独立滚动。'
  },
  {
    question: '如何插入代码块？',
    answer: '使用三个反引号（```）包围代码，可在第一行反引号后添加语言名称（如 ```javascript）来指定语法高亮。'
  },
  {
    question: '编辑的内容会保存吗？',
    answer: '本工具在浏览器中运行，不会自动保存内容。请及时使用导出功能保存您的文档。'
  }
];

// 使用示例数据
const examples = [
  {
    input: '# 极速开发工具箱\n\n欢迎使用 **morijiu** 提供的在线工具集。',
    output: '<h1>极速开发工具箱</h1><p>欢迎使用 <strong>morijiu</strong> 提供的在线工具集。</p>',
    description: '标题和文本样式',
  },
  {
    input: '- JSON格式化\n- Base64编解码\n- 时间戳转换',
    output: '<ul><li>JSON格式化</li><li>Base64编解码</li><li>时间戳转换</li></ul>',
    description: '工具列表',
  },
  {
    input: '- [x] 写需求\n- [ ] 写代码\n\n| 工具 | 对齐 |\n| :--- | ---: |\n| JSON格式化 | 居右 |',
    output: '',
    description: '任务列表与表格对齐',
  },
  {
    input: '```javascript\n// 访问极速开发工具箱\nwindow.open("https://tools.morijiu.cn");\n```',
    output: '<pre><code>// 访问极速开发工具箱\nwindow.open("https://tools.morijiu.cn");</code></pre>',
    description: '代码块',
  },
];
</script>

<style scoped>
.markdown-editor {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 2.5rem;
  color: var(--text-strong);
  margin-bottom: 10px;
  text-align: center;
}

.description {
  text-align: center;
  color: var(--text-2);
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.tool-container {
  background: var(--surface);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--shadow-md);
}

/* 编辑/预览区定高内部滚动，同步滚动才有作用对象（原实现两区随内容撑高、无内部滚动） */
/* 面板定高后，内部 flex:1 的编辑/预览区自然被约束并各自滚动 */
.markdown-editor :deep(.editor-panel) {
  height: min(72vh, 720px);
}

/* flex 子项自动最小高度会被内容撑开，必须显式归零面板内容区才能真滚动 */
.markdown-editor :deep(.panel-content) {
  min-height: 0;
}

.markdown-editor .markdown-preview {
  overflow-y: auto;
}

/* Markdown 预览样式 */
:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
  color: var(--text-strong);
  margin: 1em 0 0.5em;
  font-weight: 600;
}

:deep(h1) { font-size: 2em; border-bottom: 2px solid var(--border); padding-bottom: 0.3em; }
:deep(h2) { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
:deep(h3) { font-size: 1.25em; }
:deep(h4) { font-size: 1em; }

:deep(p) {
  margin: 0.8em 0;
}

:deep(strong) {
  font-weight: 700;
  color: var(--text);
}

:deep(em) {
  font-style: italic;
  color: var(--text-2);
}

:deep(del) {
  text-decoration: line-through;
  color: var(--text-3);
}

:deep(a) {
  color: var(--accent-text);
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}

:deep(blockquote) {
  border-left: 4px solid var(--accent);
  margin: 1em 0;
  padding: 0.5em 1em;
  background: var(--bg);
  color: var(--text-2);
}

:deep(ul), :deep(ol) {
  padding-left: 2em;
  margin: 0.8em 0;
}

:deep(li) {
  margin: 0.4em 0;
}

:deep(li.task-item) {
  list-style: none;
  margin-left: -1.4em;
}

:deep(li.task-item input[type='checkbox']) {
  margin-right: 6px;
}

:deep(.code-block) {
  background: #282c34;
  color: #abb2bf;
  padding: 15px 20px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

:deep(.inline-code) {
  background: var(--bg-soft);
  color: var(--accent-text-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

:deep(hr) {
  border: none;
  border-top: 2px solid var(--border);
  margin: 2em 0;
}

:deep(.md-table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  display: table;
}

:deep(.md-table th),
:deep(.md-table td) {
  border: 1px solid var(--border);
  padding: 10px 15px;
  text-align: left;
}

:deep(.md-table th) {
  background: var(--bg-soft);
  font-weight: 600;
}

:deep(.md-table tr:nth-child(even)) {
  background: var(--bg-soft);
}

:deep(.md-image) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 1em 0;
  display: block;
  box-shadow: var(--shadow-card);
}

/* 响应式设计 */
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }

  .tool-container {
    padding: 20px;
  }
}
</style>

