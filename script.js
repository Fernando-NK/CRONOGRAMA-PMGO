'use strict';

(() => { 
  /* ═══════════════════════════════════════════════════════
     PMGO WIDGET — ENGINE V11
     Base estrutural A/B/C + domingo D (consolidação)
     Script preparado para futura extração de catálogo em data.json
  ═══════════════════════════════════════════════════════ */

  const STORAGE_KEY = 'pmgo_vh_v11';
  const LEGACY_KEYS = [
    'pmgo_vh_v10',
    'pmgo_vh_v9',
    'pmgo_widget_vh_v7',
    'pmgo_widget_vh_v6',
    'pmgo_widget_vh_v5',
    'pmgo_widget_vh_v4',
    'pmgo_widget_vh_v3',
    'pmgo_ciclos_v2',
  ];

  const DATA_URL = './data.json';

  const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const WEEKDAY_LABELS = {
    sunday: 'Domingo',
    monday: 'Segunda',
    tuesday: 'Terça',
    wednesday: 'Quarta',
    thursday: 'Quinta',
    friday: 'Sexta',
    saturday: 'Sábado',
  };

  const CYCLE_ORDER = ['A', 'B', 'C'];
  const CYCLE_META = {
    A: { label: 'Ciclo A', multiplier: 1.0 },
    B: { label: 'Ciclo B', multiplier: 1.0 },
    C: { label: 'Ciclo C', multiplier: 0.74 },
    D: { label: 'Fase de Consolidação', multiplier: 0.0 },
  };

  const COLOR_PRESETS = {
    blue:   { label: 'Azul',     cls: 'c-blue',   hex: '#60a5fa', soft: 'rgba(96,165,250,.20)',  glow: 'rgba(96,165,250,.12)' },
    green:  { label: 'Verde',    cls: 'c-green',  hex: '#4ade80', soft: 'rgba(74,222,128,.20)',  glow: 'rgba(74,222,128,.12)' },
    gray:   { label: 'Cinza',    cls: 'c-gray',   hex: '#9ca3af', soft: 'rgba(156,163,175,.20)', glow: 'rgba(156,163,175,.10)' },
    yellow: { label: 'Amarelo',  cls: 'c-yellow', hex: '#fbbf24', soft: 'rgba(251,191,36,.20)',  glow: 'rgba(251,191,36,.12)' },
    orange: { label: 'Laranja',  cls: 'c-orange', hex: '#fb923c', soft: 'rgba(251,146,60,.20)',  glow: 'rgba(251,146,60,.12)' },
    purple: { label: 'Roxo',     cls: 'c-purple', hex: '#a78bfa', soft: 'rgba(167,139,250,.20)', glow: 'rgba(167,139,250,.12)' },
    red:    { label: 'Vermelho', cls: 'c-red',    hex: '#ef4444', soft: 'rgba(239,68,68,.20)',   glow: 'rgba(239,68,68,.12)' },
  };

  const DEFAULT_CONFIG = {
    systemName: 'Virtus et Honor',
    subtitle: 'Fila cíclica perpétua — o avanço real depende apenas da sua conclusão.',
    defaultSlots: 3,
    sundayMode: 'freeze',
    confirmReset: true,
    weekdaySlots: {
      sunday: 0,
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
    },
  };

  const DEFAULT_DISCIPLINES = [
    {
      key: 'lp',
      name: 'Língua Portuguesa',
      weight: 9,
      macroCycle: 'A',
      colorKey: 'blue',
      crossExamRelevance: 'high',
      dependencies: [],
    },
    {
      key: 'dp',
      name: 'Direito Penal',
      weight: 11,
      macroCycle: 'A',
      colorKey: 'green',
      crossExamRelevance: 'high',
      dependencies: [],
    },
    {
      key: 'dc',
      name: 'Direito Constitucional',
      weight: 10,
      macroCycle: 'A',
      colorKey: 'purple',
      crossExamRelevance: 'high',
      dependencies: [],
    },
    {
      key: 'dpp',
      name: 'Direito Processual Penal',
      weight: 9,
      macroCycle: 'B',
      colorKey: 'orange',
      crossExamRelevance: 'high',
      dependencies: [],
    },
    {
      key: 'da',
      name: 'Direito Administrativo',
      weight: 10,
      macroCycle: 'B',
      colorKey: 'yellow',
      crossExamRelevance: 'high',
      dependencies: [],
    },
    {
      key: 'lex',
      name: 'Legislação Extravagante',
      weight: 7,
      macroCycle: 'B',
      colorKey: 'gray',
      crossExamRelevance: 'medium',
      dependencies: ['dp', 'dc'],
    },
    {
      key: 'dpm',
      name: 'Direito Penal Militar',
      weight: 6,
      macroCycle: 'C',
      colorKey: 'red',
      crossExamRelevance: 'low',
      dependencies: ['dp'],
    },
    {
      key: 'dppm',
      name: 'Direito Processual Penal Militar',
      weight: 7,
      macroCycle: 'C',
      colorKey: 'red',
      crossExamRelevance: 'low',
      dependencies: ['dpp'],
    },
    {
      key: 'rg',
      name: 'Realidade de Goiás',
      weight: 3,
      macroCycle: 'C',
      colorKey: 'gray',
      crossExamRelevance: 'very_low',
      dependencies: [],
    },
    {
      key: 'redacao',
      name: 'Redação',
      weight: 2,
      macroCycle: 'D',
      colorKey: 'purple',
      crossExamRelevance: 'special',
      dependencies: [],
    },
  ];

  let catalog = {
    config: deepClone(DEFAULT_CONFIG),
    disciplines: makeDefaultDisciplines(),
  };

  let appState = null;
  let isBusy = false;

  /* ═══════════════════════════════════════════════════════
     BASIC HELPERS
  ═══════════════════════════════════════════════════════ */
  function uid() {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function unique(array) {
    return [...new Set((array || []).filter(Boolean))];
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  /* ═══════════════════════════════════════════════════════
     DATE HELPERS
  ═══════════════════════════════════════════════════════ */
  function isoDate(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function parseIso(dateKey) {
    const [year, month, day] = String(dateKey || isoDate()).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  function addDays(dateKey, amount) {
    const d = parseIso(dateKey);
    d.setDate(d.getDate() + amount);
    return isoDate(d);
  }

  function daysBetween(a, b) {
    return Math.round((parseIso(b) - parseIso(a)) / 86400000);
  }

  function fmtDate(dateKey) {
    return parseIso(dateKey).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function wkKey(date = new Date()) {
    return WEEKDAY_KEYS[date.getDay()];
  }

  function wkFromDateKey(dateKey) {
    return wkKey(parseIso(dateKey));
  }

  function wkLabel(dateKey) {
    return WEEKDAY_LABELS[wkFromDateKey(dateKey)] ?? '—';
  }

  function isSunday(weekdayKey) {
    return weekdayKey === 'sunday';
  }

  function getDaySlots(config, weekdayKey) {
    if (isSunday(weekdayKey)) return 0;
    const specific = Number(config?.weekdaySlots?.[weekdayKey] ?? 0);
    if (specific > 0) return clamp(specific, 1, 10, 3);
    return clamp(config?.defaultSlots, 1, 10, 3);
  }

  /* ═══════════════════════════════════════════════════════
     PERSISTENCE
  ═══════════════════════════════════════════════════════ */
  const Store = {
    _ok: null,

    ok() {
      if (this._ok !== null) return this._ok;
      try {
        const key = `${STORAGE_KEY}__test`;
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        this._ok = true;
      } catch {
        this._ok = false;
      }
      return this._ok;
    },

    save(state) {
      const payload = JSON.stringify(state);
      if (this.ok()) {
        try {
          localStorage.setItem(STORAGE_KEY, payload);
          return;
        } catch {
          // fallback below
        }
      }

      try {
        const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(payload))));
        history.replaceState(null, '', `${location.pathname}${location.search}#vh=${encoded}`);
      } catch {
        // silent fallback fail
      }
    },

    load() {
      if (this.ok()) {
        const current = localStorage.getItem(STORAGE_KEY);
        if (current) return safeParse(current);

        for (const key of LEGACY_KEYS) {
          const legacy = localStorage.getItem(key);
          if (legacy) return safeParse(legacy);
        }
      }

      const hash = String(location.hash || '');
      const match = hash.match(/vh=([^&]+)/);
      if (!match) return null;

      try {
        const raw = decodeURIComponent(escape(atob(decodeURIComponent(match[1]))));
        return safeParse(raw);
      } catch {
        return null;
      }
    },

    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
        LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch {
        // ignore
      }

      if (String(location.hash || '').includes('vh=')) {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
      }
    },
  };

  /* ═══════════════════════════════════════════════════════
     CATALOG LOADER — preparado para data.json futuro
  ═══════════════════════════════════════════════════════ */
  async function loadCatalog() {
    const base = {
      config: deepClone(DEFAULT_CONFIG),
      disciplines: makeDefaultDisciplines(),
    };

    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) return base;
      const json = await response.json();
      if (!isObject(json)) return base;

      const merged = {
        config: {
          ...deepClone(DEFAULT_CONFIG),
          ...(isObject(json.config) ? json.config : {}),
        },
        disciplines: Array.isArray(json.disciplines) && json.disciplines.length
          ? json.disciplines.map(normDisc).filter(Boolean)
          : makeDefaultDisciplines(),
      };

      merged.config.weekdaySlots = {
        ...deepClone(DEFAULT_CONFIG.weekdaySlots),
        ...(isObject(json.config?.weekdaySlots) ? json.config.weekdaySlots : {}),
      };

      return merged;
    } catch {
      return base;
    }
  }

  /* ═══════════════════════════════════════════════════════
     DEFAULTS / NORMALIZATION
  ═══════════════════════════════════════════════════════ */
  function makeDefaultDisciplines() {
    return DEFAULT_DISCIPLINES.map((discipline) => ({ ...deepClone(discipline) }));
  }

  function makeEmptyCycleMemory() {
    return {
      A: { lastScheduledDate: null, skipCount: 0 },
      B: { lastScheduledDate: null, skipCount: 0 },
      C: { lastScheduledDate: null, skipCount: 0 },
    };
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

  function emptyState() {
    return {
      rev: 0,
      updatedAt: null,
      config: deepClone(catalog.config),
      disciplines: catalog.disciplines.map((discipline) => ({ ...deepClone(discipline) })),
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
      stats: {
        completedCount: 0,
        closedDays: 0,
      },
    };
  }

  function inferCycle(name) {
    const text = String(name || '').toLowerCase();
    if (text.includes('militar') || text.includes('goiás') || text.includes('goias')) return 'C';
    if (text.includes('administrativo') || text.includes('processual') || text.includes('extravagante')) return 'B';
    if (text.includes('redação') || text.includes('redacao')) return 'D';
    return 'A';
  }

  function inferColorByCycle(cycle) {
    if (cycle === 'A') return 'blue';
    if (cycle === 'B') return 'orange';
    if (cycle === 'C') return 'red';
    return 'purple';
  }

  function normDisc(raw) {
    if (!isObject(raw)) return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;

    const macroCycle = ['A', 'B', 'C', 'D'].includes(raw.macroCycle) ? raw.macroCycle : inferCycle(name);

    return {
      key: String(raw.key || uid()).trim(),
      name,
      weight: clamp(raw.weight, 1, 11, 1),
      macroCycle,
      colorKey: COLOR_PRESETS[raw.colorKey] ? raw.colorKey : inferColorByCycle(macroCycle),
      crossExamRelevance: raw.crossExamRelevance || 'medium',
      dependencies: unique(Array.isArray(raw.dependencies) ? raw.dependencies : []),
    };
  }

  function normPkgItem(raw, disciplines) {
    if (!isObject(raw)) return null;

    if (raw.type === 'special') {
      return {
        uid: raw.uid || uid(),
        type: 'special',
        disciplineKey: null,
        name: raw.name || 'Fase de Consolidação',
        macroCycle: 'D',
        colorKey: COLOR_PRESETS[raw.colorKey] ? raw.colorKey : 'purple',
        completed: Boolean(raw.completed),
        completedAt: raw.completedAt || null,
        carryOver: Boolean(raw.carryOver),
        inheritedFromDate: raw.inheritedFromDate || null,
        reservedDate: raw.reservedDate || isoDate(),
        sourceCycle: 'D',
        occLabel: raw.occLabel || null,
        suggestedMode: raw.suggestedMode || null,
        buildReason: raw.buildReason || 'sunday',
      };
    }

    const discipline = disciplines.find((item) => item.key === raw.disciplineKey);
    if (!discipline) return null;

    return {
      uid: raw.uid || uid(),
      type: 'discipline',
      disciplineKey: discipline.key,
      name: raw.name || discipline.name,
      macroCycle: discipline.macroCycle,
      colorKey: COLOR_PRESETS[raw.colorKey] ? raw.colorKey : discipline.colorKey,
      completed: Boolean(raw.completed),
      completedAt: raw.completedAt || null,
      carryOver: Boolean(raw.carryOver),
      inheritedFromDate: raw.inheritedFromDate || null,
      reservedDate: raw.reservedDate || isoDate(),
      sourceCycle: ['A', 'B', 'C', 'D'].includes(raw.sourceCycle) ? raw.sourceCycle : discipline.macroCycle,
      occLabel: raw.occLabel || null,
      suggestedMode: null,
      buildReason: raw.buildReason || 'base',
    };
  }

  function normDay(raw, disciplines) {
    const dateKey = raw?.dateKey || isoDate();
    return {
      dateKey,
      weekdayKey: raw?.weekdayKey || wkFromDateKey(dateKey),
      packageItems: Array.isArray(raw?.packageItems)
        ? raw.packageItems.map((item) => normPkgItem(item, disciplines)).filter(Boolean)
        : [],
      closedVisual: Boolean(raw?.closedVisual),
      sundayModeActive: Boolean(raw?.sundayModeActive),
      seedCycle: ['A', 'B', 'C', 'D'].includes(raw?.seedCycle) ? raw.seedCycle : null,
      sundaySuggestion: isObject(raw?.sundaySuggestion) ? raw.sundaySuggestion : null,
    };
  }

  function normHistoryItem(raw) {
    if (!isObject(raw)) return null;
    const dateKey = raw.dateKey || isoDate();

    return {
      uid: raw.uid || uid(),
      type: raw.type || 'discipline',
      discKey: raw.discKey || raw.disciplineKey || null,
      name: raw.name || '—',
      macroCycle: ['A', 'B', 'C', 'D', 'DAY'].includes(raw.macroCycle) ? raw.macroCycle : 'A',
      colorKey: COLOR_PRESETS[raw.colorKey] ? raw.colorKey : 'blue',
      dateKey,
      completedIso: raw.completedIso || raw.completedAt || new Date().toISOString(),
      weekdayKey: raw.weekdayKey || wkFromDateKey(dateKey),
      carryOver: Boolean(raw.carryOver),
      skipped: Boolean(raw.skipped),
      dayClose: Boolean(raw.dayClose),
      meta: isObject(raw.meta) ? raw.meta : {},
    };
  }

  function normDayBuild(raw) {
    if (!isObject(raw)) return null;
    return {
      dateKey: raw.dateKey || isoDate(),
      weekdayKey: raw.weekdayKey || wkFromDateKey(raw.dateKey || isoDate()),
      seedCycle: ['A', 'B', 'C', 'D'].includes(raw.seedCycle) ? raw.seedCycle : null,
      disciplineKeys: Array.isArray(raw.disciplineKeys) ? raw.disciplineKeys.filter(Boolean) : [],
      carryCount: clamp(raw.carryCount, 0, 20, 0),
      sundayModeActive: Boolean(raw.sundayModeActive),
      builtAt: raw.builtAt || null,
    };
  }

  function normalizeState(raw) {
    if (!isObject(raw)) return emptyState();

    const state = emptyState();

    state.rev = Number.isInteger(raw.rev) ? raw.rev : 0;
    state.updatedAt = raw.updatedAt || null;

    state.config = {
      ...deepClone(catalog.config),
      ...(isObject(raw.config) ? raw.config : {}),
    };

    state.config.weekdaySlots = {
      ...deepClone(catalog.config.weekdaySlots),
      ...(isObject(raw.config?.weekdaySlots) ? raw.config.weekdaySlots : {}),
    };

    const disciplines = Array.isArray(raw.disciplines) && raw.disciplines.length
      ? raw.disciplines.map(normDisc).filter(Boolean)
      : catalog.disciplines.map((item) => ({ ...deepClone(item) }));

    state.disciplines = disciplines.length ? disciplines : makeDefaultDisciplines();
    state.today = normDay(raw.today, state.disciplines);
    state.history = Array.isArray(raw.history) ? raw.history.map(normHistoryItem).filter(Boolean) : [];
    state.dayBuilds = Array.isArray(raw.dayBuilds) ? raw.dayBuilds.map(normDayBuild).filter(Boolean) : [];
    state.carryBuffer = Array.isArray(raw.carryBuffer)
      ? raw.carryBuffer.map((item) => normPkgItem(item, state.disciplines)).filter(Boolean)
      : [];

    state.cycleState = {
      nextBaseIndex: clamp(raw.cycleState?.nextBaseIndex, 0, CYCLE_ORDER.length - 1, 0),
      lastBaseCycle: ['A', 'B', 'C'].includes(raw.cycleState?.lastBaseCycle) ? raw.cycleState.lastBaseCycle : null,
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
      },
    };

    state.rotations = clamp(raw.rotations, 0, 999999, 0);
    state.stats = {
      completedCount: clamp(raw.stats?.completedCount, 0, 1000000000, 0),
      closedDays: clamp(raw.stats?.closedDays, 0, 1000000000, 0),
    };

    return state;
  }

  /* ═══════════════════════════════════════════════════════
     STATE HELPERS
  ═══════════════════════════════════════════════════════ */
  function getDisc(key, runtime = appState) {
    return runtime.disciplines.find((discipline) => discipline.key === key) || null;
  }

  function getPreset(colorKey) {
    return COLOR_PRESETS[colorKey] || COLOR_PRESETS.blue;
  }

  function todayDiscs(day = appState.today) {
    return (day?.packageItems || []).filter((item) => item.type === 'discipline');
  }

  function pendingN(day = appState.today) {
    return todayDiscs(day).filter((item) => !item.completed).length;
  }

  function doneTodayN(day = appState.today) {
    return todayDiscs(day).filter((item) => item.completed).length;
  }

  function totalDiscN(day = appState.today) {
    return todayDiscs(day).length;
  }

  function nextCycleAfter(cycleKey) {
    const index = CYCLE_ORDER.indexOf(cycleKey);
    if (index < 0) return 'A';
    return CYCLE_ORDER[(index + 1) % CYCLE_ORDER.length];
  }

  function dayIsFullyCompleted(day) {
    const disciplines = todayDiscs(day);
    return disciplines.length > 0 && disciplines.every((item) => item.completed);
  }

  function dayIsFullMiss(day) {
    const disciplines = todayDiscs(day);
    return disciplines.length > 0 && disciplines.every((item) => !item.completed);
  }

  function cloneItemsForDate(items, dateKey, opts = {}) {
    return (items || []).map((item) => ({
      ...deepClone(item),
      uid: uid(),
      reservedDate: dateKey,
      inheritedFromDate: opts.keepOriginalDate
        ? item.inheritedFromDate || item.reservedDate || null
        : (opts.inheritedFromDate ?? item.inheritedFromDate ?? item.reservedDate ?? null),
      completed: false,
      completedAt: null,
      occLabel: opts.occLabel ?? item.occLabel ?? null,
      carryOver: typeof opts.carryOver === 'boolean' ? opts.carryOver : Boolean(item.carryOver),
      buildReason: opts.buildReason || item.buildReason || 'carry',
    }));
  }

  function createDiscItem(discipline, dateKey, sourceCycle, opts = {}) {
    return {
      uid: uid(),
      type: 'discipline',
      disciplineKey: discipline.key,
      name: discipline.name,
      macroCycle: discipline.macroCycle,
      colorKey: COLOR_PRESETS[opts.colorKey] ? opts.colorKey : discipline.colorKey,
      completed: false,
      completedAt: null,
      carryOver: Boolean(opts.carryOver),
      inheritedFromDate: opts.inheritedFromDate || null,
      reservedDate: dateKey,
      sourceCycle: sourceCycle || discipline.macroCycle,
      occLabel: opts.occLabel || null,
      suggestedMode: null,
      buildReason: opts.buildReason || 'base',
    };
  }

  function createSundayItem(dateKey, suggestion, mode) {
    const manual = mode === 'manual';
    return {
      uid: uid(),
      type: 'special',
      disciplineKey: null,
      name: manual ? 'Domingo livre' : 'Fase de Consolidação',
      macroCycle: 'D',
      colorKey: 'purple',
      completed: false,
      completedAt: null,
      carryOver: false,
      inheritedFromDate: null,
      reservedDate: dateKey,
      sourceCycle: 'D',
      occLabel: suggestion?.label || (manual ? 'MANUAL' : 'CONSOLIDAÇÃO'),
      suggestedMode: suggestion?.mode || null,
      buildReason: 'sunday',
    };
  }

  function recordDayBuild(runtime, day) {
    const record = {
      dateKey: day.dateKey,
      weekdayKey: day.weekdayKey,
      seedCycle: day.seedCycle,
      disciplineKeys: todayDiscs(day).map((item) => item.disciplineKey),
      carryCount: todayDiscs(day).filter((item) => item.carryOver).length,
      sundayModeActive: Boolean(day.sundayModeActive),
      builtAt: new Date().toISOString(),
    };

    runtime.dayBuilds = (runtime.dayBuilds || []).filter((item) => item.dateKey !== day.dateKey);
    runtime.dayBuilds.push(record);
    runtime.dayBuilds.sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
  }

  function getLastCompletionDate(discKey, runtime = appState) {
    return (runtime.history || [])
      .filter((item) => item.type === 'discipline' && !item.skipped && item.discKey === discKey)
      .map((item) => item.dateKey)
      .sort()
      .pop() || null;
  }

  function getLastScheduledDate(discKey, runtime = appState) {
    const fromBuilds = (runtime.dayBuilds || [])
      .filter((item) => Array.isArray(item.disciplineKeys) && item.disciplineKeys.includes(discKey))
      .map((item) => item.dateKey)
      .sort()
      .pop() || null;

    const fromToday = todayDiscs(runtime.today)
      .filter((item) => item.disciplineKey === discKey)
      .map((item) => item.reservedDate)
      .sort()
      .pop() || null;

    const fromCarry = (runtime.carryBuffer || [])
      .filter((item) => item.type === 'discipline' && item.disciplineKey === discKey)
      .map((item) => item.reservedDate)
      .sort()
      .pop() || null;

    return [fromBuilds, fromToday, fromCarry].filter(Boolean).sort().pop() || null;
  }

  function hasRecentCompletion(discKey, dateKey, runtime = appState, withinDays = 10) {
    const last = getLastCompletionDate(discKey, runtime);
    if (!last) return false;
    return daysBetween(last, dateKey) <= withinDays;
  }

  function getPreviousActiveBuild(dateKey, runtime = appState) {
    const activeBuilds = (runtime.dayBuilds || [])
      .filter((item) => !item.sundayModeActive && item.dateKey < dateKey)
      .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));

    return activeBuilds.length ? activeBuilds[activeBuilds.length - 1] : null;
  }
  
   function recentCompletionCount(discKey, dateKey, runtime = appState, withinDays = 12) {
  return (runtime.history || []).filter((item) => (
    item.type === 'discipline'
    && !item.skipped
    && item.discKey === discKey
    && daysBetween(item.dateKey, dateKey) <= withinDays
  )).length;
}

