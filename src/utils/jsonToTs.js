// JSON 转 TypeScript 类型（纯本地）：推断原始类型、嵌套对象生成 interface、
// 数组元素类型合并（对象元素取键并集，缺失键标可选），同名同形接口复用、同名异形自动改名。
// 输入上限 100 万字符、嵌套深度 100 层、节点总数 5 万，超限点名报错（防深嵌套爆栈）；
// JSON 语法错误复用 parseJsonDetailed 给行列定位；根数组混合对象与原始值时，
// 元素接口名加 Item 后缀并预留根名，避免 interface 与 type 别名同名冲突（旧版会生成无效 TS）。

import { parseJsonDetailed } from './jsonFormat.js';

export const JSON_TO_TS_LIMITS = { maxChars: 1000000, maxDepth: 100, maxNodes: 50000 };

export function pascalCase(raw) {
  const parts = String(raw).split(/[^a-zA-Z0-9]+/).filter(Boolean);
  let name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (!name) name = 'Value';
  if (/^\d/.test(name)) name = 'N' + name;
  return name;
}

const KEEP_PLURAL = new Set(['news']);
function singularize(name) {
  if (name.length > 3 && name.endsWith('ies')) return name.slice(0, -3) + 'y';
  // status/analysis 等以 us/is 结尾的词不是复数，不能剥 s（旧版 status→Statu、news→New）
  if (KEEP_PLURAL.has(name.toLowerCase())) return name;
  if (name.length > 1 && name.endsWith('s') && !name.endsWith('ss') && !name.endsWith('us') && !name.endsWith('is')) return name.slice(0, -1);
  return name;
}

