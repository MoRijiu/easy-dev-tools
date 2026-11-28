// 单位换算核心（纯本地）：精确系数（换算到基准单位的乘数）、严格数值校验、
// 温度绝对零度校验、全量对照与结果格式化。
// factor 表示「1 个该单位 = factor 个基准单位」；温度为仿射换算，单独处理。

export const UNIT_CATEGORIES = [
  { id: 'length', name: '长度', base: 'm' },
  { id: 'weight', name: '重量', base: 'kg' },
  { id: 'temperature', name: '温度', base: 'c' },
  { id: 'area', name: '面积', base: 'm2' },
  { id: 'volume', name: '体积', base: 'l' },
  { id: 'time', name: '时间', base: 's' },
  { id: 'speed', name: '速度', base: 'mps' },
  { id: 'data', name: '数据', base: 'byte' },
]

const U = (id, name, symbol, factor) => ({ id, name, symbol, factor })

export const UNIT_DATA = {
  length: [
    U('km', '千米', 'km', 1000), U('m', '米', 'm', 1), U('dm', '分米', 'dm', 0.1),
    U('cm', '厘米', 'cm', 0.01), U('mm', '毫米', 'mm', 0.001), U('um', '微米', 'μm', 1e-6),
    U('nm', '纳米', 'nm', 1e-9), U('mile', '英里', 'mi', 1609.344), U('yard', '码', 'yd', 0.9144),
    U('foot', '英尺', 'ft', 0.3048), U('inch', '英寸', 'in', 0.0254),
    U('li', '里', '里', 500), U('zhang', '丈', '丈', 10 / 3), U('chi', '尺', '尺', 1 / 3), U('cun', '寸', '寸', 1 / 30),
  ],
  weight: [
    U('t', '吨', 't', 1000), U('kg', '千克', 'kg', 1), U('g', '克', 'g', 0.001),
    U('mg', '毫克', 'mg', 1e-6), U('ug', '微克', 'μg', 1e-9),
    U('lb', '磅', 'lb', 0.45359237), U('oz', '盎司', 'oz', 0.028349523125),
    U('jin', '斤', '斤', 0.5), U('liang', '两', '两', 0.05), U('qian', '钱', '钱', 0.005),
  ],
  temperature: [
    U('c', '摄氏度', '°C', 1), U('f', '华氏度', '°F', 1), U('k', '开尔文', 'K', 1),
  ],
  area: [
    U('km2', '平方千米', 'km²', 1e6), U('ha', '公顷', 'ha', 1e4), U('m2', '平方米', 'm²', 1),
    U('dm2', '平方分米', 'dm²', 0.01), U('cm2', '平方厘米', 'cm²', 1e-4), U('mm2', '平方毫米', 'mm²', 1e-6),
    U('acre', '英亩', 'acre', 4046.8564224), U('ft2', '平方英尺', 'ft²', 0.09290304),
    U('mu', '亩', '亩', 2000 / 3),
  ],
  volume: [
    U('m3', '立方米', 'm³', 1000), U('l', '升', 'L', 1), U('ml', '毫升', 'mL', 0.001),
    U('dm3', '立方分米', 'dm³', 1), U('cm3', '立方厘米', 'cm³', 0.001),
    U('gal', '加仑(美)', 'gal', 3.785411784), U('qt', '夸脱', 'qt', 0.946352946),
    U('pt', '品脱', 'pt', 0.473176473), U('cup', '杯', 'cup', 0.2365882365),
  ],
  time: [
    U('y', '年', '年', 31536000), U('d', '天', '天', 86400), U('h', '小时', 'h', 3600),
    U('min', '分钟', 'min', 60), U('s', '秒', 's', 1), U('ms', '毫秒', 'ms', 0.001),
    U('us', '微秒', 'μs', 1e-6), U('ns', '纳秒', 'ns', 1e-9),
  ],
  speed: [
    U('mps', '米/秒', 'm/s', 1), U('kmph', '千米/时', 'km/h', 1000 / 3600),
    U('mph', '英里/时', 'mph', 0.44704), U('knot', '节', 'kn', 1852 / 3600),
    U('mach', '马赫', 'Ma', 340.3), U('c', '光速', 'c', 299792458),
  ],
  data: [
    U('bit', '比特', 'bit', 1 / 8), U('byte', '字节', 'B', 1),
    U('kb', '千字节', 'KB', 1024), U('mb', '兆字节', 'MB', 1024 ** 2),
    U('gb', '吉字节', 'GB', 1024 ** 3), U('tb', '太字节', 'TB', 1024 ** 4), U('pb', '拍字节', 'PB', 1024 ** 5),
  ],
}

