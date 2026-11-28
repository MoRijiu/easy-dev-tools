// HTTP 状态码速查：纯本地静态数据 + 搜索/分类过滤
export const HTTP_CATEGORIES = [
  { id: 0, name: '全部' },
  { id: 1, name: '1xx 信息' },
  { id: 2, name: '2xx 成功' },
  { id: 3, name: '3xx 重定向' },
  { id: 4, name: '4xx 客户端错误' },
  { id: 5, name: '5xx 服务器错误' }
];
const C = (code, name, nameZh, description, keywords = '') => ({ code, name, nameZh, category: Math.floor(code / 100), description, keywords });
const HTTP_STATUS_CODES = [
  C(100, 'Continue', '继续', '服务器已收到请求头，客户端应继续发送请求体。', 'continue'),
  C(101, 'Switching Protocols', '切换协议', '服务器同意按 Upgrade 头切换协议，如升级到 WebSocket。', 'websocket upgrade'),
  C(102, 'Processing', '处理中', 'WebDAV：服务器正在处理请求，尚无响应可用。', 'webdav'),
  C(103, 'Early Hints', '早期提示', '在最终响应前预先发送 Link 等头，帮助浏览器提前加载资源。', 'preload link'),
  C(200, 'OK', '成功', '请求成功，最常见的成功状态。响应体内容取决于请求方法。', 'ok success 成功'),
  C(201, 'Created', '已创建', '请求成功且服务器创建了新资源，常用于 POST 新建。', 'created post 新建'),
  C(202, 'Accepted', '已接受', '请求已接受但尚未处理完成，适合异步任务。', 'async 异步'),
  C(203, 'Non-Authoritative Information', '非权威信息', '返回的元信息来自缓存或代理，而非源服务器。', ''),
  C(204, 'No Content', '无内容', '请求成功但没有响应体，常用于删除或保存后不刷新页面。', 'delete 无响应体'),
  C(205, 'Reset Content', '重置内容', '请求成功且要求客户端重置表单等文档视图。', ''),
  C(206, 'Partial Content', '部分内容', '对 Range 范围请求的成功响应，用于断点续传与视频拖动。', 'range 断点续传 分片'),
  C(207, 'Multi-Status', '多状态', 'WebDAV：响应体包含多个子请求的状态。', 'webdav'),
  C(208, 'Already Reported', '已报告', 'WebDAV：DAV 绑定成员已在前面的多状态响应中列出。', 'webdav'),
  C(226, 'IM Used', '已使用实例操作', '服务器已完成对资源的 GET，且响应是增量操作的结果。', ''),
  C(300, 'Multiple Choices', '多种选择', '请求资源有多个可选表示，由客户端或用户选择。', ''),
  C(301, 'Moved Permanently', '永久重定向', '资源已永久移动到新 URL，搜索引擎会更新索引，后续应改用新地址。', 'redirect 永久 跳转 seo'),
  C(302, 'Found', '临时重定向', '资源临时在另一 URL，客户端后续仍应使用原地址。历史上常被误用作登录跳转。', 'redirect 临时 跳转'),
  C(303, 'See Other', '查看其他', '应使用 GET 到另一个 URL 获取响应，常用于 POST 提交后跳转结果页。', 'redirect post get'),
  C(304, 'Not Modified', '未修改', '资源未修改，客户端可直接使用缓存副本，响应无主体。', 'cache 缓存 etag'),
  C(305, 'Use Proxy', '使用代理', '所请求资源必须通过代理访问，已基本废弃。', 'proxy deprecated'),
  C(306, 'Unused', '已保留未用', '原名 Switch Proxy，已被保留、现行规范不再使用，服务器不应返回这个码。', 'reserved switch proxy 保留'),
  C(307, 'Temporary Redirect', '临时重定向（保方法）', '临时重定向且不允许改变请求方法与请求体。', 'redirect 临时'),
  C(308, 'Permanent Redirect', '永久重定向（保方法）', '永久重定向且不允许改变请求方法与请求体。', 'redirect 永久'),
  C(400, 'Bad Request', '请求错误', '请求语法或参数不合法，服务器无法理解。接口联调最先排查参数与 JSON 格式。', 'bad request 参数 错误'),
  C(401, 'Unauthorized', '未授权', '需要身份认证，或提供的凭据无效/已过期。实际语义是未认证。', 'auth 登录 token 未登录'),
  C(402, 'Payment Required', '需要付费', '为将来付费场景预留，少数接口用它表示需要付费。', 'payment'),
  C(403, 'Forbidden', '禁止访问', '已认证但无权限，或服务器明确拒绝。重新登录通常解决不了。', 'forbidden 权限 拒绝'),
  C(404, 'Not Found', '未找到', '请求的资源不存在。检查 URL、路由与资源是否已删除。', 'not found 不存在 路由'),
  C(405, 'Method Not Allowed', '方法不允许', '该资源不支持当前请求方法，如对只读接口发 POST。', 'method get post'),
  C(406, 'Not Acceptable', '不可接受', '服务器无法提供符合 Accept 头要求的内容格式。', 'accept'),
  C(407, 'Proxy Authentication Required', '代理需要认证', '需要先通过代理服务器的身份认证。', 'proxy auth'),
  C(408, 'Request Timeout', '请求超时', '客户端发送请求太慢，服务器等待超时并断开。', 'timeout 超时'),
  C(409, 'Conflict', '冲突', '请求与资源当前状态冲突，如版本冲突、重复创建、编辑冲突。', 'conflict 版本 重复'),
  C(410, 'Gone', '已删除', '资源曾存在但已被永久删除，比 404 更明确。', 'gone 删除'),
  C(411, 'Length Required', '需要内容长度', '服务器要求有效的 Content-Length 头。', 'content-length'),
  C(412, 'Precondition Failed', '先决条件失败', 'If-Match 等先决条件不满足，常用于乐观锁校验。', 'etag if-match'),
  C(413, 'Content Too Large', '请求体过大', '请求体超过服务器限制。上传文件时检查大小与网关限制。', 'payload too large 上传 大小'),
  C(414, 'URI Too Long', 'URI 过长', 'URL 超过服务器可处理的长度。', 'url long'),
  C(415, 'Unsupported Media Type', '不支持的媒体类型', '请求格式不被支持。检查 Content-Type 是否与实际数据一致。', 'content-type 格式'),
  C(416, 'Range Not Satisfiable', '范围不满足', 'Range 请求的范围超出资源大小。', 'range'),
  C(417, 'Expectation Failed', '期望失败', '服务器无法满足 Expect 头的要求。', 'expect'),
  C(418, "I'm a Teapot", '我是茶壶', '愚人节彩蛋状态码：服务器是茶壶，拒绝煮咖啡。少数接口拿它当玩笑或占位。', 'teapot 彩蛋 茶壶'),
  C(421, 'Misdirected Request', '请求方向错误', '请求被发到了无法响应该内容的服务器。', ''),
  C(422, 'Unprocessable Content', '内容无法处理', '语法正确但语义错误，常见于接口参数校验不通过（字段级错误）。', 'validation 校验 参数 unprocessable entity'),
  C(423, 'Locked', '已锁定', 'WebDAV：资源被锁定。', 'webdav lock'),
  C(424, 'Failed Dependency', '依赖失败', 'WebDAV：因前序请求失败，本请求无法执行。', 'webdav'),
  C(425, 'Too Early', '过早请求', '服务器不愿处理可能被重放的早期数据请求。', ''),
  C(426, 'Upgrade Required', '需要升级', '客户端应升级到其他协议（如 TLS 或 HTTP/2）。', 'upgrade'),
  C(428, 'Precondition Required', '需要先决条件', '服务器要求请求带先决条件头，防止丢失更新。', ''),
  C(429, 'Too Many Requests', '请求过多', '触发限流。应按 Retry-After 或指数退避重试，不要立即猛重试。', 'rate limit 限流 限速 retry'),
  C(431, 'Request Header Fields Too Large', '请求头过大', '请求头总大小或单个字段超过限制。', 'header cookie'),
  C(451, 'Unavailable For Legal Reasons', '因法律原因不可用', '因法律要求拒绝提供该资源。', 'legal 法律'),
  C(500, 'Internal Server Error', '服务器内部错误', '服务器内部异常的通用兜底。客户端改什么都没用，去看服务端日志。', 'internal error 报错 日志'),
  C(501, 'Not Implemented', '未实现', '服务器不支持完成请求所需的功能，如未实现的请求方法。', ''),
  C(502, 'Bad Gateway', '网关错误', '网关/代理从上游收到无效响应。常见于后端服务挂了、端口不对或反代配置错误。', 'gateway nginx 代理 上游'),
  C(503, 'Service Unavailable', '服务不可用', '服务暂时过载、维护或未就绪。稍后重试，并关注 Retry-After。', 'unavailable 维护 过载 重试'),
  C(504, 'Gateway Timeout', '网关超时', '网关/代理等待上游响应超时。常见于后端处理太慢或不可达。', 'gateway timeout 超时 nginx 上游'),
  C(505, 'HTTP Version Not Supported', 'HTTP 版本不支持', '服务器不支持请求所用的 HTTP 协议版本。', 'version'),
  C(507, 'Insufficient Storage', '存储空间不足', 'WebDAV：服务器存储空间不足，无法完成请求。', 'webdav storage'),
  C(508, 'Loop Detected', '检测到死循环', 'WebDAV：服务器在处理 Depth: infinity 请求时检测到无限循环。', 'webdav loop 循环'),
  C(510, 'Not Extended', '未扩展', '服务器需要客户端发送进一步的扩展请求才能完成处理，现已很少使用。', 'extended'),
  C(511, 'Network Authentication Required', '需要网络认证', '需要先完成网络接入认证，常见于公共 Wi-Fi 强制门户。', 'wifi captive')
];
function getStatusByCode(code) {
  // 严格口径：数字须为整数，字符串须为纯数字（旧版 Number() 会把 '0x194' 当 404、'' 当 0）
  let n;
  if (typeof code === 'number') n = code;
  else if (typeof code === 'string' && /^\d+$/.test(code.trim())) n = Number(code.trim());
  else return null;
  if (!Number.isInteger(n)) return null;
  return HTTP_STATUS_CODES.find((s) => s.code === n) || null;
}
// 全角数字/字母转半角（中文输入法粘过来的 ４０４ 也能查）
function normalizeQueryText(text) {
  return String(text || '').replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
  // 范围为 U+FF01–U+FF5E 全角字符与 U+3000 全角空格
}
function tokenMatches(s, token, hay) {
  const classToken = /^([1-5])xx$/.exec(token);
  if (classToken) return s.category === Number(classToken[1]);
  return hay.includes(token);
}
export function searchHttpStatus(query = '', category = 0) {
  const q = normalizeQueryText(query).trim().toLowerCase();
  const cat = Number(category) || 0;
  const filtered = HTTP_STATUS_CODES.filter((s) => {
    if (cat && s.category !== cat) return false;
    if (!q) return true;
    const hay = `${s.code} ${s.name} ${s.nameZh} ${s.description} ${s.keywords}`.toLowerCase();
    return q.split(/\s+/).every((part) => tokenMatches(s, part, hay));
  });
  // 排序：纯数字查询时 精确码 > 码前缀 > 其他命中（如描述里提到该数字）
  if (/^\d+$/.test(q)) {
    const rank = (s) => (String(s.code) === q ? 0 : String(s.code).startsWith(q) ? 1 : 2);
    return [...filtered].sort((a, b) => rank(a) - rank(b) || a.code - b.code);
  }
  return filtered;
}
// 查不到的三位码给解释：未登记 / 已保留 / 厂商自定义 / 超出范围
export function describeUnknownCode(input) {
  const text = normalizeQueryText(input).trim();
  if (!/^\d{3}$/.test(text)) return null;
  const code = Number(text);
  if (getStatusByCode(code)) return null;
  if (code < 100 || code > 599) {
    return { code, category: 0, categoryName: '', note: `HTTP 状态码的范围是 100–599，${code} 不是合法的状态码，多半是业务自定义的错误码或看错了数字。` };
  }
  const category = Math.floor(code / 100);
  const catMeta = HTTP_CATEGORIES.find((c) => c.id === category);
  const categoryName = catMeta ? catMeta.name : `${category}xx`;
  let note = `${code} 没有在 IANA 登记的官方含义，属于 ${categoryName} 区段的未分配码，遇到时多半是框架、网关或厂商的自定义扩展。`;
  if (code >= 520 && code <= 527) note = `${code} 是 Cloudflare 自定义的 5xx 码（如 520 未知错误、522 连接超时、524 上游响应超时），不是 HTTP 官方状态码，先看 Cloudflare 与源站两边的状态。`;
  else if (code === 419) note = '419 不是官方状态码，Laravel / Spring 等框架用它表示「页面已过期」（CSRF Token 失效），刷新页面重新提交即可。';
  else if (code === 420) note = '420 不是官方状态码，少数接口用它表示「请求太频繁」或当彩蛋用，官方的限流码是 429。';
  else if (code === 509) note = '509 不是官方状态码，部分主机商用它表示「带宽超限」，官方没有对应的登记含义。';
  else if (code === 499) note = '499 不是官方状态码，Nginx 用它记录「客户端在响应完成前主动断开」，只出现在访问日志里。';
  return { code, category, categoryName, note };
}
export function countByCategory() {
  const counts = { 0: HTTP_STATUS_CODES.length };
  for (const s of HTTP_STATUS_CODES) counts[s.category] = (counts[s.category] || 0) + 1;
  return counts;
}
export function buildStatusSummary(s) {
  if (!s) return '';
  return `${s.code} ${s.name}（${s.nameZh}）：${s.description}`;
}