function cycleLastSeen(cycleKey, runtime = appState) {
  return runtime.cycleState?.memory?.[cycleKey]?.lastScheduledDate || null;
}

function canDisciplineEnterFromCycle(discipline, dateKey, runtime = appState) {
  const neglect = calcNeglectFactor(discipline, dateKey, runtime);

  if (discipline.key === 'dpm') {
    const dpCount5 = recentCompletionCount('dp', dateKey, runtime, 5);
    const dpCount12 = recentCompletionCount('dp', dateKey, runtime, 12);

    return dpCount5 >= 2 || dpCount12 >= 4 || neglect >= 1.75;
  }

  if (discipline.key === 'dppm') {
    const dppCount5 = recentCompletionCount('dpp', dateKey, runtime, 5);
    const dppCount12 = recentCompletionCount('dpp', dateKey, runtime, 12);

    return dppCount5 >= 2 || dppCount12 >= 4 || neglect >= 1.75;
  }

  if (discipline.key === 'rg') {
    const rgNeglect = neglect >= 1.95;
    const longGap = !hasRecentCompletion('rg', dateKey, runtime, 21);
    return rgNeglect || longGap;
  }

  return true;
}

function countUnlockedCDisciplines(dateKey, runtime = appState) {
  return runtime.disciplines
    .filter((discipline) => discipline.macroCycle === 'C')
    .filter((discipline) => canDisciplineEnterFromCycle(discipline, dateKey, runtime))
    .length;
}

