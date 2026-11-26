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
