// Docker Run 命令转 docker-compose.yml（纯本地）
// 复用 curlParse 的 shell 分词；支持常用 run 选项，未识别选项收集为 warnings 提示。
import { tokenizeShell } from './curlParse.js'

const MULTI_VALUE = new Map([
  ['-p', 'ports'], ['--publish', 'ports'],
  ['-v', 'volumes'], ['--volume', 'volumes'],
  ['-e', 'environment'], ['--env', 'environment'],
  ['--env-file', 'envFile'],
  ['--cap-add', 'capAdd'], ['--cap-drop', 'capDrop'],
  ['--device', 'devices'], ['--dns', 'dns'],
  ['--add-host', 'extraHosts'], ['-l', 'labels'], ['--label', 'labels'],
  ['--expose', 'expose'], ['--network', 'networks'], ['--net', 'networks'],
  ['--link', 'links']
])
const SINGLE_VALUE = new Map([
  ['--name', 'containerName'], ['--hostname', 'hostname'],
  ['--restart', 'restart'], ['-w', 'workdir'], ['--workdir', 'workdir'],
  ['-u', 'user'], ['--user', 'user'], ['--entrypoint', 'entrypoint'],
  ['--platform', 'platform'], ['--pull', 'pull'],
  ['-m', 'memory'], ['--memory', 'memory'], ['--cpus', 'cpus'],
  ['--network-alias', 'networkAlias']
])
const BOOL_FLAGS = new Map([
  ['-d', 'detach'], ['--detach', 'detach'],
  ['-i', 'stdinOpen'], ['--interactive', 'stdinOpen'],
  ['-t', 'tty'], ['--tty', 'tty'],
  ['--privileged', 'privileged'], ['--read-only', 'readOnly'],
  ['--init', 'init'], ['--rm', 'rm']
])
// 已知但 compose 无直接对应/无需转换的带值选项：跳过其值并提示
const SKIP_VALUE = new Set(['--log-driver', '--log-opt', '--health-cmd', '--health-interval', '--health-timeout', '--health-retries', '--stop-timeout', '--stop-signal', '--cidfile', '--runtime', '--isolation', '--security-opt', '--sysctl', '--tmpfs', '--mount', '--ip', '--mac-address', '--group-add', '--blkio-weight', '--cpu-shares', '--memory-swap', '--shm-size', '--ulimit', '--userns', '--pid', '--ipc', '--cgroupns', '--uts'])

export function deriveServiceName(image, containerName) {
  if (containerName) return sanitize(containerName)
  let base = String(image || '').split('@')[0]
  base = base.split('/').pop() || 'app'
  base = base.split(':')[0]
  return sanitize(base) || 'app'
}
function sanitize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

export function parseDockerRun(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('请先粘贴 docker run 命令')
  const tokens = tokenizeShell(raw)
  if (tokens[0] !== 'docker') throw new Error('命令需以 docker run 开头')
  let idx = 1
  if (tokens[idx] === 'container') idx++
  if (tokens[idx] !== 'run') throw new Error('命令需以 docker run 开头（仅支持 run 子命令）')
  idx++

  const r = {
    containerName: '', hostname: '', restart: '', workdir: '', user: '', entrypoint: '',
    platform: '', pull: '', memory: '', cpus: '', networkAlias: '',
    ports: [], volumes: [], environment: [], envFile: [], capAdd: [], capDrop: [],
    devices: [], dns: [], extraHosts: [], labels: [], expose: [], networks: [], links: [],
    detach: false, stdinOpen: false, tty: false, privileged: false, readOnly: false, init: false, rm: false,
    image: '', command: [], warnings: []
  }
  const skipped = []
  let image = null

  const needValue = (flag, i) => {
    if (i + 1 >= tokens.length) throw new Error(`选项 ${flag} 缺少取值`)
    return tokens[i + 1]
  }

  for (let i = idx; i < tokens.length; i++) {
    const tok = tokens[i]
    if (image !== null) { r.command.push(tok); continue }
    if (tok === '--') { image = tokens[i + 1] ?? null; if (image === null) break; i++; continue }
    if (!tok.startsWith('-') || tok === '-') { image = tok; continue }

    // --flag=value 形式
    const eq = tok.indexOf('=')
    if (tok.startsWith('--') && eq > 2) {
      const flag = tok.slice(0, eq); const val = tok.slice(eq + 1)
      if (MULTI_VALUE.has(flag)) { r[MULTI_VALUE.get(flag)].push(val); continue }
      if (SINGLE_VALUE.has(flag)) { r[SINGLE_VALUE.get(flag)] = val; continue }
      if (SKIP_VALUE.has(flag)) { skipped.push(flag); continue }
      r.warnings.push(`未识别选项 ${flag} 已忽略`); continue
    }
    if (MULTI_VALUE.has(tok)) { r[MULTI_VALUE.get(tok)].push(needValue(tok, i)); i++; continue }
    if (SINGLE_VALUE.has(tok)) { r[SINGLE_VALUE.get(tok)] = needValue(tok, i); i++; continue }
    if (BOOL_FLAGS.has(tok)) { r[BOOL_FLAGS.get(tok)] = true; continue }
    if (SKIP_VALUE.has(tok)) { needValue(tok, i); skipped.push(tok); i++; continue }
    // 短选项组合，如 -dit、-dp 8080:80（p/e/v 带值时取剩余或下一 token）
    if (/^-[a-zA-Z]+$/.test(tok)) {
      let consumedNext = false; let ok = true
      const chars = tok.slice(1).split('')
      for (let c = 0; c < chars.length; c++) {
        const f = '-' + chars[c]
        if (BOOL_FLAGS.has(f)) { r[BOOL_FLAGS.get(f)] = true; continue }
        if (MULTI_VALUE.has(f) || SINGLE_VALUE.has(f)) {
          const rest = chars.slice(c + 1).join('')
          let val
          if (rest) val = rest
          else { val = needValue(f, i); consumedNext = true }
          if (MULTI_VALUE.has(f)) r[MULTI_VALUE.get(f)].push(val); else r[SINGLE_VALUE.get(f)] = val
          break
        }
        ok = false; r.warnings.push(`未识别选项 ${f} 已忽略`)
      }
      if (consumedNext) i++
      void ok
      continue
    }
    r.warnings.push(`未识别选项 ${tok} 已忽略`)
  }

  if (!image) throw new Error('未找到镜像名：请确认命令包含镜像，如 docker run nginx')
  r.image = image
  if (skipped.length) r.warnings.push(`以下选项在 Compose 中无直接对应、已跳过：${[...new Set(skipped)].join('、')}`)
  if (r.rm) r.warnings.push('--rm 与 Compose 长驻服务模型不匹配，已忽略')
  if (r.detach) r.warnings.push('-d 后台运行对应 compose up -d，无需写进配置文件')
  r.serviceName = deriveServiceName(r.image, r.containerName)
  return r
}