function selectSupportDisciplines(count, dateKey, runtime, excludeKeys = []) {
  if (count <= 0) return [];

  const excluded = new Set(excludeKeys.filter(Boolean));
  const previousActiveBuild = getPreviousActiveBuild(dateKey, runtime);

  return runtime.disciplines
    .filter((discipline) => ['A', 'B'].includes(discipline.macroCycle))
    .filter((discipline) => !excluded.has(discipline.key))
    .filter((discipline) => !previousActiveBuild?.disciplineKeys?.includes(discipline.key))
    .map((discipline) => ({
      discipline,
      score: calcDisciplinePriority(discipline, dateKey, runtime),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.discipline.name.localeCompare(b.discipline.name, 'pt-BR');
    })
    .slice(0, count)
    .map((entry) => entry.discipline);
}
  
  function countSkippedDisc(discKey, runtime = appState) {
    return (runtime.history || []).filter((item) => item.type === 'discipline' && item.skipped && item.discKey === discKey).length;
  }

  /* ═══════════════════════════════════════════════════════
     PRIORITY ENGINE
  ═══════════════════════════════════════════════════════ */
  function calcNeglectFactor(discipline, dateKey, runtime) {
    const lastDone = getLastCompletionDate(discipline.key, runtime);
    const lastScheduled = getLastScheduledDate(discipline.key, runtime);
    const reference = lastDone || lastScheduled;
    const skipped = countSkippedDisc(discipline.key, runtime);

    let factor = 1;

    if (!reference) {
      factor += 0.9;
    } else {
      const gap = daysBetween(reference, dateKey);
      if (gap >= 21) factor += 0.9;
      else if (gap >= 14) factor += 0.7;
      else if (gap >= 10) factor += 0.5;
      else if (gap >= 7) factor += 0.32;
      else if (gap >= 4) factor += 0.16;
    }

    factor += Math.min(skipped * 0.12, 0.6);

    if (discipline.key === 'rg') {
      factor = Math.min(factor, 1.45);
    }

    return factor;
  }

  function calcContextFactor(discipline, dateKey, runtime) {
  let factor = 1;

  if (discipline.crossExamRelevance === 'high') factor += 0.08;
  if (discipline.crossExamRelevance === 'very_low') factor -= 0.08;

  if (discipline.key === 'dpm' && !hasRecentCompletion('dp', dateKey, runtime, 8)) factor -= 0.30;
  if (discipline.key === 'dppm' && !hasRecentCompletion('dpp', dateKey, runtime, 8)) factor -= 0.28;
  if (discipline.key === 'lex' && !(hasRecentCompletion('dp', dateKey, runtime, 10) || hasRecentCompletion('dc', dateKey, runtime, 10))) factor -= 0.12;

  // Regra correta: só segura de verdade se apareceu no dia ativo imediatamente anterior.
  const previousActiveBuild = getPreviousActiveBuild(dateKey, runtime);
  if (previousActiveBuild?.disciplineKeys?.includes(discipline.key)) {
    factor -= 0.55;
  }

  return Math.max(0.2, factor);
}

  function calcDisciplinePriority(discipline, dateKey, runtime) {
    const cycleMult = CYCLE_META[discipline.macroCycle]?.multiplier ?? 1;
    const neglect = calcNeglectFactor(discipline, dateKey, runtime);
    const context = calcContextFactor(discipline, dateKey, runtime);
    return discipline.weight * cycleMult * neglect * context;
  }

  function cyclePriorityScore(cycleKey, dateKey, runtime) {
  if (!CYCLE_META[cycleKey] || cycleKey === 'D') return -999;

  const meta = runtime.cycleState?.memory?.[cycleKey] || { lastScheduledDate: null, skipCount: 0 };
  const canonical = CYCLE_ORDER[runtime.cycleState?.nextBaseIndex ?? 0] || 'A';
  let score = CYCLE_META[cycleKey].multiplier * 10;

  if (cycleKey === canonical) score += 2.2;
  score += Math.min((meta.skipCount || 0) * 0.9, 2.7);

  if (meta.lastScheduledDate) {
    const gap = daysBetween(meta.lastScheduledDate, dateKey);
    if (gap >= 10) score += 1.1;
    else if (gap >= 6) score += 0.6;
    else if (gap <= 1) score -= 0.8;
  } else {
    score += 0.8;
  }

  if (cycleKey === 'C') {
    const lastCDate = cycleLastSeen('C', runtime);
    const recentC = (runtime.dayBuilds || []).filter((item) => (
      item.seedCycle === 'C' && !item.sundayModeActive && daysBetween(item.dateKey, dateKey) <= 6
    )).length;

    const unlockedC = countUnlockedCDisciplines(dateKey, runtime);
    const dpCount = recentCompletionCount('dp', dateKey, runtime, 12);
    const dppCount = recentCompletionCount('dpp', dateKey, runtime, 12);

    if (lastCDate && daysBetween(lastCDate, dateKey) < 6) score -= 5.5;
    if (recentC >= 1) score -= 3.0;
    if (recentC >= 2) score -= 5.0;

    if (dpCount < 2) score -= 2.2;
    if (dppCount < 2) score -= 1.8;

    if (unlockedC === 0) score -= 7.0;
    else if (unlockedC === 1) score -= 3.2;
  }

  return score;
}

  function chooseSeedCycle(dateKey, runtime, excludedCycles = []) {
    const candidates = CYCLE_ORDER
      .filter((cycleKey) => !excludedCycles.includes(cycleKey))
      .map((cycleKey) => ({ cycleKey, score: cyclePriorityScore(cycleKey, dateKey, runtime) }))
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.cycleKey || (CYCLE_ORDER[runtime.cycleState?.nextBaseIndex ?? 0] || 'A');
  }

  function selectDisciplinesForCycle(cycleKey, count, dateKey, runtime, excludeKeys = []) {
  if (count <= 0) return [];

  const excluded = new Set(excludeKeys.filter(Boolean));
  const previousActiveBuild = getPreviousActiveBuild(dateKey, runtime);

  return runtime.disciplines
    .filter((discipline) => discipline.macroCycle === cycleKey)
    .filter((discipline) => !excluded.has(discipline.key))
    .filter((discipline) => !previousActiveBuild?.disciplineKeys?.includes(discipline.key))
    .filter((discipline) => {
      if (cycleKey !== 'C') return true;
      return canDisciplineEnterFromCycle(discipline, dateKey, runtime);
    })
    .map((discipline) => ({
      discipline,
      score: calcDisciplinePriority(discipline, dateKey, runtime),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.discipline.name.localeCompare(b.discipline.name, 'pt-BR');
    })
    .slice(0, count)
    .map((entry) => entry.discipline);
}

  function registerCycleSelection(runtime, cycleKey, dateKey) {
    const previous = runtime.cycleState.lastBaseCycle;
    if (previous === 'C' && cycleKey === 'A') {
      runtime.rotations = clamp((runtime.rotations || 0) + 1, 0, 999999, 0);
    }

    runtime.cycleState.lastBaseCycle = cycleKey;
    runtime.cycleState.nextBaseIndex = CYCLE_ORDER.indexOf(nextCycleAfter(cycleKey));

    CYCLE_ORDER.forEach((cycle) => {
      const memory = runtime.cycleState.memory[cycle] || { lastScheduledDate: null, skipCount: 0 };
      if (cycle === cycleKey) {
        memory.lastScheduledDate = dateKey;
        memory.skipCount = 0;
      } else {
        memory.skipCount = clamp((memory.skipCount || 0) + 1, 0, 9999, 0);
      }
      runtime.cycleState.memory[cycle] = memory;
    });
  }

  /* ═══════════════════════════════════════════════════════
     SUNDAY ENGINE
  ═══════════════════════════════════════════════════════ */
  function chooseSundaySuggestion(dateKey, runtime) {
    const recentCompletions = (runtime.history || []).filter((item) => (
      item.type === 'discipline' && !item.skipped && daysBetween(item.dateKey, dateKey) <= 7
    ));

    const recentBuilds = (runtime.dayBuilds || []).filter((item) => !item.sundayModeActive && daysBetween(item.dateKey, dateKey) <= 5);
    const hadStrongAB = recentBuilds.filter((item) => item.seedCycle === 'A' || item.seedCycle === 'B').length >= 2;
    const hasCarry = (runtime.carryBuffer || []).some((item) => item.type === 'discipline');

    const neglected = runtime.disciplines
      .filter((discipline) => discipline.macroCycle !== 'D')
      .map((discipline) => {
        const last = getLastCompletionDate(discipline.key, runtime) || getLastScheduledDate(discipline.key, runtime);
        return {
          discipline,
          gap: last ? daysBetween(last, dateKey) : 9999,
        };
      })
      .sort((a, b) => b.gap - a.gap)[0] || null;

    if (hasCarry) {
      return {
        mode: 'revisao_seletiva',
        label: 'REVISÃO',
        note: 'Domingo útil para revisão seletiva, questões e limpeza estratégica de pendências herdadas.',
      };
    }

    if (recentCompletions.length >= 12) {
      return {
        mode: 'simulado',
        label: 'SIMULADO',
        note: 'Houve teoria suficiente na janela recente. Simulado ou prova parcial faz sentido neste domingo.',
      };
    }

    if (hadStrongAB) {
      return {
        mode: 'questoes_mistas',
        label: 'QUESTÕES',
        note: 'A semana teve carga forte em A/B. Questões mistas e revisão ativa tendem a render melhor.',
      };
    }

    if (neglected && neglected.gap >= 10) {
      return {
        mode: 'revisao_ponto_fraco',
        label: 'REVISÃO',
        note: `Há negligência acumulada em ${neglected.discipline.name}. Revisão seletiva é uma boa resposta para o domingo.`,
      };
    }

    return {
      mode: 'revisao_geral',
      label: 'CONSOLIDAÇÃO',
      note: 'Domingo sem teoria nova por padrão. Revisão, questões, flashcards, redação ou organização.',
    };
  }

  /* ═══════════════════════════════════════════════════════
     COMPOSITION ENGINE
  ═══════════════════════════════════════════════════════ */
  function buildSundayDay(dateKey, runtime) {
    const suggestion = chooseSundaySuggestion(dateKey, runtime);
    const day = {
      dateKey,
      weekdayKey: wkFromDateKey(dateKey),
      packageItems: [createSundayItem(dateKey, suggestion, runtime.config.sundayMode)],
      closedVisual: false,
      sundayModeActive: true,
      seedCycle: 'D',
      sundaySuggestion: suggestion,
    };

    recordDayBuild(runtime, day);
    return day;
  }

  function buildActiveDay(dateKey, carriedItems, runtime) {
  const weekdayKey = wkFromDateKey(dateKey);
  const slots = getDaySlots(runtime.config, weekdayKey);

  const packageItems = carriedItems.map((item) => ({ ...item }));
  const freeSlots = Math.max(0, slots - packageItems.length);

  let seedCycle = runtime.cycleState.lastBaseCycle || (CYCLE_ORDER[runtime.cycleState.nextBaseIndex] || 'A');
  let selected = [];

  if (freeSlots > 0) {
    const existingKeys = packageItems
      .filter((item) => item.type === 'discipline')
      .map((item) => item.disciplineKey);

    // 1) tentativa normal: ciclo prioritário escolhido pela inteligência
    seedCycle = chooseSeedCycle(dateKey, runtime);
    selected = selectDisciplinesForCycle(seedCycle, freeSlots, dateKey, runtime, existingKeys);

    // 2) se C não entregou nada útil, aborta C e tenta A/B
    if (selected.length === 0 && seedCycle === 'C') {
      seedCycle = chooseSeedCycle(dateKey, runtime, ['C']);
      selected = selectDisciplinesForCycle(seedCycle, freeSlots, dateKey, runtime, existingKeys);
    }

    // 3) se C entrou parcialmente, completa com apoio A/B
    if (seedCycle === 'C' && selected.length < freeSlots) {
      const support = selectSupportDisciplines(
        freeSlots - selected.length,
        dateKey,
        runtime,
        [
          ...existingKeys,
          ...selected.map((discipline) => discipline.key),
        ]
      );

      selected = [...selected, ...support];
    }

    // 4) fallback final: não deixa o dia vazio/quebrado.
    // Aqui NÃO aplicamos canDisciplineEnterFromCycle, porque essa é a camada de emergência.
    if (selected.length < freeSlots) {
      const fallbackExcluded = new Set([
        ...existingKeys,
        ...selected.map((discipline) => discipline.key),
      ]);

      const fallbackFill = (runtime.disciplines || [])
        .filter((discipline) => discipline.macroCycle !== 'D')
        .filter((discipline) => !fallbackExcluded.has(discipline.key))
        .map((discipline) => ({
          discipline,
          score: calcDisciplinePriority(discipline, dateKey, runtime),
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.discipline.name.localeCompare(b.discipline.name, 'pt-BR');
        })
        .slice(0, freeSlots - selected.length)
        .map((entry) => entry.discipline);

      selected = [...selected, ...fallbackFill];
    }

    selected.forEach((discipline) => {
      packageItems.push(createDiscItem(discipline, dateKey, seedCycle, { buildReason: 'base' }));
    });

    if (selected.length > 0) {
      registerCycleSelection(runtime, seedCycle, dateKey);
    }
  }

  const day = {
    dateKey,
    weekdayKey,
    packageItems,
    closedVisual: false,
    sundayModeActive: false,
    seedCycle: selected.length > 0 ? seedCycle : null,
    sundaySuggestion: null,
  };

  recordDayBuild(runtime, day);
  return day;
}

  function buildActiveDayDraft(dateKey, carriedItems, runtime) {
  const runtimeDraft = deepClone(runtime);

  return buildActiveDay(
    dateKey,
    (carriedItems || []).map((item) => deepClone(item)),
    runtimeDraft
  );
}
  
  function composeNextDay(dateKey, previousDay, runtime) {
    const weekdayKey = wkFromDateKey(dateKey);

    if (isSunday(weekdayKey)) {
      if (previousDay?.sundayModeActive) {
        const day = buildSundayDay(dateKey, runtime);
        return day;
      }

      runtime.carryBuffer = cloneItemsForDate(
        todayDiscs(previousDay).filter((item) => !item.completed),
        dateKey,
        {
          carryOver: true,
          keepOriginalDate: true,
          buildReason: 'carry',
          occLabel: 'Herdada',
        }
      );

      return buildSundayDay(dateKey, runtime);
    }

    if (previousDay?.sundayModeActive) {
      const carryFromSunday = cloneItemsForDate(
        (runtime.carryBuffer || []).filter((item) => item.type === 'discipline'),
        dateKey,
        {
          carryOver: true,
          keepOriginalDate: true,
          buildReason: 'carry',
          occLabel: 'Herdada',
        }
      );

      runtime.carryBuffer = [];
      return buildActiveDay(dateKey, carryFromSunday, runtime);
    }

    const disciplines = todayDiscs(previousDay);

    if (!disciplines.length) {
      return buildActiveDay(dateKey, [], runtime);
    }

    if (dayIsFullMiss(previousDay)) {
      const cloned = cloneItemsForDate(disciplines, dateKey, {
        carryOver: Boolean(disciplines.some((item) => item.carryOver)),
        keepOriginalDate: true,
        buildReason: 'stalled',
      });

      const day = {
        dateKey,
        weekdayKey,
        packageItems: cloned,
        closedVisual: false,
        sundayModeActive: false,
        seedCycle: previousDay.seedCycle || runtime.cycleState.lastBaseCycle || 'A',
        sundaySuggestion: null,
      };

      recordDayBuild(runtime, day);
      return day;
    }

    const carried = cloneItemsForDate(
      disciplines.filter((item) => !item.completed),
      dateKey,
      {
        carryOver: true,
        keepOriginalDate: true,
        buildReason: 'carry',
        occLabel: 'Herdada',
      }
    );

    return buildActiveDay(dateKey, carried, runtime);
  }

  function buildInitialDay(dateKey, runtime) {
    if (isSunday(wkFromDateKey(dateKey))) {
      runtime.carryBuffer = [];
      return buildSundayDay(dateKey, runtime);
    }

    return buildActiveDay(dateKey, [], runtime);
  }

  function shiftOpenStateToDate(dateKey) {
    const shiftedDay = {
      ...appState.today,
      dateKey,
      weekdayKey: wkFromDateKey(dateKey),
      packageItems: (appState.today.packageItems || []).map((item) => ({
        ...deepClone(item),
        uid: uid(),
        reservedDate: dateKey,
      })),
    };

    shiftedDay.closedVisual = dayIsFullyCompleted(shiftedDay);
    appState.today = shiftedDay;

    if (appState.today.sundayModeActive) {
      appState.carryBuffer = cloneItemsForDate(appState.carryBuffer || [], dateKey, {
        carryOver: true,
        keepOriginalDate: true,
        buildReason: 'carry',
      });
    }

    recordDayBuild(appState, appState.today);
  }

  function reconcileToday() {
    const currentDate = isoDate();

    if (!appState.today || !Array.isArray(appState.today.packageItems) || !appState.today.packageItems.length) {
      appState.today = buildInitialDay(currentDate, appState);
      return;
    }

    if (appState.today.dateKey === currentDate) {
      appState.today.closedVisual = dayIsFullyCompleted(appState.today);
      return;
    }

    if (appState.today.dateKey > currentDate) {
      appState.today.dateKey = currentDate;
      appState.today.weekdayKey = wkFromDateKey(currentDate);
      return;
    }

    if (appState.today.sundayModeActive || pendingN(appState.today) > 0) {
      shiftOpenStateToDate(currentDate);
      return;
    }

    appState.today = composeNextDay(currentDate, deepClone(appState.today), appState);
  }

  function persist() {
    appState.rev += 1;
    appState.updatedAt = new Date().toISOString();
    Store.save(appState);
  }

  function syncIfNewer() {
    const raw = Store.load();
    if (!raw) return;

    const external = normalizeState(raw);
    if (external.rev > appState.rev) {
      appState = external;
      reconcileToday();
    }
  }
function composePreviewDay(dateKey, previousDay, runtime, carryItems = []) {
  const weekdayKey = wkFromDateKey(dateKey);

  // Domingo continua sendo fase de consolidação.
  // Se houver pendência herdada do primeiro dia projetado, ela fica preservada no buffer.
  if (isSunday(weekdayKey)) {
    runtime.carryBuffer = (carryItems || []).map((item) => ({ ...deepClone(item) }));
    return buildSundayDay(dateKey, runtime);
  }

  let inherited = [];

  // Se o dia anterior projetado foi domingo, reaproveita o carryBuffer.
  if (previousDay?.sundayModeActive) {
    inherited = cloneItemsForDate(
      (runtime.carryBuffer || []).filter((item) => item.type === 'discipline'),
      dateKey,
      {
        carryOver: true,
        keepOriginalDate: true,
        buildReason: 'carry',
        occLabel: 'Herdada',
      }
    );
    runtime.carryBuffer = [];
  } else {
    inherited = Array.isArray(carryItems) ? carryItems : [];
  }

  // Aqui entra a projeção útil:
  // pendência herdada entra primeiro, mas o sistema continua rodando.
  return buildActiveDay(dateKey, inherited, runtime);
}
  
  function buildCalendarPreview(days = 9) {
  const runtime = normalizeState(deepClone(appState));
  const preview = [];
  const baseDate = runtime.today.dateKey;

  preview.push({ ...deepClone(runtime.today), isToday: true });

  let previousProjectedDay = deepClone(runtime.today);

  for (let index = 1; index < days; index += 1) {
    const targetDate = addDays(baseDate, index);

    // No preview, amanhã NÃO herda automaticamente as pendências de hoje.
    // Herdança só existe quando o motor real virar o dia.
    const next = composePreviewDay(targetDate, previousProjectedDay, runtime, []);

    preview.push({ ...deepClone(next), isToday: false });
    previousProjectedDay = deepClone(next);
    runtime.today = deepClone(next);
  }

  return preview;
}
  
  /* ═══════════════════════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════════════════════ */
  function handlePkgAction(event) {
    if (isBusy) return;

    const button = event.currentTarget;
    const action = button.dataset.action;
    const itemId = button.dataset.itemId;
    if (!action || !itemId) return;

    const item = (appState.today.packageItems || []).find((entry) => entry.uid === itemId);
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
          completedIso: item.completedAt,
          weekdayKey: appState.today.weekdayKey,
          carryOver: item.carryOver,
          skipped: false,
          dayClose: false,
          meta: {
            inheritedFromDate: item.inheritedFromDate || null,
            sourceCycle: item.sourceCycle || null,
            occLabel: item.occLabel || null,
          },
        });

        appState.stats.completedCount = clamp((appState.stats.completedCount || 0) + 1, 0, 1000000000, 0);
        appState.today.closedVisual = dayIsFullyCompleted(appState.today);
      }

      if (action === 'undo' && item.completed) {
        item.completed = false;
        item.completedAt = null;
        appState.today.closedVisual = false;

        const reverseIndex = [...appState.history].reverse().findIndex((historyItem) => (
          historyItem.type === 'discipline'
          && !historyItem.skipped
          && historyItem.discKey === item.disciplineKey
          && historyItem.dateKey === appState.today.dateKey
        ));

        if (reverseIndex >= 0) {
          appState.history.splice(appState.history.length - 1 - reverseIndex, 1);
        }

        appState.stats.completedCount = Math.max(0, (appState.stats.completedCount || 0) - 1);
      }

      persist();
      render();
    } finally {
      setTimeout(() => {
        isBusy = false;
      }, 120);
    }
  }

  function addDiscipline() {
    const nameInput = document.getElementById('new-disc-name');
    const weightInput = document.getElementById('new-disc-weight');
    const colorInput = document.getElementById('new-disc-color');
    if (!nameInput || !weightInput || !colorInput) return;

    const name = nameInput.value.trim();
    if (!name) return;

    const weight = clamp(weightInput.value, 1, 11, 1);
    const macroCycle = inferCycle(name);
    const colorKey = COLOR_PRESETS[colorInput.value] ? colorInput.value : inferColorByCycle(macroCycle);

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

    nameInput.value = '';
    weightInput.value = '1';
    nameInput.focus();
  }

  function saveSettings() {
    syncIfNewer();

    const cfgName = document.getElementById('cfg-name');
    const cfgSubtitle = document.getElementById('cfg-subtitle');
    const cfgSlots = document.getElementById('cfg-slots');
    const cfgSunday = document.getElementById('cfg-sunday');
    const cfgConfirm = document.getElementById('cfg-confirm-reset');

    if (cfgName) appState.config.systemName = cfgName.value.trim() || DEFAULT_CONFIG.systemName;
    if (cfgSubtitle) appState.config.subtitle = cfgSubtitle.value.trim() || DEFAULT_CONFIG.subtitle;
    if (cfgSlots) appState.config.defaultSlots = clamp(cfgSlots.value, 1, 10, 3);
    if (cfgSunday) appState.config.sundayMode = cfgSunday.value === 'manual' ? 'manual' : 'freeze';
    if (cfgConfirm) appState.config.confirmReset = Boolean(cfgConfirm.checked);

    WEEKDAY_KEYS.forEach((weekdayKey) => {
      const field = document.querySelector(`[data-wday="${weekdayKey}"] .js-wday-slot`);
      if (field) {
        appState.config.weekdaySlots[weekdayKey] = clamp(field.value, 0, 10, 0);
      }
    });

    const oldMap = new Map(appState.disciplines.map((discipline) => [discipline.key, discipline]));
    const cards = [...document.querySelectorAll('#disc-editor [data-disc-key]')];
    const nextDisciplines = cards.map((card) => {
      const key = card.dataset.discKey;
      const previous = oldMap.get(key) || {};
      const name = card.querySelector('.js-disc-name')?.value?.trim() || '';
      if (!name) return null;

      const macroCycle = ['A', 'B', 'C', 'D'].includes(card.querySelector('.js-disc-cycle')?.value)
        ? card.querySelector('.js-disc-cycle').value
        : inferCycle(name);

      const colorKey = COLOR_PRESETS[card.querySelector('.js-disc-color')?.value]
        ? card.querySelector('.js-disc-color').value
        : inferColorByCycle(macroCycle);

      return {
        key,
        name,
        weight: clamp(card.querySelector('.js-disc-weight')?.value, 1, 11, 1),
        macroCycle,
        colorKey,
        crossExamRelevance: previous.crossExamRelevance || 'medium',
        dependencies: Array.isArray(previous.dependencies) ? previous.dependencies : [],
      };
    }).filter(Boolean);

    appState.disciplines = nextDisciplines.length ? nextDisciplines : makeDefaultDisciplines();

    rebuildCurrentDayAfterSettings();
    persist();
    closeModal('settings-modal');
    render();
  }

  function rebuildCurrentDayAfterSettings() {
  const dateKey = appState.today?.dateKey || isoDate();
  const weekdayKey = wkFromDateKey(dateKey);

  if (isSunday(weekdayKey)) {
    appState.today = buildSundayDay(dateKey, appState);
    return;
  }

  const slots = getDaySlots(appState.config, weekdayKey);

  const normalizedItems = (appState.today.packageItems || [])
    .map((item) => {
      const normalized = normPkgItem(item, appState.disciplines);
      if (!normalized || normalized.type !== 'discipline') return null;

      return {
        ...normalized,
        reservedDate: dateKey,
      };
    })
    .filter(Boolean);

  const preserved = [
    ...normalizedItems.filter((item) => !item.completed),
    ...normalizedItems.filter((item) => item.completed),
  ].slice(0, slots);

  const simulatedDay = buildActiveDayDraft(dateKey, preserved, appState);

  const finalItems = [];
  const seen = new Set();

  for (const item of simulatedDay.packageItems || []) {
    if (item.type !== 'discipline') continue;
    if (seen.has(item.disciplineKey)) continue;
    if (finalItems.length >= slots) break;

    seen.add(item.disciplineKey);
    finalItems.push(item);
  }

  appState.today = {
    dateKey,
    weekdayKey,
    packageItems: finalItems,
    closedVisual: dayIsFullyCompleted({ packageItems: finalItems }),
    sundayModeActive: false,
    seedCycle: simulatedDay.seedCycle || appState.today.seedCycle || appState.cycleState.lastBaseCycle || null,
    sundaySuggestion: null,
  };

  recordDayBuild(appState, appState.today);
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
    ['reset-modal', 'history-modal', 'settings-modal'].forEach(closeModal);
    render();
  }

  function forceRollover() {
    syncIfNewer();
    const targetDate = addDays(appState.today.dateKey, 1);

    if (dayIsFullyCompleted(appState.today)) {
      appState.stats.closedDays = clamp((appState.stats.closedDays || 0) + 1, 0, 1000000000, 0);
      appState.history.push({
        uid: uid(),
        type: 'dayClose',
        discKey: null,
        name: `Dia fechado — ${fmtDate(appState.today.dateKey)}`,
        macroCycle: appState.today.seedCycle || 'DAY',
        colorKey: 'green',
        dateKey: appState.today.dateKey,
        completedIso: new Date().toISOString(),
        weekdayKey: appState.today.weekdayKey,
        carryOver: false,
        skipped: false,
        dayClose: true,
        meta: {
          completed: doneTodayN(appState.today),
          total: totalDiscN(appState.today),
        },
      });
    }

    appState.today = composeNextDay(targetDate, deepClone(appState.today), appState);
    persist();
    render();
  }

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  function render() {
    renderHeader();
    renderStats();
    renderFocus();
    renderCalendar();

    const historyModal = document.getElementById('history-modal');
    const settingsModal = document.getElementById('settings-modal');
    if (historyModal?.classList.contains('show')) renderHistory();
    if (settingsModal?.classList.contains('show')) populateSettings();
  }

  function renderHeader() {
    const signatureText = document.querySelector('.sig-text');
    const signature = document.querySelector('.vh-signature');

    if (signatureText) signatureText.textContent = appState.config.systemName;
    else if (signature) signature.textContent = appState.config.systemName;

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
        ? `${(appState.carryBuffer || []).filter((item) => item.type === 'discipline').length} PENDÊNCIAS PRESERVADAS`
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
    const pctEl = document.getElementById('pkg-pct');
    const fillEl = document.getElementById('pkg-fill');
    const stateEl = document.getElementById('fc-state');

    const total = totalDiscN(appState.today);
    const done = doneTodayN(appState.today);
    const pct = total ? Math.round((done / total) * 100) : 0;

    if (pctEl) pctEl.textContent = `${done} / ${total}`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    if (stateEl) {
      if (appState.today.sundayModeActive) {
        stateEl.textContent = appState.today.sundaySuggestion?.note || 'Domingo ativo de consolidação.';
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

    const items = appState.today.packageItems || [];
    const isSun = appState.today.sundayModeActive;

    if (!items.length) {
      grid.innerHTML = '<div class="empty-box">Nenhuma disciplina projetada para hoje.</div>';
      if (queueNote) {
        queueNote.textContent = '';
        queueNote.classList.add('is-hidden');
      }
      if (directive) directive.textContent = 'Sem carga projetada para este dia.';
      return;
    }

    grid.innerHTML = items.map((item, index) => {
      const classes = [
        'package-item',
        item.completed ? 'completed' : '',
        !item.completed && index === 0 ? 'current' : '',
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
        <div class="${classes}">
          <div class="package-main">
            <div class="package-eyebrow">${item.type === 'special' ? 'DIA ESPECIAL' : 'DISCIPLINA'}</div>
            <h3 class="package-title">${esc(item.name)}</h3>
            ${subtext ? `<p class="package-sub">${esc(subtext)}</p>` : ''}
            <div class="package-tags">
              ${tags.map((tag) => `<span class="mini-chip">${esc(tag)}</span>`).join('')}
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

    grid.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', handlePkgAction);
    });

    if (queueNote) {
      queueNote.classList.remove('is-hidden');
      queueNote.textContent = isSun
        ? 'Domingo é fase ativa de consolidação. A fila teórica não avança sozinha.'
        : 'A conclusão manual é o único motor real de avanço da fila.';
    }

    if (directive) {
      if (isSun) {
        directive.textContent = appState.today.sundaySuggestion?.note
          || 'Domingo sem teoria nova por padrão. Revisão, questões, redação, flashcards ou organização.';
      } else if (pendingN(appState.today) === 0) {
        directive.textContent = 'Rotação limpa. O próximo avanço pode seguir sem pendência herdada.';
      } else {
        directive.textContent = `${pendingN(appState.today)} disciplina(s) permanecem pendentes e entram primeiro na composição seguinte.`;
      }
    }
  }

  function renderCalendar() {
    const box = document.getElementById('calendar-grid');
    if (!box) return;

    const days = buildCalendarPreview(9);

    box.innerHTML = days.map((day, index) => {
      const disciplines = todayDiscs(day);
      const pending = pendingN(day);

      const kicker = day.isToday
        ? 'HOJE'
        : index === 1
          ? 'AMANHÃ'
          : day.sundayModeActive
            ? 'DOM'
            : 'PROJEÇÃO';

      const stateClass = [
        'calendar-card',
        day.isToday ? 'today' : '',
        index === 1 && !day.isToday ? 'tomorrow' : '',
        day.sundayModeActive ? 'sunday' : '',
        !day.isToday && index !== 1 && !day.sundayModeActive ? 'projected' : '',
      ].filter(Boolean).join(' ');

      const loadLabel = day.sundayModeActive ? 'D' : `${disciplines.length} DISC`;

      const discList = day.sundayModeActive
        ? `
          <div class="calendar-disc-list">
            <div class="calendar-disc">FASE DE CONSOLIDAÇÃO</div>
            <div class="calendar-disc">${esc(day.sundaySuggestion?.label || 'ATIVO')}</div>
            <div class="calendar-disc">${esc(day.sundaySuggestion?.note || 'Bloco ativo sem teoria nova por padrão')}</div>
          </div>
        `
        : disciplines.length
          ? `
            <div class="calendar-disc-list">
              ${disciplines.map((discipline) => `<div class="calendar-disc">${esc(discipline.name)}${discipline.carryOver ? ' • herdada' : ''}</div>`).join('')}
            </div>
          `
          : `
            <div class="calendar-disc-list">
              <div class="calendar-disc">Sem disciplinas projetadas</div>
            </div>
          `;

      const note = day.sundayModeActive
  ? 'Sugestão de consolidação. Não é imposição automática.'
  : day.isToday
    ? (
        pending > 0
          ? `${pending} pendência(s) real(is) em aberto hoje.`
          : 'Sem pendências reais em aberto hoje.'
      )
    : (
        disciplines.length > 0
          ? `${disciplines.length} disciplina(s) prevista(s) para este dia.`
          : 'Sem disciplinas previstas para este dia.'
      );

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
      box.innerHTML = '<div class="history-empty">Nenhum registro ainda. Cada conclusão real alimenta o histórico.</div>';
      return;
    }

    const recent = [...appState.history].reverse().slice(0, 60);

    box.innerHTML = recent.map((entry, index) => {
      const preset = getPreset(entry.colorKey);
      const desc = entry.dayClose
        ? `Fechamento visual · ${entry.meta?.completed ?? 0}/${entry.meta?.total ?? 0} concluídas`
        : `${entry.carryOver ? 'Herdada · ' : ''}${WEEKDAY_LABELS[entry.weekdayKey] || '—'}`;

      return `
        <div class="history-item">
          <div class="history-index" style="border:1px solid ${preset.soft};color:${preset.hex}">
            ${String(index + 1).padStart(2, '0')}
          </div>
          <div class="history-main">
            <strong>${esc(entry.name)}</strong>
            <div class="history-disc">${esc(desc)}</div>
          </div>
          <div class="history-date">${fmtDateTime(entry.completedIso)}</div>
        </div>
      `;
    }).join('');
  }

  function populateSettings() {
    const cfgName = document.getElementById('cfg-name');
    const cfgSubtitle = document.getElementById('cfg-subtitle');
    const cfgSlots = document.getElementById('cfg-slots');
    const cfgSunday = document.getElementById('cfg-sunday');
    const cfgConfirm = document.getElementById('cfg-confirm-reset');

    if (cfgName) cfgName.value = appState.config.systemName;
    if (cfgSubtitle) cfgSubtitle.value = appState.config.subtitle;
    if (cfgSlots) cfgSlots.value = appState.config.defaultSlots;
    if (cfgSunday) cfgSunday.value = appState.config.sundayMode;
    if (cfgConfirm) cfgConfirm.checked = Boolean(appState.config.confirmReset);

    const weekdayBox = document.getElementById('wday-slots');
    if (weekdayBox) {
      weekdayBox.innerHTML = WEEKDAY_KEYS.map((weekdayKey) => `
        <div class="disc-editor-card" data-wday="${weekdayKey}">
          <div class="inline-grid" style="grid-template-columns:1fr .55fr;">
            <div class="form-col">
              <label>${WEEKDAY_LABELS[weekdayKey]}</label>
              <input class="field js-wday-slot" type="number" min="0" max="10" value="${appState.config.weekdaySlots?.[weekdayKey] ?? 0}" />
            </div>
            <div class="form-col">
              <label>Status</label>
              <input class="field" value="${weekdayKey === 'sunday' ? 'Consolidação' : 'Ativo'}" disabled />
            </div>
          </div>
        </div>
      `).join('');
    }

    const newDiscColor = document.getElementById('new-disc-color');
    if (newDiscColor) {
      newDiscColor.innerHTML = Object.entries(COLOR_PRESETS)
        .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
        .join('');
    }

    renderDiscEditor();
  }

  function renderDiscEditor() {
    const box = document.getElementById('disc-editor');
    if (!box) return;

    box.innerHTML = appState.disciplines.map((discipline) => `
      <div class="disc-editor-card" data-disc-key="${discipline.key}">
        <div class="inline-grid" style="grid-template-columns:1.6fr .55fr .6fr .8fr auto;">
          <div class="form-col">
            <label>Nome</label>
            <input class="field js-disc-name" type="text" maxlength="60" value="${esc(discipline.name)}" />
          </div>
          <div class="form-col">
            <label>Peso</label>
            <input class="field js-disc-weight" type="number" min="1" max="11" value="${discipline.weight}" />
          </div>
          <div class="form-col">
            <label>Ciclo</label>
            <select class="select js-disc-cycle">
              <option value="A" ${discipline.macroCycle === 'A' ? 'selected' : ''}>A</option>
              <option value="B" ${discipline.macroCycle === 'B' ? 'selected' : ''}>B</option>
              <option value="C" ${discipline.macroCycle === 'C' ? 'selected' : ''}>C</option>
              <option value="D" ${discipline.macroCycle === 'D' ? 'selected' : ''}>D</option>
            </select>
          </div>
          <div class="form-col">
            <label>Cor</label>
            <select class="select js-disc-color">
              ${Object.entries(COLOR_PRESETS)
                .map(([key, preset]) => `<option value="${key}" ${discipline.colorKey === key ? 'selected' : ''}>${preset.label}</option>`)
                .join('')}
            </select>
          </div>
          <button class="btn-danger js-remove-disc" type="button" style="height:42px;padding:0 12px;margin-top:22px;">×</button>
        </div>
      </div>
    `).join('');

    box.querySelectorAll('.js-remove-disc').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-disc-key]');
        if (!card) return;
        const key = card.dataset.discKey;
        appState.disciplines = appState.disciplines.filter((discipline) => discipline.key !== key);
        if (!appState.disciplines.length) appState.disciplines = makeDefaultDisciplines();
        rebuildCurrentDayAfterSettings();
        persist();
        renderDiscEditor();
        render();
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

    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => closeModal(button.dataset.close));
    });

    document.querySelectorAll('.modal').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal.id);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        ['history-modal', 'settings-modal', 'reset-modal'].forEach(closeModal);
      }
    });

    window.addEventListener('storage', () => {
      syncIfNewer();
      render();
    });
  }

  async function init() {
    catalog = await loadCatalog();
    appState = normalizeState(Store.load());
    reconcileToday();
    persist();
    bind();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
