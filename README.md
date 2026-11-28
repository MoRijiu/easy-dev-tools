# 极速开发工具箱 (Easy Dev Tools)

🚀 一个轻量级的在线开发者工具集合，提供丰富的开发辅助工具，提升开发效率。

🌐 在线地址：[https://tools.morijiu.cn/](https://tools.morijiu.cn/)

## ✨ 特性

- 🎯 **纯前端实现** - 所有工具均在浏览器端运行，数据不上传服务器，保护隐私安全
- ⚡ **快速响应** - 基于 Vue 3 + Vite 构建，极速加载
- 🔍 **快速发现** - 首页搜索（支持别名）、分类导航、收藏与最近使用
- ⌨️ **键盘流** - Ctrl+K / Cmd+K 命令面板，快速直达任意工具
- 🌗 **暗色模式** - 亮 / 暗 / 跟随系统三态切换
- 📱 **响应式设计** - 支持桌面端和移动端
- 🎨 **简洁美观** - 清晰的界面设计，易于使用

## 🛠️ 工具列表（共 72 个）

工具名称与分组以 `src/router/tools-config.js` 为准，与站内实际工具一一对应。

### 📝 文本处理（27 个）
JSON格式化、JSON字符串转义、JSONPath查询、Base64编解码、URL编解码、URL解析、cURL解析、User Agent解析、HTTP状态码查询、MIME类型查询、键盘按键查询、常用端口查询、ASCII码查询、编码转换、Punycode转换、Luhn校验、摩尔斯电码编解码、Markdown编辑器、正则表达式测试、Unicode/HTML实体、命名格式转换、文本对比、文本统计、文本行工具、Markdown表格生成、全角半角转换、URL Slug生成

### 🔄 格式转换（27 个）
时间戳转换、Cron表达式解析、进制转换、JSON/CSV互转、YAML/JSON互转、.env/JSON互转、SQL格式化、TOML/JSON 互转、XML格式化、CSS格式化、HTML格式化、CIDR子网计算器、IP地址工具、数据大小换算、时区转换、CSS单位换算、金额大写转换、JSON转TypeScript、日期计算器、SemVer版本工具、Docker Run转Compose、Chmod权限计算器、颜色转换、颜色对比度检查、CSS渐变生成器、CSS阴影生成器、单位转换

### ⚡ 生成器（9 个）
UUID生成器、UUID解析、雪花ID解析/生成、Nano ID生成、ULID生成/解析、二维码生成、密码生成器、随机数生成器、占位文本生成

### 🔒 加密解密（6 个）
哈希计算、AES加解密、JWT解码、JWT生成、HMAC签名生成、密码强度检查

### 🖼️ 图片工具（3 个）
图片压缩、图片格式转换、二维码解码

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 📁 项目结构

```
easy-dev-tools/
├── public/             # 静态资源
├── src/
│   ├── assets/         # 资源文件
│   ├── components/     # 公共组件
│   ├── composables/    # 组合式函数
│   ├── layouts/        # 布局组件
│   ├── router/         # 路由配置
│   ├── views/          # 页面组件
│   │   └── tools/      # 工具页面
│   │       ├── text/       # 文本处理工具
│   │       ├── converter/  # 格式转换工具
│   │       ├── generator/  # 生成器工具
│   │       ├── crypto/     # 加密解密工具
│   │       └── image/      # 图片工具
│   ├── App.vue         # 根组件
│   ├── main.js         # 入口文件
│   └── style.css       # 全局样式
├── index.html          # HTML 模板
├── vite.config.js      # Vite 配置
└── package.json        # 项目配置
```

## 🔧 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 下一代前端构建工具
- **Vue Router** - Vue.js 官方路由
- **qrcode / jsQR** - 二维码生成与解码库

## 📄 许可证

MIT License

## 👨‍💻 作者

morijiu

---

如果这个项目对你有帮助，欢迎 ⭐ Star 支持！
