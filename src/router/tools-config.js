// 工具配置 - 统一管理工具数据和路由
export const toolGroups = [
  {
    id: 'text',
    name: '文本处理',
    nameEn: 'text',
    icon: '📝',
    description: '各类文本处理和转换工具',
    tools: [
      {
        id: 'json-formatter',
        name: 'JSON格式化',
        nameEn: 'json-formatter',
        icon: '{ }',
        description: '格式化和验证JSON数据',
        aliases: ['json','格式化','美化','校验','geshihua','meihua'],
        path: '/text/json-formatter',
        component: () => import('../views/tools/text/JsonFormatter.vue'),
        meta: {
          title: 'JSON格式化工具 - 在线JSON美化、验证、压缩',
          description: '免费的在线JSON格式化工具，支持JSON美化、压缩、验证、语法高亮，帮助开发者快速处理JSON数据',
          keywords: 'JSON格式化,JSON美化,JSON压缩,JSON验证,JSON工具'
        }
      },
      {
        id: 'jsonpath',
        name: 'JSONPath查询',
        nameEn: 'jsonpath',
        icon: '🧭',
        description: '用JSONPath表达式从JSON中提取数据，支持通配/递归/切片/过滤',
        aliases: ['jsonpath','json','路径','查询','提取','lujing','chaxun','tiqu'],
        path: '/text/jsonpath',
        component: () => import('../views/tools/text/JsonPathQuery.vue'),
        meta: {
          title: 'JSONPath查询工具 - 在线JSONPath表达式测试与数据提取',
          description: '免费的在线JSONPath查询工具，粘贴JSON写表达式实时提取数据，支持通配、递归下降、切片、联合与条件过滤，纯本地运行不上传服务器',
          keywords: 'JSONPath,JSONPath查询,JSON提取,JSONPath测试,JSON查询'
        }
      },
      {
        id: 'base64',
        name: 'Base64编解码',
        nameEn: 'base64',
        icon: '🔐',
        description: 'Base64编码和解码工具',
        aliases: ['base64','编码','解码','bianma','jiema'],
        path: '/text/base64',
        component: () => import('../views/tools/text/Base64Encoder.vue'),
        meta: {
          title: 'Base64编解码工具 - 在线Base64编码解码',
          description: '免费的在线Base64编解码工具，支持文本和文件的Base64编码解码',
          keywords: 'Base64编码,Base64解码,Base64工具'
        }
      },
      {
        id: 'url-encode',
        name: 'URL编解码',
        nameEn: 'url-encode',
        icon: '🔗',
        description: 'URL编码和解码工具',
        aliases: ['url','链接','编码','解码','encode','decode'],
        path: '/text/url-encode',
        component: () => import('../views/tools/text/UrlEncoder.vue'),
        meta: {
          title: 'URL编解码工具 - 在线URL编码解码',
          description: '免费的在线URL编解码工具，支持URL参数编码解码',
          keywords: 'URL编码,URL解码,URL工具'
        }
      },
      {
        id: 'url-parser',
        name: 'URL解析',
        nameEn: 'url-parser',
        icon: '🧭',
        description: '拆解URL组件与查询参数，参数可编辑重组',
        aliases: ['url','链接','解析','参数','query','jiexi','canshu'],
        path: '/text/url-parser',
        component: () => import('../views/tools/text/UrlParser.vue'),
        meta: {
          title: 'URL解析工具 - 在线拆解URL组件与查询参数',
          description: '免费的在线URL解析工具，拆解协议、主机、路径与查询参数，参数可编辑并实时重组新URL，纯本地运行不上传服务器',
          keywords: 'URL解析,URL拆解,查询参数,query参数,链接解析'
        }
      },
      {
        id: 'curl-parser',
        name: 'cURL解析',
        nameEn: 'curl-parser',
        icon: '🖥️',
        description: '解析curl命令为方法/请求头/Body，并生成fetch与Python代码',
        aliases: ['curl','命令','请求','fetch','python','jiexi','mingling'],
        path: '/text/curl-parser',
        component: () => import('../views/tools/text/CurlParser.vue'),
        meta: {
          title: 'cURL解析工具 - 在线解析curl命令并生成fetch/Python代码',
          description: '免费的在线cURL解析工具，把curl命令拆成方法、URL、请求头、参数与Body，并生成JavaScript fetch与Python requests代码，纯本地运行不上传服务器',
          keywords: 'curl解析,curl转fetch,curl转python,curl命令,在线curl'
        }
      },
      {
        id: 'user-agent',
        name: 'User Agent解析',
        nameEn: 'user-agent',
        icon: '🕵️',
        description: '解析UA字符串的浏览器、系统与设备信息',
        aliases: ['ua','user agent','useragent','浏览器','设备','jiexi'],
        path: '/text/user-agent',
        component: () => import('../views/tools/text/UserAgentParser.vue'),
        meta: {
          title: 'User Agent解析工具 - 在线解析UA浏览器与设备信息',
          description: '免费的在线User Agent解析工具，识别浏览器、渲染引擎、操作系统、设备类型与机器人，纯本地运行不上传服务器',
          keywords: 'User Agent解析,UA解析,浏览器识别,设备识别,UA工具'
        }
      },
      {
        id: 'http-status',
        name: 'HTTP状态码查询',
        nameEn: 'http-status',
        icon: '🌐',
        description: '按码值或关键词速查HTTP状态码含义与排查提示',
        aliases: ['http','状态码','status','code','404','502','zhuangtaima','cha xun'],
        path: '/text/http-status',
        component: () => import('../views/tools/text/HttpStatus.vue'),
        meta: {
          title: 'HTTP状态码查询工具 - 在线速查状态码含义',
          description: '免费的在线HTTP状态码查询工具，按状态码、英文名或中文关键词速查59个状态码含义与排查提示，纯本地运行不上传服务器',
          keywords: 'HTTP状态码,状态码查询,404,502,HTTP status code'
        }
      },
      {
        id: 'mime-type',
        name: 'MIME类型查询',
        nameEn: 'mime-type',
        icon: '🧾',
        description: '按扩展名或MIME类型速查对应关系与Content-Type',
        aliases: ['mime','content-type','扩展名','文件类型','kuozhanming','leixing'],
        path: '/text/mime-type',
        component: () => import('../views/tools/text/MimeTypeFinder.vue'),
        meta: {
          title: 'MIME类型查询工具 - 在线速查扩展名与Content-Type',
          description: '免费的在线MIME类型查询工具，按文件扩展名、MIME类型或中文关键词速查对应关系，附易混类型说明，纯本地运行不上传服务器',
          keywords: 'MIME类型,Content-Type,扩展名,MIME查询,文件类型'
        }
      },
      {
        id: 'keycode-finder',
        name: '键盘按键查询',
        nameEn: 'keycode-finder',
        icon: '⌨️',
        description: '按任意键实时查看key/code/keyCode，附常用键码表',
        aliases: ['keycode','keyboard','按键','键码','键盘','event.key','event.code','jianpan','anjian'],
        path: '/text/keycode-finder',
        component: () => import('../views/tools/text/KeyCodeFinder.vue'),
        meta: {
          title: '键盘按键查询工具 - 在线KeyCode与event.key/code速查',
          description: '免费的在线键盘按键查询工具，按任意键实时查看event.key、event.code、keyCode与修饰键，附常用键码表搜索，纯本地运行不上传服务器',
          keywords: 'KeyCode查询,键盘按键,event.key,event.code,keyCode表,按键识别'
        }
      },
      {
        id: 'port-finder',
        name: '常用端口查询',
        nameEn: 'port-finder',
        icon: '🔌',
        description: '按端口号或服务名速查常用端口、协议与安全提示',
        aliases: ['port','端口','服务端口','3306','6379','ssh','duankou','fuwu'],
        path: '/text/port-finder',
        component: () => import('../views/tools/text/PortFinder.vue'),
        meta: {
          title: '常用端口查询工具 - 在线速查服务端口与协议',
          description: '免费的在线常用端口查询工具，按端口号、服务名或中文用途速查协议、服务说明与安全提示，并判定任意端口所属段，纯本地运行不上传服务器',
          keywords: '常用端口,端口查询,3306,6379,服务端口,TCP端口,UDP端口'
        }
      },
      {
        id: 'ascii-table',
        name: 'ASCII码查询',
        nameEn: 'ascii-table',
        icon: '🔡',
        description: '速查ASCII码表四种进制，并支持文本与码值互转',
        aliases: ['ascii','码表','字符编码','mabiao','bianma'],
        path: '/text/ascii-table',
        component: () => import('../views/tools/text/AsciiTable.vue'),
        meta: {
          title: 'ASCII码查询工具 - 在线ASCII码表与文本互转',
          description: '免费的在线ASCII码查询工具，速查0到127码表的十进制、十六进制、八进制与二进制，支持文本与ASCII码互转，纯本地运行不上传服务器',
          keywords: 'ASCII码表,ASCII查询,ASCII转换,字符编码,ASCII code'
        }
      },
      {
        id: 'encoding-converter',
        name: '编码转换',
        nameEn: 'encoding-converter',
        icon: '🔣',
        description: '文本与Hex/Base32/Base58互转，UTF-8安全',
        aliases: ['hex','base32','base58','编码','十六进制','bianma','zhuanhuan'],
        path: '/text/encoding-converter',
        component: () => import('../views/tools/text/EncodingConverter.vue'),
        meta: {
          title: '编码转换工具 - 在线Hex/Base32/Base58与文本互转',
          description: '免费的在线编码转换工具，文本与Hex十六进制、Base32、Base58互转，按UTF-8字节处理中文与Emoji，错误精确定位，纯本地运行不上传服务器',
          keywords: 'Hex编码,Base32,Base58,十六进制编码,编码转换,文本转Hex'
        }
      },
      {
        id: 'markdown',
        name: 'Markdown编辑器',
        nameEn: 'markdown',
        icon: '📄',
        description: '实时预览的Markdown编辑器',
        aliases: ['markdown','md','编辑器','预览','bianjiqi'],
        path: '/text/markdown',
        component: () => import('../views/tools/text/MarkdownEditor.vue'),
        meta: {
          title: 'Markdown编辑器 - 在线Markdown实时预览',
          description: '免费的在线Markdown编辑器，支持实时预览和导出',
          keywords: 'Markdown编辑器,Markdown预览,Markdown工具'
        }
      },
      {
        id: 'regex-tester',
        name: '正则表达式测试',
        nameEn: 'regex-tester',
        icon: '🔍',
        description: '在线测试正则，匹配高亮与捕获组查看',
        aliases: ['regex','regexp','正则','匹配','zhengze','pipei'],
        path: '/text/regex-tester',
        component: () => import('../views/tools/text/RegexTester.vue'),
        meta: {
          title: '正则表达式测试工具 - 在线正则匹配高亮与替换预览',
          description: '免费的在线正则表达式测试工具，实时高亮匹配、查看捕获组与命名组、预览替换结果，纯本地运行不上传服务器',
          keywords: '正则表达式,正则测试,regex,在线正则,匹配高亮'
        }
      },
      {
        id: 'unicode-html',
        name: 'Unicode/HTML实体',
        nameEn: 'unicode-html',
        icon: '🔣',
        description: 'Unicode转义与HTML实体编解码',
        aliases: ['unicode','html','实体','转义','unicode编码','shiti','zhuanyi','entity'],
        path: '/text/unicode-html',
        component: () => import('../views/tools/text/UnicodeHtmlCodec.vue'),
        meta: {
          title: 'Unicode/HTML实体编解码工具 - 在线Unicode转义与HTML实体转换',
          description: '免费的在线Unicode与HTML实体编解码工具，支持命名/十进制/十六进制实体、代理对与ES6花括号形式，纯本地运行不上传服务器',
          keywords: 'Unicode编码,Unicode解码,HTML实体,HTML编码,实体编解码'
        }
      },
      {
        id: 'case-converter',
        name: '命名格式转换',
        nameEn: 'case-converter',
        icon: '🔤',
        description: 'camelCase/snake_case/kebab-case 等命名风格互转',
        aliases: ['case','命名','驼峰','变量名','camel','snake','kebab','mingming','tuofeng'],
        path: '/text/case-converter',
        component: () => import('../views/tools/text/CaseConverter.vue'),
        meta: {
          title: '命名格式转换工具 - camelCase snake_case kebab-case互转',
          description: '免费的在线命名格式转换工具，12种命名风格一屏对照，智能拆词识别缩略词，支持多行批量，纯本地运行不上传服务器',
          keywords: '命名转换,camelCase,snake_case,kebab-case,驼峰转换,变量命名'
        }
      },
      {
        id: 'text-diff',
        name: '文本对比',
        nameEn: 'text-diff',
        icon: '↔️',
        description: '对比两段文本差异，行级与行内高亮',
        aliases: ['diff','对比','比较','差异','duibi','bijiao'],
        path: '/text/text-diff',
        component: () => import('../views/tools/text/TextDiff.vue'),
        meta: {
          title: '文本对比工具 - 在线Diff文本差异对比',
          description: '免费的在线文本对比工具，行级差异与行内字符高亮，支持忽略空白/大小写、统一与双栏视图，纯本地运行不上传服务器',
          keywords: '文本对比,Diff,在线对比,差异比较,文本差异'
        }
      },
      {
        id: 'text-stats',
        name: '文本统计',
        nameEn: 'text-stats',
        icon: '📈',
        description: '统计字数、词数、行段句、字节与阅读时长、高频词',
        aliases: ['text','count','word','字数','统计','词数','zishu','tongji','cishu'],
        path: '/text/text-stats',
        component: () => import('../views/tools/text/TextStats.vue'),
        meta: {
          title: '文本统计工具 - 在线字数词数行数统计',
          description: '免费的在线文本统计工具，统计字符、词数、行数、段落、句子、UTF-8字节与阅读时长并列出高频词，纯本地运行不上传服务器',
          keywords: '文本统计,字数统计,词数统计,word count,在线字数'
        }
      },
      {
        id: 'line-tools',
        name: '文本行工具',
        nameEn: 'line-tools',
        icon: '📋',
        description: '按行排序、去重、删空行、加行号与前后缀',
        aliases: ['line','lines','行','排序','去重','空行','paixu','quchong','hang'],
        path: '/text/line-tools',
        component: () => import('../views/tools/text/LineTools.vue'),
        meta: {
          title: '文本行工具 - 在线按行排序去重删空行',
          description: '免费的在线文本行工具，自然排序、去除重复行、删除空行、修剪、反转、添加行号与前后缀，纯本地运行不上传服务器',
          keywords: '文本行工具,按行排序,去除重复行,删除空行,行排序,去重'
        }
      }
    ]
  },
  {
    id: 'converter',
    name: '格式转换',
    nameEn: 'converter',
    icon: '🔄',
    description: '各种数据格式转换工具',
    tools: [
      {
        id: 'timestamp',
        name: '时间戳转换',
        nameEn: 'timestamp',
        icon: '⏰',
        description: '时间戳与日期时间互转',
        aliases: ['timestamp','时间戳','日期','unix','shijianchuo'],
        path: '/converter/timestamp',
        component: () => import('../views/tools/converter/TimestampConverter.vue'),
        meta: {
          title: '时间戳转换工具 - Unix时间戳转换',
          description: '免费的在线时间戳转换工具，支持Unix时间戳与日期时间互转',
          keywords: '时间戳转换,Unix时间戳,时间戳工具'
        }
      },
      {
        id: 'cron-parser',
        name: 'Cron表达式解析',
        nameEn: 'cron-parser',
        icon: '⏱️',
        description: '解析Cron表达式含义并预览执行时间',
        aliases: ['cron','crontab','定时','表达式','定时任务','dingshi'],
        path: '/converter/cron-parser',
        component: () => import('../views/tools/converter/CronParser.vue'),
        meta: {
          title: 'Cron表达式解析工具 - 在线解析Cron定时表达式',
          description: '免费的在线Cron表达式解析工具，逐字段说明含义并预览未来执行时间，支持5/6/7字段与@daily别名，纯本地计算',
          keywords: 'Cron解析,Cron表达式,crontab,定时任务'
        }
      },
      {
        id: 'base-converter',
        name: '进制转换',
        nameEn: 'base-converter',
        icon: '🔢',
        description: '二/八/十/十六等进制互转，支持大整数与小数',
        aliases: ['base','radix','进制','二进制','十六进制','jinzhi','hex','binary'],
        path: '/converter/base-converter',
        component: () => import('../views/tools/converter/BaseConverter.vue'),
        meta: {
          title: '进制转换工具 - 在线二/八/十/十六进制互转',
          description: '免费的在线进制转换工具，支持2到36进制互转、任意精度大整数与小数，识别0x/0b/0o前缀，纯本地计算不上传服务器',
          keywords: '进制转换,二进制,十六进制,八进制,base converter'
        }
      },
      {
        id: 'json-csv',
        name: 'JSON/CSV互转',
        nameEn: 'json-csv',
        icon: '📊',
        description: 'JSON对象数组与CSV表格互转，支持类型推断',
        aliases: ['json','csv','表格','互转','excel','biaoge','huzhuan'],
        path: '/converter/json-csv',
        component: () => import('../views/tools/converter/JsonCsvConverter.vue'),
        meta: {
          title: 'JSON/CSV互转工具 - 在线JSON转CSV、CSV转JSON',
          description: '免费的在线JSON/CSV互转工具，表头并集、RFC 4180规范转义、CSV转JSON可选类型推断，纯本地运行不上传服务器',
          keywords: 'JSON转CSV,CSV转JSON,JSON CSV互转,表格转换'
        }
      },
      {
        id: 'yaml-json',
        name: 'YAML/JSON互转',
        nameEn: 'yaml-json',
        icon: '🔀',
        description: 'YAML与JSON互转，支持嵌套、流式写法、注释与块标量',
        aliases: ['yaml','yml','json','配置','互转','peizhi','huzhuan'],
        path: '/converter/yaml-json',
        component: () => import('../views/tools/converter/YamlJsonConverter.vue'),
        meta: {
          title: 'YAML/JSON互转工具 - 在线YAML转JSON、JSON转YAML',
          description: '免费的在线YAML/JSON互转工具，支持嵌套映射与序列、流式写法、引号字符串、注释与块标量，错误定位到行，纯本地运行不上传服务器',
          keywords: 'YAML转JSON,JSON转YAML,YAML JSON互转,配置文件转换'
        }
      },
      {
        id: 'sql-formatter',
        name: 'SQL格式化',
        nameEn: 'sql-formatter',
        icon: '🗄️',
        description: '美化或压缩SQL，子句分行缩进，字符串与注释不受影响',
        aliases: ['sql','数据库','格式化','查询','geshihua','shujuku'],
        path: '/converter/sql-formatter',
        component: () => import('../views/tools/converter/SqlFormatter.vue'),
        meta: {
          title: 'SQL格式化工具 - 在线SQL美化与压缩',
          description: '免费的在线SQL格式化工具，主子句分行、字段与条件缩进、子查询缩进，支持关键词大小写与压缩一行，纯本地运行不上传服务器',
          keywords: 'SQL格式化,SQL美化,SQL压缩,在线SQL,SQL工具'
        }
      },
      {
        id: 'toml-json',
        name: 'TOML/JSON 互转',
        nameEn: 'toml-json',
        icon: '🧾',
        description: 'TOML 与 JSON 双向转换，支持表/数组表/点分键，错误定位到行',
        aliases: ['toml','json','配置','互转','peizhi','huzhuan'],
        path: '/converter/toml-json',
        component: () => import('../views/tools/converter/TomlJsonConverter.vue'),
        meta: {
          title: 'TOML/JSON互转工具 - 在线TOML与JSON双向转换',
          description: '免费的在线TOML/JSON互转工具，支持表、数组表、点分键、多行字符串与日期时间，错误定位到行，纯本地运行不上传服务器',
          keywords: 'TOML转JSON,JSON转TOML,TOML解析,TOML工具,配置转换'
        }
      },
      {
        id: 'xml-formatter',
        name: 'XML格式化',
        nameEn: 'xml-formatter',
        icon: '📰',
        description: '美化或压缩XML并校验良构性，错误定位到行',
        aliases: ['xml','格式化','校验','报文','geshihua','jiaoyan'],
        path: '/converter/xml-formatter',
        component: () => import('../views/tools/converter/XmlFormatter.vue'),
        meta: {
          title: 'XML格式化工具 - 在线XML美化、压缩与校验',
          description: '免费的在线XML格式化工具，按嵌套缩进美化或压缩一行，校验标签匹配与单个根元素并把错误定位到行，纯本地运行不上传服务器',
          keywords: 'XML格式化,XML美化,XML压缩,XML校验,在线XML'
        }
      },
      {
        id: 'css-formatter',
        name: 'CSS格式化',
        nameEn: 'css-formatter',
        icon: '🎨',
        description: '美化或压缩CSS并校验结构，错误定位到行',
        aliases: ['css','格式化','美化','压缩','样式','geshihua','yangshi'],
        path: '/converter/css-formatter',
        component: () => import('../views/tools/converter/CssFormatter.vue'),
        meta: {
          title: 'CSS格式化工具 - 在线CSS美化、压缩与校验',
          description: '免费的在线CSS格式化工具，按嵌套缩进美化或压缩一行，校验大括号配平与声明完整性并把错误定位到行，纯本地运行不上传服务器',
          keywords: 'CSS格式化,CSS美化,CSS压缩,CSS校验,在线CSS'
        }
      },
      {
        id: 'html-formatter',
        name: 'HTML格式化',
        nameEn: 'html-formatter',
        icon: '🌐',
        description: '美化或压缩HTML并校验标签嵌套，错误定位到行',
        aliases: ['html','格式化','美化','压缩','标签','geshihua','biaoqian'],
        path: '/converter/html-formatter',
        component: () => import('../views/tools/converter/HtmlFormatter.vue'),
        meta: {
          title: 'HTML格式化工具 - 在线HTML美化、压缩与校验',
          description: '免费的在线HTML格式化工具，按嵌套缩进美化或压缩一行，校验标签匹配并把错误定位到行，script/pre内容原样保留，纯本地运行不上传服务器',
          keywords: 'HTML格式化,HTML美化,HTML压缩,HTML校验,在线HTML'
        }
      },
      {
        id: 'cidr-calculator',
        name: 'CIDR子网计算器',
        nameEn: 'cidr-calculator',
        icon: '🌐',
        description: '由IP与前缀算网络/广播地址、可用主机范围与掩码',
        aliases: ['cidr','子网','网段','掩码','subnet','ip','wangduan','yanma'],
        path: '/converter/cidr-calculator',
        component: () => import('../views/tools/converter/CidrCalculator.vue'),
        meta: {
          title: 'CIDR子网计算器 - 在线IPv4子网掩码与网段计算',
          description: '免费的在线CIDR子网计算器，输入IPv4地址与前缀算出网络地址、广播地址、可用主机范围、子网掩码与地址性质，纯本地计算不上传服务器',
          keywords: 'CIDR计算,子网计算,子网掩码,网段计算,IP计算器'
        }
      },
      {
        id: 'ip-address',
        name: 'IP地址工具',
        nameEn: 'ip-address',
        icon: '🛰️',
        description: '解析IPv4/IPv6：整数/十六进制互转、展开压缩与性质判定',
        aliases: ['ip','ipv4','ipv6','地址','dizhi','jiexi'],
        path: '/converter/ip-address',
        component: () => import('../views/tools/converter/IpAddressTool.vue'),
        meta: {
          title: 'IP地址工具 - 在线IPv4/IPv6解析与互转',
          description: '免费的在线IP地址工具，IPv4与整数、十六进制、二进制互转，IPv6按RFC 5952展开与压缩，判定私有、环回、组播等性质，纯本地运行不上传服务器',
          keywords: 'IP地址,IPv4转换,IPv6展开,IPv6压缩,IP解析,整数转IP'
        }
      },
      {
        id: 'data-size',
        name: '数据大小换算',
        nameEn: 'data-size',
        icon: '💾',
        description: '字节/比特与KB/MB/GB互转，SI与IEC双标准，估算下载耗时',
        aliases: ['data','size','byte','字节','容量','文件大小','换算','rongliang','huansuan'],
        path: '/converter/data-size',
        component: () => import('../views/tools/converter/DataSizeConverter.vue'),
        meta: {
          title: '数据大小换算工具 - 在线字节KB MB GB与比特互转',
          description: '免费的在线数据大小换算工具，字节、比特与KB/MB/GB/TB互转，SI 1000与IEC 1024双标准对照，按网速估算下载耗时，纯本地运行不上传服务器',
          keywords: '数据大小换算,字节换算,MB转GB,KB换算,比特字节,下载耗时估算'
        }
      },
      {
        id: 'json-to-ts',
        name: 'JSON转TypeScript',
        nameEn: 'json-to-ts',
        icon: '🧩',
        description: '由JSON生成TS interface，嵌套拆分、数组合并推断',
        aliases: ['json','typescript','ts','interface','类型','leixing','jiekou'],
        path: '/converter/json-to-ts',
        component: () => import('../views/tools/converter/JsonToTypescript.vue'),
        meta: {
          title: 'JSON转TypeScript工具 - 在线JSON生成TS interface类型',
          description: '免费的在线JSON转TypeScript工具，嵌套对象拆独立interface、对象数组合并推断可选字段、同形接口复用，纯本地运行不上传服务器',
          keywords: 'JSON转TypeScript,JSON生成interface,TS类型生成,json to ts'
        }
      },
      {
        id: 'date-calculator',
        name: '日期计算器',
        nameEn: 'date-calculator',
        icon: '📅',
        description: '计算日期间隔、工作日与日期加减',
        aliases: ['date','日期','天数','间隔','工作日','riqi','tianshu','jiange'],
        path: '/converter/date-calculator',
        component: () => import('../views/tools/converter/DateCalculator.vue'),
        meta: {
          title: '日期计算器 - 在线计算日期间隔与日期加减',
          description: '免费的在线日期计算器，计算两日期相隔天数、年月日分解、工作日与周末天数，支持日期加减天/周/月/年，纯本地运行不上传服务器',
          keywords: '日期计算器,日期间隔,天数计算,工作日计算,日期加减'
        }
      },
      {
        id: 'semver',
        name: 'SemVer版本工具',
        nameEn: 'semver',
        icon: '🏷️',
        description: '解析语义化版本、比较大小、递增与范围校验',
        aliases: ['semver','版本','语义化版本','版本号','version','banben','yuyihua'],
        path: '/converter/semver',
        component: () => import('../views/tools/converter/SemverTool.vue'),
        meta: {
          title: 'SemVer版本工具 - 在线解析比较语义化版本',
          description: '免费的在线SemVer语义化版本工具，解析主/次/修订与预发布、比较优先级、一键递增、校验 ^ ~ 区间范围，纯本地运行不上传服务器',
          keywords: 'SemVer,语义化版本,版本比较,版本号解析,版本范围'
        }
      },
      {
        id: 'docker-run',
        name: 'Docker Run转Compose',
        nameEn: 'docker-run',
        icon: '🐳',
        description: '把docker run命令解析为docker-compose.yml配置',
        aliases: ['docker','compose','容器','run命令','rongqi','zhuanhuan'],
        path: '/converter/docker-run',
        component: () => import('../views/tools/converter/DockerRunConverter.vue'),
        meta: {
          title: 'Docker Run转Compose工具 - 在线生成docker-compose.yml',
          description: '免费的在线Docker Run转Compose工具，解析docker run命令的端口、挂载、环境变量与重启策略，一键生成docker-compose.yml，纯本地运行不上传服务器',
          keywords: 'docker run转compose,docker-compose生成,docker命令转换,compose.yml'
        }
      },
      {
        id: 'chmod-calculator',
        name: 'Chmod权限计算器',
        nameEn: 'chmod-calculator',
        icon: '🔐',
        description: '勾选权限算八进制与符号形式、反向解析与umask计算',
        aliases: ['chmod','权限','linux','文件权限','quanxian','bash'],
        path: '/converter/chmod-calculator',
        component: () => import('../views/tools/converter/ChmodCalculator.vue'),
        meta: {
          title: 'Chmod权限计算器 - 在线计算Linux文件权限',
          description: '免费的在线Chmod权限计算器，勾选读/写/执行与setuid等特殊位实时得到八进制与符号形式，支持反向解析与umask默认权限计算，纯本地运行不上传服务器',
          keywords: 'chmod,权限计算器,Linux文件权限,755,644,umask'
        }
      },
      {
        id: 'color-converter',
        name: '颜色转换',
        nameEn: 'color-converter',
        icon: '🎨',
        description: 'RGB、HEX、HSL颜色转换',
        aliases: ['color','颜色','rgb','hex','hsl','yanse'],
        path: '/converter/color-converter',
        component: () => import('../views/tools/converter/ColorConverter.vue'),
        meta: {
          title: '颜色转换工具 - RGB HEX HSL颜色转换',
          description: '免费的在线颜色转换工具，支持RGB、HEX、HSL等颜色格式互转',
          keywords: '颜色转换,RGB转换,HEX转换,HSL转换'
        }
      },
      {
        id: 'unit-converter',
        name: '单位转换',
        nameEn: 'unit-converter',
        icon: '📏',
        description: '长度、重量等单位转换',
        aliases: ['unit','单位','长度','重量','温度','danwei'],
        path: '/converter/unit-converter',
        component: () => import('../views/tools/converter/UnitConverter.vue'),
        meta: {
          title: '单位转换工具 - 长度重量单位转换',
          description: '免费的在线单位转换工具，支持长度、重量、温度等单位转换',
          keywords: '单位转换,长度转换,重量转换,单位工具'
        }
      }
    ]
  },
  {
    id: 'generator',
    name: '生成器',
    nameEn: 'generator',
    icon: '⚡',
    description: '各类代码和数据生成工具',
    tools: [
      {
        id: 'uuid',
        name: 'UUID生成器',
        nameEn: 'uuid',
        icon: '🆔',
        description: '生成UUID/GUID',
        aliases: ['uuid','guid','唯一标识','shengcheng'],
        path: '/generator/uuid',
        component: () => import('../views/tools/generator/UuidGenerator.vue'),
        meta: {
          title: 'UUID生成器 - 在线生成UUID/GUID',
          description: '免费的在线UUID生成器，支持批量生成UUID/GUID',
          keywords: 'UUID生成器,GUID生成器,UUID工具'
        }
      },
      {
        id: 'qrcode',
        name: '二维码生成',
        nameEn: 'qrcode',
        icon: '📱',
        description: '生成二维码图片',
        aliases: ['qrcode','qr','二维码','erweima'],
        path: '/generator/qrcode',
        component: () => import('../views/tools/generator/QrcodeGenerator.vue'),
        meta: {
          title: '二维码生成器 - 在线生成二维码',
          description: '免费的在线二维码生成器，支持文本、链接转二维码',
          keywords: '二维码生成器,QR码生成,二维码工具'
        }
      },
      {
        id: 'password',
        name: '密码生成器',
        nameEn: 'password',
        icon: '🔑',
        description: '生成安全的随机密码',
        aliases: ['password','密码','随机密码','mima'],
        path: '/generator/password',
        component: () => import('../views/tools/generator/PasswordGenerator.vue'),
        meta: {
          title: '密码生成器 - 在线生成随机密码',
          description: '免费的在线密码生成器，支持自定义长度和字符类型',
          keywords: '密码生成器,随机密码,密码工具'
        }
      },
      {
        id: 'lorem-ipsum',
        name: '占位文本生成',
        nameEn: 'lorem-ipsum',
        icon: '📃',
        description: '生成Lorem Ipsum占位文本',
        aliases: ['lorem','ipsum','占位','假文本','zhanwei'],
        path: '/generator/lorem-ipsum',
        component: () => import('../views/tools/generator/LoremGenerator.vue'),
        meta: {
          title: '占位文本生成器 - Lorem Ipsum生成',
          description: '免费的在线占位文本生成器，支持生成Lorem Ipsum文本',
          keywords: '占位文本,Lorem Ipsum,文本生成器'
        }
      }
    ]
  },
  {
    id: 'crypto',
    name: '加密解密',
    nameEn: 'crypto',
    icon: '🔒',
    description: '加密、解密和哈希工具',
    tools: [
      {
        id: 'hash',
        name: '哈希计算',
        nameEn: 'hash',
        icon: '#️⃣',
        description: 'MD5、SHA1、SHA256等哈希计算',
        aliases: ['hash','md5','sha1','sha256','哈希','haxi'],
        path: '/crypto/hash',
        component: () => import('../views/tools/crypto/HashCalculator.vue'),
        meta: {
          title: '哈希计算工具 - MD5 SHA1 SHA256哈希',
          description: '免费的在线哈希计算工具，支持MD5、SHA1、SHA256等算法',
          keywords: '哈希计算,MD5,SHA1,SHA256,哈希工具'
        }
      },
      {
        id: 'aes',
        name: 'AES加解密',
        nameEn: 'aes',
        icon: '🛡️',
        description: 'AES对称加密解密',
        aliases: ['aes','加密','解密','jiami','jiemi'],
        path: '/crypto/aes',
        component: () => import('../views/tools/crypto/AesEncryption.vue'),
        meta: {
          title: 'AES加解密工具 - 在线AES加密解密',
          description: '免费的在线AES加解密工具，支持AES对称加密解密',
          keywords: 'AES加密,AES解密,AES工具'
        }
      },
      {
        id: 'jwt-decoder',
        name: 'JWT解码',
        nameEn: 'jwt-decoder',
        icon: '🎫',
        description: '解析JWT的Header与Payload、校验过期',
        aliases: ['jwt','token','令牌','解码','jiema','lingpai'],
        path: '/crypto/jwt-decoder',
        component: () => import('../views/tools/crypto/JwtDecoder.vue'),
        meta: {
          title: 'JWT解码工具 - 在线解析JWT Token',
          description: '免费的在线JWT解码工具，本地解析Header、Payload与签名，自动校验exp过期时间，不上传服务器',
          keywords: 'JWT解码,JWT解析,JWT Token,令牌解析'
        }
      },
      {
        id: 'jwt-encoder',
        name: 'JWT生成',
        nameEn: 'jwt-encoder',
        icon: '✍️',
        description: '用HMAC密钥本地签名生成JWT Token',
        aliases: ['jwt','token','令牌','生成','签名','shengcheng','qianming'],
        path: '/crypto/jwt-encoder',
        component: () => import('../views/tools/crypto/JwtEncoder.vue'),
        meta: {
          title: 'JWT生成工具 - 在线HMAC签名生成JWT Token',
          description: '免费的在线JWT生成工具，支持HS256/HS384/HS512本地签名、有效期快捷设置与签名自检，密钥不上传服务器',
          keywords: 'JWT生成,JWT签名,HS256,Token生成'
        }
      }
    ]
  },
  {
    id: 'image',
    name: '图片工具',
    nameEn: 'image',
    icon: '🖼️',
    description: '图片处理和转换工具',
    tools: [
      {
        id: 'image-compress',
        name: '图片压缩',
        nameEn: 'image-compress',
        icon: '📦',
        description: '在线压缩图片大小',
        aliases: ['image','图片','压缩','yasuo','tupian'],
        path: '/image/image-compress',
        component: () => import('../views/tools/image/ImageCompress.vue'),
        meta: {
          title: '图片压缩工具 - 在线压缩图片',
          description: '免费的在线图片压缩工具，支持JPG、PNG等格式压缩',
          keywords: '图片压缩,图片优化,图片工具'
        }
      },
      {
        id: 'image-converter',
        name: '图片格式转换',
        nameEn: 'image-converter',
        icon: '🔄',
        description: '转换图片格式',
        aliases: ['image','图片','格式转换','webp','png','jpg','geshi'],
        path: '/image/image-converter',
        component: () => import('../views/tools/image/ImageConverter.vue'),
        meta: {
          title: '图片格式转换工具 - 在线转换图片格式',
          description: '免费的在线图片格式转换工具，支持JPG、PNG、WebP等格式互转',
          keywords: '图片转换,格式转换,图片工具'
        }
      }
    ]
  }
]

// 获取所有工具的扁平列表
export const getAllTools = () => {
  return toolGroups.flatMap(group => group.tools)
}

// 根据路径获取工具信息
export const getToolByPath = (path) => {
  return getAllTools().find(tool => tool.path === path)
}

// 生成路由配置
export const generateRoutes = () => {
  const routes = []
  
  toolGroups.forEach(group => {
    group.tools.forEach(tool => {
      if (tool.component) {
        routes.push({
          path: tool.path,
          name: tool.id,
          component: tool.component,
          meta: tool.meta
        })
      }
    })
  })
  
  return routes
}
// 按关键词搜索工具：匹配名称/英文名/描述/关键词/别名/所属分类（大小写不敏感）
export const searchTools = (keyword) => {
  const q = (keyword || '').trim().toLowerCase()
  if (!q) return toolGroups
  return toolGroups.map(group => ({
    ...group,
    tools: group.tools.filter(tool => {
      const hay = [tool.name, tool.nameEn, tool.description, tool.meta?.keywords || '', group.name, ...(tool.aliases || [])].join(' ').toLowerCase()
      return q.split(/\s+/).every(part => hay.includes(part))
    })
  })).filter(group => group.tools.length > 0)
}
export const totalToolCount = getAllTools().length
