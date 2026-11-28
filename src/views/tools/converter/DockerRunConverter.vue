<template>
  <div class="docker-run">
    <h1>Docker Run 转 Compose</h1>
    <p class="description">粘贴 docker run 命令，一键生成等价的 docker-compose.yml：端口、挂载、环境变量、重启策略与资源限制全覆盖，全程本地处理不上传</p>
    <div class="tool-container">
      <ToolToolbar>
        <button @click="loadExample" class="btn btn-secondary"><span class="icon" aria-hidden="true">📝</span> 示例</button>
        <button @click="clearAll" class="btn btn-danger"><span class="icon" aria-hidden="true">🗑️</span> 清空</button>
        <button @click="copyYaml" class="btn btn-success" :disabled="!yamlText"><span class="icon" aria-hidden="true">📋</span> 复制 YAML</button>
      </ToolToolbar>
      <ToolStatusMessage id="docker-run-status" :message="statusMessage" :type="statusType" />
      <textarea v-model="inputText" class="text-input" placeholder="粘贴 docker run 命令，如：&#10;docker run -d --name web -p 8080:80 -v ./site:/usr/share/nginx/html:ro --restart unless-stopped nginx:alpine" spellcheck="false" aria-label="docker run命令输入" :aria-invalid="inputErrorActive ? 'true' : undefined" :aria-describedby="inputErrorActive ? 'docker-run-status' : undefined" @input="parse"></textarea>
      <template v-if="result">
        <p class="stats">{{ summary }}</p>
        <table class="kv" aria-label="解析概览">
          <tbody>
            <tr><th scope="row">服务名</th><td><code>{{ result.serviceName }}</code></td></tr>
            <tr><th scope="row">镜像</th><td><code>{{ result.image }}</code></td></tr>
            <tr v-if="result.ports.length"><th scope="row">端口</th><td><code>{{ result.ports.join('，') }}</code></td></tr>
            <tr v-if="result.restart"><th scope="row">重启策略</th><td><code>{{ result.restart }}</code></td></tr>
            <tr v-if="result.networkMode"><th scope="row">网络模式</th><td><code>{{ result.networkMode }}</code></td></tr>
            <tr v-if="result.healthCmd || result.healthDisable"><th scope="row">健康检查</th><td><code>{{ result.healthDisable ? '已禁用' : result.healthCmd }}</code></td></tr>
            <tr v-if="result.logDriver"><th scope="row">日志驱动</th><td><code>{{ result.logDriver }}</code></td></tr>
            <tr v-if="result.command.length"><th scope="row">启动命令</th><td><code>{{ result.command.join(' ') }}</code></td></tr>
          </tbody>
        </table>
        <p v-for="(w, i) in result.warnings" :key="i" class="hint">⚠ {{ w }}</p>
        <h2 class="sub">docker-compose.yml</h2>
        <textarea spellcheck="false" :value="yamlText" class="text-input output code" readonly aria-label="生成的Compose配置"></textarea>
      </template>
      <ToolExamples :examples="examples" @use-example="useExample" />
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
import ToolExamples from '@/components/ToolExamples.vue';
import ToolToolbar from '@/components/ToolToolbar.vue';
import ToolStatusMessage from '@/components/ToolStatusMessage.vue';
import { parseDockerRun, toComposeYaml, buildDockerSummary } from '@/utils/dockerRun.js';

