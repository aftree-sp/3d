export const DEFAULTS = {
  faces: 2,
  angle: 90,
  thickness: 4,
  width: 30,
  armA: 50,
  armB: 50,
  armC: 40,
  holeCount: 2,
  holeDia: 4.2,
  holeMargin: 8,
  countersink: true,
  connection: 'screw',
  slotWidth: 3.4,
  slotDepth: 2,
  rib: true,
  ribCount: 1,
  ribThickness: 3,
  ribSize: 18,
  orientation: 'A',
};

export const PARAM_LIMITS = {
  angle: { min: 30, max: 150, step: 1, unit: '°', decimals: 0 },
  thickness: { min: 1.6, max: 10, step: 0.2, unit: 'mm', decimals: 1 },
  width: { min: 10, max: 100, step: 1, unit: 'mm', decimals: 0 },
  armA: { min: 15, max: 150, step: 1, unit: 'mm', decimals: 0 },
  armB: { min: 15, max: 150, step: 1, unit: 'mm', decimals: 0 },
  armC: { min: 15, max: 150, step: 1, unit: 'mm', decimals: 0 },
  holeCount: { min: 1, max: 6, step: 1, unit: '个', decimals: 0 },
  holeDia: { min: 2, max: 10, step: 0.1, unit: 'mm', decimals: 1 },
  holeMargin: { min: 3, max: 25, step: 0.5, unit: 'mm', decimals: 1 },
  slotWidth: { min: 1, max: 20, step: 0.1, unit: 'mm', decimals: 1 },
  slotDepth: { min: 0.6, max: 8, step: 0.1, unit: 'mm', decimals: 1 },
  ribCount: { min: 1, max: 4, step: 1, unit: '条', decimals: 0 },
  ribThickness: { min: 1, max: 8, step: 0.5, unit: 'mm', decimals: 1 },
  ribSize: { min: 5, max: 60, step: 1, unit: 'mm', decimals: 0 },
};

export const SECTIONS = [
  {
    id: 'size',
    title: '基本尺寸',
    hint: '角度为两臂之间的夹角，90° 即经典 L 型角码；三面模式第三臂沿 Y 轴垂直伸出',
    fields: [
      {
        key: 'faces',
        label: '连接面数',
        type: 'segmented',
        options: [
          { value: 2, label: '2 面' },
          { value: 3, label: '3 面' },
        ],
      },
      { key: 'angle', label: '连接角度', slider: true },
      { key: 'thickness', label: '板厚', slider: true },
      { key: 'width', label: '臂宽', slider: true },
      { key: 'armA', label: 'A 臂长', slider: true },
      { key: 'armB', label: 'B 臂长', slider: true },
      { key: 'armC', label: 'C 臂长', slider: true },
    ],
  },
  {
    id: 'holes',
    title: '连接结构',
    hint: '螺丝孔可拆卸安装；卡槽纯靠槽位夹持板材，无需螺丝',
    fields: [
      {
        key: 'connection',
        label: '连接方式',
        type: 'segmented',
        options: [
          { value: 'screw', label: '螺丝孔' },
          { value: 'slot', label: '卡槽' },
        ],
      },
      { key: 'holeCount', label: '连接数量（每臂）', slider: true },
      {
        key: 'screw',
        label: '螺纹规格',
        type: 'select',
        options: [
          { value: 'custom', label: '自定义孔径' },
          { value: 'm3', label: 'M3（3.4 mm）', dia: 3.4 },
          { value: 'm4', label: 'M4（4.5 mm）', dia: 4.5 },
          { value: 'm5', label: 'M5（5.5 mm）', dia: 5.5 },
          { value: 'm6', label: 'M6（6.6 mm）', dia: 6.6 },
        ],
      },
      { key: 'holeDia', label: '孔径', slider: true },
      { key: 'holeMargin', label: '孔边距', slider: true },
      { key: 'countersink', label: '沉头孔（90°）', type: 'toggle' },
      { key: 'slotWidth', label: '卡槽宽度', slider: true },
      { key: 'slotDepth', label: '槽深', slider: true },
    ],
  },
  {
    id: 'rib',
    title: '加强筋',
    hint: '加强筋位于内角，90° 折角打印时自支撑',
    fields: [
      { key: 'rib', label: '启用加强筋', type: 'toggle' },
      { key: 'ribSize', label: '筋长度', slider: true },
      { key: 'ribCount', label: '筋数量', slider: true },
      { key: 'ribThickness', label: '筋厚度', slider: true },
    ],
  },
  {
    id: 'print',
    title: '打印摆放',
    hint: '模型默认按 A 臂平放于热床，导出时保持当前摆放',
    fields: [
      {
        key: 'orientation',
        label: '贴床臂',
        type: 'segmented',
        options: [
          { value: 'A', label: 'A 臂朝下' },
          { value: 'B', label: 'B 臂朝下' },
        ],
      },
    ],
  },
];

