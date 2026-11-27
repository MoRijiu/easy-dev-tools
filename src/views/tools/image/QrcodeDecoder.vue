<template>
  <div class="qr-decoder">
    <h1>二维码解码</h1>
    <p class="description">上传、拖放或粘贴二维码图片，本地识别内容并判断类型（链接 / WiFi / 名片等），图片不上传服务器</p>
    <div class="tool-container">
      <div
        class="drop-zone"
        :class="{ dragging, hasImage: !!previewUrl }"
        tabindex="0"
        role="button"
        aria-label="上传二维码图片，或把图片拖放到这里"
        @click="fileInput.click()"
        @keydown.enter.prevent="fileInput.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
        @paste="onPaste"
      >
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
        <img v-if="previewUrl" :src="previewUrl" alt="待解码的二维码图片" class="preview" />
        <p v-else class="drop-hint">点击选择图片，或把图片拖放到这里<br /><span>也可以聚焦此处后按 Ctrl+V 粘贴截图</span></p>
      </div>
      <div class="row actions">
        <button class="btn" type="button" @click="fileInput.click()">选择图片</button>
        <button class="btn ghost" type="button" @click="pasteFromClipboard">从剪贴板粘贴</button>
        <button class="btn ghost" type="button" @click="loadSample">载入示例二维码</button>
        <button class="btn ghost" type="button" :disabled="!previewUrl" @click="clearAll">清空</button>
        <span v-if="imageInfo" class="meta">{{ imageInfo }}</span>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="decoding" class="hint">正在识别…</p>
      <template v-if="result">
        <p class="verdict pass">✓ 识别成功 · {{ result.info.typeName }}</p>
        <label class="block">解码内容
          <textarea :value="result.text" rows="4" readonly spellcheck="false" aria-label="解码内容"></textarea>
        </label>
        <p v-for="w in (result.info.warnings || [])" :key="w" class="warn">⚠ {{ w }}</p>
        <table v-if="result.info.rows.length" class="kv">
          <tbody>
            <tr v-for="row in result.info.rows" :key="row.label"><th>{{ row.label }}</th><td class="mono">{{ row.value }}</td></tr>
          </tbody>
        </table>
        <div class="row actions">
          <button class="btn" type="button" @click="copyText(result.text)">复制内容</button>
          <button class="btn ghost" type="button" @click="copyText(result.summary)">复制摘要</button>
          <a v-if="result.info.link" class="btn ghost link-btn" :href="result.info.link" target="_blank" rel="noopener noreferrer">打开链接</a>
        </div>
      </template>
      <ToolStatusMessage :message="statusMessage" :type="statusType" />
      <ToolFeatures :features="features" />
      <ToolUsageGuide :steps="usageSteps" />
      <ToolFaq :faqs="faqs" />
    </div>
  </div>
</template>
<script setup>
import { ref, onBeforeUnmount } from 'vue';
import jsQR from 'jsqr';
import QRCodeLib from 'qrcode';
import ToolFeatures from '@/components/ToolFeatures.vue';
import ToolUsageGuide from '@/components/ToolUsageGuide.vue';
import ToolFaq from '@/components/ToolFaq.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { classifyQrContent, buildDecodeSummary } from '@/utils/qrDecode.js';

const features = [
  { icon: '🖼️', title: '多方式导入', description: '点击选择、拖放文件、Ctrl+V 粘贴截图，也可一键读取剪贴板里的图片' },
  { icon: '🧭', title: '内容类型识别', description: '自动区分网址、WiFi、电话、邮件、短信、地理位置、vCard/MECARD 名片与纯文本并拆出字段' },
  { icon: '🔒', title: '纯本地解码', description: '图片只在浏览器内用 Canvas + jsQR 解码，不上传任何服务器' },
  { icon: '🔁', title: '反色也能认', description: '解码时同时尝试正常与反色模式，深色底浅色码也能识别' }
];
const usageSteps = ['上传、拖放或粘贴二维码图片', '自动识别并显示内容与类型', '按需复制内容、复制摘要，或直接打开识别出的链接'];
const faqs = [
  { question: '识别不出来怎么办？', answer: '多为图片模糊、二维码太小、倾斜严重或被压缩失真。可换一张更清晰的原图、把二维码裁大一些再试；纯色反色码已自动尝试反色解码。' },
  { question: '图片会上传到服务器吗？', answer: '不会。解码全程在你的浏览器本地完成，图片不离开设备；WiFi 密码、名片等敏感内容也不会被发送到任何地方。' },
  { question: '和二维码生成器有什么区别？', answer: '生成器是把文本变成二维码图片，本工具反过来：把二维码图片还原成文本，并进一步识别是链接、WiFi 还是名片等类型。' },
  { question: '识别结果上方的黄色提示是什么意思？', answer: '内容本身有可疑之处时会出现：如链接里内嵌了用户名/密码（真实域名在 @ 之后）、位置坐标超出合法范围、电话/短信号码为空。提示不影响查看内容，但打开链接或拨号前请先核对。' },
  { question: '图片有什么限制？', answer: '单张图片不超过 20MB；过小的二维码会自动放大后再识别，过大的图片会等比缩小到 3000px 内处理。动图只取第一帧。' }
];

const fileInput = ref(null);
const previewUrl = ref('');
const dragging = ref(false);
const decoding = ref(false);
const error = ref('');
const result = ref(null);
const imageInfo = ref('');
const statusMessage = ref(''); const statusType = ref('');

function revokePreview() {
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value);
}