const features = [
  { icon: '🐳', title: '常用选项全覆盖', description: '--name/-p/-v/--mount/-e/--restart/--network/--health-*/--log-*/--ulimit/--tmpfs 等一次转完' },
  { icon: '🧾', title: '规范 YAML 输出', description: '端口与环境变量自动加引号，避免 YAML 把 8080:80、on/off 误读' },
  { icon: '⚠️', title: '不匹配项明说', description: '-d、--rm、--ip 等无直接对应的选项会逐项提示，不静默丢弃；日志与健康检查会转成 logging / healthcheck' },
  { icon: '🔒', title: '纯本地处理', description: '命令常含密码与 Token，全部在浏览器本地解析，不上传服务器' }
];
const usageSteps = ['把现成的 docker run 命令粘贴到输入框（支持反斜杠换行与引号）', '核对解析概览与提示项，确认端口/挂载/环境变量无误', '点「复制 YAML」保存为 docker-compose.yml，用 docker compose up -d 启动'];
const faqs = [
  { question: '-d 和 --rm 为什么没出现在 YAML 里？', answer: '-d 是启动方式（对应 docker compose up -d），--rm 与 Compose 长驻服务模型不匹配，两者都会在页面上提示后忽略，不会静默丢失。' },
  { question: '--memory / --cpus 转到哪里了？', answer: '转成 deploy.resources.limits 下的 memory / cpus，这也是 Compose 规范里声明资源限制的标准位置。' },
  { question: '没写 --name 时服务名怎么定？', answer: '取镜像名最后一段并去掉标签，如 registry.example.com/team/nginx:1.27 的服务名为 nginx；写了 --name 则同时生成 container_name 并以它为服务名。' },
  { question: '镜像后的参数会保留吗？', answer: '会。镜像名之后的所有内容会原样拼成 command 字段；--entrypoint 则单独生成 entrypoint 字段。' },
  { question: '--network host 为什么变成 network_mode？', answer: 'host / none / container:xxx 这类是网络模式而非普通网络名，写进 networks 列表是无效配置；本工具会生成 network_mode 字段，其余普通网络名才进 networks 列表，两者不能共存时页面会提示。' },
  { question: '健康检查和日志选项转到哪里了？', answer: '--health-cmd/--health-interval/--health-retries 等会转成 healthcheck（命令默认按 CMD-SHELL 处理，NONE 表示禁用）；--log-driver/--log-opt 会转成 logging.driver 与 logging.options。旧版曾把这两类误报为「无直接对应」并跳过，现已修复。' },
  { question: '--mount 和 --tmpfs / --ulimit 怎么转？', answer: '--mount type=bind/volume 会转成 volumes 长语法条目，type=tmpfs 与 --tmpfs 一起进 tmpfs 列表；--ulimit nofile=1024:2048 会转成 ulimits 下的 soft/hard。格式不合法时页面会点名报错，不会静默生成坏配置。' },
  { question: '粘贴时带 sudo 或 $ 提示符可以吗？', answer: '可以，开头的 $ 提示符、sudo 与 docker.exe 都会自动识别；--privileged=true 这类布尔等号写法也支持，写 false 则不生成对应字段。' }
];
const examples = [
  { input: 'docker run -d --name web -p 8080:80 --restart unless-stopped nginx:alpine', output: '服务 web · 端口 1 个', description: '基础 Web 服务' },
  { input: "docker run -d --name db -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data --restart always postgres:16", output: '服务 db · 环境变量 1 个', description: '带环境变量与数据卷' },
  { input: 'docker run -d --name web --network host --health-cmd "curl -f http://localhost || exit 1" --health-interval 30s --health-retries 3 --log-driver json-file --log-opt max-size=10m nginx:alpine', output: '服务 web · 网络模式 host · 含健康检查 · 日志 json-file', description: 'host 网络 + 健康检查 + 日志' }
];
const inputText = ref('');
const result = ref(null);
const statusMessage = ref('');
const statusType = ref('');
const inputErrorText = ref('');
const setInputError = (msg) => { statusMessage.value = msg; statusType.value = 'error'; inputErrorText.value = msg; };
const inputErrorActive = computed(() => statusType.value === 'error' && inputErrorText.value !== '' && statusMessage.value === inputErrorText.value);
const summary = computed(() => (result.value ? buildDockerSummary(result.value) : ''));
const yamlText = computed(() => (result.value ? toComposeYaml(result.value) : ''));
const parse = () => {
  if (!inputText.value.trim()) { result.value = null; statusMessage.value = ''; return; }
  try {
    result.value = parseDockerRun(inputText.value);
    statusMessage.value = '✓ 解析成功';
    statusType.value = 'success';
  } catch (e) { setInputError('✗ ' + e.message); }
};
const EXAMPLE = "docker run -d --name web \\\n  -p 8080:80 -p 8443:443 \\\n  -v ./site:/usr/share/nginx/html:ro \\\n  -e TZ=Asia/Shanghai --restart unless-stopped \\\n  --memory 512m --cpus 1.5 \\\n  nginx:alpine";
const loadExample = () => { inputText.value = EXAMPLE; parse(); };
const useExample = (ex) => { inputText.value = ex.input; parse(); };
const clearAll = () => { inputText.value = ''; result.value = null; statusMessage.value = ''; };
const copyYaml = async () => {
  try { await navigator.clipboard.writeText(yamlText.value); statusMessage.value = '✓ YAML 已复制'; statusType.value = 'success'; }
  catch { statusMessage.value = '✗ 复制失败，请手动复制'; statusType.value = 'error'; }
};
</script>

<style scoped>
.docker-run { max-width: 1400px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2.5rem; color: var(--text-strong); margin-bottom: 10px; text-align: center; }
.description { text-align: center; color: var(--text-2); font-size: 1.1rem; margin-bottom: 30px; }
.tool-container { background: var(--surface); border-radius: 12px; padding: 30px; box-shadow: var(--shadow-md); }
.text-input { width: 100%; min-height: 110px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-softer); color: var(--text); font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; box-sizing: border-box; resize: vertical; }
.text-input.output { min-height: 72px; background: var(--bg-soft); }
.text-input.code { min-height: 220px; }
.kv { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
.kv th, .kv td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.kv th { width: 150px; color: var(--text-2); background: var(--bg-soft); font-weight: 600; word-break: break-all; }
.kv code { word-break: break-all; color: var(--text); }
.sub { font-size: 1rem; color: var(--text-strong); margin: 16px 0 6px; }
.stats { margin: 10px 0 0; font-size: 13px; color: var(--text-2); word-break: break-all; }
.hint { font-size: 13px; color: var(--text-2); }
@media (max-width: 640px) { h1 { font-size: 2rem; } .tool-container { padding: 20px; } .kv th { width: 96px; } }
</style>
