// Docker Run 命令转 docker-compose.yml（纯本地）
// 复用 curlParse 的 shell 分词；支持常用 run 选项，未识别选项收集为 warnings 提示。
import { tokenizeShell } from './curlParse.js'

const MAX_DOCKER_INPUT = 100000

const MULTI_VALUE = new Map([
  ['-p', 'ports'], ['--publish', 'ports'],
  ['-v', 'volumes'], ['--volume', 'volumes'],
  ['-e', 'environment'], ['--env', 'environment'],
  ['--env-file', 'envFile'], ['--label-file', 'labelFile'],
  ['--cap-add', 'capAdd'], ['--cap-drop', 'capDrop'],
  ['--device', 'devices'], ['--dns', 'dns'],
  ['--dns-search', 'dnsSearch'], ['--dns-opt', 'dnsOptions'], ['--dns-option', 'dnsOptions'],
  ['--add-host', 'extraHosts'], ['-l', 'labels'], ['--label', 'labels'],
  ['--expose', 'expose'], ['--network', 'networks'], ['--net', 'networks'],
  ['--link', 'links'], ['--tmpfs', 'tmpfs'], ['--sysctl', 'sysctls'],
  ['--security-opt', 'securityOpt'], ['--group-add', 'groupAdd'],
  ['--log-opt', 'logOpts'], ['--mount', 'mounts'], ['--ulimit', 'ulimits'],
  ['--volume-driver', 'volumeDrivers']
])
const SINGLE_VALUE = new Map([
  ['--name', 'containerName'], ['--hostname', 'hostname'],
  ['--restart', 'restart'], ['-w', 'workdir'], ['--workdir', 'workdir'],
  ['-u', 'user'], ['--user', 'user'], ['--entrypoint', 'entrypoint'],
  ['--platform', 'platform'], ['--pull', 'pull'],
  ['-m', 'memory'], ['--memory', 'memory'], ['--cpus', 'cpus'],
  ['--network-alias', 'networkAlias'], ['--domainname', 'domainname'],
  ['--log-driver', 'logDriver'], ['--shm-size', 'shmSize'],
  ['--stop-signal', 'stopSignal'], ['--stop-timeout', 'stopTimeout'],
  ['--pid', 'pid'], ['--ipc', 'ipc'], ['--uts', 'uts'], ['--cgroupns', 'cgroup'],
  ['--userns', 'usernsMode'], ['--runtime', 'runtime'], ['--mac-address', 'macAddress'],
  ['--cgroup-parent', 'cgroupParent'], ['--cpu-shares', 'cpuShares'],
  ['--memory-swap', 'memswapLimit'], ['--health-cmd', 'healthCmd'],
  ['--health-interval', 'healthInterval'], ['--health-timeout', 'healthTimeout'],
  ['--health-retries', 'healthRetries'], ['--health-start-period', 'healthStartPeriod'],
  ['--health-start-interval', 'healthStartInterval']
])
const BOOL_FLAGS = new Map([
  ['-d', 'detach'], ['--detach', 'detach'],
  ['-i', 'stdinOpen'], ['--interactive', 'stdinOpen'],
  ['-t', 'tty'], ['--tty', 'tty'],
  ['--privileged', 'privileged'], ['--read-only', 'readOnly'],
  ['--init', 'init'], ['--rm', 'rm'], ['--health-disable', 'healthDisable'],
  ['--oom-kill-disable', 'oomKillDisable'], ['--publish-all', 'publishAll'], ['-P', 'publishAll']
])
// 已知但 compose 无直接对应/需按网络拓扑手写的带值选项：跳过其值并提示（务必登记，避免其值被误当镜像名）
const SKIP_VALUE = new Set(['--cidfile', '--isolation', '--ip', '--ip6', '--blkio-weight', '--device-cgroup-rule', '--device-read-bps', '--device-write-bps', '--gpus'])

function deriveServiceName(image, containerName) {
  if (containerName) return sanitize(containerName)
  let base = String(image || '').split('@')[0]
  base = base.split('/').pop() || 'app'
  base = base.split(':')[0]
  return sanitize(base) || 'app'
}
function sanitize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

