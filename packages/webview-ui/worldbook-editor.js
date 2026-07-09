(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.WorldbookEditor = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_ENTRY = Object.freeze({
    key: [],
    keysecondary: [],
    comment: 'New Entry',
    content: '',
    constant: false,
    vectorized: false,
    selective: true,
    selectiveLogic: 0,
    order: 100,
    position: 0,
    disable: false,
    probability: 100,
    useProbability: true,
    depth: 4,
  });

  const POSITION_LABELS = Object.freeze({
    0: 'Before Character',
    1: 'After Character',
    2: 'Top of Author Note',
    3: 'Bottom of Author Note',
    4: 'At Depth',
    5: 'Before Example Messages',
    6: 'After Example Messages',
    7: 'Outlet',
  });

  function parseWorldbookText(text) {
    let data;
    try {
      data = JSON.parse(String(text || ''));
    } catch (error) {
      throw new Error(`Worldbook contains invalid JSON: ${error.message}`);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Worldbook JSON must be an object.');
    }
    if (!data.entries || typeof data.entries !== 'object') {
      throw new Error('Worldbook JSON must contain an entries object or array.');
    }
    return data;
  }

  function serializeWorldbook(data) {
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  function getEntryRecords(data) {
    const entries = data?.entries;
    if (!entries || typeof entries !== 'object') return [];
    if (Array.isArray(entries)) {
      return entries.map((entry, index) => ({
        id: String(entry?.uid ?? entry?.id ?? index),
        storageKey: index,
        entry,
      }));
    }
    return Object.entries(entries).map(([key, entry]) => ({
      id: String(key),
      storageKey: key,
      entry,
    }));
  }

  function createEntry(data, template) {
    const id = nextEntryId(data);
    const entry = template ? deepClone(template) : deepClone(DEFAULT_ENTRY);
    entry.uid = id;
    if (Object.prototype.hasOwnProperty.call(entry, 'id')) entry.id = id;
    if (template) entry.comment = `${entryTitle(template)} Copy`;

    if (Array.isArray(data.entries)) {
      data.entries.push(entry);
    } else {
      data.entries[String(id)] = entry;
    }
    return getEntryRecords(data).find(record => record.entry === entry) || null;
  }

  function deleteEntry(data, storageKey) {
    if (Array.isArray(data?.entries)) {
      const index = Number(storageKey);
      if (!Number.isInteger(index) || index < 0 || index >= data.entries.length) return false;
      data.entries.splice(index, 1);
      return true;
    }
    if (!data?.entries || !Object.prototype.hasOwnProperty.call(data.entries, storageKey)) return false;
    delete data.entries[storageKey];
    return true;
  }

  function nextEntryId(data) {
    const ids = getEntryRecords(data).flatMap(record => {
      const values = [record.id, record.entry?.uid, record.entry?.id]
        .map(Number)
        .filter(Number.isFinite);
      return values;
    });
    return (ids.length ? Math.max(...ids) : -1) + 1;
  }

  function entryStrategy(entry) {
    if (entry?.vectorized) return 'vectorized';
    if (entry?.constant) return 'constant';
    if (entry?.selective !== false) return 'selective';
    return 'normal';
  }

  function applyEntryStrategy(entry, strategy) {
    if (!entry || typeof entry !== 'object') return;
    entry.constant = strategy === 'constant';
    entry.vectorized = strategy === 'vectorized';
    entry.selective = strategy === 'selective';
  }

  function applyEntryPosition(entry, position) {
    if (!entry || typeof entry !== 'object') return;
    const value = Number(position);
    entry.position = Number.isFinite(value) ? value : 0;
    if (entry.position === 4) {
      const role = Number(entry.role);
      entry.role = Number.isFinite(role) && role >= 0 && role <= 2 ? role : 0;
    } else {
      delete entry.role;
    }
  }

  function positionLabel(position, role, depth) {
    const value = Number(position);
    if (value === 4) {
      const roleName = ['System', 'User', 'Assistant'][Number(role)] || 'System';
      return `${roleName} @ Depth ${numberValue(depth, 4)}`;
    }
    return POSITION_LABELS[value] || `Position ${value}`;
  }

  function parseListText(value) {
    return String(value || '').split(/[\n,]/).map(item => item.trim()).filter(Boolean);
  }

  function formatList(value) {
    if (!Array.isArray(value)) return value === undefined || value === null ? '' : String(value);
    return value.join(', ');
  }

  function estimateTokens(text, profile = 'estimate') {
    const value = String(text || '');
    if (!value) return 0;
    let cjk = 0;
    let ascii = 0;
    let other = 0;
    for (const char of value) {
      const code = char.codePointAt(0);
      if ((code >= 0x3400 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff)) cjk++;
      else if (code < 0x80) ascii++;
      else other++;
    }
    const normalized = String(profile || 'estimate');
    const divisor = normalized.includes('llama') ? 3.6 : normalized.includes('claude') ? 3.8 : 4;
    return Math.max(1, Math.ceil(cjk + other * 0.8 + ascii / divisor));
  }

  function entryTitle(entry) {
    return String(entry?.comment || entry?.name || entry?.uid || 'Untitled Entry');
  }

  function previewLocalId(fullId) {
    const value = String(fullId || '');
    const separator = value.lastIndexOf(':');
    return separator >= 0 ? value.slice(separator + 1) : value;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function numberValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  return {
    DEFAULT_ENTRY,
    POSITION_LABELS,
    parseWorldbookText,
    serializeWorldbook,
    getEntryRecords,
    createEntry,
    deleteEntry,
    entryStrategy,
    applyEntryStrategy,
    applyEntryPosition,
    positionLabel,
    parseListText,
    formatList,
    estimateTokens,
    entryTitle,
    previewLocalId,
  };
}));
