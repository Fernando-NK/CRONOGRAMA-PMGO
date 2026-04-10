'use strict';

'use strict';

/* ═══════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════ */
const STORAGE_KEY  = 'pmgo_vh_v8';
const LEGACY_KEYS  = ['pmgo_widget_vh_v7','pmgo_widget_vh_v6','pmgo_widget_vh_v5','pmgo_widget_vh_v4','pmgo_widget_vh_v3','pmgo_ciclos_v2'];
const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const WEEKDAY_LABELS = { sunday:'Domingo', monday:'Segunda', tuesday:'Terça', wednesday:'Quarta', thursday:'Quinta', friday:'Sexta', saturday:'Sábado' };

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
  sundayMode:   'freeze',
  confirmReset: true,
  weekdaySlots: { sunday:0, monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0 },
};

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
function uid() {
  return window.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function safeParse(v)   { try { return JSON.parse(v); } catch { return null; } }
function deepClone(v)   { return JSON.parse(JSON.stringify(v)); }
function clamp(v,mn,mx,fb) { const n=Number(v); return Number.isFinite(n) ? Math.min(mx,Math.max(mn,Math.round(n))) : fb; }
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ═══════════════════════════════════════════════════════
   DEFAULT DISCIPLINES
   Pesos espelham proporção do edital: A≈38% | B≈38% | C≈25%
   Distribuição intercalada — peso ≠ repetição em bloco.
═══════════════════════════════════════════════════════ */
function makeDefaultDisciplines() {
  return [
    { name:'Língua Portuguesa',        weight:3, colorKey:'blue',   macroCycle:'A' },
    { name:'Direito Penal',            weight:3, colorKey:'green',  macroCycle:'A' },
    { name:'Direito Constitucional',   weight:3, colorKey:'purple', macroCycle:'A' },
    { name:'Dir. Processual Penal',    weight:3, colorKey:'orange', macroCycle:'B' },
    { name:'Direito Administrativo',   weight:3, colorKey:'yellow', macroCycle:'B' },
    { name:'Legislação Extravagante',  weight:2, colorKey:'gray',   macroCycle:'B' },
    { name:'Dir. Penal Militar',       weight:2, colorKey:'red',    macroCycle:'C' },
    { name:'Proc. Penal Militar',      weight:2, colorKey:'red',    macroCycle:'C' },
    { name:'Realidade de Goiás',       weight:1, colorKey:'gray',   macroCycle:'C' },
  ].map(d => ({ ...d, key: uid() }));
}

/* ═══════════════════════════════════════════════════════
   IN-MEMORY STATE + BUSY LOCK
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
function fmtDate(key) {
  return parseIso(key).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function wkKey(d = new Date())  { return WEEKDAY_KEYS[d.getDay()]; }
function wkFromDateKey(dateKey) { return wkKey(parseIso(dateKey)); }
function wkLabel(dateKey)       { return WEEKDAY_LABELS[wkFromDateKey(dateKey)] ?? '—'; }
function isSunday(wk)           { return wk === 'sunday'; }
function daysBetween(a, b)      { return Math.round((parseIso(b) - parseIso(a)) / 86400000); }

function getDaySlots(config, wk) {
  const s = Number(config.weekdaySlots?.[wk] ?? 0);
  return s > 0 ? s : clamp(config.defaultSlots, 1, 10, 3);
}


function simulateFuturePackage(dateKey, prevDay, cursor, carryBuffer) {
  const wk    = wkFromDateKey(dateKey);
  const slots = getDaySlots(appState.config, wk);
  const stateCarry = Array.isArray(carryBuffer) ? carryBuffer : [];

  let carried = prevDay?.sundayModeActive
    ? stateCarry.map(i => ({ ...i, uid: uid(), carryOver: true, reservedDate: dateKey }))
    : carryPending(prevDay?.packageItems || [], dateKey);

  if (isSunday(wk)) {
    return {
      day: {
        dateKey,
        weekdayKey: wk,
        sundayModeActive: true,
        closedVisual: false,
        packageItems: buildSundayPkg(dateKey, appState.config.sundayMode),
      },
      cursor,
      carryBuffer: carried,
    };
  }

  const items = [...carried];
  let localCursor = cursor;
  const qLen = appState.queue.length;

  if (qLen) {
    while (items.length < Math.max(carried.length, slots)) {
      const qItem = appState.queue[localCursor % qLen];
      localCursor++;
      if (!qItem) break;
      const disc = getDisc(qItem.discKey);
      if (!disc) continue;
      items.push({
        uid:           uid(),
        type:          'discipline',
        disciplineKey: disc.key,
        name:          disc.name,
        macroCycle:    disc.macroCycle,
        colorKey:      disc.colorKey,
        queueIndex:    (localCursor - 1) % qLen,
        queueKey:      qItem.key,
        completed:     false,
        completedAt:   null,
        occLabel:      `${qItem.occ}/${qItem.totalOcc}`,
        carryOver:     false,
        reservedDate:  dateKey,
        slots,
      });
    }
  }

  return {
    day: {
      dateKey,
      weekdayKey: wk,
      sundayModeActive: false,
      closedVisual: false,
      packageItems: items,
    },
    cursor: localCursor % Math.max(qLen, 1),
    carryBuffer: [],
  };
}

function buildCalendarPreview(days = 7) {
  const out = [];
  let prevDay = deepClone(appState.today);
  let cursor = appState.cursor;
  let carryBuffer = deepClone(appState.carryBuffer || []);
  out.push({
    ...deepClone(appState.today),
    isToday: true,
  });

  for (let i = 1; i < days; i++) {
    const date = parseIso(appState.today.dateKey);
    date.setDate(date.getDate() + i);
    const dateKey = isoDate(date);
    const simulated = simulateFuturePackage(dateKey, prevDay, cursor, carryBuffer);
    prevDay = simulated.day;
    cursor = simulated.cursor;
    carryBuffer = simulated.carryBuffer;
    out.push({
      ...deepClone(simulated.day),
      isToday: false,
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════
   PERSISTENCE LAYER
   Isolated: swap save/load implementations without
   touching queue logic or render functions.
═══════════════════════════════════════════════════════ */
const Store = {
  _ok: null,

  ok() {
    if (this._ok !== null) return this._ok;
    try {
      const k = `${STORAGE_KEY}__t`;
      localStorage.setItem(k,'1');
      localStorage.removeItem(k);
      this._ok = true;
    } catch { this._ok = false; }
    return this._ok;
  },

  save(state) {
    const s = JSON.stringify(state);
    if (this.ok()) {
      try { localStorage.setItem(STORAGE_KEY, s); return; } catch {}
    }
    // Hash fallback for restricted embed/iframe/Safari environments
    try {
      const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(s))));
      history.replaceState(null,'',`${location.pathname}${location.search}#vh=${enc}`);
    } catch {}
  },

  load() {
    if (this.ok()) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return safeParse(raw);
      // Migrate from any legacy version key
      for (const k of LEGACY_KEYS) {
        const leg = localStorage.getItem(k);
        if (leg) return safeParse(leg);
      }
    }
    // Hash fallback
    const m = location.hash.match(/vh=([^&]+)/);
    if (!m) return null;
    try {
      return safeParse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    } catch { return null; }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    } catch {}
    if (location.hash.includes('vh=')) {
      history.replaceState(null,'',`${location.pathname}${location.search}`);
    }
  },
};