// 迭代统计深度与节点数（不用递归，避免深嵌套先把校验本身爆栈）
function measureStructure(data) {
  let nodes = 0;
  let maxDepth = 0;
  const stack = [[data, 1]];
  while (stack.length) {
    const [v, d] = stack.pop();
    nodes++;
    if (d > maxDepth) maxDepth = d;
    if (Array.isArray(v)) for (const el of v) stack.push([el, d + 1]);
    else if (isPlainObject(v)) for (const k of Object.keys(v)) stack.push([v[k], d + 1]);
  }
  return { nodes, maxDepth };
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function jsonToTypeScript(text, options = {}) {
  const rootNameRaw = (options.rootName || 'Root').trim() || 'Root';
  if (!/[A-Za-z0-9_$]/.test(rootNameRaw)) {
    throw new Error(`根类型名「${rootNameRaw}」需包含英文字母、数字或 _/$，请改一个合法的类型名`);
  }
  const rootName = pascalCase(rootNameRaw);
  const useExport = options.useExport !== false;

  const src = String(text ?? '');
  if (src.length > JSON_TO_TS_LIMITS.maxChars) {
    throw new Error(`输入过长：${src.length} 个字符，超过上限 ${JSON_TO_TS_LIMITS.maxChars} 个字符，请拆分后再生成`);
  }
  const parsed = parseJsonDetailed(src);
  if (!parsed.ok) {
    const { line, column, hints } = parsed.error;
    const where = line ? `（第 ${line} 行第 ${column} 列）` : '';
    const hint = hints && hints.length ? `；${hints[0]}` : '';
    throw new Error(`JSON 解析失败${where}：${parsed.error.message.replace(/^JSON\.parse:\s*/i, '')}${hint}`);
  }
  const data = parsed.value;
  const { nodes, maxDepth } = measureStructure(data);
  if (maxDepth > JSON_TO_TS_LIMITS.maxDepth) {
    throw new Error(`JSON 嵌套过深：${maxDepth} 层，超过上限 ${JSON_TO_TS_LIMITS.maxDepth} 层，请拆分后再生成`);
  }
  if (nodes > JSON_TO_TS_LIMITS.maxNodes) {
    throw new Error(`JSON 节点过多：${nodes} 个，超过上限 ${JSON_TO_TS_LIMITS.maxNodes} 个，请拆分后再生成`);
  }

  const interfaces = []; // { name, lines: [] }
  const byShape = new Map(); // shapeKey -> name
  const usedNames = new Map(); // name -> shapeKey
  let fieldCount = 0;

  function claimName(base, shapeKey) {
    if (byShape.has(shapeKey)) return byShape.get(shapeKey);
    let name = base;
    let i = 2;
    while (usedNames.has(name) && usedNames.get(name) !== shapeKey) {
      name = base + i;
      i++;
    }
    usedNames.set(name, shapeKey);
    byShape.set(shapeKey, name);
    return name;
  }

  // 把一组对象合并成形状：key -> { values: [], optional }
  function mergeShape(objects) {
    const shape = new Map();
    for (const obj of objects) {
      for (const key of Object.keys(obj)) {
        if (!shape.has(key)) shape.set(key, { values: [], optional: objects.length > 1 });
        shape.get(key).values.push(obj[key]);
      }
    }
    if (objects.length > 1) {
      for (const entry of shape.values()) {
        // 在部分对象中缺失的键标可选
        entry.optional = entry.values.length < objects.length;
      }
    }
    return shape;
  }

  function shapeKeyOf(shape) {
    // 纯结构签名（不含名字）做同形复用判断：字段名/可选性/递归类型一致即视为同形
    const parts = [];
    for (const [key, entry] of shape) {
      const sigs = [...new Set(entry.values.map((v) => typeSignature(v, key)))].sort();
      parts.push(`${key}${entry.optional ? '?' : ''}:${sigs.join('|')}`);
    }
    return '{' + parts.join(';') + '}';
  }

  function typeSignature(v, keyHint) {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
      if (!v.length) return 'unknown[]';
      // 每个元素签名加括号再拼接，避免 [] 只绑定到最后一个签名导致同形判断串味
      return [...new Set(v.map((el) => typeSignature(el, keyHint)))].sort().map((s) => `(${s})`).join('|') + '[]';
    }
    if (isPlainObject(v)) return shapeKeyOf(mergeShape([v]));
    return typeof v; // string | number | boolean
  }

  function typeOf(values, keyHint, { fromArray = false } = {}) {
    // values: 同一位置出现的多个值（数组元素合并时）
    const objectValues = values.filter(isPlainObject);
    const others = values.filter((v) => !isPlainObject(v));
    const types = [];

    if (objectValues.length) {
      const base = pascalCase(singularize(keyHint || 'Item'));
      const shape = mergeShape(objectValues);
      const sKey = shapeKeyOf(shape);
      let name = byShape.get(sKey);
      if (!name) {
        name = claimName(base, sKey);
        const entry = { name, lines: [] };
        interfaces.push(entry); // 先占位保证根接口在前
        entry.lines = renderShape(shape);
      }
      types.push(name);
    }
    for (const v of others) {
      const t = singleType(v, keyHint, fromArray);
      if (!types.includes(t)) types.push(t);
    }
    return types;
  }

  function singleType(v, keyHint, fromArray) {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
      if (!v.length) return 'unknown[]';
      const inner = typeOf(v, keyHint, { fromArray: true });
      const joined = inner.join(' | ');
      return (inner.length > 1 ? `(${joined})` : joined) + '[]';
    }
    return typeof v; // string | number | boolean
  }

  function renderShape(shape) {
    const lines = [];
    for (const [key, entry] of shape) {
      fieldCount++;
      const types = typeOf(entry.values, key);
      const label = IDENT_RE.test(key) ? key : JSON.stringify(key);
      lines.push(`  ${label}${entry.optional ? '?' : ''}: ${types.join(' | ')};`);
    }
    return lines;
  }

  const prefix = useExport ? 'export ' : '';
  let rootBlock = '';
  if (isPlainObject(data)) {
    const shape = mergeShape([data]);
    const sKey = shapeKeyOf(shape);
    claimName(rootName, sKey);
    const entry = { name: rootName, lines: [] };
    interfaces.unshift(entry);
    entry.lines = renderShape(shape);
  } else if (Array.isArray(data) && data.length && data.every(isPlainObject)) {
    const shape = mergeShape(data);
    const sKey = shapeKeyOf(shape);
    claimName(rootName, sKey);
    const entry = { name: rootName, lines: [] };
    interfaces.unshift(entry);
    entry.lines = renderShape(shape);
    rootBlock = `${prefix}type ${rootName}List = ${rootName}[];`;
    // 根数组的元素接口就叫 rootName，另给列表别名便于引用
    interfaces.rootAlias = rootBlock;
  } else {
    // 根原始值 / 混合数组：根名是 type 别名，先预留防止元素接口抢同名（旧版生成 interface Root + type Root 无效 TS）；
    // 元素对象接口以「根名+Item」为命名提示，如 RootItem。
    usedNames.set(rootName, '__root_alias__');
    const types = typeOf([data], rootName + 'Item');
    rootBlock = `${prefix}type ${rootName} = ${types.join(' | ')};`;
  }

  const blocks = interfaces.map((it) => `${prefix}interface ${it.name} {\n${it.lines.join('\n')}\n}`);
  if (interfaces.rootAlias) blocks.push(interfaces.rootAlias);
  else if (rootBlock && !isPlainObject(data)) blocks.push(rootBlock);

  return {
    code: blocks.join('\n\n') + '\n',
    interfaceCount: interfaces.length,
    fieldCount
  };
}