function getUnits(category) {
  const units = UNIT_DATA[category]
  if (!units) throw new Error(`未知单位类别：${category}`)
  return units
}
export function getUnit(category, unitId) {
  const unit = getUnits(category).find((u) => u.id === unitId)
  if (!unit) throw new Error(`类别 ${category} 中没有单位：${unitId}`)
  return unit
}

// 严格解析：不像 parseFloat 那样静默截断 "12abc"，逐字定位非法字符
export function parseValueStrict(text) {
  const raw = String(text ?? '')
  const s = raw.trim()
  if (!s) throw new Error('请输入数值')
  const m = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.exec(s)
  if (!m) {
    // 找第一个不属于数值字符集的字符定位
    const badIdx = [...s].findIndex((ch) => !/[0-9.+\-eE]/.test(ch))
    if (badIdx >= 0) throw new Error(`第 ${badIdx + 1} 个字符「${s[badIdx]}」不是合法数值字符`)
    if ((s.match(/\./g) || []).length > 1) throw new Error('数值里有多个小数点')
    if (/[eE]/.test(s)) throw new Error('科学计数法格式不完整，如 1.5e3')
    throw new Error('请输入合法数值，如 12.5 或 1.5e3')
  }
  const value = Number(s)
  if (!Number.isFinite(value)) throw new Error('数值超出可表示范围（溢出）')
  return value
}

const ABSOLUTE_ZERO = { c: -273.15, f: -459.67, k: 0 }
function assertTemperature(value, unitId) {
  const min = ABSOLUTE_ZERO[unitId]
  if (min !== undefined && value < min - 1e-9) {
    const names = { c: '摄氏度', f: '华氏度', k: '开尔文' }
    throw new Error(`温度不能低于绝对零度（${min} ${getUnit('temperature', unitId).symbol}），当前 ${value} ${names[unitId] || unitId}`)
  }
}

function convertTemperature(value, from, to) {
  assertTemperature(value, from)
  if (from === to) return value
  let celsius
  if (from === 'c') celsius = value
  else if (from === 'f') celsius = (value - 32) * (5 / 9)
  else celsius = value - 273.15
  let result
  if (to === 'c') result = celsius
  else if (to === 'f') result = celsius * (9 / 5) + 32
  else result = celsius + 273.15
  assertTemperature(result, to)
  return result
}

export function convertUnit(value, category, fromId, toId) {
  if (!Number.isFinite(value)) throw new Error('数值必须是有限数')
  if (category === 'temperature') return convertTemperature(value, fromId, toId)
  const from = getUnit(category, fromId)
  const to = getUnit(category, toId)
  const result = (value * from.factor) / to.factor
  if (!Number.isFinite(result)) throw new Error('换算结果超出可表示范围（溢出）')
  return result
}

export function convertAll(value, category, fromId) {
  return getUnits(category).map((unit) => ({
    ...unit,
    value: convertUnit(value, category, fromId, unit.id),
  }))
}

// 修复旧版 formatNumber(0) 输出 "0.000000e+0" 的问题
export function formatResult(num) {
  if (num === 0) return '0'
  if (!Number.isFinite(num)) throw new Error('结果不是有限数')
  const abs = Math.abs(num)
  if (abs < 1e-6 || abs >= 1e15) {
    const [mantissa, exp] = num.toExponential(6).split('e')
    return `${parseFloat(mantissa)}e${exp}`
  }
  return String(parseFloat(num.toPrecision(10)))
}

// 1 基准单位 = X 该单位（参考表用）
export function ratioFromBase(category, unitId) {
  if (category === 'temperature') return null
  const unit = getUnit(category, unitId)
  return 1 / unit.factor
}

