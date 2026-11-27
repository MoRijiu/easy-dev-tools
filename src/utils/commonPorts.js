// 常用端口速查：纯本地静态数据 + 按端口/服务/关键词搜索、分类与协议过滤、端口段判定
export const PORT_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'web', name: 'Web' },
  { id: 'database', name: '数据库' },
  { id: 'remote', name: '远程/运维' },
  { id: 'mail', name: '邮件' },
  { id: 'file', name: '文件/基础' },
  { id: 'dev', name: '开发/中间件' },
  { id: 'game', name: '游戏/其他' }
];
const P = (port, service, nameZh, protocol, category, note = '', keywords = '') => ({ port, service, nameZh, protocol, category, note, keywords });
export const COMMON_PORTS = [
  P(20, 'FTP-DATA', 'FTP 数据', 'TCP', 'file', 'FTP 主动模式下传输文件数据，现已少用', 'ftp file 文件传输'),
  P(21, 'FTP', 'FTP 控制', 'TCP', 'file', '文件传输控制连接；明文传输，公网慎用，建议 SFTP/FTPS', 'ftp file 文件传输'),
  P(22, 'SSH', '安全 Shell', 'TCP', 'remote', 'Linux 服务器远程登录与 SFTP/SCP 的默认端口', 'ssh sftp scp linux 登录'),
  P(23, 'Telnet', '远程终端', 'TCP', 'remote', '明文远程终端，已被 SSH 取代，不要暴露公网', 'telnet 远程 明文'),
  P(25, 'SMTP', '邮件发送', 'TCP', 'mail', '邮件服务器之间投递；云厂商常默认封禁出站 25', 'smtp mail 邮件 发信'),
  P(53, 'DNS', '域名解析', 'TCP/UDP', 'file', '域名解析，UDP 为主、大响应或区域传送走 TCP', 'dns 域名 解析 nameserver'),
  P(67, 'DHCP', 'DHCP 服务端', 'UDP', 'file', '局域网自动分配 IP 的服务端端口（客户端为 68）', 'dhcp ip 分配'),
  P(68, 'DHCP Client', 'DHCP 客户端', 'UDP', 'file', '终端向 DHCP 服务器请求/续租 IP 时监听的客户端端口', 'dhcp ip 分配 客户端'),
  P(69, 'TFTP', '简单文件传输', 'UDP', 'file', '无认证的简单文件传输，常用于网络设备与 PXE 启动', 'tftp pxe 文件'),
  P(80, 'HTTP', '超文本传输', 'TCP', 'web', '网站明文 HTTP，生产站点通常 301 跳转 HTTPS', 'http web 网站 网页'),
  P(110, 'POP3', '邮局协议', 'TCP', 'mail', '客户端收信（明文），加密版为 995', 'pop3 mail 收信 邮件'),
  P(123, 'NTP', '网络时间协议', 'UDP', 'file', '时钟同步，服务器时间不对先查它', 'ntp 时间 同步 时钟'),
  P(143, 'IMAP', '邮件读取', 'TCP', 'mail', '在服务器上管理邮件（明文），加密版为 993', 'imap mail 收信 邮件'),
  P(161, 'SNMP', '简单网络管理', 'UDP', 'remote', '设备监控查询，162 为告警 Trap 端口', 'snmp 监控 设备'),
  P(162, 'SNMP Trap', 'SNMP 告警', 'UDP', 'remote', '设备主动上报 Trap/SNMP 告警的目标端口（查询走 161）', 'snmp trap 告警 监控'),
  P(389, 'LDAP', '目录服务', 'TCP/UDP', 'remote', '目录与统一身份查询，加密版为 636', 'ldap 目录 ad 域'),
  P(443, 'HTTPS', '安全超文本传输', 'TCP', 'web', '加密网站与 API 的默认端口，基于 TLS', 'https web 网站 tls ssl'),
  P(445, 'SMB', '文件共享', 'TCP', 'file', 'Windows 文件共享与打印共享，不要暴露公网', 'smb windows 共享 文件'),
  P(465, 'SMTPS', 'SMTP 加密提交', 'TCP', 'mail', '隐式 TLS 的邮件提交端口', 'smtp tls mail 发信'),
  P(514, 'Syslog', '系统日志', 'UDP', 'remote', '远程日志收集常用端口', 'syslog 日志 log'),
  P(587, 'SMTP Submission', '邮件提交', 'TCP', 'mail', '客户端发信提交端口，通常配合 STARTTLS 与认证', 'smtp submission 发信 邮件'),
  P(636, 'LDAPS', '安全目录服务', 'TCP', 'remote', 'TLS 加密的 LDAP', 'ldaps ldap tls 目录'),
  P(873, 'Rsync', '远程同步', 'TCP', 'file', 'rsync 守护进程模式的默认端口', 'rsync 同步 备份'),
  P(993, 'IMAPS', '安全邮件读取', 'TCP', 'mail', 'TLS 加密的 IMAP', 'imaps imap tls 邮件'),
  P(995, 'POP3S', '安全邮局协议', 'TCP', 'mail', 'TLS 加密的 POP3', 'pop3s pop3 tls 邮件'),
  P(1080, 'SOCKS', 'SOCKS 代理', 'TCP', 'remote', 'SOCKS4/5 代理常用端口', 'socks proxy 代理'),
  P(1194, 'OpenVPN', 'OpenVPN', 'TCP/UDP', 'remote', 'OpenVPN 默认端口，UDP 更常见', 'openvpn vpn 隧道'),
  P(1433, 'MSSQL', 'SQL Server', 'TCP', 'database', 'Microsoft SQL Server 数据库', 'mssql sqlserver microsoft 数据库'),
  P(1521, 'Oracle DB', 'Oracle 数据库', 'TCP', 'database', 'Oracle Database 监听端口', 'oracle 数据库'),
  P(1723, 'PPTP', '点对点隧道', 'TCP', 'remote', 'PPTP VPN 控制端口，协议已老旧', 'pptp vpn 隧道'),
  P(1812, 'RADIUS', 'RADIUS 认证', 'UDP', 'remote', '网络接入认证，计费端口为 1813', 'radius 认证 wifi'),
  P(1813, 'RADIUS Acct', 'RADIUS 计费', 'UDP', 'remote', 'RADIUS 计费（Accounting）端口，认证走 1812', 'radius 计费 认证 wifi'),
  P(1883, 'MQTT', 'MQTT 消息', 'TCP', 'dev', 'MQTT 明文端口，物联网设备消息发布/订阅常用，TLS 版为 8883', 'mqtt 物联网 iot 消息'),
  P(2049, 'NFS', '网络文件系统', 'TCP/UDP', 'file', 'Unix/Linux 网络文件共享', 'nfs 文件 共享 linux'),
  P(2181, 'ZooKeeper', 'ZooKeeper', 'TCP', 'dev', 'ZooKeeper 客户端连接端口', 'zookeeper zk 中间件'),
  P(2375, 'Docker API', 'Docker 远程 API（明文）', 'TCP', 'dev', '无 TLS 的 Docker API，等同宿主机 root 权限，绝不要暴露公网', 'docker api 危险 容器'),
  P(2376, 'Docker API TLS', 'Docker 远程 API（TLS）', 'TCP', 'dev', '启用 TLS 客户端证书的 Docker API', 'docker api tls 容器'),
  P(2379, 'etcd', 'etcd 客户端', 'TCP', 'dev', 'etcd 客户端请求端口，集群成员通信为 2380，不要暴露公网', 'etcd k8s kubernetes 配置 中间件'),
  P(3000, 'Dev/Grafana', '开发服务/Grafana', 'TCP', 'dev', 'Grafana 默认端口，也常被本地 Web 开发服务占用', 'grafana 监控 node 开发 rails'),
  P(3306, 'MySQL', 'MySQL 数据库', 'TCP', 'database', 'MySQL/MariaDB 默认端口，不要直接暴露公网', 'mysql mariadb 数据库'),
  P(3389, 'RDP', '远程桌面', 'TCP/UDP', 'remote', 'Windows 远程桌面，不要裸奔公网，建议 VPN/网关后使用', 'rdp windows 远程桌面'),
  P(3478, 'STUN/TURN', 'NAT 穿透', 'TCP/UDP', 'remote', 'WebRTC 等实时通信的 STUN/TURN 端口，TURN TLS 版为 5349', 'stun turn webrtc 穿透 音视频'),
  P(4369, 'EPMD', 'Erlang 端口映射', 'TCP', 'dev', 'Erlang 节点发现，RabbitMQ 集群会用到', 'erlang epmd rabbitmq'),
  P(5000, 'Dev/AirPlay', '开发服务/AirPlay', 'TCP', 'dev', 'Flask 等开发服务器常用；macOS 上也可能是 AirPlay 接收', 'flask 开发 airplay'),
  P(5060, 'SIP', 'SIP 信令', 'TCP/UDP', 'remote', 'VoIP 电话与视频会议的 SIP 信令端口，TLS 版为 5061', 'sip voip 电话 信令'),
  P(5173, 'Vite', 'Vite 开发服务器', 'TCP', 'dev', 'Vite 前端开发服务器默认端口', 'vite vue react 前端 开发'),
  P(5432, 'PostgreSQL', 'PostgreSQL 数据库', 'TCP', 'database', 'PostgreSQL 默认端口', 'postgres postgresql pg 数据库'),
  P(5672, 'AMQP', 'RabbitMQ 消息', 'TCP', 'dev', 'AMQP 协议端口，RabbitMQ 管理台为 15672', 'rabbitmq amqp mq 消息队列'),
  P(5900, 'VNC', 'VNC 远程桌面', 'TCP', 'remote', 'VNC 第 0 号显示的默认端口', 'vnc 远程桌面'),
  P(5985, 'WinRM', 'Windows 远程管理', 'TCP', 'remote', 'WinRM HTTP 端口，HTTPS 为 5986', 'winrm windows 远程 powershell'),
  P(5986, 'WinRM HTTPS', 'Windows 远程管理（TLS）', 'TCP', 'remote', 'WinRM 的 HTTPS 端口（HTTP 为 5985）', 'winrm windows 远程 powershell tls'),
  P(6379, 'Redis', 'Redis 缓存', 'TCP', 'database', 'Redis 默认端口，无密码暴露公网极危险', 'redis 缓存 数据库'),
  P(6443, 'Kubernetes API', 'Kubernetes API', 'TCP', 'dev', 'Kubernetes API Server 默认端口', 'k8s kubernetes api'),
  P(8000, 'HTTP Alt/Dev', '备用 Web/开发', 'TCP', 'web', 'Django 等开发服务器与备用 HTTP 常用', 'django 开发 http 备用'),
  P(8080, 'HTTP Proxy/Alt', '备用 HTTP/代理', 'TCP', 'web', '备用 HTTP、代理与 Tomcat 等应用服务器常用', 'tomcat http 代理 备用'),
  P(8443, 'HTTPS Alt', '备用 HTTPS', 'TCP', 'web', '备用 HTTPS 端口，Tomcat/面板常见', 'https 备用 tls'),
  P(8883, 'MQTTS', 'MQTT（TLS）', 'TCP', 'dev', 'MQTT 的 TLS 加密端口，明文版为 1883', 'mqtt tls 物联网 iot 消息'),
  P(8888, 'HTTP Alt', '备用 HTTP', 'TCP', 'web', 'Jupyter、面板与备用 Web 服务常用', 'jupyter http 备用 面板'),
  P(9000, 'PHP-FPM/Sonar', '应用服务', 'TCP', 'dev', 'PHP-FPM 默认端口，也被 SonarQube 等使用', 'php-fpm sonar 应用'),
  P(9090, 'Prometheus/Cockpit', '监控/管理台', 'TCP', 'dev', 'Prometheus 与 Cockpit 管理台常用', 'prometheus cockpit 监控'),
  P(9092, 'Kafka', 'Kafka 消息', 'TCP', 'dev', 'Apache Kafka Broker 默认端口', 'kafka 消息队列 mq 中间件'),
  P(9200, 'Elasticsearch', 'Elasticsearch HTTP', 'TCP', 'database', 'Elasticsearch REST API，集群通信为 9300', 'elasticsearch es 搜索 数据库'),
  P(9300, 'Elasticsearch Cluster', 'Elasticsearch 集群', 'TCP', 'database', 'Elasticsearch 节点间集群通信端口（HTTP API 为 9200），不要暴露公网', 'elasticsearch es 集群 数据库'),
  P(9229, 'Node Inspector', 'Node.js 调试', 'TCP', 'dev', 'Node.js Inspector 调试端口，不要暴露公网', 'node inspector 调试 debug'),
  P(10000, 'Webmin', 'Webmin 面板', 'TCP', 'remote', 'Webmin 服务器管理面板默认端口', 'webmin 面板 管理'),
  P(11211, 'Memcached', 'Memcached 缓存', 'TCP/UDP', 'database', 'Memcached 默认端口', 'memcached 缓存'),
  P(15672, 'RabbitMQ UI', 'RabbitMQ 管理台', 'TCP', 'dev', 'RabbitMQ 管理界面与 HTTP API', 'rabbitmq 管理台 mq'),
  P(25565, 'Minecraft', 'Minecraft 服务器', 'TCP/UDP', 'game', 'Minecraft Java 版服务器默认端口', 'minecraft mc 游戏 我的世界'),
  P(27015, 'Steam/Game', 'Steam 游戏服务', 'TCP/UDP', 'game', 'Source 引擎等 Steam 游戏服务器常用', 'steam cs 游戏 source'),
  P(27017, 'MongoDB', 'MongoDB 数据库', 'TCP', 'database', 'MongoDB 默认端口', 'mongodb mongo 数据库'),
  P(33060, 'MySQL X', 'MySQL X 协议', 'TCP', 'database', 'MySQL X Protocol（文档存储/新协议）端口', 'mysql x protocol 数据库'),
  P(51820, 'WireGuard', 'WireGuard VPN', 'UDP', 'remote', 'WireGuard VPN 默认监听端口', 'wireguard vpn 隧道')
];
// 全角数字/字母（中文输入法粘贴常见）转半角，搜索与精确查询共用
export function normalizePortInput(input = '') {
  return String(input ?? '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
export function countByCategory() {
  const counts = { all: COMMON_PORTS.length };
  for (const t of COMMON_PORTS) counts[t.category] = (counts[t.category] || 0) + 1;
  return counts;
}
export function classifyPort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n < 0 || n > 65535) return null;
  if (n === 0) return { range: '保留端口（Reserved）', rangeEn: '0', hint: '端口 0 被 IANA 保留、不能作为监听端口使用；程序里填 0 表示让系统随机分配一个空闲端口' };
  if (n <= 1023) return { range: '熟知端口（Well-Known）', rangeEn: '0–1023', hint: '由 IANA 分配给系统服务，Unix 上绑定通常需要 root 权限' };
  if (n <= 49151) return { range: '注册端口（Registered）', rangeEn: '1024–49151', hint: '向 IANA 注册或被应用约定使用，大多数业务服务落在这一段' };
  return { range: '动态/私有端口（Dynamic）', rangeEn: '49152–65535', hint: '临时客户端端口，系统建立出站连接时随机选用，一般不作服务端监听' };
}
export function getByPort(input = '') {
  const raw = normalizePortInput(String(input ?? '').trim());
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return COMMON_PORTS.find((t) => t.port === n) || null;
}
export function searchPorts(query = '', category = 'all', protocol = 'all') {
  const q = normalizePortInput(String(query || '').trim().toLowerCase());
  const cat = category || 'all';
  const proto = protocol || 'all';
  const list = COMMON_PORTS.filter((t) => {
    if (cat !== 'all' && t.category !== cat) return false;
    if (proto !== 'all' && !t.protocol.split('/').includes(proto)) return false;
    if (!q) return true;
    const hay = `${t.port} ${t.service} ${t.nameZh} ${t.protocol} ${t.note} ${t.keywords}`.toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part));
  });
  // 纯数字查询按精确 > 端口前缀 > 其他命中排序（搜 80 时 1080 的子串命中不再排在 80 前面）；其余按端口升序
  if (/^\d+$/.test(q)) {
    const tier = (t) => (String(t.port) === q ? 0 : String(t.port).startsWith(q) ? 1 : 2);
    return list.sort((a, b) => tier(a) - tier(b) || a.port - b.port);
  }
  return list.sort((a, b) => a.port - b.port);
}
export function buildPortSummary(t) {
  if (!t) return '';
  return `${t.port} → ${t.service}（${t.nameZh}，${t.protocol}）`;
}