/* ═══════════════════════════════════════════════════════
   STATE CREATION & NORMALIZATION
   Separates CONFIG (what the system should do)
   from EXECUTION STATE (what it's doing right now).
═══════════════════════════════════════════════════════ */
function emptyState() {
  const disciplines = makeDefaultDisciplines();
  return {
    rev:         0,
    updatedAt:   null,
    config:      deepClone(DEFAULT_CONFIG),
    disciplines,
    queue:       buildQueue(disciplines),
    cursor:      0,
    rotations:   0,
    today:       emptyDay(isoDate()),
    history:     [],
    carryBuffer: [],
    stats:       { completedCount: 0, closedDays: 0 },
  };
}

function emptyDay(dateKey) {
  return {
    dateKey,
    weekdayKey:       wkFromDateKey(dateKey),
    packageItems:     [],
    closedVisual:     false,
    sundayModeActive: false,
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();

  // Config: merge with defaults so new fields always exist
  const cfg = { ...deepClone(DEFAULT_CONFIG), ...(raw.config || {}) };
  cfg.weekdaySlots = { ...deepClone(DEFAULT_CONFIG.weekdaySlots), ...(cfg.weekdaySlots || {}) };

  const disciplines = Array.isArray(raw.disciplines) && raw.disciplines.length
    ? raw.disciplines.map(normDisc).filter(Boolean)
    : makeDefaultDisciplines();

  let queue = Array.isArray(raw.queue) && raw.queue.length ? raw.queue : buildQueue(disciplines);
  if (!queue.length) queue = buildQueue(disciplines);

  const qLen   = Math.max(queue.length, 1);
  const cursor = Number.isInteger(raw.cursor) && raw.cursor >= 0 ? raw.cursor % qLen : 0;

  return {
    rev:         Number.isInteger(raw.rev)       ? raw.rev       : 0,
    updatedAt:   raw.updatedAt || null,
    config:      cfg,
    disciplines,
    queue,
    cursor,
    rotations:   Number.isInteger(raw.rotations) ? raw.rotations : 0,
    today:       normDay(raw.today, disciplines),
    history:     Array.isArray(raw.history) ? raw.history.map(normHistItem).filter(Boolean) : [],
    carryBuffer: Array.isArray(raw.carryBuffer)
      ? raw.carryBuffer.map(i => normPkgItem(i, disciplines)).filter(Boolean)
      : [],
    stats: {
      completedCount: clamp(raw.stats?.completedCount, 0, 1e9, 0),
      closedDays:     clamp(raw.stats?.closedDays,     0, 1e9, 0),
    },
  };
}

function normDisc(d) {
  if (!d || typeof d !== 'object') return null;
  const name = String(d.name || '').trim();
  if (!name) return null;
  return {
    key:        d.key || uid(),
    name,
    weight:     clamp(d.weight, 1, 10, 1),
    colorKey:   COLOR_PRESETS[d.colorKey] ? d.colorKey : 'blue',
    macroCycle: ['A','B','C'].includes(d.macroCycle) ? d.macroCycle : 'A',
  };
}

function normDay(raw, disciplines) {
  const dateKey = raw?.dateKey || isoDate();
  const pkgItems = Array.isArray(raw?.packageItems)
    ? raw.packageItems.map(i => normPkgItem(i, disciplines)).filter(Boolean)
    : [];
  return {
    dateKey,
    weekdayKey:       raw?.weekdayKey      || wkFromDateKey(dateKey),
    packageItems:     pkgItems,
    closedVisual:     Boolean(raw?.closedVisual),
    sundayModeActive: Boolean(raw?.sundayModeActive),
  };
}

function normPkgItem(item, disciplines) {
  if (!item || typeof item !== 'object') return null;
  const disc = disciplines?.find(d => d.key === item.disciplineKey);
  if (!disc && item.type !== 'special') return null;
  return {
    uid:           item.uid || uid(),
    type:          item.type || 'discipline',
    disciplineKey: item.disciplineKey || null,
    name:          item.name         || disc?.name     || '—',
    macroCycle:    item.macroCycle   || disc?.macroCycle || 'A',
    colorKey:      COLOR_PRESETS[item.colorKey] ? item.colorKey : (disc?.colorKey || 'blue'),
    queueIndex:    Number.isInteger(item.queueIndex) ? item.queueIndex : 0,
    queueKey:      item.queueKey     || null,
    completed:     Boolean(item.completed),
    completedAt:   item.completedAt  || null,
    occLabel:      item.occLabel     || null,
    carryOver:     Boolean(item.carryOver),
    reservedDate:  item.reservedDate || item.reservedDateKey || isoDate(),
    slots:         clamp(item.slots  || item.slotsAtCreation, 0, 20, 0),
  };
}

function normHistItem(item) {
  if (!item || typeof item !== 'object') return null;
  const dateKey = item.dateKey || isoDate();
  return {
    uid:          item.uid          || uid(),
    type:         item.type         || 'discipline',
    discKey:      item.discKey      || item.disciplineKey || null,
    name:         item.name         || '—',
    macroCycle:   ['A','B','C','DAY'].includes(item.macroCycle) ? item.macroCycle : 'A',
    colorKey:     COLOR_PRESETS[item.colorKey] ? item.colorKey : 'blue',
    dateKey,
    completedIso: item.completedIso || dateKey,
    queueIndex:   Number.isInteger(item.queueIndex) ? item.queueIndex : 0,
    slotsOnDay:   clamp(item.slotsOnDay || item.slotsAtCompletion, 0, 20, 0),
    weekdayKey:   item.weekdayKey   || wkFromDateKey(dateKey),
    carryOver:    Boolean(item.carryOver),
    dayClose:     Boolean(item.dayClose || item.type === 'dayClose'),
    meta:         item.meta         || {},
  };
}

/* ═══════════════════════════════════════════════════════
   QUEUE ENGINE
   Weighted interleaved distribution.
   Higher weight = more occurrences per rotation,
   but NEVER consecutive repetitions of the same discipline.
═══════════════════════════════════════════════════════ */
function buildQueue(disciplines) {
  const pool = disciplines.map(normDisc).filter(d => d?.weight > 0);
  if (!pool.length) return [];

  const slots = pool.map(d => ({
    discKey: d.key, name: d.name,
    macroCycle: d.macroCycle, colorKey: d.colorKey,
    rem: d.weight, total: d.weight,
  }));

  const queue = [];
  let last  = null;
  let guard = 0;

  while (slots.some(s => s.rem > 0) && guard++ < 800) {
    const candidates = slots
      .filter(s => s.rem > 0)
      .sort((a, b) => {
        // Anti-consecutive: push last-used to the back
        if (a.discKey === last && b.discKey !== last) return  1;
        if (b.discKey === last && a.discKey !== last) return -1;
        // Primary sort: highest remaining weight first
        if (b.rem !== a.rem) return b.rem - a.rem;
        // Tiebreaker: stable alphabetical
        return a.name.localeCompare(b.name, 'pt-BR');
      });

    const chosen = candidates.find(c => c.discKey !== last) || candidates[0];
    if (!chosen) break;

    const occ = chosen.total - chosen.rem + 1;
    queue.push({
      key:      `${chosen.discKey}::${occ}`,
      discKey:  chosen.discKey,
      occ,
      totalOcc: chosen.total,
      macroCycle: chosen.macroCycle,
      colorKey:   chosen.colorKey,
    });

    chosen.rem--;
    last = chosen.discKey;
  }

  return queue;
}

function queuePreview(count = 4) {
  if (!appState.queue.length) return [];
  const items  = [];
  let   c      = appState.cursor;
  let   guard  = 0;
  while (items.length < count && guard++ < appState.queue.length + 8) {
    const qItem = appState.queue[c % appState.queue.length];
    if (!qItem) break;
    const disc = getDisc(qItem.discKey);
    if (disc) items.push({ qItem, disc, idx: c % appState.queue.length });
    c++;
  }
  return items;
}

/* ═══════════════════════════════════════════════════════
   PACKAGE ENGINE
═══════════════════════════════════════════════════════ */

// Dispatches `count` new items from the queue, advancing the cursor.
// Detects cursor wrap to count completed rotations.
function dispatchFromQueue(count, dateKey) {
  const items = [];
  const qLen  = appState.queue.length;
  if (!qLen || count <= 0) return items;

  let c     = appState.cursor;
  let guard = 0;

  while (items.length < count && guard++ < qLen * 3) {
    // Rotation complete: cursor wrapped back to the start
    if (c > 0 && c % qLen === 0) {
      appState.rotations++;
    }

    const qItem = appState.queue[c % qLen];
    c++;
    if (!qItem) continue;
    const disc = getDisc(qItem.discKey);
    if (!disc) continue;

    items.push({
      uid:           uid(),
      type:          'discipline',
      disciplineKey: disc.key,
      name:          disc.name,
      macroCycle:    disc.macroCycle,
      colorKey:      disc.colorKey,
      queueIndex:    (c - 1) % qLen,
      queueKey:      qItem.key,
      completed:     false,
      completedAt:   null,
      occLabel:      `${qItem.occ}/${qItem.totalOcc}`,
      carryOver:     false,
      reservedDate:  dateKey,
      slots:         count,
    });
  }

  appState.cursor = c % qLen;
  return items;
}

// Carries over ALL pending items from the previous day.
// RULE: no discipline disappears without being completed.
// The slot cap only limits how many NEW items are added,
// never how many carry-overs are preserved.
function carryPending(prevItems, targetDate) {
  return prevItems
    .filter(i => i.type === 'discipline' && !i.completed)
    .map(i => ({ ...i, uid: uid(), carryOver: true, reservedDate: targetDate }));
}

function cloneCarryBuffer(targetDate) {
  return (appState.carryBuffer || []).map(i => ({ ...i, uid: uid(), carryOver: true, reservedDate: targetDate }));
}

function buildSundayPkg(dateKey, mode) {
  return [{
    uid:           uid(),
    type:          'special',
    disciplineKey: null,
    name:          mode === 'manual' ? 'Domingo livre' : 'Domingo — teoria congelada',
    macroCycle:    'DAY',
    colorKey:      'purple',
    queueIndex:    -1,
    queueKey:      null,
    completed:     false,
    completedAt:   null,
    occLabel:      mode,
    carryOver:     false,
    reservedDate:  dateKey,
    slots:         0,
  }];
}

// Rebuilds today's package when the date changes (or when forced).
// Returns true if a rebuild was triggered.
function rollover(force = false) {
  const todayKey = isoDate();
  const wk       = wkFromDateKey(todayKey);
  const slots    = getDaySlots(appState.config, wk);

  if (appState.today.dateKey === todayKey && !force) return false;

  const prev = deepClone(appState.today);

  if (prev.dateKey !== todayKey) {
    const prevDiscs = prev.packageItems.filter(i => i.type === 'discipline');
    if (prevDiscs.length > 0 && prevDiscs.every(i => i.completed)) {
      appState.stats.closedDays++;
      appState.history.push({
        uid:          uid(),
        type:         'dayClose',
        discKey:      null,
        name:         `Dia fechado — ${fmtDate(prev.dateKey)}`,
        macroCycle:   'DAY',
        colorKey:     'green',
        dateKey:      prev.dateKey,
        completedIso: todayKey,
        queueIndex:   appState.cursor,
        slotsOnDay:   prevDiscs.length,
        weekdayKey:   prev.weekdayKey,
        carryOver:    false,
        dayClose:     true,
        meta: {
          completed: prevDiscs.filter(i => i.completed).length,
          total:     prevDiscs.length,
        },
      });
    }
  }

  let carried = [];
  if (prev.sundayModeActive) {
    carried = cloneCarryBuffer(todayKey);
  } else {
    carried = carryPending(prev.packageItems, todayKey);
  }

  let pkgItems;
  let sundayMode = false;

  if (isSunday(wk)) {
    sundayMode = true;
    appState.carryBuffer = carried;
    pkgItems = buildSundayPkg(todayKey, appState.config.sundayMode);
  } else {
    const newCount = Math.max(0, slots - carried.length);
    pkgItems       = [...carried, ...dispatchFromQueue(newCount, todayKey)];
    appState.carryBuffer = [];
  }

  appState.today = {
    dateKey:          todayKey,
    weekdayKey:       wk,
    packageItems:     pkgItems,
    closedVisual:     false,
    sundayModeActive: sundayMode,
  };

  return true;
}

/* ═══════════════════════════════════════════════════════
   STATE HELPERS
═══════════════════════════════════════════════════════ */
function getDisc(key)   { return appState.disciplines.find(d => d.key === key) || null; }
function getPreset(ck)  { return COLOR_PRESETS[ck] || COLOR_PRESETS.blue; }
function todayDiscs()   { return appState.today.packageItems.filter(i => i.type === 'discipline'); }
function doneTodayN()   { return todayDiscs().filter(i => i.completed).length; }
function pendingN()     { return todayDiscs().filter(i => !i.completed).length; }
function totalDiscN()   { return todayDiscs().length; }

function uniqueStudyDays() {
  return new Set(appState.history.filter(h => h.type === 'discipline').map(h => h.dateKey)).size || 1;
}

function mostNeglected() {
  const lastSeen = new Map();
  appState.history.forEach(h => {
    if (h.type === 'discipline' && h.discKey) {
      if (!lastSeen.has(h.discKey) || h.dateKey > lastSeen.get(h.discKey)) {
        lastSeen.set(h.discKey, h.dateKey);
      }
    }
  });
  const todayK = appState.today.dateKey;
  return appState.disciplines.reduce((best, d) => {
    const last = lastSeen.get(d.key) || null;
    const gap  = last ? daysBetween(last, todayK) : 9999;
    return (!best || gap > best.gap) ? { disc: d, gap, last } : best;
  }, null);
}

/* ═══════════════════════════════════════════════════════
   PERSIST
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
  if (ext.rev > appState.rev) appState = ext;
}

/* ═══════════════════════════════════════════════════════
   QUEUE REBUILD (after config/discipline changes)
   Preserves current pending items when possible.
═══════════════════════════════════════════════════════ */
function rebuildQueue(preservePending = true) {
  const pending = preservePending
    ? appState.today.packageItems
        .filter(i => i.type === 'discipline' && !i.completed)
        .map(i => i.disciplineKey)
    : [];

  appState.queue  = buildQueue(appState.disciplines);
  if (!appState.queue.length) appState.queue = buildQueue(makeDefaultDisciplines());
  appState.cursor = appState.cursor % Math.max(appState.queue.length, 1);

  if (!preservePending) return;

  const dateKey  = appState.today.dateKey;
  const wk       = appState.today.weekdayKey;

  if (isSunday(wk)) {
    appState.today.packageItems = buildSundayPkg(dateKey, appState.config.sundayMode);
    return;
  }

  const slots   = getDaySlots(appState.config, wk);
  const carried = pending
    .map(k => getDisc(k))
    .filter(Boolean)
    .map(disc => ({
      uid: uid(), type: 'discipline', disciplineKey: disc.key,
      name: disc.name, macroCycle: disc.macroCycle, colorKey: disc.colorKey,
      queueIndex: 0, queueKey: null, completed: false, completedAt: null,
      occLabel: null, carryOver: true, reservedDate: dateKey, slots,
    }));

  const newCount = Math.max(0, slots - carried.length);
  appState.today.packageItems = [...carried, ...dispatchFromQueue(newCount, dateKey)];
}

/* ═══════════════════════════════════════════════════════
   ACTIONS
═══════════════════════════════════════════════════════ */
function handlePkgAction(e) {
  if (isBusy) return;
  const btn    = e.currentTarget;
  const action = btn.dataset.action;
  const itemId = btn.dataset.itemId;
  if (!action || !itemId) return;

  const item = appState.today.packageItems.find(i => i.uid === itemId);
  if (!item || item.type !== 'discipline') return;

  isBusy = true;
  try {
    if (action === 'complete' && !item.completed) {
      item.completed   = true;
      item.completedAt = new Date().toISOString();
      appState.history.push({
        uid:          uid(),
        type:         'discipline',
        discKey:      item.disciplineKey,
        name:         item.name,
        macroCycle:   item.macroCycle,
        colorKey:     item.colorKey,
        dateKey:      appState.today.dateKey,
        completedIso: isoDate(),
        queueIndex:   item.queueIndex,
        slotsOnDay:   totalDiscN(),
        weekdayKey:   appState.today.weekdayKey,
        carryOver:    item.carryOver,
        dayClose:     false,
        meta:         { occLabel: item.occLabel, completedAt: item.completedAt },
      });
      appState.stats.completedCount++;
      if (todayDiscs().every(i => i.completed)) appState.today.closedVisual = true;
    }

    if (action === 'undo' && item.completed) {
      item.completed   = false;
      item.completedAt = null;
      appState.today.closedVisual = false;
      // Remove the most recent matching history entry
      const idx = [...appState.history]
        .reverse()
        .findIndex(h => h.type === 'discipline' && h.discKey === item.disciplineKey && h.dateKey === appState.today.dateKey);
      if (idx >= 0) appState.history.splice(appState.history.length - 1 - idx, 1);
      appState.stats.completedCount = Math.max(0, appState.stats.completedCount - 1);
    }

    persist();
    render();
  } finally {
    setTimeout(() => { isBusy = false; }, 180);
  }
}

function inferCycle(name) {
  const l = name.toLowerCase();
  if (l.includes('militar') || l.includes('goiás') || l.includes('goias')) return 'C';
  if (l.includes('administrativo') || l.includes('processual') || l.includes('extravagante')) return 'B';
  return 'A';
}

function addDiscipline() {
  const name    = document.getElementById('new-disc-name').value.trim();
  const weight  = clamp(document.getElementById('new-disc-weight').value, 1, 10, 1);
  const colorEl = document.getElementById('new-disc-color');
  const colorKey = COLOR_PRESETS[colorEl.value] ? colorEl.value : 'blue';
  if (!name) return;
  appState.disciplines.push({ key: uid(), name, weight, colorKey, macroCycle: inferCycle(name) });
  rebuildQueue(true);
  renderDiscEditor();
  persist();
  render();
  document.getElementById('new-disc-name').value   = '';
  document.getElementById('new-disc-weight').value = 1;
  document.getElementById('new-disc-name').focus();
}

function saveSettings() {
  syncIfNewer();
  appState.config.systemName   = document.getElementById('cfg-name').value.trim()     || DEFAULT_CONFIG.systemName;
  appState.config.subtitle     = document.getElementById('cfg-subtitle').value.trim() || DEFAULT_CONFIG.subtitle;
  appState.config.defaultSlots = clamp(document.getElementById('cfg-slots').value, 1, 10, 3);
  appState.config.sundayMode   = document.getElementById('cfg-sunday').value === 'manual' ? 'manual' : 'freeze';
  appState.config.confirmReset = document.getElementById('cfg-confirm-reset').checked;

  WEEKDAY_KEYS.forEach(k => {
    const el = document.querySelector(`[data-wday="${k}"] .js-wday-slot`);
    if (el) appState.config.weekdaySlots[k] = clamp(el.value, 0, 10, 0);
  });

  const cards = [...document.querySelectorAll('#disc-editor [data-disc-key]')];
  const next  = cards.map(card => {
    const name = card.querySelector('.js-disc-name').value.trim();
    if (!name) return null;
    return {
      key:        card.dataset.discKey,
      name,
      weight:     clamp(card.querySelector('.js-disc-weight').value, 1, 10, 1),
      macroCycle: (['A','B','C'].includes(card.querySelector('.js-disc-cycle').value)) ? card.querySelector('.js-disc-cycle').value : 'A',
      colorKey:   COLOR_PRESETS[card.querySelector('.js-disc-color').value] ? card.querySelector('.js-disc-color').value : 'blue',
    };
  }).filter(Boolean);

  appState.disciplines = next.length ? next : makeDefaultDisciplines();
  rebuildQueue(true);
  persist();
  closeModal('settings-modal');
  render();
}

function requestReset() {
  if (appState.config.confirmReset) { openModal('reset-modal'); return; }
  doReset();
}

function doReset() {
  Store.clear();
  appState = emptyState();
  persist();
  ['reset-modal','history-modal','settings-modal'].forEach(id => closeModal(id));
  render();
}

function forceRollover() {
  syncIfNewer();
  rollover(true);
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
  if (document.getElementById('history-modal').classList.contains('show'))  renderHistory();
  if (document.getElementById('settings-modal').classList.contains('show')) populateSettings();
}

function renderHeader() {
  document.querySelector('.vh-signature').textContent = appState.config.systemName;
  document.getElementById('hero-weekday').textContent = wkLabel(appState.today.dateKey);
  document.getElementById('hero-date').textContent = fmtDate(appState.today.dateKey);
  document.getElementById('hero-badge').textContent = appState.today.sundayModeActive ? 'DOMINGO ESPECIAL' : 'ROTAÇÃO OPERACIONAL';
}

function renderStats() {
  document.getElementById('meta-slots').textContent = appState.today.sundayModeActive ? 'domingo especial' : `${totalDiscN()} disciplina(s)`;
  document.getElementById('meta-pending').textContent = `${pendingN()} pendente(s)`;
  document.getElementById('meta-rotations').textContent = `${appState.rotations} rotação(ões)`;
}

function renderFocus() {
  const pkg    = appState.today.packageItems;
  const anchor = pkg.find(i => i.type === 'discipline' && !i.completed) || pkg.find(i => i.type === 'discipline') || pkg[0];
  const preset = getPreset(anchor?.colorKey || 'blue');

  const panel = document.getElementById('focus-card');
  panel.style.setProperty('--accent', preset.hex);

  const isSun = appState.today.sundayModeActive;
  document.getElementById('fc-state').textContent = isSun
    ? 'teoria congelada'
    : `${doneTodayN()} de ${totalDiscN()} concluídas`;

  const done  = doneTodayN();
  const total = totalDiscN();
  document.getElementById('pkg-pct').textContent  = `${done} / ${total}`;
  document.getElementById('pkg-fill').style.width = total > 0 ? `${(done / total) * 100}%` : '0%';

  const grid = document.getElementById('today-pkg');
  if (!pkg.length) {
    grid.innerHTML = `<div class="empty-box">Nenhuma rotação ativa.</div>`;
  } else {
    grid.innerHTML = pkg.map((item, i) => {
      const cls = [
        'package-item',
        item.completed ? 'completed' : '',
        !item.completed && i === 0 ? 'current' : '',
        item.type === 'special' ? 'special' : '',
      ].filter(Boolean).join(' ');

      const tags = [];
      if (item.type === 'discipline') tags.push(`Ciclo ${item.macroCycle}`);
      if (item.occLabel) tags.push(`Ocorrência ${item.occLabel}`);
      if (item.carryOver) tags.push('Herdada');
      if (item.completed) tags.push('Concluída');

      const subtext = item.completed
        ? `Concluída em ${fmtDateTime(item.completedAt)}.`
        : item.type === 'special'
          ? (appState.config.sundayMode === 'manual' ? 'Domingo livre. A fila teórica permanece preservada.' : 'A teoria não avança hoje. Use revisão, questões ou simulado.')
          : 'A conclusão manual é o único motor real de avanço da fila.';

      return `<div class="${cls}">
        <div class="package-main">
          <div class="package-eyebrow">${item.type === 'special' ? 'DIA ESPECIAL' : 'DISCIPLINA'}</div>
          <h3 class="package-title">${esc(item.name)}</h3>
          <p class="package-sub">${esc(subtext)}</p>
          <div class="package-tags">${tags.map(t => `<span class="mini-chip">${esc(t)}</span>`).join('')}</div>
        </div>
        ${item.type === 'discipline' ? `
          <div class="package-actions">
            <button class="btn-inline done" data-action="complete" data-item-id="${item.uid}" ${item.completed ? 'disabled' : ''}>concluir</button>
            <button class="btn-inline undo" data-action="undo" data-item-id="${item.uid}" ${!item.completed ? 'disabled' : ''}>desfazer</button>
          </div>` : ''}
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', handlePkgAction));
  }

  document.getElementById('sys-directive').textContent = isSun
    ? 'Domingo preserva a teoria. A fila congela e retoma na segunda a partir das pendências acumuladas.'
    : pendingN() === 0
      ? 'Rotação limpa. Se o dia virar agora, o sistema registrará fechamento visual sem transbordo.'
      : `${pendingN()} disciplina(s) ainda transbordam para o próximo dia se você encerrar agora.`;
}

function renderCalendar() {
  const box = document.getElementById('calendar-grid');
  const days = buildCalendarPreview(7);
  box.innerHTML = days.map((day, idx) => {
    const discs = day.packageItems.filter(i => i.type === 'discipline');
    const pending = discs.filter(i => !i.completed).length;
    const allDone = discs.length > 0 && discs.every(i => i.completed);
    const label = day.isToday ? 'HOJE' : (idx === 1 ? 'AMANHÃ' : 'PROJEÇÃO');
    const chips = day.sundayModeActive
      ? `<span class="mini-chip">Domingo especial</span>`
      : discs.length
        ? discs.map(d => `<span class="calendar-disc ${d.completed ? 'done' : ''}">${esc(d.name)}</span>`).join('')
        : `<span class="mini-chip">Sem disciplinas</span>`;

    const note = day.sundayModeActive
      ? (appState.config.sundayMode === 'manual' ? 'Domingo livre. Teoria preservada.' : 'Teoria congelada. Pendências seguem para a segunda.')
      : allDone
        ? 'Dia projetado sem transbordo.'
        : `${pending} pendente(s) projetada(s) para este dia.`;

    return `<article class="calendar-card ${day.isToday ? 'today' : ''}">
      <div class="calendar-head">
        <div>
          <div class="calendar-label">${label}</div>
          <h3>${esc(wkLabel(day.dateKey))}</h3>
          <div class="calendar-date">${fmtDate(day.dateKey)}</div>
        </div>
        <span class="mini-chip">${day.sundayModeActive ? 'DOM' : `${discs.length} DISC`}</span>
      </div>
      <div class="calendar-list">${chips}</div>
      <p class="calendar-note">${esc(note)}</p>
    </article>`;
  }).join('');
}

function renderHistory() {
  const box = document.getElementById('history-list');
  if (!appState.history.length) {
    box.innerHTML = `<div class="history-empty">Nenhum registro ainda. Cada disciplina concluída gera uma entrada com data ISO, posição na fila, ciclo macro e contexto do dia.</div>`;
    return;
  }
  const recent = [...appState.history].reverse().slice(0, 50);
  box.innerHTML = recent.map((h, i) => {
    const p    = getPreset(h.colorKey);
    const desc = h.dayClose
      ? `Fechamento visual · ${h.meta?.completed ?? 0}/${h.meta?.total ?? 0} concluídas`
      : `Fila pos. ${h.queueIndex + 1} · teto ${h.slotsOnDay} · ciclo ${h.macroCycle}${h.carryOver ? ' · herdada' : ''}`;
    return `<div class="history-item">
      <div class="history-index">${appState.history.length - i}</div>
      <div class="history-main">
        <div><span class="badge ${p.cls}">${h.dayClose ? 'DIA FECHADO' : esc(h.name)}</span></div>
        <div class="history-disc">${esc(desc)}</div>
      </div>
      <div class="history-date">${fmtDate(h.dateKey)}</div>
    </div>`;
  }).join('');
}

function renderWdaySlots() {
  document.getElementById('wday-slots').innerHTML = WEEKDAY_KEYS.map(k => `
    <div class="disc-editor-card" data-wday="${k}">
      <div class="inline-grid" style="grid-template-columns:1.3fr .6fr auto;">
        <div class="form-col"><label>${WEEKDAY_LABELS[k]}</label><input class="field" type="text" value="${WEEKDAY_LABELS[k]}" disabled /></div>
        <div class="form-col"><label>Slots</label><input class="field js-wday-slot" type="number" min="0" max="10" value="${Number(appState.config.weekdaySlots[k]||0)}" /></div>
        <button class="btn-secondary" type="button" style="height:42px;" onclick="this.closest('[data-wday]').querySelector('.js-wday-slot').value=0">limpar</button>
      </div>
    </div>`).join('');
}

function renderDiscEditor() {
  const box = document.getElementById('disc-editor');
  if (!appState.disciplines.length) { box.innerHTML = `<div class="empty-box">Nenhuma disciplina.</div>`; return; }
  box.innerHTML = appState.disciplines.map(d => `
    <div class="disc-editor-card" data-disc-key="${d.key}">
      <div class="inline-grid" style="grid-template-columns:1.6fr .6fr .55fr .7fr auto;">
        <div class="form-col"><label>Nome</label><input class="field js-disc-name" type="text" maxlength="60" value="${esc(d.name)}" /></div>
        <div class="form-col"><label>Peso</label><input class="field js-disc-weight" type="number" min="1" max="10" value="${d.weight}" /></div>
        <div class="form-col"><label>Ciclo</label>
          <select class="select js-disc-cycle">${['A','B','C'].map(c=>`<option value="${c}" ${d.macroCycle===c?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="form-col"><label>Cor</label>
          <select class="select js-disc-color">${Object.entries(COLOR_PRESETS).map(([k,p])=>`<option value="${k}" ${d.colorKey===k?'selected':''}>${p.label}</option>`).join('')}</select>
        </div>
        <button class="btn-secondary js-rm-disc" type="button" style="height:42px;padding:0 12px;">×</button>
      </div>
    </div>`).join('');

  box.querySelectorAll('.js-rm-disc').forEach(btn => {
    btn.addEventListener('click', e => {
      const key = e.target.closest('[data-disc-key]')?.dataset.discKey;
      if (!key) return;
      appState.disciplines = appState.disciplines.filter(d => d.key !== key);
      if (!appState.disciplines.length) appState.disciplines = makeDefaultDisciplines();
      rebuildQueue(true);
      renderDiscEditor();
      persist();
      render();
    });
  });
}

function setView(view) {
  const operational = document.getElementById('view-operational');
  const calendar    = document.getElementById('view-calendar');
  const opTab       = document.getElementById('tab-operational');
  const calTab      = document.getElementById('tab-calendar');
  const target = view === 'calendar' ? 'calendar' : 'operational';
  operational?.classList.toggle('is-hidden', target !== 'operational');
  calendar?.classList.toggle('is-hidden', target !== 'calendar');
  opTab?.classList.toggle('is-active', target === 'operational');
  calTab?.classList.toggle('is-active', target === 'calendar');
}

function populateSettings() {
  const m = document.getElementById('settings-modal');
  if (!m.classList.contains('show')) return;
  document.getElementById('cfg-name').value         = appState.config.systemName;
  document.getElementById('cfg-subtitle').value     = appState.config.subtitle;
  document.getElementById('cfg-slots').value        = appState.config.defaultSlots;
  document.getElementById('cfg-sunday').value       = appState.config.sundayMode;
  document.getElementById('cfg-confirm-reset').checked = Boolean(appState.config.confirmReset);
  document.getElementById('new-disc-name').value    = '';
  document.getElementById('new-disc-weight').value  = 1;
  document.getElementById('new-disc-color').innerHTML =
    Object.entries(COLOR_PRESETS).map(([k,p])=>`<option value="${k}">${p.label}</option>`).join('');
  document.getElementById('new-disc-color').value   = 'blue';
  renderWdaySlots();
  renderDiscEditor();
}

/* ═══════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════ */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('show');
  m.setAttribute('aria-hidden','false');
  if (id === 'history-modal')  renderHistory();
  if (id === 'settings-modal') populateSettings();
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('show');
  m.setAttribute('aria-hidden','true');
}

function setupModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ['history-modal','settings-modal','reset-modal'].forEach(id => closeModal(id));
  });
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
function init() {
  const raw = Store.load();
  appState  = raw ? normalizeState(raw) : emptyState();
  rollover(false);
  persist();

  document.getElementById('btn-history').addEventListener('click',  () => openModal('history-modal'));
  document.getElementById('btn-settings').addEventListener('click', () => openModal('settings-modal'));
  document.getElementById('btn-reset').addEventListener('click',    requestReset);
  document.getElementById('btn-reset-confirm').addEventListener('click', doReset);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('btn-add-disc').addEventListener('click', addDiscipline);
  document.getElementById('btn-rollover').addEventListener('click', forceRollover);
  document.getElementById('tab-operational').addEventListener('click', () => setView('operational'));
  document.getElementById('tab-calendar').addEventListener('click', () => setView('calendar'));
  document.getElementById('btn-open-calendar').addEventListener('click', () => setView('calendar'));

  setupModals();
  setView('operational');
  render();
}

init();
