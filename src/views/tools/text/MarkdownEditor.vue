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
        <button @click="insertBold" class="btn btn-tool" title="粗体 (Ctrl+B)">
          <span class="icon">𝐁</span>
        </button>
        <button @click="insertItalic" class="btn btn-tool" title="斜体 (Ctrl+I)">
          <span class="icon">𝐼</span>
        </button>
        <button @click="insertHeading" class="btn btn-tool" title="标题">
          <span class="icon">H</span>
        </button>
        <button @click="insertLink" class="btn btn-tool" title="链接">
          <span class="icon">🔗</span>
        </button>
        <button @click="insertImage" class="btn btn-tool" title="图片">
          <span class="icon">🖼️</span>
        </button>
        <button @click="insertCode" class="btn btn-tool" title="代码块">
          <span class="icon">&lt;/&gt;</span>
        </button>
        <button @click="insertList" class="btn btn-tool" title="列表">
          <span class="icon">☰</span>
        </button>
        <button @click="insertQuote" class="btn btn-tool" title="引用">
          <span class="icon">❝</span>
        </button>
        <button @click="insertTable" class="btn btn-tool" title="表格">
          <span class="icon">▦</span>
        </button>

        <div class="toolbar-divider"></div>

        <button @click="clearContent" class="btn btn-danger">
          <span class="icon">🗑️</span> 清空
        </button>
        <button @click="copyMarkdown" class="btn btn-secondary" :disabled="!markdownText.trim()">
          <span class="icon">📋</span> 复制
        </button>
        <button @click="exportMarkdown" class="btn btn-primary" :disabled="!markdownText.trim()">
          <span class="icon">💾</span> 导出
        </button>
        <button @click="exportHtml" class="btn btn-success" :disabled="!markdownText.trim()">
          <span class="icon">🌐</span> 导出HTML
        </button>
      </ToolToolbar>

      <!-- 状态信息 -->
      <ToolStatusMessage :message="statusMessage" :type="statusType" />

      <!-- 编辑器区域 -->
      <ToolEditorLayout>
        <!-- 输入区 -->
        <ToolEditorPanel
          title="Markdown 编辑"
          :info="`${markdownText.length} 字符 | ${lineCount} 行`"
        >
          <textarea
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

const editorRef = ref(null);
const markdownText = ref('');
const statusMessage = ref('');
const statusType = ref('');
const syncScroll = ref(true);

// 计算行数
const lineCount = computed(() => {
  return markdownText.value.split('\n').length;
});

// 简易 Markdown 解析器
const parseMarkdown = (text) => {
  if (!text) return '';

  let html = text;

  // 保存代码块，避免被其他规则处理
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
    const escapedCode = code.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    codeBlocks.push(`<pre class="code-block${lang ? ' language-' + lang : ''}"><code>${escapedCode}</code></pre>`);
    return placeholder;
  });

  // 保存行内代码
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `\x00INLINECODE${inlineCodes.length}\x00`;
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    inlineCodes.push(`<code class="inline-code">${escapedCode}</code>`);
    return placeholder;
  });

  // 转义 HTML 特殊字符
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 表格处理 - 需要在其他处理之前
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (match) => {
    const rows = match.trim().split('\n');
    let tableHtml = '<table class="md-table">';
    let isHeader = true;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // 跳过分隔行 (|---|---|)
      if (/^\|[\s\-:]+\|$/.test(row)) {
        isHeader = false;
        continue;
      }

      const cells = row.slice(1, -1).split('|').map(cell => cell.trim());
      const tag = isHeader && i === 0 ? 'th' : 'td';
      const cellsHtml = cells.map(cell => `<${tag}>${cell}</${tag}>`).join('');
      tableHtml += `<tr>${cellsHtml}</tr>`;

      if (isHeader && i === 0 && rows.length > 1 && /^\|[\s\-:]+\|$/.test(rows[1])) {
        // 第一行是表头
      } else {
        isHeader = false;
      }
    }

    tableHtml += '</table>';
    return tableHtml;
  });

  // 标题 (# ~ ######)
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

  // 水平线 (--- 或 ***) - 在列表之前处理
  html = html.replace(/^[\-\*]{3,}$/gm, '<hr>');

  // 粗体 (**text** 或 __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 斜体 (*text* 或 _text_) - 注意不要匹配列表项
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

  // 删除线 (~~text~~)
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 图片 ![alt](url) - 必须在链接之前处理
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-image" />');

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // 引用块 (> text)
  html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // 无序列表处理
  const processLists = (text) => {
    const lines = text.split('\n');
    let result = [];
    let inList = false;

    for (let line of lines) {
      if (/^[\-\*]\s+(.*)$/.test(line)) {
        if (!inList) {
          result.push('<ul>');
          inList = true;
        }
        result.push(line.replace(/^[\-\*]\s+(.*)$/, '<li>$1</li>'));
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(line);
      }
    }
    if (inList) result.push('</ul>');
    return result.join('\n');
  };
  html = processLists(html);

  // 有序列表处理
  const processOrderedLists = (text) => {
    const lines = text.split('\n');
    let result = [];
    let inList = false;

    for (let line of lines) {
      if (/^\d+\.\s+(.*)$/.test(line)) {
        if (!inList) {
          result.push('<ol>');
          inList = true;
        }
        result.push(line.replace(/^\d+\.\s+(.*)$/, '<li>$1</li>'));
      } else {
        if (inList) {
          result.push('</ol>');
          inList = false;
        }
        result.push(line);
      }
    }
    if (inList) result.push('</ol>');
    return result.join('\n');
  };
  html = processOrderedLists(html);

  // 段落和换行处理
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    // 不包装已有 HTML 标签的块
    if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|table|div)/.test(block)) {
      return block;
    }
    // 包装为段落
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 恢复行内代码
  inlineCodes.forEach((code, i) => {
    html = html.replace(`\x00INLINECODE${i}\x00`, code);
  });

  // 恢复代码块
  codeBlocks.forEach((code, i) => {
    html = html.replace(`\x00CODEBLOCK${i}\x00`, code);
  });

  return html;
};