const NETWORK_MODES = /^(host|none|bridge)$|^(container|service|ns):.+/
function validateRestart(value) {
  const v = String(value || '')
  if (/^(no|always|unless-stopped|on-failure)$/.test(v)) return v
  const m = v.match(/^on-failure:(\d+)$/)
  if (m) return v
  throw new Error(`重启策略不合法：「${v}」，只能是 no / always / unless-stopped / on-failure 或 on-failure:N（N 为非负整数重试次数）`)
}

function parseMount(value) {
  const s = String(value || '')
  const out = {}
  for (const part of s.split(',')) {
    const p = part.trim()
    if (!p) continue
    const eq = p.indexOf('=')
    if (eq === -1) {
      if (p === 'readonly' || p === 'ro') { out.readOnly = true; continue }
      if (p === 'rw' || p === 'readwrite') { out.readOnly = false; continue }
      if (p === 'nocopy') { out.nocopy = true; continue }
      throw new Error(`--mount 片段不合法：「${p}」，应为 key=value 或 readonly`)
    }
    const key = p.slice(0, eq).trim(); const val = p.slice(eq + 1).trim()
    if (key === 'type') out.type = val
    else if (key === 'source' || key === 'src') out.source = val
    else if (key === 'target' || key === 'dst' || key === 'destination') out.target = val
    else if (key === 'readonly' || key === 'ro') out.readOnly = val !== 'false'
    else if (key === 'bind-propagation' || key === 'propagation') out.propagation = val
    else if (key === 'volume-nocopy') out.nocopy = val !== 'false'
    else if (key === 'tmpfs-size') out.tmpfsSize = val
    else if (key === 'tmpfs-mode') out.tmpfsMode = val
    else throw new Error(`--mount 暂不支持的键：「${key}」`)
  }
  if (!out.type) throw new Error('--mount 缺少 type（如 type=bind / type=volume / type=tmpfs）')
  if (!['bind', 'volume', 'tmpfs'].includes(out.type)) throw new Error(`--mount 的 type 不合法：「${out.type}」，只能是 bind / volume / tmpfs`)
  if (!out.target) throw new Error('--mount 缺少 target（容器内路径）')
  if (out.type !== 'tmpfs' && !out.source) throw new Error(`--mount type=${out.type} 缺少 source`)
  return out
}

function parseUlimit(value) {
  const s = String(value || '')
  const eq = s.indexOf('=')
  const name = (eq === -1 ? s : s.slice(0, eq)).trim()
  if (!name) throw new Error(`--ulimit 格式不合法：「${s}」，应为 名称=软限 或 名称=软限:硬限`)
  if (eq === -1) throw new Error(`--ulimit 格式不合法：「${s}」，应为 名称=软限 或 名称=软限:硬限`)
  const parts = s.slice(eq + 1).split(':')
  if (parts.length > 2 || parts.some(x => !/^-?\d+$/.test(x.trim()))) {
    throw new Error(`--ulimit 取值不合法：「${s}」，软/硬限应为整数（-1 表示不限）`)
  }
  return { name, soft: Number(parts[0]), hard: parts.length === 2 ? Number(parts[1]) : null }
}

function parseBoolValue(flag, val) {
  const v = String(val).toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  throw new Error(`选项 ${flag} 的取值不合法：「${val}」，只能是 true 或 false`)
}

