// MIME 类型速查：纯本地静态数据 + 按扩展名/MIME/关键词搜索与分类过滤
export const MIME_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'text', name: '文本' },
  { id: 'image', name: '图片' },
  { id: 'audio', name: '音频' },
  { id: 'video', name: '视频' },
  { id: 'application', name: '应用/文档' },
  { id: 'font', name: '字体' }
];
const M = (ext, mime, nameZh, category, note = '', keywords = '') => ({ ext, mime, nameZh, category, note, keywords });
export const MIME_TYPES = [
  M('html', 'text/html', 'HTML 文档', 'text', '网页文档，浏览器默认按此类型渲染', 'htm web page 网页'),
  M('htm', 'text/html', 'HTML 文档', 'text', '同 .html 的旧式扩展名', 'html 网页'),
  M('css', 'text/css', 'CSS 样式表', 'text', '网页样式表', 'style 样式'),
  M('csv', 'text/csv', 'CSV 表格', 'text', '逗号分隔值，可用 Excel 打开', 'excel 表格 comma'),
  M('txt', 'text/plain', '纯文本', 'text', '无格式纯文本', 'plain text 文本'),
  M('md', 'text/markdown', 'Markdown 文档', 'text', 'Markdown 轻量标记文档', 'markdown 文档'),
  M('xml', 'text/xml', 'XML 文档', 'text', '也常用 application/xml', 'xml 数据'),
  M('js', 'text/javascript', 'JavaScript 脚本', 'text', '现代标准写法，旧写法 application/javascript 已不推荐', 'javascript script 脚本 mjs'),
  M('mjs', 'text/javascript', 'JavaScript 模块', 'text', 'ES Module 文件', 'javascript module 脚本'),
  M('json', 'application/json', 'JSON 数据', 'application', '接口与配置文件最常用的数据格式', 'json api 数据'),
  M('map', 'application/json', 'Source Map', 'application', '源码映射文件，本质是 JSON', 'sourcemap 调试'),
  M('pdf', 'application/pdf', 'PDF 文档', 'application', '便携式文档格式', 'pdf 文档 adobe'),
  M('zip', 'application/zip', 'ZIP 压缩包', 'application', '最常见的压缩归档格式', 'zip 压缩 archive'),
  M('gz', 'application/gzip', 'Gzip 压缩包', 'application', '常与 tar 组合为 .tar.gz', 'gzip tar 压缩'),
  M('tar', 'application/x-tar', 'Tar 归档', 'application', '本身不压缩，常配合 gzip', 'tar 归档 压缩'),
  M('7z', 'application/x-7z-compressed', '7-Zip 压缩包', 'application', '高压缩比归档格式', '7zip 压缩'),
  M('rar', 'application/vnd.rar', 'RAR 压缩包', 'application', 'RAR 归档格式', 'rar 压缩 winrar'),
  M('wasm', 'application/wasm', 'WebAssembly', 'application', '浏览器可执行的二进制模块', 'webassembly wasm'),
  M('bin', 'application/octet-stream', '二进制流', 'application', '通用二进制兜底类型，下载时常用', 'binary octet stream 下载'),
  M('exe', 'application/vnd.microsoft.portable-executable', 'Windows 可执行文件', 'application', 'Windows 程序，也常标 octet-stream', 'windows 可执行'),
  M('dmg', 'application/x-apple-diskimage', 'macOS 磁盘镜像', 'application', 'macOS 安装镜像', 'mac apple 镜像'),
  M('iso', 'application/x-iso9660-image', '光盘镜像', 'application', 'ISO 光盘镜像文件', 'iso 镜像 光盘'),
  M('apk', 'application/vnd.android.package-archive', 'Android 安装包', 'application', 'Android 应用安装包', 'android apk 安装包'),
  M('doc', 'application/msword', 'Word 文档（旧）', 'application', 'Word 97-2003 文档', 'word office 文档'),
  M('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word 文档', 'application', '现代 Word 文档', 'word office 文档'),
  M('xls', 'application/vnd.ms-excel', 'Excel 表格（旧）', 'application', 'Excel 97-2003 表格', 'excel office 表格'),
  M('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.document', 'Excel 表格', 'application', '现代 Excel 表格', 'excel office 表格'),
  M('ppt', 'application/vnd.ms-powerpoint', 'PowerPoint（旧）', 'application', 'PowerPoint 97-2003 演示', 'ppt office 演示'),
  M('pptx', 'application/vnd.openxmlformats-officedocument.presentationml.document', 'PowerPoint 演示', 'application', '现代 PowerPoint 演示', 'ppt office 演示'),
  M('odt', 'application/vnd.oasis.opendocument.text', 'ODF 文本文档', 'application', '开放文档格式文本', 'opendocument office'),
  M('ods', 'application/vnd.oasis.opendocument.spreadsheet', 'ODF 表格', 'application', '开放文档格式表格', 'opendocument office 表格'),
  M('rtf', 'application/rtf', 'RTF 文档', 'application', '富文本格式文档', 'rtf 富文本'),
  M('sh', 'application/x-sh', 'Shell 脚本', 'application', 'Unix Shell 脚本，也常标 text/x-shellscript', 'shell script 脚本 linux'),
  M('svg', 'image/svg+xml', 'SVG 矢量图', 'image', '可缩放矢量图，本质是 XML 文本', 'svg 矢量 vector 图标'),
  M('png', 'image/png', 'PNG 图片', 'image', '无损位图，支持透明通道', 'png 图片 透明'),
  M('jpg', 'image/jpeg', 'JPEG 图片', 'image', '有损压缩照片格式，与 .jpeg 同类型', 'jpeg 照片 图片'),
  M('jpeg', 'image/jpeg', 'JPEG 图片', 'image', '与 .jpg 完全相同的 MIME 类型', 'jpg 照片 图片'),
  M('gif', 'image/gif', 'GIF 图片', 'image', '支持简单动画的位图', 'gif 动图 动画'),
  M('webp', 'image/webp', 'WebP 图片', 'image', 'Google 推出的高压缩图片格式', 'webp 图片 google'),
  M('avif', 'image/avif', 'AVIF 图片', 'image', '基于 AV1 的新一代图片格式', 'avif 图片 av1'),
  M('ico', 'image/vnd.microsoft.icon', '图标', 'image', '网站 favicon 常用格式，也见 image/x-icon', 'icon favicon 图标'),
  M('bmp', 'image/bmp', 'BMP 位图', 'image', 'Windows 位图格式', 'bmp 位图'),
  M('tif', 'image/tiff', 'TIFF 图片', 'image', '高质量图像，常用于印刷与扫描，与 .tiff 同类型', 'tiff 扫描'),
  M('tiff', 'image/tiff', 'TIFF 图片', 'image', '与 .tif 完全相同的 MIME 类型', 'tif 扫描'),
  M('heic', 'image/heic', 'HEIC 图片', 'image', 'iPhone 照片常用格式', 'heic iphone 照片'),
  M('mp3', 'audio/mpeg', 'MP3 音频', 'audio', '最普及的有损音频格式', 'mp3 音乐 音频'),
  M('wav', 'audio/wav', 'WAV 音频', 'audio', '无损波形音频，也见 audio/x-wav', 'wav 波形 音频'),
  M('ogg', 'audio/ogg', 'Ogg 音频', 'audio', '开放音频容器，视频时为 video/ogg', 'ogg 音频 vorbis'),
  M('flac', 'audio/flac', 'FLAC 音频', 'audio', '无损音频压缩', 'flac 无损 音乐'),
  M('aac', 'audio/aac', 'AAC 音频', 'audio', '高效有损音频，常用于视频伴音', 'aac 音频'),
  M('m4a', 'audio/mp4', 'M4A 音频', 'audio', 'MP4 容器中的音频文件', 'm4a mp4 音频'),
  M('opus', 'audio/opus', 'Opus 音频', 'audio', '低延迟音频，常用于语音与 WebRTC', 'opus 语音 webrtc'),
  M('mp4', 'video/mp4', 'MP4 视频', 'video', '最普及的视频容器格式', 'mp4 视频 movie'),
  M('webm', 'video/webm', 'WebM 视频', 'video', '面向 Web 的开放视频格式', 'webm 视频 web'),
  M('mov', 'video/quicktime', 'QuickTime 视频', 'video', 'Apple QuickTime 视频格式', 'mov quicktime apple 视频'),
  M('avi', 'video/x-msvideo', 'AVI 视频', 'video', 'Windows 经典视频容器', 'avi 视频 windows'),
  M('mkv', 'video/x-matroska', 'Matroska 视频', 'video', '开放视频容器，常用于高清影视', 'mkv matroska 视频'),
  M('m3u8', 'application/vnd.apple.mpegurl', 'HLS 播放列表', 'application', 'HLS 流媒体索引，也见 application/x-mpegURL', 'hls 流媒体 播放列表 m3u'),
  M('ts', 'video/mp2t', 'MPEG-TS 视频段', 'video', 'HLS 分片常用的传输流格式', 'ts hls 分片 视频'),
  M('woff', 'font/woff', 'WOFF 字体', 'font', 'Web 字体格式一代', 'font 字体 webfont'),
  M('woff2', 'font/woff2', 'WOFF2 字体', 'font', '压缩更好的 Web 字体格式，网页首选', 'font 字体 webfont'),
  M('ttf', 'font/ttf', 'TrueType 字体', 'font', '最常见的字体文件格式', 'font 字体 truetype'),
  M('otf', 'font/otf', 'OpenType 字体', 'font', 'OpenType 字体格式', 'font 字体 opentype'),
  M('eot', 'application/vnd.ms-fontobject', 'EOT 字体', 'font', '旧 IE 专用的嵌入字体格式', 'font 字体 ie'),
  M('form', 'application/x-www-form-urlencoded', '表单编码', 'application', '不是文件扩展名：HTML 表单默认提交的 Content-Type', 'form urlencoded 表单 content-type'),
  M('multipart', 'multipart/form-data', '分段表单', 'application', '不是文件扩展名：含文件上传时表单的 Content-Type', 'multipart form-data 上传 文件')
];
export function getByExtension(input = '') {
  const raw = String(input || '').trim().toLowerCase();
  const ext = raw.replace(/^\.+/, '').split('.').pop();
  if (!ext) return null;
  return MIME_TYPES.find((t) => t.ext === ext) || null;
}
export function getByMime(input = '') {
  const q = String(input || '').trim().toLowerCase();
  if (!q) return null;
  return MIME_TYPES.find((t) => t.mime === q) || null;
}
export function searchMimeTypes(query = '', category = 'all') {
  const q = String(query || '').trim().toLowerCase();
  const cat = category || 'all';
  return MIME_TYPES.filter((t) => {
    if (cat !== 'all' && t.category !== cat) return false;
    if (!q) return true;
    const hay = `.${t.ext} ${t.ext} ${t.mime} ${t.nameZh} ${t.note} ${t.keywords}`.toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part.replace(/^\./, '')) || hay.includes(part));
  });
}
export function buildMimeSummary(t) {
  if (!t) return '';
  return `.${t.ext} → ${t.mime}（${t.nameZh}）`;
}