function clearAll() {
  decodeSeq++; decoding.value = false;
  revokePreview();
  previewUrl.value = '';
  result.value = null;
  error.value = '';
  imageInfo.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

async function decodeImageElement(img) {
  const maxDim = 3000;
  let { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) throw new Error('图片加载失败，请换一张图片');
  let scale = Math.min(1, maxDim / Math.max(w, h));
  // 小图整数倍放大再识别：几十像素的小码直接喂给 jsQR 经常识别不到
  if (scale === 1 && Math.max(w, h) < 500) scale = Math.min(8, Math.ceil(500 / Math.max(w, h)));
  w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (scale > 1) ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
  return code ? code.data : '';
}

let decodeSeq = 0;
async function handleFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { error.value = '所选文件不是图片，请选择 PNG/JPG/WebP 等图片文件'; return; }
  if (file.size > 20 * 1024 * 1024) { error.value = '图片超过 20MB，请压缩后再试'; return; }
  const seq = ++decodeSeq;
  error.value = ''; result.value = null; decoding.value = true;
  revokePreview();
  previewUrl.value = URL.createObjectURL(file);
  imageInfo.value = `${file.name || '剪贴板图片'} · ${(file.size / 1024).toFixed(1)} KB`;
  try {
    const img = new Image();
    img.src = previewUrl.value;
    await img.decode();
    if (seq !== decodeSeq) return;
    imageInfo.value += ` · ${img.naturalWidth}×${img.naturalHeight}`;
    const text = await decodeImageElement(img);
    if (seq !== decodeSeq) return;
    if (!text) { error.value = '没有识别到二维码：请确认图片里有完整清晰的二维码'; return; }
    const info = classifyQrContent(text);
    result.value = { text, info, summary: buildDecodeSummary(info, text) };
  } catch (e) {
    if (seq === decodeSeq) error.value = e.message || '图片处理失败，请换一张图片重试';
  } finally {
    if (seq === decodeSeq) decoding.value = false;
  }
}

function onFileChange(e) { handleFile(e.target.files && e.target.files[0]); }
function onDrop(e) {
  dragging.value = false;
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(file);
}
function onPaste(e) {
  const items = e.clipboardData && e.clipboardData.files;
  if (items && items.length) { e.preventDefault(); handleFile(items[0]); }
}
async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find(t => t.startsWith('image/'));
      if (type) { handleFile(await item.getType(type)); return; }
    }
    error.value = '剪贴板里没有图片，请先复制一张二维码图片';
  } catch {
    error.value = '浏览器不允许直接读剪贴板，请聚焦上方区域后按 Ctrl+V 粘贴';
  }
}

async function loadSample() {
  const seq = ++decodeSeq;
  error.value = ''; result.value = null; decoding.value = true;
  try {
    const dataUrl = await QRCodeLib.toDataURL('https://tools.morijiu.cn', { width: 320, margin: 2 });
    revokePreview();
    previewUrl.value = dataUrl;
    imageInfo.value = '示例二维码（内容为本站地址）';
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const text = await decodeImageElement(img);
    if (seq !== decodeSeq) return;
    if (!text) { error.value = '示例二维码识别失败，请重试'; return; }
    const info = classifyQrContent(text);
    result.value = { text, info, summary: buildDecodeSummary(info, text) };
  } catch {
    if (seq === decodeSeq) error.value = '示例生成失败，请重试';
  } finally {
    if (seq === decodeSeq) decoding.value = false;
  }
}

async function copyText(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); statusMessage.value = '已复制到剪贴板'; statusType.value = 'success'; }
  catch { statusMessage.value = '复制失败，请手动选择复制'; statusType.value = 'error'; }
}

onBeforeUnmount(revokePreview);
</script>
<style scoped>
.qr-decoder { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.drop-zone { border: 2px dashed var(--border); border-radius: 12px; padding: 18px; text-align: center; cursor: pointer; background: var(--bg-softer); margin-bottom: 12px; }
.drop-zone.dragging { border-color: var(--accent, #4f46e5); }
.drop-zone:focus-visible { outline: 2px solid var(--accent, #4f46e5); outline-offset: 2px; }
.drop-hint { color: var(--text-2); font-size: 14px; margin: 12px 0; }
.drop-hint span { font-size: 12px; }
.preview { max-width: 260px; max-height: 260px; width: auto; height: auto; border-radius: 8px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.btn { padding: 8px 14px; border: 1px solid transparent; border-radius: 8px; background: var(--accent, #4f46e5); color: #fff; cursor: pointer; font-size: 13px; white-space: nowrap; text-decoration: none; display: inline-block; }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.meta { font-size: 12px; color: var(--text-2); }
.error { color: var(--danger, #dc2626); font-size: 14px; }
.warn { color: var(--text); background: var(--warn-soft); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 13px; margin: 0 0 8px; }
.hint { color: var(--text-2); font-size: 13px; }
.verdict { font-size: 15px; font-weight: 600; margin: 8px 0; }
.verdict.pass { color: var(--success, #16a34a); }
.kv { border-collapse: collapse; width: 100%; font-size: 13px; margin-bottom: 8px; }
.kv th { text-align: left; color: var(--text-2); font-weight: 500; padding: 5px 10px 5px 0; white-space: nowrap; vertical-align: top; }
.kv td { padding: 5px 0; color: var(--text); word-break: break-all; }
.mono { font-family: monospace; }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .preview { max-width: 200px; max-height: 200px; } }
</style>