export function parseDockerRun(input) {
  const rawInput = String(input || '')
  if (rawInput.length > MAX_DOCKER_INPUT) throw new Error(`命令过长：${rawInput.length} 个字符，上限 ${MAX_DOCKER_INPUT} 个`)
  const raw = rawInput.trim()
  if (!raw) throw new Error('请先粘贴 docker run 命令')
  let tokens = tokenizeShell(raw)
  // 容忍从终端/教程复制来的 $ 提示符与 sudo 前缀
  if (tokens[0] === '$') tokens = tokens.slice(1)
  if (tokens[0] === 'sudo') tokens = tokens.slice(1)
  if (tokens[0] === 'docker.exe') tokens[0] = 'docker'
  if (tokens[0] !== 'docker') throw new Error('命令需以 docker run 开头')
  let idx = 1
  if (tokens[idx] === 'container') idx++
  if (tokens[idx] !== 'run') throw new Error('命令需以 docker run 开头（仅支持 run 子命令）')
  idx++

  const r = {
    containerName: '', hostname: '', restart: '', workdir: '', user: '', entrypoint: '',
    platform: '', pull: '', memory: '', cpus: '', networkAlias: '', domainname: '',
    logDriver: '', shmSize: '', stopSignal: '', stopTimeout: '', pid: '', ipc: '', uts: '',
    cgroup: '', usernsMode: '', runtime: '', macAddress: '', cgroupParent: '', cpuShares: '',
    memswapLimit: '', healthCmd: '', healthInterval: '', healthTimeout: '', healthRetries: '',
    healthStartPeriod: '', healthStartInterval: '',
    ports: [], volumes: [], environment: [], envFile: [], labelFile: [], capAdd: [], capDrop: [],
    devices: [], dns: [], dnsSearch: [], dnsOptions: [], extraHosts: [], labels: [], expose: [],
    networks: [], links: [], tmpfs: [], sysctls: [], securityOpt: [], groupAdd: [], logOpts: [],
    mounts: [], ulimits: [], volumeDrivers: [],
    detach: false, stdinOpen: false, tty: false, privileged: false, readOnly: false, init: false, rm: false,
    healthDisable: false, oomKillDisable: false, publishAll: false,
    networkMode: '',
    image: '', command: [], warnings: []
  }
  const skipped = []
  let image = null

  const needValue = (flag, i) => {
    if (i + 1 >= tokens.length) throw new Error(`选项 ${flag} 缺少取值`)
    return tokens[i + 1]
  }
  const applyNetwork = (val) => {
    if (NETWORK_MODES.test(val)) {
      if (r.networkMode && r.networkMode !== val) r.warnings.push(`出现多个网络模式（${r.networkMode} 与 ${val}），已保留第一个`)
      else r.networkMode = val
    } else r.networks.push(val)
  }
  const applyValue = (flag, val) => {
    if (MULTI_VALUE.has(flag)) {
      const key = MULTI_VALUE.get(flag)
      if (key === 'networks') applyNetwork(val)
      else if (key === 'mounts') r.mounts.push(parseMount(val))
      else if (key === 'ulimits') r.ulimits.push(parseUlimit(val))
      else r[key].push(val)
      return
    }
    if (SINGLE_VALUE.has(flag)) { r[SINGLE_VALUE.get(flag)] = val; return }
    if (SKIP_VALUE.has(flag)) { skipped.push(flag); return }
    r.warnings.push(`未识别选项 ${flag} 已忽略`)
  }

  for (let i = idx; i < tokens.length; i++) {
    const tok = tokens[i]
    if (image !== null) { r.command.push(tok); continue }
    if (tok === '--') { image = tokens[i + 1] ?? null; if (image === null) break; i++; continue }
    if (!tok.startsWith('-') || tok === '-') { image = tok; continue }

    // --flag=value 形式（布尔选项也支持 =true/=false）
    const eq = tok.indexOf('=')
    if (tok.startsWith('--') && eq > 2) {
      const flag = tok.slice(0, eq); const val = tok.slice(eq + 1)
      if (BOOL_FLAGS.has(flag)) { r[BOOL_FLAGS.get(flag)] = parseBoolValue(flag, val); continue }
      applyValue(flag, val); continue
    }
    if (MULTI_VALUE.has(tok) || SINGLE_VALUE.has(tok) || SKIP_VALUE.has(tok)) { applyValue(tok, needValue(tok, i)); i++; continue }
    if (BOOL_FLAGS.has(tok)) { r[BOOL_FLAGS.get(tok)] = true; continue }
    // 短选项组合，如 -dit、-dp 8080:80（p/e/v 带值时取剩余或下一 token）
    if (/^-[a-zA-Z]+$/.test(tok)) {
      let consumedNext = false
      const chars = tok.slice(1).split('')
      for (let c = 0; c < chars.length; c++) {
        const f = '-' + chars[c]
        if (BOOL_FLAGS.has(f)) { r[BOOL_FLAGS.get(f)] = true; continue }
        if (MULTI_VALUE.has(f) || SINGLE_VALUE.has(f)) {
          const rest = chars.slice(c + 1).join('')
          let val
          if (rest) val = rest
          else { val = needValue(f, i); consumedNext = true }
          applyValue(f, val)
          break
        }
        r.warnings.push(`未识别选项 ${f} 已忽略`)
      }
      if (consumedNext) i++
      continue
    }
    r.warnings.push(`未识别选项 ${tok} 已忽略（若它带取值，其值可能会被当作镜像名，请检查）`)
  }

  if (!image) throw new Error('未找到镜像名：请确认命令包含镜像，如 docker run nginx')
  r.image = image
  if (r.restart) validateRestart(r.restart)
  if (r.healthRetries && !/^\d+$/.test(r.healthRetries)) throw new Error(`--health-retries 取值不合法：「${r.healthRetries}」，应为非负整数`)
  if (r.stopTimeout) {
    if (!/^\d+(\.\d+)?$/.test(r.stopTimeout)) throw new Error(`--stop-timeout 取值不合法：「${r.stopTimeout}」，应为秒数`)
  }
  if (r.networkMode && r.networks.length) r.warnings.push(`已使用 network_mode: ${r.networkMode}，其余 --network（${r.networks.join('、')}）与它不能共存，已忽略`)
  if (r.volumeDrivers.length) r.warnings.push('--volume-driver 在 Compose 中需按卷逐个声明 driver，已忽略')
  if (skipped.length) r.warnings.push(`以下选项在 Compose 中无直接对应、已跳过：${[...new Set(skipped)].join('、')}`)
  if (r.rm) r.warnings.push('--rm 与 Compose 长驻服务模型不匹配，已忽略')
  if (r.detach) r.warnings.push('-d 后台运行对应 compose up -d，无需写进配置文件')
  if (r.publishAll) r.warnings.push('-P/--publish-all 发布镜像 EXPOSE 的全部端口，Compose 无等价写法，已忽略（请按需逐个写 -p）')
  r.serviceName = deriveServiceName(r.image, r.containerName)
  return r
}

