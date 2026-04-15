'use strict';

/* ═══════════════════════════════════════════════════════
   PMGO WIDGET — REFACTORED SYSTEM ENGINE
   Base estrutural A/B/C + domingo D (consolidação)
   Pendência herdada prioritária + calendário projetivo
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════ */
const STORAGE_KEY  = 'pmgo_vh_v10';
const LEGACY_KEYS  = [
  'pmgo_vh_v9','pmgo_widget_vh_v7','pmgo_widget_vh_v6',
  'pmgo_widget_vh_v5','pmgo_widget_vh_v4','pmgo_widget_vh_v3','pmgo_ciclos_v2'
];

const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const WEEKDAY_LABELS = {
  sunday:'Domingo', monday:'Segunda', tuesday:'Terça',
  wednesday:'Quarta', thursday:'Quinta', friday:'Sexta', saturday:'Sábado'
};

const CYCLE_ORDER = ['A','B','C'];
const CYCLE_META = {
  A: { label:'Ciclo A', multiplier:1.00 },
  B: { label:'Ciclo B', multiplier:1.00 },
  C: { label:'Ciclo C', multiplier:0.74 },
  D: { label:'Fase de Consolidação', multiplier:0.00 },
};

const COLOR_PRESETS = {
  blue:   { label:'Azul',     cls:'c-blue',   hex:'#60a5fa', soft:'rgba(96,165,250,.20)',  glow:'rgba(96,165,250,.12)'  },
  green:  { label:'Verde',    cls:'c-green',  hex:'#4ade80', soft:'rgba(74,222,128,.20)',  glow:'rgba(74,222,128,.12)'  },
  gray:   { label:'Cinza',    cls:'c-gray',   hex:'#9ca3af', soft:'rgba(156,163,175,.20)', glow:'rgba(156,163,175,.10)' },
  yellow: { label:'Amarelo',  cls:'c-yellow', hex:'#fbbf24', soft:'rgba(251,191,36,.20)',  glow:'rgba(251,191,36,.12)'  },
  orange: { label:'Laranja',  cls:'c-orange', hex:'#fb923c', soft:'rgba(251,146,60,.20)',  glow:'rgba(251,146,60,.12)'  },
  purple: { label:'Roxo',     cls:'c-purple', hex:'#a78bfa', soft:'rgba(167,139,250,.20)', glow:'rgba(167,139,250,.12)' },
  red:    { label:'Vermelho', cls:'c-red',    hex:'#ef4444', soft:'rgba(239,68,68,.20)',   glow:'rgba(239,68,68,.12)'   },
};

const DEFAULT_CONFIG = {
  systemName:   'Virtus et Honor',
  subtitle:     'Fila cíclica perpétua — o avanço real depende apenas da sua conclusão.',
  defaultSlots: 3,
  sundayMode:   'freeze', // freeze = guiado | manual = livre
  confirmReset: true,
  weekdaySlots: { sunday:0, monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0 },
};

const DEFAULT_DISCIPLINES = [
  {
    key:'lp',
    name:'Língua Portuguesa',
    weight:9,
    macroCycle:'A',
    colorKey:'blue',
    crossExamRelevance:'high',
    dependencies:[]
  },
  {
    key:'dp',
    name:'Direito Penal',
    weight:11,
    macroCycle:'A',
    colorKey:'green',
    crossExamRelevance:'high',
    dependencies:[]
  },
  {
    key:'dc',
    name:'Direito Constitucional',
    weight:10,
    macroCycle:'A',
    colorKey:'purple',
    crossExamRelevance:'high',
    dependencies:[]
  },
  {
    key:'dpp',
    name:'Direito Processual Penal',
    weight:9,
    macroCycle:'B',
    colorKey:'orange',
    crossExamRelevance:'high',
    dependencies:[]
  },
  {
    key:'da',
    name:'Direito Administrativo',
    weight:10,
    macroCycle:'B',
    colorKey:'yellow',
    crossExamRelevance:'high',
    dependencies:[]
  },
  {
    key:'lex',
    name:'Legislação Extravagante',
    weight:7,
    macroCycle:'B',
    colorKey:'gray',
    crossExamRelevance:'medium',
    dependencies:['dp','dc']
  },
  {
    key:'dpm',
    name:'Direito Penal Militar',
    weight:6,
    macroCycle:'C',
    colorKey:'red',
    crossExamRelevance:'low',
    dependencies:['dp']
  },
  {
    key:'dppm',
    name:'Direito Processual Penal Militar',
    weight:7,
    macroCycle:'C',
    colorKey:'red',
    crossExamRelevance:'low',
    dependencies:['dpp']
  },
  {
    key:'rg',
    name:'Realidade de Goiás',
    weight:3,
    macroCycle:'C',
    colorKey:'gray',
    crossExamRelevance:'very_low',
    dependencies:[]
  },
  {
    key:'redacao',
    name:'Redação',
    weight:2,
    macroCycle:'D',
    colorKey:'purple',
    crossExamRelevance:'special',
    dependencies:[]
  },
];

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
function uid() {
  return window.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function safeParse(v)   { try { return JSON.parse(v); } catch { return null; } }
function deepClone(v)   { return JSON.parse(JSON.stringify(v)); }
function clamp(v,mn,mx,fb) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(mx, Math.max(mn, Math.round(n))) : fb;
}
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
function unique(arr) { return [...new Set(arr)]; }

/* ═══════════════════════════════════════════════════════
   IN-MEMORY STATE
═══════════════════════════════════════════════════════ */
let appState = null;
let isBusy   = false;

/* ═══════════════════════════════════════════════════════
   DATE HELPERS
═══════════════════════════════════════════════════════ */
function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseIso(key) {
  const [y,m,d] = String(key).split('-').map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function addDays(dateKey, amount) {
  const d = parseIso(dateKey);
  d.setDate(d.getDate() + amount);
  return isoDate(d);
}
function fmtDate(key) {
  return parseIso(key).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function wkKey(d = new Date()) { return WEEKDAY_KEYS[d.getDay()]; }
function wkFromDateKey(dateKey) { return wkKey(parseIso(dateKey)); }
function wkLabel(dateKey) { return WEEKDAY_LABELS[wkFromDateKey(dateKey)] ?? '—'; }
function isSunday(weekdayKey) { return weekdayKey === 'sunday'; }
function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 86400000); }
function getDaySlots(config, weekdayKey) {
  if (isSunday(weekdayKey)) return 0;
  const s = Number(config.weekdaySlots?.[weekdayKey] ?? 0);
  return s > 0 ? s : clamp(config.defaultSlots, 1, 10, 3);
}

/* ═══════════════════════════════════════════════════════
   PERSISTENCE
═══════════════════════════════════════════════════════ */
const Store = {
  _ok: null,

  ok() {
    if (this._ok !== null) return this._ok;
    try {
      const k = `${STORAGE_KEY}__t`;
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      this._ok = true;
    } catch {
      this._ok = false;
    }
    return this._ok;
  },

  save(state) {
    const s = JSON.stringify(state);
    if (this.ok()) {
      try { localStorage.setItem(STORAGE_KEY, s); return; } catch {}
    }
    try {
      const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(s))));
      history.replaceState(null, '', `${location.pathname}${location.search}#vh=${enc}`);
    } catch {}
  },

  load() {
    if (this.ok()) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return safeParse(raw);
      for (const k of LEGACY_KEYS) {
        const leg = localStorage.getItem(k);
        if (leg) return safeParse(leg);
      }
    }
    const m = location.hash.match(/vh=([^&]+)/);
    if (!m) return null;
    try {
      return safeParse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    } catch {
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    } catch {}
    if (location.hash.includes('vh=')) {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
  },
};

/* ═══════════════════════════════════════════════════════
   DEFAULTS / NORMALIZATION
═══════════════════════════════════════════════════════ */
function makeDefaultDisciplines() {
  return DEFAULT_DISCIPLINES.map(d => ({ ...deepClone(d) }));
}

function emptyDay(dateKey) {
  return {
    dateKey,
    weekdayKey: wkFromDateKey(dateKey),
    packageItems: [],
    closedVisual: false,
    sundayModeActive: false,
    seedCycle: null,
    sundaySuggestion: null,
  };
}

function makeEmptyCycleMemory() {
  return {
    A: { lastScheduledDate:null, skipCount:0 },
    B: { lastScheduledDate:null, skipCount:0 },
    C: { lastScheduledDate:null, skipCount:0 },
  };
}