// YAML 标量引用：含特殊字符/易被误读为 bool/number/null 时加双引号
export function yamlScalar(v) {
  const s = String(v)
  if (s === '') return '""'
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return JSON.stringify(s)
  if (/^-?\d+(\.\d+)?$/.test(s)) return JSON.stringify(s)
  if (/[#\[\]{}&*!|>'"%@`,]/.test(s) || /\s$/.test(s) || /^\s/.test(s) || s.includes(': ') || s.endsWith(':')) return JSON.stringify(s)
  return s
}
const listItem = (v) => JSON.stringify(String(v)) // 端口/卷/环境等一律引号，避免 YAML 误读（如 8080:80 性别进制、KEY=on 等）

export function toComposeYaml(r) {
  const lines = ['services:', `  ${r.serviceName}:`]
  const kv = (key, val) => lines.push(`    ${key}: ${yamlScalar(val)}`)
  kv('image', r.image)
  if (r.containerName) kv('container_name', r.containerName)
  if (r.hostname) kv('hostname', r.hostname)
  if (r.restart) kv('restart', r.restart)
  if (r.platform) kv('platform', r.platform)
  if (r.pull) kv('pull_policy', r.pull)
  const list = (key, arr) => { if (arr.length) { lines.push(`    ${key}:`); arr.forEach(v => lines.push(`      - ${listItem(v)}`)) } }
  list('ports', r.ports)
  list('expose', r.expose)
  list('volumes', r.volumes)
  list('environment', r.environment)
  list('env_file', r.envFile)
  list('networks', r.networks)
  list('links', r.links)
  list('extra_hosts', r.extraHosts)
  list('dns', r.dns)
  list('cap_add', r.capAdd)
  list('cap_drop', r.capDrop)
  list('devices', r.devices)
  list('labels', r.labels)
  if (r.networkAlias) lines.push(`    # 网络别名 ${r.networkAlias} 需写在 networks 的 aliases 子项下，请按实际网络名调整`)
  if (r.workdir) kv('working_dir', r.workdir)
  if (r.user) kv('user', r.user)
  if (r.entrypoint) kv('entrypoint', r.entrypoint)
  if (r.command.length) {
    const cmd = r.command.map(t => (/\s/.test(t) ? JSON.stringify(t) : t)).join(' ')
    kv('command', cmd)
  }
  if (r.privileged) lines.push('    privileged: true')
  if (r.readOnly) lines.push('    read_only: true')
  if (r.init) lines.push('    init: true')
  if (r.stdinOpen) lines.push('    stdin_open: true')
  if (r.tty) lines.push('    tty: true')
  if (r.memory || r.cpus) {
    lines.push('    deploy:')
    lines.push('      resources:')
    lines.push('        limits:')
    if (r.cpus) lines.push(`          cpus: ${yamlScalar(r.cpus)}`)
    if (r.memory) lines.push(`          memory: ${yamlScalar(r.memory)}`)
  }
  return lines.join('\n') + '\n'
}

export function buildDockerSummary(r) {
  const parts = [`服务 ${r.serviceName}`, `镜像 ${r.image}`]
  if (r.ports.length) parts.push(`端口 ${r.ports.length} 个`)
  if (r.volumes.length) parts.push(`挂载 ${r.volumes.length} 个`)
  if (r.environment.length) parts.push(`环境变量 ${r.environment.length} 个`)
  if (r.command.length) parts.push(`命令 ${r.command.length} 段`)
  return parts.join(' · ')
}