export const PRESETS = [
  {
    id: 'l90',
    name: '经典 L 型',
    tag: '90°',
    params: { ...DEFAULTS },
  },
  {
    id: 'slot90',
    name: '纯卡槽角码',
    tag: '免螺丝',
    params: {
      ...DEFAULTS,
      connection: 'slot',
      armA: 45,
      armB: 45,
      slotWidth: 3.4,
      slotDepth: 2.2,
      ribSize: 18,
    },
  },
  {
    id: 'corner3',
    name: '三面箱角',
    tag: '3 面',
    params: {
      ...DEFAULTS,
      faces: 3,
      armA: 50,
      armB: 50,
      armC: 40,
      ribSize: 18,
    },
  },
  {
    id: 'acute',
    name: '锐角 60°',
    tag: '60°',
    params: {
      ...DEFAULTS,
      angle: 60,
      armA: 55,
      armB: 55,
      ribSize: 16,
    },
  },
  {
    id: 'obtuse',
    name: '钝角 120°',
    tag: '120°',
    params: {
      ...DEFAULTS,
      angle: 120,
      armA: 55,
      armB: 55,
      ribSize: 20,
    },
  },
  {
    id: 'heavy',
    name: '重型加强',
    tag: '高负载',
    params: {
      ...DEFAULTS,
      thickness: 6,
      width: 40,
      armA: 60,
      armB: 60,
      holeCount: 3,
      holeDia: 5.5,
      holeMargin: 10,
      ribSize: 28,
      ribCount: 3,
      ribThickness: 4,
    },
  },
  {
    id: 'mini',
    name: '迷你 M3',
    tag: '小件',
    params: {
      ...DEFAULTS,
      thickness: 2.6,
      width: 16,
      armA: 30,
      armB: 30,
      holeDia: 3.4,
      holeMargin: 6,
      ribSize: 10,
      ribThickness: 2,
    },
  },
];

export function clampParams(params) {
  const out = { ...DEFAULTS, ...params };
  for (const [key, lim] of Object.entries(PARAM_LIMITS)) {
    const value = Number(out[key]);
    if (!Number.isFinite(value)) {
      out[key] = DEFAULTS[key];
      continue;
    }
    const snapped = Math.round((value - lim.min) / lim.step) * lim.step + lim.min;
    out[key] = Math.min(lim.max, Math.max(lim.min, Number(snapped.toFixed(lim.decimals))));
  }
  out.orientation = out.orientation === 'B' ? 'B' : 'A';
  out.faces = Number(out.faces) === 3 ? 3 : 2;
  out.connection = out.connection === 'slot' ? 'slot' : 'screw';
  out.countersink = Boolean(out.countersink);
  out.rib = Boolean(out.rib);
  return out;
}

export function encodeParams(params) {
  return JSON.stringify(clampParams(params));
}

export function decodeParams(hash) {
  try {
    const raw = JSON.parse(decodeURIComponent(hash.replace(/^#/, '')));
    if (!raw || typeof raw !== 'object') return null;
    return clampParams(raw);
  } catch {
    return null;
  }
}