// YAML 标量引用：含特殊字符/易被误读为 bool/number/null 时加双引号
function yamlScalar(v) {
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
  if (r.domainname) kv('domainname', r.domainname)
  if (r.restart) kv('restart', r.restart)
  if (r.platform) kv('platform', r.platform)
  if (r.pull) kv('pull_policy', r.pull)
  if (r.runtime) kv('runtime', r.runtime)
  if (r.macAddress) kv('mac_address', r.macAddress)
  if (r.networkMode) kv('network_mode', r.networkMode)
  const list = (key, arr) => { if (arr.length) { lines.push(`    ${key}:`); arr.forEach(v => lines.push(`      - ${listItem(v)}`)) } }
  list('ports', r.ports)
  list('expose', r.expose)
  // -v 短语法与 --mount 长语法同属 volumes 列表（tmpfs 型 mount 转 tmpfs 列表）
  const mountVolumes = r.mounts.filter(m => m.type !== 'tmpfs')
  if (r.volumes.length || mountVolumes.length) {
    lines.push('    volumes:')
    r.volumes.forEach(v => lines.push(`      - ${listItem(v)}`))
    for (const m of mountVolumes) {
      lines.push(`      - type: ${m.type}`)
      lines.push(`        source: ${yamlScalar(m.source)}`)
      lines.push(`        target: ${yamlScalar(m.target)}`)
      if (m.readOnly) lines.push('        read_only: true')
      if (m.propagation) { lines.push('        bind:'); lines.push(`          propagation: ${yamlScalar(m.propagation)}`) }
      if (m.nocopy) { lines.push('        volume:'); lines.push('          nocopy: true') }
    }
  }
  const tmpfsAll = [...r.tmpfs, ...r.mounts.filter(m => m.type === 'tmpfs').map(m => m.target)]
  list('tmpfs', tmpfsAll)
  list('environment', r.environment)
  list('env_file', r.envFile)
  list('label_file', r.labelFile)
  if (!r.networkMode) list('networks', r.networks)
  list('links', r.links)
  list('extra_hosts', r.extraHosts)
  list('dns', r.dns)
  list('dns_search', r.dnsSearch)
  list('dns_opt', r.dnsOptions)
  list('cap_add', r.capAdd)
  list('cap_drop', r.capDrop)
  list('devices', r.devices)
  list('labels', r.labels)
  list('security_opt', r.securityOpt)
  list('group_add', r.groupAdd)
  list('sysctls', r.sysctls)
  if (r.ulimits.length) {
    lines.push('    ulimits:')
    for (const u of r.ulimits) {
      if (u.hard === null || u.hard === u.soft) lines.push(`      ${u.name}: ${u.soft}`)
      else { lines.push(`      ${u.name}:`); lines.push(`        soft: ${u.soft}`); lines.push(`        hard: ${u.hard}`) }
    }
  }
  if (r.networkAlias) lines.push(`    # 网络别名 ${r.networkAlias} 需写在 networks 的 aliases 子项下，请按实际网络名调整`)
  if (r.workdir) kv('working_dir', r.workdir)
  if (r.user) kv('user', r.user)
  if (r.shmSize) kv('shm_size', r.shmSize)
  if (r.stopSignal) kv('stop_signal', r.stopSignal)
  if (r.stopTimeout) kv('stop_grace_period', `${r.stopTimeout}s`)
  if (r.pid) kv('pid', r.pid)
  if (r.ipc) kv('ipc', r.ipc)
  if (r.uts) kv('uts', r.uts)
  if (r.cgroup) kv('cgroup', r.cgroup)
  if (r.usernsMode) kv('userns_mode', r.usernsMode)
  if (r.cgroupParent) kv('cgroup_parent', r.cgroupParent)
  if (r.cpuShares) kv('cpu_shares', r.cpuShares)
  if (r.memswapLimit) kv('memswap_limit', r.memswapLimit)
  if (r.entrypoint) kv('entrypoint', r.entrypoint)
  if (r.command.length) {
    const cmd = r.command.map(t => (/\s/.test(t) ? JSON.stringify(t) : t)).join(' ')
    kv('command', cmd)
  }
  if (r.logDriver || r.logOpts.length) {
    lines.push('    logging:')
    if (r.logDriver) lines.push(`      driver: ${yamlScalar(r.logDriver)}`)
    if (r.logOpts.length) {
      lines.push('      options:')
      for (const o of r.logOpts) {
        const eq = o.indexOf('=')
        if (eq === -1) lines.push(`        ${yamlScalar(o)}: ""`)
        else lines.push(`        ${yamlScalar(o.slice(0, eq))}: ${yamlScalar(o.slice(eq + 1))}`)
      }
    }
  }
  const hasHealth = r.healthDisable || r.healthCmd || r.healthInterval || r.healthTimeout || r.healthRetries || r.healthStartPeriod || r.healthStartInterval
  if (hasHealth) {
    lines.push('    healthcheck:')
    if (r.healthDisable) lines.push('      disable: true')
    if (r.healthCmd) {
      if (/^NONE$/i.test(r.healthCmd.trim())) lines.push('      disable: true')
      else if (/^CMD-SHELL\s+/i.test(r.healthCmd.trim())) lines.push(`      test: ${JSON.stringify(['CMD-SHELL', r.healthCmd.trim().replace(/^CMD-SHELL\s+/i, '')])}`)
      else if (/^CMD\s+/i.test(r.healthCmd.trim())) lines.push(`      test: ${JSON.stringify(['CMD', ...r.healthCmd.trim().replace(/^CMD\s+/i, '').split(/\s+/)])}`)
      else lines.push(`      test: ${JSON.stringify(['CMD-SHELL', r.healthCmd])}`)
    }
    if (r.healthInterval) lines.push(`      interval: ${yamlScalar(r.healthInterval)}`)
    if (r.healthTimeout) lines.push(`      timeout: ${yamlScalar(r.healthTimeout)}`)
    if (r.healthRetries) lines.push(`      retries: ${r.healthRetries}`)
    if (r.healthStartPeriod) lines.push(`      start_period: ${yamlScalar(r.healthStartPeriod)}`)
    if (r.healthStartInterval) lines.push(`      start_interval: ${yamlScalar(r.healthStartInterval)}`)
  }
  if (r.privileged) lines.push('    privileged: true')
  if (r.readOnly) lines.push('    read_only: true')
  if (r.init) lines.push('    init: true')
  if (r.oomKillDisable) lines.push('    oom_kill_disable: true')
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
  if (r.volumes.length || r.mounts.length) parts.push(`挂载 ${r.volumes.length + r.mounts.length} 个`)
  if (r.environment.length) parts.push(`环境变量 ${r.environment.length} 个`)
  if (r.networkMode) parts.push(`网络模式 ${r.networkMode}`)
  if (r.healthCmd || r.healthDisable) parts.push('含健康检查')
  if (r.logDriver) parts.push(`日志 ${r.logDriver}`)
  if (r.command.length) parts.push(`命令 ${r.command.length} 段`)
  return parts.join(' · ')
}
