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
    addMemo: false,
    order: 100,
    position: 0,
    disable: false,
    ignoreBudget: false,
    excludeRecursion: false,
    preventRecursion: false,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    delayUntilRecursion: 0,
    probability: 100,
    useProbability: true,
    depth: 4,
    outletName: '',
    group: '',
    groupOverride: false,
    groupWeight: 100,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: 0,
    sticky: null,
    cooldown: null,
    delay: null,
    triggers: [],
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

  function deleteEntries(data, entryIds) {
    const selected = new Set((Array.isArray(entryIds) ? entryIds : []).map(String));
    const records = getEntryRecords(data).filter(record => selected.has(String(record.id)));
    if (Array.isArray(data?.entries)) {
      records.sort((left, right) => Number(right.storageKey) - Number(left.storageKey));
    }
    let deleted = 0;
    for (const record of records) {
      if (deleteEntry(data, record.storageKey)) deleted++;
    }
    return deleted;
  }

  function setEntriesDisabled(data, entryIds, disabled) {
    const selected = new Set((Array.isArray(entryIds) ? entryIds : []).map(String));
    let changed = 0;
    for (const record of getEntryRecords(data)) {
      if (!selected.has(String(record.id))) continue;
      const next = Boolean(disabled);
      if (Boolean(record.entry.disable) === next) continue;
      record.entry.disable = next;
      changed++;
    }
    return changed;
  }

  function findEntryMatches(data, query, options = {}) {
    const needle = String(query || '');
    if (!needle) return [];
    const fields = normalizeBatchFields(options.fields);
    const caseSensitive = Boolean(options.caseSensitive);
    const matches = [];

    for (const record of getEntryRecords(data)) {
      const details = [];
      for (const field of batchFieldValues(record.entry, fields)) {
        const count = countLiteralMatches(field.value, needle, caseSensitive);
        if (count) details.push({ field: field.group, key: field.key, count });
      }
      if (!details.length) continue;
      matches.push({
        id: String(record.id),
        storageKey: record.storageKey,
        title: entryTitle(record.entry),
        count: details.reduce((sum, detail) => sum + detail.count, 0),
        details,
      });
    }
    return matches;
  }

  function replaceEntryMatches(data, query, replacement, options = {}) {
    const needle = String(query || '');
    if (!needle) return { entriesChanged: 0, replacements: 0 };
    const fields = normalizeBatchFields(options.fields);
    const caseSensitive = Boolean(options.caseSensitive);
    let entriesChanged = 0;
    let replacements = 0;

    for (const record of getEntryRecords(data)) {
      let changed = false;
      for (const field of batchFieldValues(record.entry, fields)) {
        const result = replaceLiteralMatches(field.value, needle, replacement, caseSensitive);
        if (!result.count) continue;
        field.assign(result.value);
        replacements += result.count;
        changed = true;
      }
      if (changed) {
        for (const key of ['key', 'keysecondary']) {
          if (Array.isArray(record.entry?.[key])) {
            record.entry[key] = record.entry[key].map(item => String(item).trim()).filter(Boolean);
          }
        }
        entriesChanged++;
      }
    }
    return { entriesChanged, replacements };
  }

  function normalizeBatchFields(fields) {
    const values = Array.isArray(fields) && fields.length ? fields : ['title', 'keywords', 'content'];
    return new Set(values.filter(value => ['title', 'keywords', 'content'].includes(value)));
  }

  function batchFieldValues(entry, fields) {
    const values = [];
    if (fields.has('title')) {
      for (const key of ['comment', 'name']) {
        if (!Object.prototype.hasOwnProperty.call(entry || {}, key)) continue;
        values.push({
          group: 'title',
          key,
          value: String(entry[key] ?? ''),
          assign: value => { entry[key] = value; },
        });
      }
    }
    if (fields.has('keywords')) {
      for (const key of ['key', 'keysecondary']) {
        if (Array.isArray(entry?.[key])) {
          entry[key].forEach((item, index) => values.push({
            group: 'keywords',
            key,
            value: String(item ?? ''),
            assign: value => { entry[key][index] = value; },
          }));
        } else if (entry && Object.prototype.hasOwnProperty.call(entry, key)) {
          values.push({
            group: 'keywords',
            key,
            value: String(entry[key] ?? ''),
            assign: value => { entry[key] = value; },
          });
        }
      }
    }
    if (fields.has('content')) {
      values.push({
        group: 'content',
        key: 'content',
        value: String(entry?.content ?? ''),
        assign: value => { entry.content = value; },
      });
    }
    return values;
  }

  function countLiteralMatches(value, query, caseSensitive) {
    const source = caseSensitive ? String(value) : String(value).toLocaleLowerCase();
    const needle = caseSensitive ? String(query) : String(query).toLocaleLowerCase();
    if (!needle) return 0;
    let count = 0;
    let index = 0;
    while ((index = source.indexOf(needle, index)) >= 0) {
      count++;
      index += needle.length;
    }
    return count;
  }

  function replaceLiteralMatches(value, query, replacement, caseSensitive) {
    const input = String(value);
    const needle = String(query);
    const count = countLiteralMatches(input, needle, caseSensitive);
    if (!count) return { value: input, count: 0 };
    const expression = new RegExp(escapeRegex(needle), caseSensitive ? 'g' : 'gi');
    return { value: input.replace(expression, () => String(replacement ?? '')), count };
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    return 'normal';
  }

  function applyEntryStrategy(entry, strategy) {
    if (!entry || typeof entry !== 'object') return;
    entry.constant = strategy === 'constant';
    entry.vectorized = strategy === 'vectorized';
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

  function createUndoManager(limit = 80) {
    const maxSteps = Math.max(1, Math.floor(numberValue(limit, 80)));
    const undoStack = [];
    const redoStack = [];

    function push(stack, entry) {
      stack.push(entry);
      if (stack.length > maxSteps) stack.shift();
    }

    function entry(state, label) {
      return {
        label: String(label || 'Edit'),
        state: deepClone(state),
      };
    }

    function status() {
      return {
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undoCount: undoStack.length,
        redoCount: redoStack.length,
        undoLabel: undoStack.at(-1)?.label || '',
        redoLabel: redoStack.at(-1)?.label || '',
      };
    }

    return {
      capture(state, label) {
        push(undoStack, entry(state, label));
        redoStack.length = 0;
        return status();
      },
      undo(currentState) {
        if (!undoStack.length) return null;
        const previous = undoStack.pop();
        push(redoStack, entry(currentState, previous.label));
        return { label: previous.label, state: deepClone(previous.state), status: status() };
      },
      redo(currentState) {
        if (!redoStack.length) return null;
        const next = redoStack.pop();
        push(undoStack, entry(currentState, next.label));
        return { label: next.label, state: deepClone(next.state), status: status() };
      },
      reset() {
        undoStack.length = 0;
        redoStack.length = 0;
        return status();
      },
      status,
    };
  }

  function deepClone(value) {
    if (value === undefined) return undefined;
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
    deleteEntries,
    setEntriesDisabled,
    findEntryMatches,
    replaceEntryMatches,
    entryStrategy,
    applyEntryStrategy,
    applyEntryPosition,
    positionLabel,
    parseListText,
    formatList,
    estimateTokens,
    entryTitle,
    previewLocalId,
    createUndoManager,
  };
}));
