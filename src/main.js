import './style.css';
import Module from 'manifold-3d';
import { createViewer } from './viewer.js';
import { buildConnector } from './geometry.js';
import {
  DEFAULTS,
  PARAM_LIMITS,
  SECTIONS,
  PRESETS,
  clampParams,
  decodeParams,
} from './params.js';
import { buildBinarySTL, build3MF, downloadBlob, makeFilename } from './exporters.js';

const $ = (selector) => document.querySelector(selector);
const BED = 256;
const STORAGE_KEY = 'angle-connector-studio.params';

const state = {
  params: loadInitialParams(),
  wasm: null,
  viewer: null,
  pending: false,
  refit: false,
  toastTimer: 0,
};

const ui = {
  fields: new Map(),
  presets: [],
};

function loadInitialParams() {
  const fromHash = decodeParams(window.location.hash);
  if (fromHash) return fromHash;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return clampParams(JSON.parse(stored));
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------------- controls ---------------- */

function buildControls() {
  const root = $('#controls');
  for (const section of SECTIONS) {
    const sec = el('section', 'section');
    const head = el('div', 'section-head');
    head.append(el('h2', null, section.title), el('span', 'section-hint', section.hint));
    sec.appendChild(head);
    for (const field of section.fields) {
      sec.appendChild(buildField(field));
    }
    root.appendChild(sec);
  }
}

function buildField(field) {
  const wrap = el('div', 'field');
  const head = el('div', 'field-head');
  const label = el('label', 'field-label', field.label);
  if (field.key !== 'screw') label.htmlFor = `input-${field.key}`;
  head.appendChild(label);

  const entry = { wrap };

  if (field.type === 'toggle') {
    const toggle = el('button', 'toggle');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', field.label);
    toggle.addEventListener('click', () => setParam(field.key, !state.params[field.key]));
    head.appendChild(toggle);
    entry.toggle = toggle;
    wrap.appendChild(head);
  } else if (field.type === 'select') {
    const select = el('select');
    select.id = `input-${field.key}`;
    for (const option of field.options) {
      const node = el('option', null, option.label);
      node.value = option.value;
      select.appendChild(node);
    }
    select.addEventListener('change', () => {
      const option = field.options.find((o) => o.value === select.value);
      if (option && option.dia) setParam('holeDia', option.dia);
    });
    head.appendChild(select);
    entry.select = select;
    entry.field = field;
    wrap.appendChild(head);
  } else if (field.type === 'segmented') {
    const group = el('div', 'segmented');
    group.setAttribute('role', 'group');
    entry.segments = [];
    for (const option of field.options) {
      const button = el('button', null, option.label);
      button.type = 'button';
      button.addEventListener('click', () => setParam(field.key, option.value));
      group.appendChild(button);
      entry.segments.push({ button, value: option.value });
    }
    wrap.append(head, group);
  } else {
    const limit = PARAM_LIMITS[field.key];
    const valueWrap = el('div', 'field-value');
    const number = el('input');
    number.type = 'number';
    number.id = `input-${field.key}`;
    number.min = limit.min;
    number.max = limit.max;
    number.step = limit.step;
    number.inputMode = 'decimal';
    number.addEventListener('input', () => {
      const value = Number(number.value);
      if (Number.isFinite(value)) setParam(field.key, value, { keepFocus: number });
    });
    number.addEventListener('blur', () => syncControls());
    valueWrap.append(number, el('span', 'field-unit', limit.unit));

    const range = el('input');
    range.type = 'range';
    range.min = limit.min;
    range.max = limit.max;
    range.step = limit.step;
    range.addEventListener('input', () => setParam(field.key, Number(range.value)));

    head.appendChild(valueWrap);
    wrap.append(head, range);
    entry.number = number;
    entry.range = range;
    entry.limit = limit;
  }

  ui.fields.set(field.key, entry);
  return wrap;
}

function buildPresets() {
  const root = $('#presets');
  ui.presets = PRESETS.map((preset) => {
    const button = el('button', 'preset');
    button.type = 'button';
    button.append(el('b', null, preset.name), el('small', null, preset.tag));
    button.addEventListener('click', () => {
      state.params = clampParams(preset.params);
      state.refit = true;
      persist();
      syncControls();
      scheduleBuild();
    });
    root.appendChild(button);
    return { button, preset };
  });
}

function setParam(key, value, options = {}) {
  state.params = clampParams({ ...state.params, [key]: value });
  if (key === 'orientation' || key === 'faces') state.refit = true;
  persist();
  syncControls(options.keepFocus);
  scheduleBuild();
}

function syncControls(keepFocus) {
  for (const [key, entry] of ui.fields) {
    const value = state.params[key];
    if (entry.toggle) {
      entry.toggle.classList.toggle('is-on', Boolean(value));
      entry.toggle.setAttribute('aria-checked', String(Boolean(value)));
    }
    if (entry.number && entry.range) {
      if (document.activeElement !== entry.number && entry.number !== keepFocus) {
        entry.number.value = Number(value).toFixed(entry.limit.decimals);
      }
      entry.range.value = value;
      const pct = ((value - entry.limit.min) / (entry.limit.max - entry.limit.min)) * 100;
      entry.range.style.setProperty('--fill', `${pct}%`);
    }
    if (entry.segments) {
      for (const segment of entry.segments) {
        segment.button.classList.toggle('is-active', segment.value === value);
      }
    }
    if (entry.select) {
      const match = entry.field.options.find((option) => {
        if (!option.dia) return false;
        return Math.abs(option.dia - state.params.holeDia) < 0.05;
      });
      entry.select.value = match ? match.value : 'custom';
    }
  }

  const ribKeys = ['ribSize', 'ribCount', 'ribThickness'];
  for (const key of ribKeys) {
    ui.fields.get(key)?.wrap.classList.toggle('is-disabled', !state.params.rib);
  }

  const slotMode = state.params.connection === 'slot';
  const holeKeys = ['holeCount', 'screw', 'holeDia', 'holeMargin', 'countersink'];
  for (const key of holeKeys) {
    ui.fields.get(key)?.wrap.classList.toggle('is-disabled', slotMode);
  }
  for (const key of ['slotWidth', 'slotDepth']) {
    ui.fields.get(key)?.wrap.classList.toggle('is-disabled', !slotMode);
  }

  ui.fields.get('armC')?.wrap.classList.toggle('is-disabled', state.params.faces !== 3);

  const signature = JSON.stringify(state.params);
  for (const { button, preset } of ui.presets) {
    button.classList.toggle('is-active', JSON.stringify(clampParams(preset.params)) === signature);
  }
}

/* ---------------- persistence ---------------- */

function persist() {
  const json = JSON.stringify(state.params);
  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
  const hash = `#${encodeURIComponent(json)}`;
  try {
    window.history.replaceState(null, '', hash);
  } catch {
    /* ignore */
  }
}

/* ---------------- build pipeline ---------------- */

function scheduleBuild() {
  if (state.pending) return;
  state.pending = true;
  requestAnimationFrame(() => {
    state.pending = false;
    rebuild();
  });
}

function rebuild() {
  if (!state.wasm || !state.viewer) return;
  try {
    const result = buildConnector(state.wasm, state.params);
    state.viewer.setMesh(result.mesh, result.size, { refit: state.refit });
    state.refit = false;
    updateStats(result);
    updateNotes(result);
  } catch (error) {
    console.error(error);
    showToast(`生成失败：${error.message}`);
  }
}

function updateStats(result) {
  const [x, y, z] = result.size;
  const stats = result.stats;
  $('#stat-size').textContent = `${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)} mm`;
  $('#stat-volume').textContent = `${(stats.volume / 1000).toFixed(2)} cm³`;
  $('#stat-weight').textContent = `${stats.weight.toFixed(1)} g`;
  $('#stat-filament').textContent = `${stats.filament.toFixed(2)} m`;
  $('#stat-tris').textContent = stats.triangles.toLocaleString('en-US');

  const badge = $('#bed-badge');
  const over = Math.max(x, y) > BED || z > BED;
  badge.textContent = over ? `超出 ${BED} × ${BED} mm 热床范围` : `热床 ${BED} × ${BED} mm · 可打印`;
  badge.classList.toggle('is-over', over);
}

function updateNotes(result) {
  const container = $('#notes');
  const notes = [...result.warnings];

  if (Math.max(...result.size) > BED) {
    notes.unshift(`模型尺寸 ${Math.max(...result.size).toFixed(0)} mm 超出常见热床，请缩放或缩短臂长`);
  }
  if (state.params.faces === 3 && state.params.angle !== 90) {
    notes.push('三面模式下建议连接角度设为 90°，才能构成标准立体箱角');
  }
  if (state.params.angle >= 115 && state.params.orientation === 'A') {
    notes.push('钝角时 B 臂倾斜较大，打印可能需要支撑，可切换为「B 臂朝下」');
  }
  if (state.params.connection === 'slot') {
    notes.push('卡槽模式无需螺丝，建议槽宽比板材厚度大 0.2–0.4 mm 便于插入');
  } else if (state.params.thickness <= 2.2) {
    notes.push('板厚较薄，建议使用 100% 填充或增加厚度以承受螺丝预紧力');
  }

  container.textContent = '';
  if (notes.length === 0) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  for (const note of notes.slice(0, 4)) {
    container.appendChild(el('div', 'note', note));
  }
}

/* ---------------- export ---------------- */

function ensureFresh() {
  if (!state.wasm) throw new Error('几何内核尚未就绪');
  return buildConnector(state.wasm, state.params);
}

function export3MF() {
  try {
    const result = ensureFresh();
    const bytes = build3MF(result.mesh, {
      title: `Angle Connector ${Math.round(state.params.angle)}°`,
    });
    downloadBlob(bytes, makeFilename(state.params, '3mf'), 'model/3mf');
    showToast('3MF 已生成 · 双击文件即可在 Bambu Studio / OrcaSlicer 中打开');
  } catch (error) {
    console.error(error);
    showToast(`导出失败：${error.message}`);
  }
}

function exportSTL() {
  try {
    const result = ensureFresh();
    const bytes = buildBinarySTL(result.mesh);
    downloadBlob(bytes, makeFilename(state.params, 'stl'), 'model/stl');
    showToast('STL 已生成 · 可用于任何切片软件');
  } catch (error) {
    console.error(error);
    showToast(`导出失败：${error.message}`);
  }
}

function launchBambu() {
  try {
    const result = ensureFresh();
    const bytes = build3MF(result.mesh, {
      title: `Angle Connector ${Math.round(state.params.angle)}°`,
    });
    const launcher = document.createElement('a');
    launcher.href = 'bambustudio://open';
    launcher.rel = 'noopener';
    document.body.appendChild(launcher);
    launcher.click();
    launcher.remove();
    downloadBlob(bytes, makeFilename(state.params, '3mf'), 'model/3mf');
    showToast('3MF 已保存 · 若 Bambu Studio 未自动打开，双击刚下载的文件即可');
  } catch (error) {
    console.error(error);
    showToast(`导出失败：${error.message}`);
  }
}

async function copyLink() {
  persist();
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    showToast('参数链接已复制 · 分享后对方打开即是同一模型');
  } catch {
    const temp = el('textarea');
    temp.value = url;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
      showToast('参数链接已复制');
    } catch {
      showToast('复制失败，请手动复制地址栏链接');
    }
    temp.remove();
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

/* ---------------- boot ---------------- */

async function boot() {
  buildControls();
  buildPresets();
  syncControls();
  persist();

  $('#btn-3mf').addEventListener('click', export3MF);
  $('#btn-stl').addEventListener('click', exportSTL);
  $('#btn-bambu').addEventListener('click', launchBambu);
  $('#btn-link').addEventListener('click', copyLink);

  $('#btn-view-reset').addEventListener('click', () => state.viewer?.resetView());
  $('#btn-edges').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const next = !button.classList.contains('is-active');
    button.classList.toggle('is-active', next);
    button.setAttribute('aria-pressed', String(next));
    state.viewer?.setEdgesVisible(next);
  });

  state.viewer = createViewer($('#viewport'));

  try {
    const wasm = await Module();
    wasm.setup();
    state.wasm = wasm;
  } catch (error) {
    console.error(error);
    $('#loading').innerHTML = '<p>几何内核加载失败，请刷新页面重试</p>';
    return;
  }

  rebuild();
  $('#loading').classList.add('is-hidden');
}

window.addEventListener('hashchange', () => {
  const fromHash = decodeParams(window.location.hash);
  if (fromHash) {
    state.params = fromHash;
    syncControls();
    scheduleBuild();
  }
});

boot();