function emptyState() {
  return {
    rev: 0,
    updatedAt: null,
    config: deepClone(DEFAULT_CONFIG),
    disciplines: makeDefaultDisciplines(),
    today: emptyDay(isoDate()),
    history: [],
    dayBuilds: [],
    carryBuffer: [],
    cycleState: {
      nextBaseIndex: 0,
      lastBaseCycle: null,
      memory: makeEmptyCycleMemory(),
    },
    rotations: 0,
    stats: { completedCount:0, closedDays:0 },
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();

  const state = emptyState();

  state.rev       = Number.isInteger(raw.rev) ? raw.rev : 0;
  state.updatedAt = raw.updatedAt || null;

  state.config = {
    ...deepClone(DEFAULT_CONFIG),
    ...(raw.config || {}),
  };
  state.config.weekdaySlots = {
    ...deepClone(DEFAULT_CONFIG.weekdaySlots),
    ...(raw.config?.weekdaySlots || {}),
  };

  const discs = Array.isArray(raw.disciplines) && raw.disciplines.length
    ? raw.disciplines.map(normDisc).filter(Boolean)
    : makeDefaultDisciplines();

  state.disciplines = discs;

  state.today = normDay(raw.today, state.disciplines);
  state.history = Array.isArray(raw.history)
    ? raw.history.map(normHistItem).filter(Boolean)
    : [];

  state.dayBuilds = Array.isArray(raw.dayBuilds)
    ? raw.dayBuilds.map(normDayBuild).filter(Boolean)
    : [];

  state.carryBuffer = Array.isArray(raw.carryBuffer)
    ? raw.carryBuffer.map(i => normPkgItem(i, state.disciplines)).filter(Boolean)
    : [];

  state.cycleState = {
    nextBaseIndex: clamp(raw.cycleState?.nextBaseIndex, 0, CYCLE_ORDER.length - 1, 0),
    lastBaseCycle: ['A','B','C'].includes(raw.cycleState?.lastBaseCycle) ? raw.cycleState.lastBaseCycle : null,
    memory: {
      A: {
        lastScheduledDate: raw.cycleState?.memory?.A?.lastScheduledDate || null,
        skipCount: clamp(raw.cycleState?.memory?.A?.skipCount, 0, 9999, 0),
      },
      B: {
        lastScheduledDate: raw.cycleState?.memory?.B?.lastScheduledDate || null,
        skipCount: clamp(raw.cycleState?.memory?.B?.skipCount, 0, 9999, 0),
      },
      C: {
        lastScheduledDate: raw.cycleState?.memory?.C?.lastScheduledDate || null,
        skipCount: clamp(raw.cycleState?.memory?.C?.skipCount, 0, 9999, 0),
      },
    }
  };

  state.rotations = clamp(raw.rotations, 0, 999999, 0);
  state.stats = {
    completedCount: clamp(raw.stats?.completedCount, 0, 1e9, 0),
    closedDays: clamp(raw.stats?.closedDays, 0, 1e9, 0),
  };

  return state;
}

function normDisc(d) {
  if (!d || typeof d !== 'object') return null;
  const name = String(d.name || '').trim();
  if (!name) return null;

  const key = String(d.key || uid()).trim();
  const macroCycle = ['A','B','C','D'].includes(d.macroCycle) ? d.macroCycle : inferCycle(name);

  return {
    key,
    name,
    weight: clamp(d.weight, 1, 11, 1),
    macroCycle,
    colorKey: COLOR_PRESETS[d.colorKey] ? d.colorKey : inferColorByCycle(macroCycle),
    crossExamRelevance: d.crossExamRelevance || 'medium',
    dependencies: Array.isArray(d.dependencies) ? unique(d.dependencies.filter(Boolean)) : [],
  };
}

function normDay(raw, disciplines) {
  const dateKey = raw?.dateKey || isoDate();
  return {
    dateKey,
    weekdayKey: raw?.weekdayKey || wkFromDateKey(dateKey),
    packageItems: Array.isArray(raw?.packageItems)
      ? raw.packageItems.map(i => normPkgItem(i, disciplines)).filter(Boolean)
      : [],
    closedVisual: Boolean(raw?.closedVisual),
    sundayModeActive: Boolean(raw?.sundayModeActive),
    seedCycle: ['A','B','C','D'].includes(raw?.seedCycle) ? raw.seedCycle : null,
    sundaySuggestion: raw?.sundaySuggestion || null,
  };
}

function normPkgItem(item, disciplines) {
  if (!item || typeof item !== 'object') return null;

  if (item.type === 'special') {
    return {
      uid: item.uid || uid(),
      type: 'special',
      disciplineKey: null,
      name: item.name || 'Fase de Consolidação',
      macroCycle: 'D',
      colorKey: COLOR_PRESETS[item.colorKey] ? item.colorKey : 'purple',
      queueIndex: Number.isInteger(item.queueIndex) ? item.queueIndex : -1,
      queueKey: item.queueKey || null,
      completed: Boolean(item.completed),
      completedAt: item.completedAt || null,
      occLabel: item.occLabel || null,
      carryOver: Boolean(item.carryOver),
      reservedDate: item.reservedDate || isoDate(),
      slots: clamp(item.slots, 0, 20, 0),
      inheritedFromDate: item.inheritedFromDate || null,
      sourceCycle: item.sourceCycle || 'D',
      buildReason: item.buildReason || 'sunday',
      suggestedMode: item.suggestedMode || null,
    };
  }

  const disc = disciplines.find(d => d.key === item.disciplineKey);
  if (!disc) return null;

  return {
    uid: item.uid || uid(),
    type: 'discipline',
    disciplineKey: disc.key,
    name: item.name || disc.name,
    macroCycle: item.macroCycle || disc.macroCycle,
    colorKey: COLOR_PRESETS[item.colorKey] ? item.colorKey : disc.colorKey,
    queueIndex: Number.isInteger(item.queueIndex) ? item.queueIndex : 0,
    queueKey: item.queueKey || null,
    completed: Boolean(item.completed),
    completedAt: item.completedAt || null,
    occLabel: item.occLabel || null,
    carryOver: Boolean(item.carryOver),
    reservedDate: item.reservedDate || isoDate(),
    slots: clamp(item.slots, 0, 20, 0),
    inheritedFromDate: item.inheritedFromDate || null,
    sourceCycle: ['A','B','C','D'].includes(item.sourceCycle) ? item.sourceCycle : disc.macroCycle,
    buildReason: item.buildReason || 'base',
    suggestedMode: item.suggestedMode || null,
  };
}

function normHistItem(item) {
  if (!item || typeof item !== 'object') return null;
  const dateKey = item.dateKey || isoDate();
  return {
    uid: item.uid || uid(),
    type: item.type || 'discipline',
    discKey: item.discKey || item.disciplineKey || null,
    name: item.name || '—',
    macroCycle: ['A','B','C','D','DAY'].includes(item.macroCycle) ? item.macroCycle : 'A',
    colorKey: COLOR_PRESETS[item.colorKey] ? item.colorKey : 'blue',
    dateKey,
    completedIso: item.completedIso || dateKey,
    queueIndex: Number.isInteger(item.queueIndex) ? item.queueIndex : 0,
    slotsOnDay: clamp(item.slotsOnDay || 0, 0, 20, 0),
    weekdayKey: item.weekdayKey || wkFromDateKey(dateKey),
    carryOver: Boolean(item.carryOver),
    skipped: Boolean(item.skipped),
    dayClose: Boolean(item.dayClose),
    meta: item.meta || {},
  };
}

function normDayBuild(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    dateKey: item.dateKey || isoDate(),
    seedCycle: ['A','B','C','D'].includes(item.seedCycle) ? item.seedCycle : null,
    builtAt: item.builtAt || null,
    items: Array.isArray(item.items) ? item.items : [],
    carryCount: clamp(item.carryCount, 0, 20, 0),
  };
}

function inferCycle(name) {
  const l = String(name || '').toLowerCase();
  if (l.includes('militar') || l.includes('goiás') || l.includes('goias')) return 'C';
  if (l.includes('administrativo') || l.includes('processual') || l.includes('extravagante')) return 'B';
  if (l.includes('redação') || l.includes('redacao')) return 'D';
  return 'A';
}

function inferColorByCycle(cycle) {
  if (cycle === 'A') return 'blue';
  if (cycle === 'B') return 'orange';
  if (cycle === 'C') return 'red';
  return 'purple';
}

/* ═══════════════════════════════════════════════════════
   STATE HELPERS
═══════════════════════════════════════════════════════ */
function getDisc(key) {
  return appState.disciplines.find(d => d.key === key) || null;
}
function getPreset(colorKey) {
  return COLOR_PRESETS[colorKey] || COLOR_PRESETS.blue;
}
function todayDiscs() {
  return appState.today.packageItems.filter(i => i.type === 'discipline');
}
function doneTodayN() {
  return todayDiscs().filter(i => i.completed).length;
}
function pendingN() {
  return todayDiscs().filter(i => !i.completed).length;
}
function totalDiscN() {
  return todayDiscs().length;
}
function uniqueStudyDays() {
  return new Set(appState.history.filter(h => h.type === 'discipline').map(h => h.dateKey)).size || 1;
}

function getCycleDisciplines(cycleKey) {
  return appState.disciplines.filter(d => d.macroCycle === cycleKey);
}