// 渲染 HTML
const renderedHtml = computed(() => {
  return parseMarkdown(markdownText.value);
});

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
  statusMessage.value = '已清空内容';
  statusType.value = 'info';
  setTimeout(() => statusMessage.value = '', 2000);
};

// 复制 Markdown
const copyMarkdown = async () => {
  try {
    await navigator.clipboard.writeText(markdownText.value);
    statusMessage.value = '✓ Markdown 已复制到剪贴板！';
    statusType.value = 'success';
    setTimeout(() => statusMessage.value = '', 2000);
  } catch (error) {
    statusMessage.value = '✗ 复制失败，请手动复制';
    statusType.value = 'error';
  }
};

// 导出 Markdown 文件
const exportMarkdown = () => {
  const blob = new Blob([markdownText.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.md';
  a.click();
  URL.revokeObjectURL(url);
  statusMessage.value = '✓ Markdown 文件已下载！';
  statusType.value = 'success';
  setTimeout(() => statusMessage.value = '', 2000);
};

// 导出 HTML 文件
const exportHtml = () => {
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${renderedHtml.value}
</body>
</html>`;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.html';
  a.click();
  URL.revokeObjectURL(url);
  statusMessage.value = '✓ HTML 文件已下载！';
  statusType.value = 'success';
  setTimeout(() => statusMessage.value = '', 2000);
};

// 同步滚动
const handlePreviewScroll = () => {
  // 保留用于未来实现
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
    answer: '支持标题（#）、粗体（**）、斜体（*）、链接、图片、代码块、引用、列表、表格等常用语法。'
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
  color: #2c3e50;
  margin-bottom: 10px;
  text-align: center;
}

.description {
  text-align: center;
  color: #666;
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.tool-container {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* Markdown 预览样式 */
:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
  color: #2c3e50;
  margin: 1em 0 0.5em;
  font-weight: 600;
}

:deep(h1) { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
:deep(h2) { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
:deep(h3) { font-size: 1.25em; }
:deep(h4) { font-size: 1em; }

:deep(p) {
  margin: 0.8em 0;
}

:deep(strong) {
  font-weight: 700;
  color: #333;
}

:deep(em) {
  font-style: italic;
  color: #555;
}

:deep(del) {
  text-decoration: line-through;
  color: #999;
}

:deep(a) {
  color: #667eea;
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}

:deep(blockquote) {
  border-left: 4px solid #667eea;
  margin: 1em 0;
  padding: 0.5em 1em;
  background: #f8f9fa;
  color: #666;
}

:deep(ul), :deep(ol) {
  padding-left: 2em;
  margin: 0.8em 0;
}

:deep(li) {
  margin: 0.4em 0;
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
  background: #f0f0f0;
  color: #e83e8c;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

:deep(hr) {
  border: none;
  border-top: 2px solid #eee;
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
  border: 1px solid #ddd;
  padding: 10px 15px;
  text-align: left;
}

:deep(.md-table th) {
  background: #f5f5f5;
  font-weight: 600;
}

:deep(.md-table tr:nth-child(even)) {
  background: #fafafa;
}

:deep(.md-image) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 1em 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