function lastCompletedDateForDisc(discKey) {
  const items = appState.history
    .filter(h => h.type === 'discipline' && !h.skipped && h.discKey === discKey)
    .sort((a,b) => String(a.dateKey).localeCompare(String(b.dateKey)));
  return items.length ? items[items.length - 1].dateKey : null;
}

function lastScheduledDateForDisc(discKey) {
  const today = appState.today.packageItems
    .filter(i => i.type === 'discipline' && i.disciplineKey === discKey)
    .map(i => i.reservedDate);

  const carry = appState.carryBuffer
    .filter(i => i.type === 'discipline' && i.disciplineKey === discKey)
    .map(i => i.reservedDate);

  const historyDates = appState.dayBuilds
    .flatMap(b => Array.isArray(b.items) ? b.items : [])
    .filter(i => i.disciplineKey === discKey)
    .map(i => i.reservedDate);

  const all = [...today, ...carry, ...historyDates].filter(Boolean).sort();
  return all.length ? all[all.length - 1] : null;
}

function countSkipsForDisc(discKey) {
  return appState.history.filter(h => h.type === 'discipline' && h.skipped && h.discKey === discKey).length;
}

function hasRecentBase(dependencyKey, withinDays = 8, refDateKey = isoDate()) {
  const last = lastCompletedDateForDisc(dependencyKey);
  if (!last) return false;
  return daysBetween(last, refDateKey) <= withinDays;
}

function calcNegligenceFactor(disc, refDateKey = isoDate()) {
  const lastCompleted = lastCompletedDateForDisc(disc.key);
  const daysGap = lastCompleted ? daysBetween(lastCompleted, refDateKey) : 9999;
  const skipPenalty = countSkipsForDisc(disc.key) * 0.12;

  let factor = 1;

  if (!lastCompleted) factor += 0.85;
  else if (daysGap >= 14) factor += 0.70;
  else if (daysGap >= 10) factor += 0.50;
  else if (daysGap >= 7) factor += 0.32;
  else if (daysGap >= 4) factor += 0.18;

  factor += Math.min(skipPenalty, 0.80);

  if (disc.key === 'rg') {
    factor = Math.min(factor, 1.45);
  }

  return factor;
}

function calcContextFactor(disc, refDateKey = isoDate()) {
  let factor = 1;

  if (disc.crossExamRelevance === 'high') factor += 0.08;
  if (disc.crossExamRelevance === 'very_low') factor -= 0.08;

  if (disc.key === 'dpm' && !hasRecentBase('dp', 8, refDateKey)) factor -= 0.28;
  if (disc.key === 'dppm' && !hasRecentBase('dpp', 8, refDateKey)) factor -= 0.24;
  if (disc.key === 'lex' && !(hasRecentBase('dp', 10, refDateKey) || hasRecentBase('dc', 10, refDateKey))) factor -= 0.12;

  const recentWindow = appState.history.filter(h =>
    h.type === 'discipline' &&
    !h.skipped &&
    daysBetween(h.dateKey, refDateKey) <= 4 &&
    h.discKey === disc.key
  ).length;

  if (recentWindow >= 2) factor -= 0.18;
  if (recentWindow >= 3) factor -= 0.28;

  return Math.max(0.35, factor);
}

function calcDisciplinePriority(disc, refDateKey = isoDate()) {
  const cycleMult = CYCLE_META[disc.macroCycle]?.multiplier ?? 1;
  const negligence = calcNegligenceFactor(disc, refDateKey);
  const contextual = calcContextFactor(disc, refDateKey);

  return disc.weight * cycleMult * negligence * contextual;
}

function mostNeglected() {
  return appState.disciplines
    .filter(d => d.macroCycle !== 'D')
    .map(d => {
      const last = lastCompletedDateForDisc(d.key);
      const gap = last ? daysBetween(last, appState.today.dateKey) : 9999;
      return { disc:d, gap, last };
    })
    .sort((a,b) => b.gap - a.gap)[0] || null;
}

/* ═══════════════════════════════════════════════════════
   SUNDAY ENGINE
═══════════════════════════════════════════════════════ */
function chooseSundaySuggestion(refDateKey = isoDate()) {
  const recent = appState.history.filter(h =>
    h.type === 'discipline' &&
    !h.skipped &&
    daysBetween(h.dateKey, refDateKey) <= 7
  );

  const recentCount = recent.length;
  const uniqueRecent = new Set(recent.map(h => h.discKey)).size;
  const lastTwoDays = appState.history.filter(h =>
    h.type === 'discipline' &&
    !h.skipped &&
    daysBetween(h.dateKey, refDateKey) <= 2
  ).length;

  const neglected = mostNeglected();

  if (recentCount >= 12) {
    return {
      mode: 'simulado',
      label: 'Simulado sugerido',
      description: 'Janela forte de teoria recente. Simulado ou prova parcial pode ser útil neste domingo.',
    };
  }

  if (uniqueRecent >= 5 && lastTwoDays >= 6) {
    return {
      mode: 'questoes_mistas',
      label: 'Questões mistas',
      description: 'Houve teoria forte em vários blocos. Questões mistas podem consolidar melhor o conteúdo recente.',
    };
  }

  if (neglected && neglected.gap >= 10) {
    return {
      mode: 'revisao_seletiva',
      label: 'Revisão seletiva',
      description: `Há sinais de negligência em ${neglected.disc.name}. Revisão seletiva pode ser a melhor consolidação.`,
    };
  }

  return {
    mode: 'revisao_geral',
    label: 'Revisão geral',
    description: 'Sem gatilho crítico específico. Revisão geral, questões ou combinação leve são boas opções.',
  };
}

function buildSundayPkg(dateKey, mode = appState.config.sundayMode, suggestion = null) {
  const finalSuggestion = suggestion || chooseSundaySuggestion(dateKey);
  const manualLabel = mode === 'manual'
    ? 'Domingo livre'
    : 'Fase de Consolidação';

  return [{
    uid: uid(),
    type: 'special',
    disciplineKey: null,
    name: manualLabel,
    macroCycle: 'D',
    colorKey: 'purple',
    queueIndex: -1,
    queueKey: null,
    completed: false,
    completedAt: null,
    occLabel: finalSuggestion?.label || mode,
    carryOver: false,
    reservedDate: dateKey,
    slots: 0,
    inheritedFromDate: null,
    sourceCycle: 'D',
    buildReason: 'sunday',
    suggestedMode: finalSuggestion?.mode || null,
  }];
}

/* ═══════════════════════════════════════════════════════
   PRIORITY / COMPOSITION ENGINE
═══════════════════════════════════════════════════════ */
function cyclePriorityScore(cycleKey, refDateKey = isoDate()) {
  const meta = CYCLE_META[cycleKey];
  if (!meta || cycleKey === 'D') return -999;

  let score = meta.multiplier * 10;

  const mem = appState.cycleState.memory[cycleKey];
  if (mem?.skipCount) score += Math.min(mem.skipCount * 0.65, 2.2);

  if (mem?.lastScheduledDate) {
    const gap = daysBetween(mem.lastScheduledDate, refDateKey);
    if (gap >= 7) score += 1.2;
    else if (gap >= 4) score += 0.6;
    else if (gap <= 1) score -= 0.8;
  } else {
    score += 0.9;
  }

  const nextCycleByRotation = CYCLE_ORDER[appState.cycleState.nextBaseIndex] || 'A';
  if (cycleKey === nextCycleByRotation) score += 0.7;

  if (cycleKey === 'C') {
    const recentC = appState.history.filter(h =>
      h.type === 'discipline' &&
      h.macroCycle === 'C' &&
      !h.skipped &&
      daysBetween(h.dateKey, refDateKey) <= 4
    ).length;

    if (recentC >= 2) score -= 1.8;
    else if (recentC >= 1) score -= 0.9;
  }

  return score;
}

function chooseSeedCycle(refDateKey = isoDate(), excludeCycles = []) {
  const candidates = CYCLE_ORDER
    .filter(c => !excludeCycles.includes(c))
    .map(cycleKey => ({
      cycleKey,
      score: cyclePriorityScore(cycleKey, refDateKey),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.cycleKey || (CYCLE_ORDER[appState.cycleState.nextBaseIndex] || 'A');
}

function chooseDisciplinesFromCycle(cycleKey, count, refDateKey, existingKeys = []) {
  const existing = new Set(existingKeys);

  return getCycleDisciplines(cycleKey)
    .filter(d => !existing.has(d.key))
    .sort((a, b) => {
      const pa = calcDisciplinePriority(a, refDateKey);
      const pb = calcDisciplinePriority(b, refDateKey);
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name, 'pt-BR');
    })
    .slice(0, Math.max(0, count));
}

function composeProjectedDay({
  dateKey,
  carryItems = [],
  assumeCurrentCompletion = false,
  mutateCycleState = false,
}) {
  const weekdayKey = wkFromDateKey(dateKey);
  const slots = getDaySlots(appState.config, weekdayKey);

  if (isSunday(weekdayKey)) {
    const suggestion = chooseSundaySuggestion(dateKey);
    return {
      dateKey,
      weekdayKey,
      sundayModeActive: true,
      closedVisual: false,
      packageItems: buildSundayPkg(dateKey, appState.config.sundayMode, suggestion),
      seedCycle: 'D',
      sundaySuggestion: suggestion,
      overflowCarry: carryItems,
    };
  }

  const carried = carryItems.map(item => ({
    ...deepClone(item),
    uid: uid(),
    carryOver: true,
    reservedDate: dateKey,
    inheritedFromDate: item.reservedDate || item.inheritedFromDate || null,
    completed: false,
    completedAt: null,
    buildReason: 'carry',
  }));

  const packageItems = [];
  const overflowCarry = [];

  if (carried.length >= slots) {
    packageItems.push(...carried.slice(0, slots));
    overflowCarry.push(...carried.slice(slots));
    return {
      dateKey,
      weekdayKey,
      sundayModeActive: false,
      closedVisual: false,
      packageItems,
      seedCycle: appState.cycleState.lastBaseCycle || CYCLE_ORDER[appState.cycleState.nextBaseIndex] || 'A',
      sundaySuggestion: null,
      overflowCarry,
    };
  }

  packageItems.push(...carried);

  const remaining = slots - packageItems.length;
  const existingKeys = packageItems
    .filter(i => i.type === 'discipline')
    .map(i => i.disciplineKey);

  const seedCycle = chooseSeedCycle(dateKey);
  const selected = chooseDisciplinesFromCycle(seedCycle, remaining, dateKey, existingKeys);

  selected.forEach((disc, idx) => {
    packageItems.push({
      uid: uid(),
      type: 'discipline',
      disciplineKey: disc.key,
      name: disc.name,
      macroCycle: disc.macroCycle,
      colorKey: disc.colorKey,
      queueIndex: idx,
      queueKey: `${seedCycle}:${disc.key}:${dateKey}`,
      completed: false,
      completedAt: null,
      occLabel: null,
      carryOver: false,
      reservedDate: dateKey,
      slots,
      inheritedFromDate: null,
      sourceCycle: seedCycle,
      buildReason: 'base',
      suggestedMode: null,
    });
  });

  if (mutateCycleState) {
    registerCycleSelection(seedCycle, dateKey);
  }

  return {
    dateKey,
    weekdayKey,
    sundayModeActive: false,
    closedVisual: false,
    packageItems,
    seedCycle,
    sundaySuggestion: null,
    overflowCarry,
  };
}

function registerCycleSelection(seedCycle, dateKey) {
  const prev = appState.cycleState.lastBaseCycle;
  if (prev === 'C' && seedCycle === 'A') {
    appState.rotations++;
  }

  appState.cycleState.lastBaseCycle = seedCycle;
  appState.cycleState.nextBaseIndex = (CYCLE_ORDER.indexOf(seedCycle) + 1) % CYCLE_ORDER.length;

  CYCLE_ORDER.forEach(c => {
    if (c === seedCycle) {
      appState.cycleState.memory[c].lastScheduledDate = dateKey;
      appState.cycleState.memory[c].skipCount = 0;
    } else {
      appState.cycleState.memory[c].skipCount = clamp(appState.cycleState.memory[c].skipCount + 1, 0, 9999, 0);
    }
  });
}

function carryPending(items, targetDate) {
  return items
    .filter(i => i.type === 'discipline' && !i.completed)
    .map(i => ({
      ...deepClone(i),
      uid: uid(),
      carryOver: true,
      reservedDate: targetDate,
      inheritedFromDate: i.reservedDate || i.inheritedFromDate || null,
      completed: false,
      completedAt: null,
      buildReason: 'carry',
    }));
}

function cloneCarryBuffer(targetDate) {
  return (appState.carryBuffer || []).map(i => ({
    ...deepClone(i),
    uid: uid(),
    carryOver: true,
    reservedDate: targetDate,
    completed: false,
    completedAt: null,
    buildReason: 'carry',
  }));
}

function recordDayBuild(day) {
  const payload = {
    dateKey: day.dateKey,
    seedCycle: day.seedCycle,
    builtAt: new Date().toISOString(),
    carryCount: day.packageItems.filter(i => i.carryOver).length,
    items: day.packageItems.map(i => ({
      disciplineKey: i.disciplineKey,
      name: i.name,
      reservedDate: i.reservedDate,
      sourceCycle: i.sourceCycle,
      carryOver: i.carryOver,
      buildReason: i.buildReason,
    })),
  };

  appState.dayBuilds = appState.dayBuilds.filter(d => d.dateKey !== day.dateKey);
  appState.dayBuilds.push(payload);
}

function clonePendingForDate(items, dateKey) {
  return items
    .filter(i => i.type === 'discipline' && !i.completed)
    .map(i => ({
      ...deepClone(i),
      uid: uid(),
      completed: false,
      completedAt: null,
      carryOver: true,
      reservedDate: dateKey,
      inheritedFromDate: i.inheritedFromDate || i.reservedDate || null,
      occLabel: 'Herdada',
    }));
}

function createDiscItem(disc, dateKey, seedCycle, opts = {}) {
  return {
    uid: uid(),
    type: 'discipline',
    disciplineKey: disc.key,
    name: disc.name,
    macroCycle: disc.macroCycle,
    colorKey: disc.colorKey,
    completed: false,
    completedAt: null,
    carryOver: Boolean(opts.carryOver),
    inheritedFromDate: opts.inheritedFromDate || null,
    reservedDate: dateKey,
    sourceCycle: seedCycle || disc.macroCycle,
    occLabel: opts.occLabel || null,
  };
}

function createSundayItem(dateKey, suggestion) {
  return {
    uid: uid(),
    type: 'special',
    disciplineKey: null,
    name: suggestion?.title || 'Fase de Consolidação',
    macroCycle: 'DAY',
    colorKey: 'purple',
    completed: false,
    completedAt: null,
    carryOver: false,
    inheritedFromDate: null,
    reservedDate: dateKey,
    sourceCycle: 'D',
    occLabel: suggestion?.tag || null,
  };
}

/* ═══════════════════════════════════════════════════════
   PRIORITY ENGINE
═══════════════════════════════════════════════════════ */
function computeNeglectFactor(disc, dateKey, runtime) {
  const lastSeen = getLastSeenDate(disc.key, runtime);
  const lastDone = getLastCompletionDate(disc.key, runtime);
  const ref = lastDone || lastSeen;
  if (!ref) return 1.45;
  const gap = daysBetween(ref, dateKey);
  return 1 + Math.min(gap, 21) * 0.045;
}

function computeContextFactor(disc, dateKey, runtime) {
  let factor = 1;

  if (disc.key === 'rg') factor *= 0.82;
  if (disc.key === 'dpm' && !hasRecentCompletion('dp', dateKey, runtime, 10)) factor *= 0.60;
  if (disc.key === 'dppm' && !hasRecentCompletion('dpp', dateKey, runtime, 10)) factor *= 0.60;

  if (disc.key === 'lex') {
    const penalReady = hasRecentCompletion('dp', dateKey, runtime, 12);
    const constReady = hasRecentCompletion('dc', dateKey, runtime, 12);
    if (!(penalReady || constReady)) factor *= 0.78;
  }

  if (appearedYesterday(disc.key, dateKey, runtime)) factor *= 0.72;

  return factor;
}

function computeDisciplinePriority(disc, dateKey, runtime) {
  const cycleMult = CYCLE_META[disc.macroCycle]?.multiplier ?? 1;
  const neglect = computeNeglectFactor(disc, dateKey, runtime);
  const context = computeContextFactor(disc, dateKey, runtime);
  return disc.weight * cycleMult * neglect * context;
}

function chooseSeedCycle(dateKey, runtime) {
  const canonical = CYCLE_ORDER[runtime.cycleState.nextBaseIndex] || 'A';
  const scores = CYCLE_ORDER.map(cycle => {
    const mem = runtime.cycleState.memory[cycle] || { lastScheduledDate: null, skipCount: 0 };
    const base = CYCLE_META[cycle].multiplier;
    let score = base * 10;

    if (cycle === canonical) score += 2.25;
    score += (mem.skipCount || 0) * 1.2;

    if (mem.lastScheduledDate) {
      score += Math.min(daysBetween(mem.lastScheduledDate, dateKey), 21) * 0.12;
    } else {
      score += 1.2;
    }

    if (cycle === 'C') {
      const penalBaseReady = hasRecentCompletion('dp', dateKey, runtime, 10);
      const procBaseReady = hasRecentCompletion('dpp', dateKey, runtime, 10);
      if (!penalBaseReady) score -= 1.8;
      if (!procBaseReady) score -= 1.4;
    }

    return { cycle, score };
  }).sort((a, b) => b.score - a.score);

  const chosen = scores[0]?.cycle || canonical;
  const nextIndex = CYCLE_ORDER.indexOf(nextCycleAfter(chosen));

  CYCLE_ORDER.forEach(cycle => {
    const mem = runtime.cycleState.memory[cycle] || { lastScheduledDate: null, skipCount: 0 };
    if (cycle === chosen) {
      mem.lastScheduledDate = dateKey;
      mem.skipCount = 0;
    } else {
      mem.skipCount = clamp((mem.skipCount || 0) + 1, 0, 999, 0);
    }
    runtime.cycleState.memory[cycle] = mem;
  });

  runtime.cycleState.lastBaseCycle = chosen;
  runtime.cycleState.nextBaseIndex = nextIndex < 0 ? 0 : nextIndex;
  if (chosen === 'C') runtime.rotations = clamp((runtime.rotations || 0) + 1, 0, 999999, 0);

  return chosen;
}

function selectDisciplinesForCycle(cycle, count, dateKey, runtime, excludeKeys = []) {
  if (count <= 0) return [];
  const excluded = new Set(excludeKeys);
  const candidates = runtime.disciplines
    .filter(d => d.macroCycle === cycle && !excluded.has(d.key))
    .map(d => ({ disc: d, priority: computeDisciplinePriority(d, dateKey, runtime) }))
    .sort((a, b) => b.priority - a.priority);

  return candidates.slice(0, count).map(x => x.disc);
}

/* ═══════════════════════════════════════════════════════
   SUNDAY ENGINE
═══════════════════════════════════════════════════════ */
function suggestSundayPlan(dateKey, runtime) {
  const recentBuilds = (runtime.dayBuilds || []).slice(-4);
  const hadHeavyTheory = recentBuilds.filter(b => ['A', 'B'].includes(b.seedCycle)).length >= 2;
  const hasCarry = (runtime.carryBuffer || []).length > 0;
  const last3Completions = (runtime.history || []).filter(h => h.type === 'discipline' && !h.skipped).slice(-12);

  if (hasCarry) {
    return {
      key: 'review_pending',
      title: 'Fase de Consolidação',
      tag: 'REVISÃO',
      note: 'Revisão seletiva, questões e limpeza estratégica de pendências.',
    };
  }

  if (hadHeavyTheory && last3Completions.length >= 6) {
    return {
      key: 'mixed_questions',
      title: 'Fase de Consolidação',
      tag: 'QUESTÕES',
      note: 'Questões mistas, revisão ativa e treino de execução.',
    };
  }

  return {
    key: runtime.config.sundayMode === 'manual' ? 'manual' : 'light_review',
    title: 'Fase de Consolidação',
    tag: runtime.config.sundayMode === 'manual' ? 'LIVRE' : 'CONSOLIDAÇÃO',
    note: runtime.config.sundayMode === 'manual'
      ? 'Bloco livre de consolidação decidido pelo usuário.'
      : 'Revisão, questões, flashcards, redação ou organização, sem teoria nova por padrão.',
  };
}

/* ═══════════════════════════════════════════════════════
   COMPOSITION ENGINE
═══════════════════════════════════════════════════════ */
function registerDayBuild(runtime, day) {
  const record = {
    dateKey: day.dateKey,
    weekdayKey: day.weekdayKey,
    seedCycle: day.seedCycle,
    sundayModeActive: day.sundayModeActive,
    disciplineKeys: todayDiscs(day).map(i => i.disciplineKey),
    carryCount: todayDiscs(day).filter(i => i.carryOver).length,
  };

  const idx = (runtime.dayBuilds || []).findIndex(b => b.dateKey === day.dateKey);
  if (idx >= 0) runtime.dayBuilds[idx] = record;
  else runtime.dayBuilds.push(record);
}

function buildInitialDay(dateKey, runtime) {
  const weekdayKey = wkFromDateKey(dateKey);

  if (isSunday(weekdayKey)) {
    const suggestion = suggestSundayPlan(dateKey, runtime);
    const day = {
      dateKey,
      weekdayKey,
      packageItems: [createSundayItem(dateKey, suggestion)],
      closedVisual: false,
      sundayModeActive: true,
      seedCycle: 'D',
      sundaySuggestion: suggestion,
    };
    runtime.carryBuffer = [];
    registerDayBuild(runtime, day);
    return day;
  }

  const seedCycle = chooseSeedCycle(dateKey, runtime);
  const slots = getDaySlots(runtime.config, weekdayKey);
  const selected = selectDisciplinesForCycle(seedCycle, slots, dateKey, runtime, []);
  const packageItems = selected.map(d => createDiscItem(d, dateKey, seedCycle));

  const day = {
    dateKey,
    weekdayKey,
    packageItems,
    closedVisual: false,
    sundayModeActive: false,
    seedCycle,
    sundaySuggestion: null,
  };

  registerDayBuild(runtime, day);
  return day;
}

function composeNextDay(dateKey, prevDay, runtime) {
  const weekdayKey = wkFromDateKey(dateKey);

  if (isSunday(weekdayKey)) {
    const pendingFromPrev = prevDay.sundayModeActive
      ? clonePackageForNewDate(runtime.carryBuffer || [], dateKey)
      : clonePendingForDate(prevDay.packageItems || [], dateKey);

    runtime.carryBuffer = pendingFromPrev;
    const suggestion = suggestSundayPlan(dateKey, runtime);

    const day = {
      dateKey,
      weekdayKey,
      packageItems: [createSundayItem(dateKey, suggestion)],
      closedVisual: false,
      sundayModeActive: true,
      seedCycle: 'D',
      sundaySuggestion: suggestion,
    };

    registerDayBuild(runtime, day);
    return day;
  }

  if (prevDay.sundayModeActive) {
    const carried = clonePackageForNewDate(runtime.carryBuffer || [], dateKey)
      .filter(i => i.type === 'discipline')
      .map(i => ({
        ...i,
        carryOver: true,
        inheritedFromDate: i.inheritedFromDate || i.reservedDate || prevDay.dateKey,
        completed: false,
        completedAt: null,
        occLabel: 'Herdada',
      }));

    runtime.carryBuffer = [];

    const slots = getDaySlots(runtime.config, weekdayKey);
    const freeSlots = Math.max(0, slots - carried.length);
    const seedCycle = chooseSeedCycle(dateKey, runtime);
    const selected = selectDisciplinesForCycle(seedCycle, freeSlots, dateKey, runtime, carried.map(i => i.disciplineKey));
    const newItems = selected.map(d => createDiscItem(d, dateKey, seedCycle));

    const day = {
      dateKey,
      weekdayKey,
      packageItems: [...carried, ...newItems],
      closedVisual: false,
      sundayModeActive: false,
      seedCycle,
      sundaySuggestion: null,
    };

    registerDayBuild(runtime, day);
    return day;
  }

  const prevDiscs = todayDiscs(prevDay);

  if (prevDiscs.length && isFullMiss(prevDay)) {
    const day = {
      ...emptyDay(dateKey),
      weekdayKey,
      packageItems: clonePackageForNewDate(prevDay.packageItems, dateKey).map(i => ({
        ...i,
        completed: false,
        completedAt: null,
        carryOver: Boolean(i.carryOver),
        occLabel: i.occLabel || null,
      })),
      closedVisual: false,
      sundayModeActive: false,
      seedCycle: prevDay.seedCycle || runtime.cycleState.lastBaseCycle || null,
      sundaySuggestion: null,
    };

    registerDayBuild(runtime, day);
    return day;
  }

  const carried = clonePendingForDate(prevDay.packageItems || [], dateKey);
  const slots = getDaySlots(runtime.config, weekdayKey);
  const freeSlots = Math.max(0, slots - carried.length);
  const seedCycle = chooseSeedCycle(dateKey, runtime);
  const selected = selectDisciplinesForCycle(seedCycle, freeSlots, dateKey, runtime, carried.map(i => i.disciplineKey));
  const newItems = selected.map(d => createDiscItem(d, dateKey, seedCycle));

  const day = {
    dateKey,
    weekdayKey,
    packageItems: [...carried, ...newItems],
    closedVisual: false,
    sundayModeActive: false,
    seedCycle,
    sundaySuggestion: null,
  };

  registerDayBuild(runtime, day);
  return day;
}

function advanceToDate(targetDateKey, opts = {}) {
  const force = Boolean(opts.force);
  const runtime = appState;

  if (!force && runtime.today.dateKey === targetDateKey) return false;

  const prev = deepClone(runtime.today);

  if (!runtime.today.packageItems.length) {
    runtime.today = buildInitialDay(targetDateKey, runtime);
    return true;
  }

  if (prev.dateKey !== targetDateKey) {
    const prevDiscs = todayDiscs(prev);
    if (prevDiscs.length > 0 && prevDiscs.every(i => i.completed)) {
      runtime.stats.closedDays++;
      runtime.history.push({
        uid: uid(),
        type: 'dayClose',
        discKey: null,
        name: `Dia fechado — ${fmtDate(prev.dateKey)}`,
        macroCycle: prev.seedCycle || 'DAY',
        colorKey: 'green',
        dateKey: prev.dateKey,
        completedIso: targetDateKey,
        carryOver: false,
        dayClose: true,
        skipped: false,
        meta: {
          completed: prevDiscs.filter(i => i.completed).length,
          total: prevDiscs.length,
        },
      });
    }
  }

  runtime.today = composeNextDay(targetDateKey, prev, runtime);
  return true;
}

/* ═══════════════════════════════════════════════════════
   RUNTIME HELPERS / OVERRIDES
═══════════════════════════════════════════════════════ */
function todayDiscs(day = appState.today) {
  return (day?.packageItems || []).filter(i => i.type === 'discipline');
}

function doneTodayN(day = appState.today) {
  return todayDiscs(day).filter(i => i.completed).length;
}

function pendingN(day = appState.today) {
  return todayDiscs(day).filter(i => !i.completed).length;
}

function totalDiscN(day = appState.today) {
  return todayDiscs(day).length;
}

function nextCycleAfter(cycleKey) {
  const idx = CYCLE_ORDER.indexOf(cycleKey);
  if (idx < 0) return 'A';
  return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
}

function clonePackageForNewDate(items, dateKey) {
  return (items || []).map(i => ({
    ...deepClone(i),
    uid: uid(),
    reservedDate: dateKey,
  }));
}

function isFullMiss(day) {
  const discs = todayDiscs(day);
  return discs.length > 0 && discs.every(i => !i.completed);
}

function getLastSeenDate(discKey, runtime = appState) {
  const fromBuilds = (runtime.dayBuilds || [])
    .filter(b => Array.isArray(b.disciplineKeys) && b.disciplineKeys.includes(discKey))
    .map(b => b.dateKey)
    .sort()
    .pop() || null;

  const fromToday = todayDiscs(runtime.today)
    .filter(i => i.disciplineKey === discKey)
    .map(i => i.reservedDate)
    .sort()
    .pop() || null;

  return [fromBuilds, fromToday].filter(Boolean).sort().pop() || null;
}

function getLastCompletionDate(discKey, runtime = appState) {
  return (runtime.history || [])
    .filter(h => h.type === 'discipline' && !h.skipped && h.discKey === discKey)
    .map(h => h.dateKey)
    .sort()
    .pop() || null;
}

function hasRecentCompletion(discKey, dateKey, runtime = appState, withinDays = 10) {
  const last = getLastCompletionDate(discKey, runtime);
  if (!last) return false;
  return daysBetween(last, dateKey) <= withinDays;
}

function appearedYesterday(discKey, dateKey, runtime = appState) {
  const yesterday = addDays(dateKey, -1);
  return Boolean(
    (runtime.dayBuilds || []).find(b => b.dateKey === yesterday && Array.isArray(b.disciplineKeys) && b.disciplineKeys.includes(discKey))
  );
}

/* ═══════════════════════════════════════════════════════
   PERSIST / ROLLOVER / REBUILD
═══════════════════════════════════════════════════════ */
function persist() {
  appState.rev++;
  appState.updatedAt = new Date().toISOString();
  Store.save(appState);
}

function syncIfNewer() {
  const raw = Store.load();
  if (!raw) return;
  const ext = normalizeState(raw);
  if (ext.rev > appState.rev) {
    appState = ext;
  }
}

function rollover(force = false) {
  return advanceToDate(isoDate(), { force });
}

function rebuildCurrentDayAfterSettings() {
  const dateKey = appState.today.dateKey || isoDate();
  const weekdayKey = wkFromDateKey(dateKey);

  if (isSunday(weekdayKey)) {
    const suggestion = suggestSundayPlan(dateKey, appState);
    appState.today = {
      dateKey,
      weekdayKey,
      packageItems: [createSundayItem(dateKey, suggestion)],
      closedVisual: false,
      sundayModeActive: true,
      seedCycle: 'D',
      sundaySuggestion: suggestion,
    };
    appState.carryBuffer = [];
    registerDayBuild(appState, appState.today);
    return;
  }

  const slots = getDaySlots(appState.config, weekdayKey);
  const preserved = (appState.today.packageItems || [])
    .map(i => normPkgItem(i, appState.disciplines))
    .filter(Boolean)
    .filter(i => i.type === 'discipline')
    .slice(0, slots);

  const existingKeys = preserved.map(i => i.disciplineKey);
  const seedCycle = appState.today.seedCycle && CYCLE_ORDER.includes(appState.today.seedCycle)
    ? appState.today.seedCycle
    : chooseSeedCycle(dateKey, appState);

  const fill = selectDisciplinesForCycle(seedCycle, Math.max(0, slots - preserved.length), dateKey, appState, existingKeys)
    .map(d => createDiscItem(d, dateKey, seedCycle));

  appState.today = {
    dateKey,
    weekdayKey,
    packageItems: [...preserved, ...fill],
    closedVisual: false,
    sundayModeActive: false,
    seedCycle,
    sundaySuggestion: null,
  };

  registerDayBuild(appState, appState.today);
}

/* ═══════════════════════════════════════════════════════
   CALENDAR PROJECTION
═══════════════════════════════════════════════════════ */
function buildCalendarPreview(days = 9) {
  const runtime = normalizeState(deepClone(appState));
  const out = [];

  let current = deepClone(runtime.today);
  out.push({ ...deepClone(current), isToday: true });

  for (let i = 1; i < days; i++) {
    const nextDateKey = addDays(runtime.today.dateKey, i);
    const nextDay = composeNextDay(nextDateKey, current, runtime);
    runtime.today = deepClone(nextDay);
    current = deepClone(nextDay);
    out.push({ ...deepClone(nextDay), isToday: false });
  }

  return out;
}

/* ═══════════════════════════════════════════════════════
   ACTIONS
═══════════════════════════════════════════════════════ */
function handlePkgAction(e) {
  if (isBusy) return;

  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const itemId = btn.dataset.itemId;
  if (!action || !itemId) return;

  const item = appState.today.packageItems.find(i => i.uid === itemId);
  if (!item || item.type !== 'discipline') return;

  isBusy = true;

  try {
    if (action === 'complete' && !item.completed) {
      item.completed = true;
      item.completedAt = new Date().toISOString();

      appState.history.push({
        uid: uid(),
        type: 'discipline',
        discKey: item.disciplineKey,
        name: item.name,
        macroCycle: item.macroCycle,
        colorKey: item.colorKey,
        dateKey: appState.today.dateKey,
        completedIso: isoDate(),
        queueIndex: item.queueIndex ?? 0,
        slotsOnDay: totalDiscN(appState.today),
        weekdayKey: appState.today.weekdayKey,
        carryOver: item.carryOver,
        skipped: false,
        dayClose: false,
        meta: {
          occLabel: item.occLabel,
          inheritedFromDate: item.inheritedFromDate || null,
          sourceCycle: item.sourceCycle || null,
        },
      });

      appState.stats.completedCount++;

      if (todayDiscs(appState.today).every(i => i.completed)) {
        appState.today.closedVisual = true;
      }
    }

    if (action === 'undo' && item.completed) {
      item.completed = false;
      item.completedAt = null;
      appState.today.closedVisual = false;

      const reverseIdx = [...appState.history]
        .reverse()
        .findIndex(h =>
          h.type === 'discipline' &&
          !h.skipped &&
          h.discKey === item.disciplineKey &&
          h.dateKey === appState.today.dateKey
        );

      if (reverseIdx >= 0) {
        appState.history.splice(appState.history.length - 1 - reverseIdx, 1);
      }

      appState.stats.completedCount = Math.max(0, appState.stats.completedCount - 1);
    }

    persist();
    render();
  } finally {
    setTimeout(() => { isBusy = false; }, 160);
  }
}

function addDiscipline() {
  const name = document.getElementById('new-disc-name').value.trim();
  const weight = clamp(document.getElementById('new-disc-weight').value, 1, 11, 1);
  const colorEl = document.getElementById('new-disc-color');
  const colorKey = COLOR_PRESETS[colorEl.value] ? colorEl.value : 'blue';

  if (!name) return;

  const macroCycle = inferCycle(name);

  appState.disciplines.push({
    key: uid(),
    name,
    weight,
    macroCycle,
    colorKey,
    crossExamRelevance: 'medium',
    dependencies: [],
  });

  rebuildCurrentDayAfterSettings();
  persist();
  renderDiscEditor();
  render();

  document.getElementById('new-disc-name').value = '';
  document.getElementById('new-disc-weight').value = 1;
  document.getElementById('new-disc-name').focus();
}

function saveSettings() {
  syncIfNewer();

  appState.config.systemName = document.getElementById('cfg-name').value.trim() || DEFAULT_CONFIG.systemName;
  appState.config.subtitle = document.getElementById('cfg-subtitle').value.trim() || DEFAULT_CONFIG.subtitle;
  appState.config.defaultSlots = clamp(document.getElementById('cfg-slots').value, 1, 10, 3);
  appState.config.sundayMode = document.getElementById('cfg-sunday').value === 'manual' ? 'manual' : 'freeze';
  appState.config.confirmReset = document.getElementById('cfg-confirm-reset').checked;

  WEEKDAY_KEYS.forEach(k => {
    const el = document.querySelector(`[data-wday="${k}"] .js-wday-slot`);
    if (el) {
      appState.config.weekdaySlots[k] = clamp(el.value, 0, 10, 0);
    }
  });

  const cards = [...document.querySelectorAll('#disc-editor [data-disc-key]')];
  const next = cards.map(card => {
    const name = card.querySelector('.js-disc-name').value.trim();
    if (!name) return null;

    return {
      key: card.dataset.discKey,
      name,
      weight: clamp(card.querySelector('.js-disc-weight').value, 1, 11, 1),
      macroCycle: ['A', 'B', 'C', 'D'].includes(card.querySelector('.js-disc-cycle').value)
        ? card.querySelector('.js-disc-cycle').value
        : 'A',
      colorKey: COLOR_PRESETS[card.querySelector('.js-disc-color').value]
        ? card.querySelector('.js-disc-color').value
        : 'blue',
      crossExamRelevance: 'medium',
      dependencies: [],
    };
  }).filter(Boolean);

  appState.disciplines = next.length ? next : makeDefaultDisciplines();

  rebuildCurrentDayAfterSettings();
  persist();
  closeModal('settings-modal');
  render();
}

function requestReset() {
  if (appState.config.confirmReset) {
    openModal('reset-modal');
    return;
  }
  doReset();
}

function doReset() {
  Store.clear();
  appState = emptyState();
  appState.today = buildInitialDay(isoDate(), appState);
  persist();
  ['reset-modal', 'history-modal', 'settings-modal'].forEach(id => closeModal(id));
  render();
}

function forceRollover() {
  syncIfNewer();
  const targetDateKey = addDays(appState.today.dateKey, 1);
  advanceToDate(targetDateKey, { force: true });
  persist();
  render();
}

/* ═══════════════════════════════════════════════════════
   RENDER FUNCTIONS
═══════════════════════════════════════════════════════ */
function render() {
  renderHeader();
  renderStats();
  renderFocus();
  renderCalendar();

  const historyModal = document.getElementById('history-modal');
  const settingsModal = document.getElementById('settings-modal');

  if (historyModal && historyModal.classList.contains('show')) renderHistory();
  if (settingsModal && settingsModal.classList.contains('show')) populateSettings();
}

function renderHeader() {
  const sigText = document.querySelector('.sig-text');
  if (sigText) {
    sigText.textContent = appState.config.systemName;
  } else {
    const sig = document.querySelector('.vh-signature');
    if (sig) sig.textContent = appState.config.systemName;
  }

  const heroWeekday = document.getElementById('hero-weekday');
  const heroDate = document.getElementById('hero-date');
  const heroBadge = document.getElementById('hero-badge');
  const metaSlots = document.getElementById('meta-slots');
  const metaPending = document.getElementById('meta-pending');
  const metaRotations = document.getElementById('meta-rotations');

  if (heroWeekday) heroWeekday.textContent = wkLabel(appState.today.dateKey);
  if (heroDate) heroDate.textContent = fmtDate(appState.today.dateKey);

  if (heroBadge) {
    heroBadge.textContent = appState.today.sundayModeActive
      ? 'FASE DE CONSOLIDAÇÃO'
      : 'ROTAÇÃO OPERACIONAL';
  }

  if (metaSlots) {
    metaSlots.textContent = appState.today.sundayModeActive
      ? `${pendingN(appState.today)} PENDÊNCIAS PRESERVADAS`
      : `${totalDiscN(appState.today)} SLOT${totalDiscN(appState.today) === 1 ? '' : 'S'}`;
  }

  if (metaPending) {
    metaPending.textContent = `${pendingN(appState.today)} PENDENTE${pendingN(appState.today) === 1 ? '' : 'S'}`;
  }

  if (metaRotations) {
    metaRotations.textContent = `${appState.rotations} ROTAÇÃO${appState.rotations === 1 ? '' : 'ES'}`;
  }
}

function renderStats() {
  const total = totalDiscN(appState.today);
  const done = doneTodayN(appState.today);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const pctEl = document.getElementById('pkg-pct');
  const fillEl = document.getElementById('pkg-fill');
  const stateEl = document.getElementById('fc-state');

  if (pctEl) pctEl.textContent = `${done} / ${total}`;
  if (fillEl) fillEl.style.width = `${pct}%`;

  if (stateEl) {
    if (appState.today.sundayModeActive) {
      const suggestion = appState.today.sundaySuggestion?.note || 'Domingo ativo de consolidação.';
      stateEl.textContent = suggestion;
    } else if (appState.today.closedVisual) {
      stateEl.textContent = 'Dia fechado visualmente';
    } else {
      stateEl.textContent = `${pendingN(appState.today)} pendência(s) em aberto`;
    }
  }
}

function renderFocus() {
  const grid = document.getElementById('today-pkg');
  const queueNote = document.getElementById('focus-queue-note');
  const directive = document.getElementById('sys-directive');

  if (!grid) return;

  const isSun = appState.today.sundayModeActive;
  const items = appState.today.packageItems || [];

  if (!items.length) {
    grid.innerHTML = `<div class="empty-box">Nenhuma disciplina projetada para hoje.</div>`;

    if (queueNote) {
      queueNote.textContent = '';
      queueNote.classList.add('is-hidden');
    }

    if (directive) {
      directive.textContent = 'Sem carga projetada para este dia.';
    }

    return;
  }

  grid.innerHTML = items.map((item, i) => {
    const cls = [
      'package-item',
      item.completed ? 'completed' : '',
      !item.completed && i === 0 ? 'current' : '',
      item.type === 'special' ? 'special' : '',
    ].filter(Boolean).join(' ');

    const tags = [];
    if (item.type === 'discipline' && item.macroCycle) tags.push(`Ciclo ${item.macroCycle}`);
    if (item.occLabel) tags.push(item.occLabel);
    if (item.carryOver) tags.push('Herdada');
    if (item.completed) tags.push('Concluída');

    const subtext = item.completed
      ? `Concluída em ${fmtDateTime(item.completedAt)}.`
      : item.type === 'special'
        ? (appState.today.sundaySuggestion?.note || 'Domingo ativo de consolidação.')
        : '';

    return `
      <div class="${cls}">
        <div class="package-main">
          <div class="package-eyebrow">${item.type === 'special' ? 'DIA ESPECIAL' : 'DISCIPLINA'}</div>
          <h3 class="package-title">${esc(item.name)}</h3>
          ${subtext ? `<p class="package-sub">${esc(subtext)}</p>` : ''}
          <div class="package-tags">
            ${tags.map(t => `<span class="mini-chip">${esc(t)}</span>`).join('')}
          </div>
        </div>
        ${item.type === 'discipline' ? `
          <div class="package-actions">
            <button class="btn-inline done" data-action="complete" data-item-id="${item.uid}" ${item.completed ? 'disabled' : ''}>concluir</button>
            <button class="btn-inline undo" data-action="undo" data-item-id="${item.uid}" ${!item.completed ? 'disabled' : ''}>desfazer</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handlePkgAction);
  });

  if (queueNote) {
    queueNote.classList.remove('is-hidden');
    queueNote.textContent = isSun
      ? 'A conclusão manual é o único motor real de avanço da fila. Domingo funciona como fase ativa de consolidação.'
      : 'A conclusão manual é o único motor real de avanço da fila.';
  }

  if (directive) {
    if (isSun) {
      directive.textContent = appState.today.sundaySuggestion?.note
        || 'Domingo sem teoria nova por padrão. Revisão, questões, simulado, redação, flashcards ou organização.';
    } else if (pendingN(appState.today) === 0) {
      directive.textContent = 'Rotação limpa. A próxima composição pode seguir sem pendências herdadas.';
    } else {
      directive.textContent = `${pendingN(appState.today)} disciplina(s) permanecem pendentes e terão prioridade na composição seguinte.`;
    }
  }
}

function renderCalendar() {
  const box = document.getElementById('calendar-grid');
  if (!box) return;

  const days = buildCalendarPreview(9);

  box.innerHTML = days.map((day, idx) => {
    const discs = todayDiscs(day);
    const pending = pendingN(day);

    const kicker = day.isToday
      ? 'HOJE'
      : idx === 1
        ? 'AMANHÃ'
        : day.sundayModeActive
          ? 'DOM'
          : 'PROJEÇÃO';

    const stateClass = [
      'calendar-card',
      day.isToday ? 'today' : '',
      idx === 1 && !day.isToday ? 'tomorrow' : '',
      day.sundayModeActive ? 'sunday' : '',
      !day.isToday && idx !== 1 && !day.sundayModeActive ? 'projected' : '',
    ].filter(Boolean).join(' ');

    const loadLabel = day.sundayModeActive
      ? 'D'
      : `${discs.length} DISC`;

    const discList = day.sundayModeActive
      ? `
        <div class="calendar-disc-list">
          <div class="calendar-disc">FASE DE CONSOLIDAÇÃO</div>
          <div class="calendar-disc">${esc(day.sundaySuggestion?.tag || 'ATIVO')}</div>
          <div class="calendar-disc">${esc(day.sundaySuggestion?.note || 'Bloco ativo sem teoria nova por padrão')}</div>
        </div>
      `
      : discs.length
        ? `
          <div class="calendar-disc-list">
            ${discs.map(d => `<div class="calendar-disc">${esc(d.name)}${d.carryOver ? ' • herdada' : ''}</div>`).join('')}
          </div>
        `
        : `
          <div class="calendar-disc-list">
            <div class="calendar-disc">Sem disciplinas projetadas</div>
          </div>
        `;

    const note = day.sundayModeActive
      ? 'Projeção de consolidação. Sugestão, não imposição.'
      : pending > 0
        ? `${pending} pendência(s) projetada(s) para este dia.`
        : 'Sem pendências projetadas para este dia.';

    return `
      <article class="${stateClass}">
        <div class="calendar-card-top">
          <span class="calendar-kicker">${kicker}</span>
        </div>

        <div class="calendar-main">
          <h3 class="calendar-day">${esc(wkLabel(day.dateKey))}</h3>
          <div class="calendar-date">${esc(fmtDate(day.dateKey))}</div>
        </div>

        <div class="calendar-load">${loadLabel}</div>

        ${discList}

        <div class="calendar-foot">
          <p class="calendar-note">${esc(note)}</p>
        </div>
      </article>
    `;
  }).join('');
}

function renderHistory() {
  const box = document.getElementById('history-list');
  if (!box) return;

  if (!appState.history.length) {
    box.innerHTML = `<div class="history-empty">Nenhum registro ainda. Cada disciplina concluída gera uma entrada de histórico.</div>`;
    return;
  }

  const recent = [...appState.history].reverse().slice(0, 50);

  box.innerHTML = recent.map((h, i) => {
    const p = getPreset(h.colorKey);
    const desc = h.dayClose
      ? `Fechamento visual · ${h.meta?.completed ?? 0}/${h.meta?.total ?? 0} concluídas`
      : `${h.carryOver ? 'Herdada · ' : ''}${WEEKDAY_LABELS[h.weekdayKey] || '—'}`;

    return `
      <div class="history-item">
        <div class="history-index" style="border:1px solid ${p.soft};color:${p.hex}">
          ${String(i + 1).padStart(2, '0')}
        </div>
        <div class="history-main">
          <strong>${esc(h.name)}</strong>
          <div class="history-disc">${esc(desc)}</div>
        </div>
        <div class="history-date">${fmtDateTime(h.completedIso)}</div>
      </div>
    `;
  }).join('');
}

function populateSettings() {
  const nameEl = document.getElementById('cfg-name');
  const subtitleEl = document.getElementById('cfg-subtitle');
  const slotsEl = document.getElementById('cfg-slots');
  const sundayEl = document.getElementById('cfg-sunday');
  const confirmEl = document.getElementById('cfg-confirm-reset');

  if (nameEl) nameEl.value = appState.config.systemName;
  if (subtitleEl) subtitleEl.value = appState.config.subtitle;
  if (slotsEl) slotsEl.value = appState.config.defaultSlots;
  if (sundayEl) sundayEl.value = appState.config.sundayMode;
  if (confirmEl) confirmEl.checked = appState.config.confirmReset;

  const wday = document.getElementById('wday-slots');
  if (wday) {
    wday.innerHTML = WEEKDAY_KEYS.map(k => `
      <div class="disc-editor-card" data-wday="${k}">
        <div class="inline-grid" style="grid-template-columns:1fr .55fr;">
          <div class="form-col">
            <label>${WEEKDAY_LABELS[k]}</label>
            <input class="field js-wday-slot" type="number" min="0" max="10" value="${appState.config.weekdaySlots?.[k] ?? 0}" />
          </div>
          <div class="form-col">
            <label>Status</label>
            <input class="field" value="${k === 'sunday' ? 'Consolidação' : 'Ativo'}" disabled />
          </div>
        </div>
      </div>
    `).join('');
  }

  const colorSelectOptions = Object.entries(COLOR_PRESETS)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
    .join('');

  const newDiscColor = document.getElementById('new-disc-color');
  if (newDiscColor) newDiscColor.innerHTML = colorSelectOptions;

  renderDiscEditor();
}

function renderDiscEditor() {
  const box = document.getElementById('disc-editor');
  if (!box) return;

  box.innerHTML = appState.disciplines.map(d => `
    <div class="disc-editor-card" data-disc-key="${d.key}">
      <div class="inline-grid" style="grid-template-columns:1.6fr .55fr .6fr .8fr auto;">
        <div class="form-col">
          <label>Nome</label>
          <input class="field js-disc-name" type="text" maxlength="60" value="${esc(d.name)}" />
        </div>
        <div class="form-col">
          <label>Peso</label>
          <input class="field js-disc-weight" type="number" min="1" max="11" value="${d.weight}" />
        </div>
        <div class="form-col">
          <label>Ciclo</label>
          <select class="select js-disc-cycle">
            <option value="A" ${d.macroCycle === 'A' ? 'selected' : ''}>A</option>
            <option value="B" ${d.macroCycle === 'B' ? 'selected' : ''}>B</option>
            <option value="C" ${d.macroCycle === 'C' ? 'selected' : ''}>C</option>
            <option value="D" ${d.macroCycle === 'D' ? 'selected' : ''}>D</option>
          </select>
        </div>
        <div class="form-col">
          <label>Cor</label>
          <select class="select js-disc-color">
            ${Object.entries(COLOR_PRESETS).map(([k, v]) => `<option value="${k}" ${d.colorKey === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <button class="btn-danger js-remove-disc" type="button" style="height:42px;padding:0 12px;margin-top:22px;">×</button>
      </div>
    </div>
  `).join('');

  box.querySelectorAll('.js-remove-disc').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-disc-key]');
      if (!card) return;

      const key = card.dataset.discKey;
      appState.disciplines = appState.disciplines.filter(d => d.key !== key);

      if (!appState.disciplines.length) {
        appState.disciplines = makeDefaultDisciplines();
      }

      rebuildCurrentDayAfterSettings();
      renderDiscEditor();
    });
  });
}

/* ═══════════════════════════════════════════════════════
   MODALS / TABS / INIT
═══════════════════════════════════════════════════════ */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  if (id === 'history-modal') renderHistory();
  if (id === 'settings-modal') populateSettings();

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

function setTab(tab) {
  const operational = tab === 'operational';

  const opBtn = document.getElementById('tab-operational');
  const calBtn = document.getElementById('tab-calendar');
  const opView = document.getElementById('view-operational');
  const calView = document.getElementById('view-calendar');

  if (opBtn) opBtn.classList.toggle('is-active', operational);
  if (calBtn) calBtn.classList.toggle('is-active', !operational);
  if (opView) opView.classList.toggle('is-hidden', !operational);
  if (calView) calView.classList.toggle('is-hidden', operational);
}

function bind() {
  const btnRollover = document.getElementById('btn-rollover');
  const btnHistory = document.getElementById('btn-history');
  const btnSettings = document.getElementById('btn-settings');
  const btnReset = document.getElementById('btn-reset');
  const btnResetConfirm = document.getElementById('btn-reset-confirm');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnAddDisc = document.getElementById('btn-add-disc');
  const btnOpenCalendar = document.getElementById('btn-open-calendar');
  const tabOperational = document.getElementById('tab-operational');
  const tabCalendar = document.getElementById('tab-calendar');

  if (btnRollover) btnRollover.addEventListener('click', forceRollover);
  if (btnHistory) btnHistory.addEventListener('click', () => openModal('history-modal'));
  if (btnSettings) btnSettings.addEventListener('click', () => openModal('settings-modal'));
  if (btnReset) btnReset.addEventListener('click', requestReset);
  if (btnResetConfirm) btnResetConfirm.addEventListener('click', doReset);
  if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);
  if (btnAddDisc) btnAddDisc.addEventListener('click', addDiscipline);
  if (btnOpenCalendar) btnOpenCalendar.addEventListener('click', () => setTab('calendar'));
  if (tabOperational) tabOperational.addEventListener('click', () => setTab('operational'));
  if (tabCalendar) tabCalendar.addEventListener('click', () => setTab('calendar'));

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['history-modal', 'settings-modal', 'reset-modal'].forEach(closeModal);
    }
  });

  window.addEventListener('storage', () => {
    syncIfNewer();
    render();
  });
}

(function init() {
  appState = normalizeState(Store.load());
  if (!appState.today || !appState.today.packageItems || !appState.today.packageItems.length) {
    appState.today = buildInitialDay(isoDate(), appState);
  } else {
    rollover(false);
  }
  persist();
  bind();
  render();
})();
