'use strict';

const crypto = require('crypto');
const path = require('path');
const zlib = require('zlib');

const POSITION = Object.freeze({
  BEFORE_CHAR: 0,
  AFTER_CHAR: 1,
  AN_TOP: 2,
  AN_BOTTOM: 3,
  AT_DEPTH: 4,
  EXAMPLE_TOP: 5,
  EXAMPLE_BOTTOM: 6,
  OUTLET: 7,
});

const ROLE = Object.freeze({
  SYSTEM: 0,
  USER: 1,
  ASSISTANT: 2,
});

const ROLE_NAMES = ['system', 'user', 'assistant'];
const GENERATION_TRIGGERS = Object.freeze(['normal', 'continue', 'impersonate', 'swipe', 'regenerate', 'quiet']);

const WORLD_INFO_INSERTION_STRATEGY = Object.freeze({
  EVENLY: 'evenly',
  CHARACTER_FIRST: 'character-first',
  GLOBAL_FIRST: 'global-first',
});

const SELECTIVE_LOGIC = Object.freeze({
  AND_ANY: 0,
  NOT_ALL: 1,
  NOT_ANY: 2,
  AND_ALL: 3,
});

const ENTRY_DEFAULTS = Object.freeze({
  key: [],
  keysecondary: [],
  comment: '',
  content: '',
  constant: false,
  vectorized: false,
  selective: true,
  selectiveLogic: SELECTIVE_LOGIC.AND_ANY,
  addMemo: false,
  order: 100,
  position: POSITION.BEFORE_CHAR,
  disable: false,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: 0,
  probability: 100,
  useProbability: true,
  depth: 4,
  role: null,
  scanDepth: null,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  outletName: '',
  group: '',
  groupOverride: false,
  groupWeight: 100,
  automationId: '',
  sticky: null,
  cooldown: null,
  delay: null,
  characterFilter: null,
  triggers: [],
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
});

const DEFAULT_SETTINGS = Object.freeze({
  worldInfoDepth: 4,
  minActivations: 0,
  minActivationsDepthMax: 0,
  maxContextTokens: 0,
  budgetPercent: 100,
  budgetCap: 0,
  recursive: true,
  maxRecursionSteps: 2,
  includeNames: false,
  caseSensitive: false,
  matchWholeWords: false,
  useGroupScoring: false,
  alertOnOverflow: false,
  worldInfoInsertionStrategy: WORLD_INFO_INSERTION_STRATEGY.CHARACTER_FIRST,
  tokenizerProfile: 'estimate',
});

const DEFAULT_SCENARIO_VERSION = 1;
const HISTORY_TYPE = 'worldbook-workbench.history';
const HISTORY_VERSION = 1;
const DEFAULT_HISTORY_LIMIT = 200;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parseWorldbookJson(input, options = {}) {
  const data = parseJsonLike(input, 'Worldbook');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Worldbook JSON must be an object.');
  }
  if (!data.entries || typeof data.entries !== 'object') {
    throw new Error('Worldbook JSON must contain an entries object or array.');
  }
  const sourceName = options.sourceName || options.filePath && path.basename(options.filePath, path.extname(options.filePath)) || data.name || data.title || 'worldbook';
  return {
    data,
    sourceName: String(sourceName),
    entriesShape: Array.isArray(data.entries) ? 'array' : 'object',
    records: getEntryRecords(data, String(sourceName), options.sourceType || 'worldbook'),
  };
}

function serializeWorldbookJson(worldbook) {
  const data = isParsedWorldbook(worldbook) ? worldbook.data : worldbook;
  return `${JSON.stringify(data, null, 2)}\n`;
}

function parseScenarioJson(input) {
  const scenario = parseJsonLike(input, 'Scenario');
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    throw new Error('Scenario JSON must be an object.');
  }
  return normalizeScenario(scenario);
}

function createDefaultScenario(worldbookPath = '') {
  return normalizeScenario({
    version: DEFAULT_SCENARIO_VERSION,
    worldbookPath,
    characterCardPath: '',
    includeCharacterBook: true,
    seed: 'worldbook-workbench',
    trigger: 'normal',
    userName: '{{user}}',
    charName: '',
    personaDescription: '',
    characterDepthPrompt: '',
    settings: { ...DEFAULT_SETTINGS },
    messages: [
      { role: 'user', content: '' },
    ],
    forceActivate: [],
  });
}

function normalizeScenario(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const scenario = {
    ...source,
    version: Number(source.version || DEFAULT_SCENARIO_VERSION),
    worldbookPath: cleanText(source.worldbookPath),
    characterCardPath: cleanText(source.characterCardPath),
    includeCharacterBook: source.includeCharacterBook !== false,
    seed: cleanText(source.seed) || 'worldbook-workbench',
    trigger: normalizeGenerationTrigger(source.trigger),
    userName: cleanText(source.userName) || '{{user}}',
    charName: cleanText(source.charName),
    personaDescription: cleanText(source.personaDescription),
    characterDepthPrompt: cleanText(source.characterDepthPrompt),
    settings: normalizeSettings(source.settings),
    messages: normalizeMessages(source.messages),
    forceActivate: normalizeStringArray(source.forceActivate),
    timedState: normalizeTimedState(source.timedState),
  };
  return scenario;
}

function scenarioFilePath(worldbookPath) {
  const parsed = path.parse(worldbookPath || 'worldbook.json');
  return path.join(parsed.dir, `${parsed.name}.wbh.json`);
}

function historyFilePath(worldbookPath) {
  const parsed = path.parse(worldbookPath || 'worldbook.json');
  return path.join(parsed.dir, `${parsed.name}.wbh-history.json`);
}

function createDefaultHistory(worldbookPath = '') {
  return {
    type: HISTORY_TYPE,
    version: HISTORY_VERSION,
    worldbookPath: String(worldbookPath || ''),
    snapshots: [],
    experiments: [],
  };
}

function parseHistoryJson(input, options = {}) {
  const raw = parseJsonLike(input, 'History');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('History JSON must be an object.');
  }
  if (raw.type && raw.type !== HISTORY_TYPE) {
    throw new Error('History JSON has an unsupported type.');
  }

  return {
    ...raw,
    type: HISTORY_TYPE,
    version: Number(raw.version || HISTORY_VERSION),
    worldbookPath: String(options.worldbookPath || raw.worldbookPath || ''),
    snapshots: Array.isArray(raw.snapshots)
      ? raw.snapshots.filter(snapshot => snapshot && typeof snapshot === 'object').map(normalizeHistorySnapshot)
      : [],
    experiments: Array.isArray(raw.experiments)
      ? raw.experiments.filter(experiment => experiment && typeof experiment === 'object').map(normalizeHistoryExperiment)
      : [],
  };
}

function createHistorySnapshot(historyInput, worldbookInput, options = {}) {
  const history = normalizeHistory(historyInput, options.worldbookPath);
  const data = normalizeWorldbookData(worldbookInput);
  const hash = hashWorldbookData(data);
  const skipDuplicate = options.skipDuplicate !== false;
  const latest = history.snapshots[history.snapshots.length - 1];
  if (skipDuplicate && latest?.hash === hash) {
    return { history, snapshot: latest, created: false };
  }

  const createdAt = historyTimestamp(options.now);
  const snapshot = {
    id: String(options.id || createHistoryId('snapshot')),
    label: String(options.label || 'Snapshot'),
    reason: String(options.reason || 'manual'),
    createdAt,
    hash,
    entryCount: getEntryRecords(data).length,
    data: clone(data),
  };
  history.snapshots.push(snapshot);

  const limit = Math.max(1, numberOr(options.limit, DEFAULT_HISTORY_LIMIT));
  if (history.snapshots.length > limit) {
    const protectedIds = new Set(history.experiments.flatMap(experiment => [
      experiment.baselineSnapshotId,
      experiment.afterSnapshotId,
    ]).filter(Boolean));
    while (history.snapshots.length > limit) {
      const removableIndex = history.snapshots.findIndex(item => !protectedIds.has(item.id));
      if (removableIndex < 0) break;
      history.snapshots.splice(removableIndex, 1);
    }
  }

  return { history, snapshot, created: true };
}

function startHistoryExperiment(historyInput, worldbookInput, title = '', options = {}) {
  let history = normalizeHistory(historyInput, options.worldbookPath);
  const openExperiment = history.experiments.find(experiment => experiment.status === 'active');
  if (openExperiment) throw new Error('Finish the active experiment before starting another one.');

  const snapshotResult = createHistorySnapshot(history, worldbookInput, {
    ...options,
    id: options.snapshotId,
    label: options.snapshotLabel || `Baseline: ${title || 'Experiment'}`,
    reason: 'experiment-baseline',
    skipDuplicate: false,
  });
  history = snapshotResult.history;
  const experiment = {
    id: String(options.id || createHistoryId('experiment')),
    title: String(title || 'Experiment'),
    status: 'active',
    createdAt: historyTimestamp(options.now),
    completedAt: '',
    baselineSnapshotId: snapshotResult.snapshot.id,
    afterSnapshotId: '',
  };
  history.experiments.push(experiment);
  return { history, experiment, snapshot: snapshotResult.snapshot };
}

function finishHistoryExperiment(historyInput, experimentId, worldbookInput, options = {}) {
  let history = normalizeHistory(historyInput, options.worldbookPath);
  const experiment = history.experiments.find(item => item.id === String(experimentId || ''));
  if (!experiment) throw new Error('Experiment not found.');
  if (experiment.status !== 'active') throw new Error('Experiment is already finished.');

  const snapshotResult = createHistorySnapshot(history, worldbookInput, {
    ...options,
    id: options.snapshotId,
    label: options.snapshotLabel || `After: ${experiment.title}`,
    reason: 'experiment-after',
    skipDuplicate: false,
  });
  history = snapshotResult.history;
  const nextExperiment = history.experiments.find(item => item.id === experiment.id);
  nextExperiment.status = 'complete';
  nextExperiment.completedAt = historyTimestamp(options.now);
  nextExperiment.afterSnapshotId = snapshotResult.snapshot.id;
  return { history, experiment: nextExperiment, snapshot: snapshotResult.snapshot };
}

function summarizeHistory(historyInput) {
  const history = normalizeHistory(historyInput);
  return {
    type: history.type,
    version: history.version,
    worldbookPath: history.worldbookPath,
    snapshots: history.snapshots.map(({ data, ...snapshot }) => ({ ...snapshot })),
    experiments: history.experiments.map(experiment => ({ ...experiment })),
  };
}

function getHistorySnapshot(historyInput, snapshotId) {
  const history = normalizeHistory(historyInput);
  return history.snapshots.find(snapshot => snapshot.id === String(snapshotId || '')) || null;
}

function copyWorldbookEntries(sourceInput, targetInput, entryIds = []) {
  const sourceData = normalizeWorldbookData(sourceInput);
  const targetData = clone(normalizeWorldbookData(targetInput));
  const selectedIds = new Set((Array.isArray(entryIds) ? entryIds : []).map(String));
  const selected = getEntryRecords(sourceData).filter(record => selectedIds.has(String(record.id)));
  const copied = [];

  for (const record of selected) {
    const id = nextWorldbookEntryId(targetData);
    const entry = clone(record.originalEntry);
    entry.uid = id;
    if (Object.prototype.hasOwnProperty.call(entry, 'id')) entry.id = id;
    if (Array.isArray(targetData.entries)) targetData.entries.push(entry);
    else targetData.entries[String(id)] = entry;
    copied.push({ sourceId: String(record.id), id: String(id) });
  }

  return { data: targetData, copied };
}

function normalizeHistory(historyInput, worldbookPath = '') {
  if (!historyInput) return createDefaultHistory(worldbookPath);
  return parseHistoryJson(historyInput, { worldbookPath: worldbookPath || historyInput.worldbookPath });
}

function normalizeHistorySnapshot(snapshot) {
  const data = snapshot.data && typeof snapshot.data === 'object' ? clone(snapshot.data) : null;
  return {
    ...snapshot,
    id: String(snapshot.id || createHistoryId('snapshot')),
    label: String(snapshot.label || 'Snapshot'),
    reason: String(snapshot.reason || 'manual'),
    createdAt: String(snapshot.createdAt || ''),
    hash: String(snapshot.hash || (data ? hashWorldbookData(data) : '')),
    entryCount: Number.isFinite(Number(snapshot.entryCount))
      ? Number(snapshot.entryCount)
      : data ? getEntryRecords(data).length : 0,
    data,
  };
}

function normalizeHistoryExperiment(experiment) {
  const status = experiment.status === 'complete' ? 'complete' : 'active';
  return {
    ...experiment,
    id: String(experiment.id || createHistoryId('experiment')),
    title: String(experiment.title || 'Experiment'),
    status,
    createdAt: String(experiment.createdAt || ''),
    completedAt: status === 'complete' ? String(experiment.completedAt || '') : '',
    baselineSnapshotId: String(experiment.baselineSnapshotId || ''),
    afterSnapshotId: status === 'complete' ? String(experiment.afterSnapshotId || '') : '',
  };
}

function normalizeWorldbookData(input) {
  return isParsedWorldbook(input) ? parseWorldbookJson(input.data).data : parseWorldbookJson(input).data;
}

function isParsedWorldbook(input) {
  return Boolean(
    input
    && typeof input === 'object'
    && input.data
    && Array.isArray(input.records)
    && (input.entriesShape === 'object' || input.entriesShape === 'array')
  );
}

function hashWorldbookData(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function historyTimestamp(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Invalid history timestamp.');
  return date.toISOString();
}

function createHistoryId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nextWorldbookEntryId(data) {
  const ids = getEntryRecords(data).flatMap(record => [record.id, record.originalEntry?.uid, record.originalEntry?.id])
    .map(Number)
    .filter(Number.isFinite);
  return (ids.length ? Math.max(...ids) : -1) + 1;
}

function parseCharacterCard(input, options = {}) {
  const sourceName = options.sourceName
    || options.filePath && path.basename(options.filePath)
    || input && typeof input === 'object' && !Buffer.isBuffer(input) && input.sourceName
    || 'character';
  let raw = input;
  let pngMetadata = null;

  if (Buffer.isBuffer(input)) {
    if (isPng(input)) {
      pngMetadata = extractPngTextChunks(input);
      raw = decodeCharacterPayloadFromMetadata(pngMetadata);
    } else {
      raw = input.toString('utf8');
    }
  }

  const card = parseCharacterPayload(raw);
  const data = normalizeCharacterCardObject(card, String(sourceName), pngMetadata);
  return data;
}

function compilePromptPreview(input = {}) {
  const scenario = normalizeScenario(input.scenario || {});
  const settings = normalizeSettings({ ...scenario.settings, ...(input.settings || {}) });
  const characterCard = input.characterCard ? parseCharacterCard(input.characterCard) : null;
  const messages = normalizeMessages(input.messages || scenario.messages);
  const forceActivate = new Set(normalizeStringArray(input.forceActivate || scenario.forceActivate));
  const timedState = normalizeTimedState(input.timedState || scenario.timedState);
  const seed = cleanText(input.seed || scenario.seed) || 'worldbook-workbench';
  const warnings = [];
  const sources = collectSources(input, scenario, characterCard, warnings);
  const entries = sources.flatMap(source => source.records);
  const globalScanData = buildGlobalScanData(characterCard, scenario);
  const evaluation = evaluateEntries(entries, messages, globalScanData, settings, {
    seed,
    forceActivate,
    timedState,
    characterCard,
    scenario,
    trigger: globalScanData.trigger,
  });
  const evaluatedActivated = annotateTokenUsage(evaluation.activated, settings, scenario, characterCard);
  const evaluatedSkipped = annotateTokenUsage(evaluation.skipped, settings, scenario, characterCard);
  const budget = applyBudget(evaluatedActivated, settings);
  const activated = budget.activated;
  const skipped = [...evaluatedSkipped, ...budget.skipped];
  const buckets = bucketActivatedEntries(activated, scenario, characterCard);
  const timeline = buildTimeline(buckets, messages, characterCard, scenario, settings);
  const tokenizer = tokenizerInfo(settings.tokenizerProfile);
  const worldInfoTokens = activated.reduce((sum, item) => sum + item.tokens, 0);
  const allEntriesTokens = worldInfoTokens + skipped.reduce((sum, item) => sum + item.tokens, 0);
  const timelineTokens = timeline.reduce((sum, item) => sum + countTokens(item.content, settings.tokenizerProfile).count, 0);

  return {
    scenario,
    settings,
    tokenizer,
    activationScanDepth: evaluation.scanDepth,
    sources: sources.map(source => ({
      name: source.name,
      type: source.type,
      entryCount: source.records.length,
    })),
    timeline,
    activatedEntries: activated.map(toActivatedSummary),
    skippedEntries: skipped.map(toSkippedSummary),
    buckets: summarizeBuckets(buckets),
    tokenUsage: {
      profile: tokenizer.profile,
      accuracy: tokenizer.accuracy,
      allEntriesTokens,
      worldInfoTokens,
      timelineTokens,
    },
    tokenBudget: {
      limit: budget.limit,
      used: budget.used,
      overflowed: budget.overflowed,
    },
    warnings: [
      ...warnings,
      ...budget.warnings,
      ...runtimeWarnings(activated),
    ],
  };
}

function collectSources(input, scenario, characterCard, warnings) {
  const out = [];
  const worldbooks = Array.isArray(input.worldbooks) ? input.worldbooks : [];
  for (const item of worldbooks) {
    if (!item || item.enabled === false) continue;
    try {
      const parsed = item.records ? item : parseWorldbookJson(item.data || item, {
        sourceName: item.name,
        sourceType: 'worldbook',
        filePath: item.path,
      });
      out.push({
        name: parsed.sourceName || item.name || 'worldbook',
        type: 'worldbook',
        records: parsed.records || [],
      });
    } catch (error) {
      warnings.push({ code: 'worldbook_parse_failed', message: error.message });
    }
  }

  const embeddedBook = characterCard && characterCard.characterBook;
  if (embeddedBook && scenario.includeCharacterBook !== false) {
    try {
      const parsed = parseWorldbookJson(embeddedBook, {
        sourceName: `${characterCard.name || 'character'} character book`,
        sourceType: 'character-book',
      });
      out.push({
        name: parsed.sourceName,
        type: 'character-book',
        records: parsed.records,
      });
    } catch (error) {
      warnings.push({ code: 'character_book_parse_failed', message: error.message });
    }
  }

  return out;
}

function evaluateEntries(records, messages, globalScanData, settings, options) {
  const activated = new Map();
  const skipped = new Map();
  const recursionBuffer = [];
  const sorted = sortRecordsForInsertionStrategy(records, settings.worldInfoInsertionStrategy);
  const recursionDelayLevels = [...new Set(sorted
    .map(record => normalizeRecursionDelay(record.entry.delayUntilRecursion))
    .filter(level => level > 0))].sort((left, right) => left - right);
  let recursionLevel = recursionDelayLevels[0] || 0;
  const configuredMaxSteps = Math.max(0, numberOr(settings.maxRecursionSteps, 0));
  const maxPasses = settings.recursive
    ? configuredMaxSteps || Math.max(1, sorted.length + recursionDelayLevels.length + 1)
    : 1;
  const minActivations = configuredMaxSteps > 0 ? 0 : Math.max(0, numberOr(settings.minActivations, 0));
  const initialScanDepth = Math.max(0, numberOr(settings.worldInfoDepth, 0));
  const configuredDepthMax = Math.max(0, numberOr(settings.minActivationsDepthMax, 0));
  const availableDepth = messages.length;
  const minActivationDepthLimit = configuredDepthMax > 0
    ? Math.min(configuredDepthMax, availableDepth)
    : availableDepth;
  const maxScanDepth = minActivations > 0
    ? Math.max(initialScanDepth, minActivationDepthLimit)
    : initialScanDepth;
  let scanDepth = initialScanDepth;
  let passIndex = 0;

  while (true) {
    const scanSettings = { ...settings, worldInfoDepth: scanDepth };
    for (let pass = 0; pass < maxPasses; pass++, passIndex++) {
      const recursivePass = pass > 0;
      const minimumActivationPass = scanDepth > initialScanDepth && !recursivePass;
      const candidates = [];
      for (const record of sorted) {
        if (activated.has(record.fullId)) continue;
        const result = evaluateEntry(record, messages, globalScanData, scanSettings, {
          ...options,
          recursionBuffer: minimumActivationPass ? [] : recursionBuffer,
          recursivePass,
          recursionLevel,
        });
        if (result.active) {
          candidates.push(result);
        } else {
          skipped.set(record.fullId, result);
        }
      }

      const grouped = applyGrouping(candidates, scanSettings, {
        seed: options.seed,
        pass: passIndex,
        activated: [...activated.values()],
      });
      for (const loser of grouped.skipped) skipped.set(loser.record.fullId, loser);

      const probabilityPassed = [];
      for (const item of grouped.activated) {
        const result = applyProbability(item, options.seed);
        if (result.active) {
          probabilityPassed.push(result);
        } else {
          skipped.set(result.record.fullId, result);
        }
      }

      const newlyActivated = probabilityPassed.filter(item => !activated.has(item.record.fullId));
      for (const item of newlyActivated) {
        activated.set(item.record.fullId, item);
        skipped.delete(item.record.fullId);
      }

      if (!settings.recursive || !newlyActivated.length) break;

      const recursiveContent = newlyActivated
        .filter(item => !item.record.entry.preventRecursion)
        .map(item => expandMacros(item.record.entry.content, options.characterCard, options.scenario || options))
        .filter(Boolean);
      if (!recursiveContent.length) break;
      recursionBuffer.push(...recursiveContent);
      recursionLevel = recursionDelayLevels[Math.min(pass, recursionDelayLevels.length - 1)] || recursionLevel;
    }

    if (!minActivations || activated.size >= minActivations || scanDepth >= maxScanDepth) break;
    scanDepth += 1;
  }

  return {
    activated: [...activated.values()].sort((left, right) => promptOrderSort(left.record, right.record)),
    skipped: [...skipped.values()].filter(item => !activated.has(item.record.fullId)),
    scanDepth,
  };
}

function sortRecordsForInsertionStrategy(records, strategy) {
  const normalized = normalizeWorldInfoInsertionStrategy(strategy);
  if (normalized === WORLD_INFO_INSERTION_STRATEGY.EVENLY) {
    return [...records].sort(promptOrderSort);
  }
  const characterLore = records.filter(record => record.sourceType === 'character-book').sort(promptOrderSort);
  const globalLore = records.filter(record => record.sourceType !== 'character-book').sort(promptOrderSort);
  return normalized === WORLD_INFO_INSERTION_STRATEGY.GLOBAL_FIRST
    ? [...globalLore, ...characterLore]
    : [...characterLore, ...globalLore];
}

function evaluateEntry(record, messages, globalScanData, settings, options) {
  const entry = record.entry;
  const reasons = [];
  const matchedKeys = [];

  if (entry.disable && !options.forceActivate.has(record.fullId) && !options.forceActivate.has(String(record.id))) {
    return inactive(record, 'disabled', 'Entry is disabled.');
  }
  if (entry.triggers.length && !entry.triggers.includes(options.trigger)) {
    return inactive(record, 'generation_trigger', `Entry does not run for the "${options.trigger}" generation trigger.`);
  }
  if (!characterFilterMatches(entry, options.characterCard)) {
    return inactive(record, 'character_filter', 'Character filter does not match.');
  }

  const isSticky = timedStateHas(options.timedState?.sticky, record);
  if (entry.delay && messages.length < Number(entry.delay)) {
    return inactive(record, 'delay', `Entry is delayed until chat message ${Number(entry.delay)}.`);
  }
  if (timedStateHas(options.timedState?.cooldown, record) && !isSticky) {
    return inactive(record, 'cooldown', 'Entry is on cooldown in the preview scenario.');
  }
  const recursionDelay = normalizeRecursionDelay(entry.delayUntilRecursion);
  if (recursionDelay && !options.recursivePass && !isSticky) {
    return inactive(record, 'delay_until_recursion', 'Entry waits for a recursive scan.');
  }
  if (recursionDelay && options.recursivePass && recursionDelay > options.recursionLevel && !isSticky) {
    return inactive(record, 'recursion_delay_level', `Entry waits for recursion level ${recursionDelay}.`);
  }
  if (options.recursivePass && entry.excludeRecursion && !isSticky) {
    return inactive(record, 'exclude_recursion', 'Entry is excluded from recursive activation.');
  }
  if (isSticky) {
    return active(record, 'sticky', reasons, matchedKeys, 150);
  }
  if (options.forceActivate.has(record.fullId) || options.forceActivate.has(String(record.id))) {
    return active(record, 'force', reasons, matchedKeys, 999);
  }
  if (entry.constant) {
    return active(record, 'constant', reasons, matchedKeys, 100);
  }
  if (!entry.key.length) {
    return inactive(record, 'no_primary_keys', 'Entry has no primary keys and is not constant.');
  }

  const scanText = buildScanText(messages, globalScanData, settings, entry, options.recursionBuffer);
  const primaryMatches = entry.key.filter(key => matchKey(scanText, key, entry, settings));
  for (const key of primaryMatches) matchedKeys.push({ type: 'primary', key });
  if (!primaryMatches.length) {
    return inactive(record, 'primary_keys_not_found', 'No primary key matched.');
  }

  const secondaryMatches = entry.keysecondary.filter(key => matchKey(scanText, key, entry, settings));
  for (const key of secondaryMatches) matchedKeys.push({ type: 'secondary', key });
  const secondaryOk = secondaryLogicMatches(entry, secondaryMatches.length);
  if (!secondaryOk) {
    return inactive(record, 'secondary_logic_failed', 'Secondary key logic did not pass.', matchedKeys);
  }

  const score = primaryMatches.length + secondaryMatches.length;
  return active(record, 'keys', reasons, matchedKeys, score);
}

function applyProbability(item, seed) {
  const entry = item.record.entry;
  const probability = Number(entry.probability ?? 100);
  if (item.trigger === 'sticky' || item.trigger === 'force' || entry.useProbability === false || probability >= 100) {
    return item;
  }
  const roll = seededPercent(`${seed}:${item.record.fullId}`);
  if (roll >= probability) {
    return inactive(
      item.record,
      'probability_failed',
      `Deterministic probability roll ${roll.toFixed(2)} >= ${probability}.`,
      item.matchedKeys,
    );
  }
  return {
    ...item,
    reasons: [...item.reasons, `probability:${roll.toFixed(2)}`],
  };
}

function active(record, trigger, reasons, matchedKeys, score) {
  return {
    active: true,
    record,
    trigger,
    reasons: [trigger, ...reasons],
    matchedKeys,
    score,
    tokens: countTokens(record.entry.content).count,
  };
}

function inactive(record, reason, message, matchedKeys = []) {
  return {
    active: false,
    record,
    reason,
    message,
    matchedKeys,
  };
}

function applyGrouping(activeItems, settings, options = {}) {
  const remaining = new Set(activeItems);
  const skipped = new Map();
  const groupNames = [...new Set(activeItems.flatMap(item => entryGroups(item.record.entry)))];
  const activatedGroups = new Set((options.activated || []).flatMap(item => entryGroups(item.record.entry)));

  const remove = (item, group, reason = 'group_loser', message = `Another entry won group "${group}".`) => {
    if (!remaining.delete(item)) return;
    skipped.set(item.record.fullId, {
      active: false,
      record: item.record,
      reason,
      message,
      matchedKeys: item.matchedKeys,
    });
  };

  for (const group of groupNames) {
    let items = activeItems.filter(item => remaining.has(item) && entryGroups(item.record.entry).includes(group));
    if (activatedGroups.has(group)) {
      for (const item of items) remove(item, group, 'group_already_active', `Group "${group}" already activated on an earlier scan.`);
      continue;
    }
    if (items.length <= 1) continue;

    const stickyItems = items.filter(item => item.trigger === 'sticky');
    if (stickyItems.length) {
      for (const item of items) {
        if (!stickyItems.includes(item)) remove(item, group);
      }
      continue;
    }

    if (settings.useGroupScoring || items.some(item => item.record.entry.useGroupScoring === true)) {
      const maxScore = Math.max(...items.map(item => Number(item.score || 0)));
      for (const item of items) {
        const usesScoring = item.record.entry.useGroupScoring ?? settings.useGroupScoring;
        if (usesScoring && Number(item.score || 0) < maxScore) remove(item, group);
      }
      items = items.filter(item => remaining.has(item));
    }
    if (items.length <= 1) continue;

    const overrides = items.filter(item => item.record.entry.groupOverride).sort((left, right) => promptOrderSort(left.record, right.record));
    const winner = overrides[0] || weightedGroupWinner(items, `${options.seed}:group:${options.pass}:${group}`);
    for (const item of items) {
      if (item !== winner) remove(item, group);
    }
  }

  return {
    activated: [...remaining].sort((left, right) => promptOrderSort(left.record, right.record)),
    skipped: [...skipped.values()],
  };
}

function weightedGroupWinner(items, seed) {
  const weights = items.map(item => Math.max(0, numberOr(item.record.entry.groupWeight, 100)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[0];
  const roll = seededUnit(seed) * total;
  let current = 0;
  for (let index = 0; index < items.length; index++) {
    current += weights[index];
    if (roll <= current) return items[index];
  }
  return items[items.length - 1];
}

function entryGroups(entry) {
  return cleanText(entry?.group).split(/,\s*/).map(cleanText).filter(Boolean);
}

function normalizeRecursionDelay(value) {
  if (value === true) return 1;
  return Math.max(0, numberOr(value, 0));
}

function annotateTokenUsage(activeItems, settings, scenario, characterCard) {
  return activeItems.map(item => {
    const expandedContent = expandMacros(item.record.entry.content, characterCard, scenario);
    const tokenResult = countTokens(expandedContent, settings.tokenizerProfile);
    return {
      ...item,
      expandedContent,
      tokens: tokenResult.count,
      tokenAccuracy: tokenResult.accuracy,
    };
  });
}

function applyBudget(activeItems, settings) {
  const maxContext = Math.max(0, numberOr(settings.maxContextTokens, 0));
  const percent = Math.min(100, Math.max(0, numberOr(settings.budgetPercent, 100)));
  const percentLimit = maxContext > 0 && percent > 0 ? Math.round(maxContext * percent / 100) : 0;
  const cap = Math.max(0, numberOr(settings.budgetCap, 0));
  const limit = cap > 0 ? Math.min(percentLimit || cap, cap) : percentLimit;
  const activated = [];
  const skipped = [];
  let used = 0;
  let overflowed = false;

  for (const item of activeItems) {
    const tokens = Math.max(0, numberOr(item.tokens, 0));
    if (overflowed && !item.record.entry.ignoreBudget) {
      skipped.push({
        ...item,
        active: false,
        reason: 'budget',
        message: `The scenario world-info budget was already exhausted (${used}/${limit} tokens).`,
      });
      continue;
    }
    if (limit > 0 && !item.record.entry.ignoreBudget && used + tokens >= limit) {
      overflowed = true;
      skipped.push({
        ...item,
        active: false,
        reason: 'budget',
        message: `This entry would exceed the scenario world-info budget (${used + tokens}/${limit} tokens).`,
      });
      continue;
    }
    used += tokens;
    activated.push(item);
  }

  const warnings = overflowed && settings.alertOnOverflow
    ? [{ code: 'budget_overflow', message: `World info budget reached after ${activated.length} entries (${used}/${limit} tokens).` }]
    : [];
  return { activated, skipped, used, limit, overflowed, warnings };
}

function bucketActivatedEntries(activeItems, scenario, characterCard) {
  const buckets = {
    beforeCharacter: [],
    afterCharacter: [],
    authorNoteTop: [],
    authorNoteBottom: [],
    exampleTop: [],
    exampleBottom: [],
    atDepth: [],
    outlets: {},
  };

  for (const item of activeItems) {
    const entry = item.record.entry;
    const content = item.expandedContent ?? expandMacros(entry.content, characterCard, scenario);
    const bucketItem = {
      id: item.record.fullId,
      title: entryTitle(entry),
      sourceName: item.record.sourceName,
      sourceType: item.record.sourceType,
      position: Number(entry.position ?? POSITION.BEFORE_CHAR),
      role: roleName(entry.role),
      roleNumber: normalizedRole(entry.role),
      depth: Number(entry.depth ?? 0),
      order: Number(entry.order ?? 100),
      content,
      tokens: item.tokens,
      trigger: item.trigger,
      reasons: item.reasons,
      matchedKeys: item.matchedKeys,
      runtimeFlags: runtimeFlags(entry),
    };

    switch (bucketItem.position) {
      case POSITION.AFTER_CHAR:
        buckets.afterCharacter.push(bucketItem);
        break;
      case POSITION.AN_TOP:
        buckets.authorNoteTop.push(bucketItem);
        break;
      case POSITION.AN_BOTTOM:
        buckets.authorNoteBottom.push(bucketItem);
        break;
      case POSITION.AT_DEPTH:
        buckets.atDepth.push(bucketItem);
        break;
      case POSITION.EXAMPLE_TOP:
        buckets.exampleTop.push(bucketItem);
        break;
      case POSITION.EXAMPLE_BOTTOM:
        buckets.exampleBottom.push(bucketItem);
        break;
      case POSITION.OUTLET: {
        const name = cleanText(entry.outletName) || 'default';
        if (!buckets.outlets[name]) buckets.outlets[name] = [];
        buckets.outlets[name].push(bucketItem);
        break;
      }
      case POSITION.BEFORE_CHAR:
      default:
        buckets.beforeCharacter.push(bucketItem);
        break;
    }
  }

  for (const value of Object.values(buckets)) {
    if (Array.isArray(value)) value.sort(bucketSort);
  }
  for (const outlet of Object.values(buckets.outlets)) outlet.sort(outletSort);
  return buckets;
}

function buildTimeline(buckets, messages, characterCard, scenario, settings) {
  const timeline = [];
  pushEntryMessages(timeline, buckets.beforeCharacter, 'system', 'world_info_before_character');
  const characterContent = buildCharacterPrompt(characterCard, scenario);
  if (characterContent) {
    timeline.push({
      id: 'character-card',
      role: 'system',
      bucket: 'character_card',
      title: characterCard?.name || scenario.charName || 'Character card',
      content: characterContent,
      sourceIds: [],
      tokens: countTokens(characterContent, settings.tokenizerProfile).count,
    });
  }
  pushEntryMessages(timeline, buckets.afterCharacter, 'system', 'world_info_after_character');
  pushEntryMessages(timeline, buckets.exampleTop, 'system', 'world_info_example_top');
  pushEntryMessages(timeline, buckets.exampleBottom, 'system', 'world_info_example_bottom');
  pushEntryMessages(timeline, buckets.authorNoteTop, 'system', 'world_info_author_note_top');
  pushEntryMessages(timeline, buckets.authorNoteBottom, 'system', 'world_info_author_note_bottom');

  const depthByIndex = groupDepthEntries(messages.length, buckets.atDepth);
  for (let index = 0; index <= messages.length; index++) {
    const depthItems = depthByIndex.get(index) || [];
    for (const item of depthItems) {
      timeline.push({
        id: `depth:${item.depth}:${item.role}:${item.id}`,
        role: item.role,
        bucket: `world_info_depth_${item.depth}`,
        title: item.title,
        content: item.content,
        sourceIds: [item.id],
        depth: item.depth,
        order: item.order,
        tokens: item.tokens,
      });
    }
    if (index < messages.length) {
      const message = messages[index];
      timeline.push({
        id: `chat:${index}`,
        role: message.role,
        bucket: 'chat',
        title: message.name || message.role,
        content: message.content,
        sourceIds: [],
        tokens: countTokens(message.content, settings.tokenizerProfile).count,
      });
    }
  }

  return timeline;
}

function pushEntryMessages(timeline, entries, role, bucket) {
  for (const item of entries) {
    timeline.push({
      id: item.id,
      role,
      bucket,
      title: item.title,
      content: item.content,
      sourceIds: [item.id],
      order: item.order,
      tokens: item.tokens,
    });
  }
}

function groupDepthEntries(messageCount, atDepthEntries) {
  const groups = new Map();
  const entries = [...atDepthEntries].sort((left, right) => {
    const indexDiff = depthInsertIndex(messageCount, left.depth) - depthInsertIndex(messageCount, right.depth);
    if (indexDiff) return indexDiff;
    const roleDiff = left.roleNumber - right.roleNumber;
    if (roleDiff) return roleDiff;
    return bucketSort(left, right);
  });
  for (const item of entries) {
    const index = depthInsertIndex(messageCount, item.depth);
    if (!groups.has(index)) groups.set(index, []);
    groups.get(index).push(item);
  }
  return groups;
}

function depthInsertIndex(messageCount, depth) {
  const normalized = Math.max(0, Number(depth || 0));
  return Math.max(0, Math.min(messageCount, messageCount - normalized));
}

function buildCharacterPrompt(characterCard, scenario) {
  const parts = [];
  const name = characterCard?.name || scenario.charName;
  if (name) parts.push(`Name: ${name}`);
  if (characterCard?.description) parts.push(`Description:\n${characterCard.description}`);
  if (characterCard?.personality) parts.push(`Personality:\n${characterCard.personality}`);
  if (characterCard?.scenario) parts.push(`Scenario:\n${characterCard.scenario}`);
  if (characterCard?.mesExample) parts.push(`Examples:\n${characterCard.mesExample}`);
  if (characterCard?.creatorNotes) parts.push(`Creator notes:\n${characterCard.creatorNotes}`);
  return parts.join('\n\n').trim();
}

function buildScanText(messages, globalScanData, settings, entry, recursionBuffer) {
  const depth = Math.max(0, Number(entry.scanDepth ?? settings.worldInfoDepth ?? 0));
  const newestFirst = [...messages].reverse().slice(0, depth);
  const parts = newestFirst.map(message => {
    if (settings.includeNames && message.name) return `${message.name}: ${message.content}`;
    return message.content;
  });
  if (entry.matchPersonaDescription && globalScanData.personaDescription) parts.push(globalScanData.personaDescription);
  if (entry.matchCharacterDescription && globalScanData.characterDescription) parts.push(globalScanData.characterDescription);
  if (entry.matchCharacterPersonality && globalScanData.characterPersonality) parts.push(globalScanData.characterPersonality);
  if (entry.matchCharacterDepthPrompt && globalScanData.characterDepthPrompt) parts.push(globalScanData.characterDepthPrompt);
  if (entry.matchScenario && globalScanData.scenario) parts.push(globalScanData.scenario);
  if (entry.matchCreatorNotes && globalScanData.creatorNotes) parts.push(globalScanData.creatorNotes);
  if (recursionBuffer && recursionBuffer.length) parts.push(...recursionBuffer);
  return parts.join('\n\u0001');
}

function secondaryLogicMatches(entry, secondaryMatchCount) {
  const secondaryCount = entry.keysecondary.length;
  if (!entry.selective || secondaryCount === 0) return true;
  switch (Number(entry.selectiveLogic ?? SELECTIVE_LOGIC.AND_ANY)) {
    case SELECTIVE_LOGIC.AND_ALL:
      return secondaryMatchCount === secondaryCount;
    case SELECTIVE_LOGIC.NOT_ANY:
      return secondaryMatchCount === 0;
    case SELECTIVE_LOGIC.NOT_ALL:
      return secondaryMatchCount < secondaryCount;
    case SELECTIVE_LOGIC.AND_ANY:
    default:
      return secondaryMatchCount > 0;
  }
}

function matchKey(haystack, needle, entry, settings) {
  const rawNeedle = cleanText(needle);
  if (!rawNeedle) return false;
  const regex = parseRegex(rawNeedle);
  if (regex) return regex.test(haystack);
  const caseSensitive = entry.caseSensitive ?? settings.caseSensitive;
  const matchWholeWords = entry.matchWholeWords ?? settings.matchWholeWords;
  const source = caseSensitive ? haystack : haystack.toLowerCase();
  const target = caseSensitive ? rawNeedle : rawNeedle.toLowerCase();
  if (!matchWholeWords) return source.includes(target);
  if (/\s/.test(target)) return source.includes(target);
  return new RegExp(`(?:^|\\W)${escapeRegex(target)}(?:$|\\W)`).test(source);
}

function parseRegex(value) {
  const match = /^\/(.+)\/([gimsuy]*)$/.exec(value);
  if (!match) return null;
  try {
    return new RegExp(match[1], match[2]);
  } catch {
    return null;
  }
}

function characterFilterMatches(entry, characterCard) {
  const filter = normalizeCharacterFilter(entry);
  const names = filter.names.map(value => value.toLowerCase());
  const tags = filter.tags.map(value => value.toLowerCase());
  if (!names.length && !tags.length) return true;
  const cardNames = new Set([
    cleanText(characterCard?.name),
    cleanText(characterCard?.sourceName),
    characterCard?.sourceName ? path.basename(characterCard.sourceName, path.extname(characterCard.sourceName)) : '',
  ].map(value => value.toLowerCase()).filter(Boolean));
  const cardTags = normalizeStringArray(characterCard?.tags).map(value => value.toLowerCase());
  const matched = names.some(name => cardNames.has(name)) || tags.some(tag => cardTags.includes(tag));
  return filter.isExclude ? !matched : matched;
}

function normalizeSettings(input = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    worldInfoDepth: Math.max(0, numberOr(input.worldInfoDepth, DEFAULT_SETTINGS.worldInfoDepth)),
    minActivations: Math.max(0, numberOr(input.minActivations, DEFAULT_SETTINGS.minActivations)),
    minActivationsDepthMax: Math.max(0, numberOr(input.minActivationsDepthMax, DEFAULT_SETTINGS.minActivationsDepthMax)),
    maxContextTokens: Math.max(0, numberOr(input.maxContextTokens, DEFAULT_SETTINGS.maxContextTokens)),
    budgetPercent: Math.min(100, Math.max(0, numberOr(input.budgetPercent, DEFAULT_SETTINGS.budgetPercent))),
    budgetCap: Math.max(0, numberOr(input.budgetCap, DEFAULT_SETTINGS.budgetCap)),
    recursive: input.recursive === undefined ? DEFAULT_SETTINGS.recursive : booleanValue(input.recursive),
    maxRecursionSteps: Math.max(0, numberOr(input.maxRecursionSteps, DEFAULT_SETTINGS.maxRecursionSteps)),
    includeNames: input.includeNames === undefined ? DEFAULT_SETTINGS.includeNames : booleanValue(input.includeNames),
    caseSensitive: input.caseSensitive === undefined ? DEFAULT_SETTINGS.caseSensitive : booleanValue(input.caseSensitive),
    matchWholeWords: input.matchWholeWords === undefined ? DEFAULT_SETTINGS.matchWholeWords : booleanValue(input.matchWholeWords),
    useGroupScoring: input.useGroupScoring === undefined ? DEFAULT_SETTINGS.useGroupScoring : booleanValue(input.useGroupScoring),
    alertOnOverflow: input.alertOnOverflow === undefined ? DEFAULT_SETTINGS.alertOnOverflow : booleanValue(input.alertOnOverflow),
    worldInfoInsertionStrategy: normalizeWorldInfoInsertionStrategy(input.worldInfoInsertionStrategy),
    tokenizerProfile: cleanText(input.tokenizerProfile) || DEFAULT_SETTINGS.tokenizerProfile,
  };
}

function normalizeWorldInfoInsertionStrategy(value) {
  const normalized = cleanText(value).toLowerCase().replaceAll('_', '-');
  if (normalized === '0' || normalized === 'evenly' || normalized === 'sorted-evenly') return WORLD_INFO_INSERTION_STRATEGY.EVENLY;
  if (normalized === '2' || normalized === 'global-first') return WORLD_INFO_INSERTION_STRATEGY.GLOBAL_FIRST;
  if (normalized === '1' || normalized === 'character-first') return WORLD_INFO_INSERTION_STRATEGY.CHARACTER_FIRST;
  return DEFAULT_SETTINGS.worldInfoInsertionStrategy;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message, index) => {
    const source = message && typeof message === 'object' && !Array.isArray(message) ? message : {};
    return {
      ...source,
      role: normalizeRoleName(source.role || (index % 2 ? 'assistant' : 'user')),
      name: cleanText(source.name),
      content: cleanText(source.content),
    };
  }).filter(message => message.content || message.name);
}

function normalizeTimedState(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    sticky: normalizeStringArray(input.sticky),
    cooldown: normalizeStringArray(input.cooldown),
  };
}

function timedStateHas(list, record) {
  const values = new Set(normalizeStringArray(list));
  return values.has(record.fullId) || values.has(String(record.id));
}

function getEntryRecords(data, sourceName = 'worldbook', sourceType = 'worldbook') {
  const entries = data?.entries;
  if (!entries || typeof entries !== 'object') return [];
  const raw = Array.isArray(entries)
    ? entries.map((entry, index) => [String(entry?.uid ?? entry?.id ?? index), entry, index])
    : Object.entries(entries).map(([key, entry], index) => [String(key), entry, index]);
  return raw.map(([id, entry, index]) => {
    const normalized = normalizeEntry(entry);
    const fullId = `${sourceName}:${id}`;
    return {
      id,
      fullId,
      sourceName,
      sourceType,
      index,
      storageKey: Array.isArray(entries) ? index : id,
      entry: normalized,
      originalEntry: entry,
    };
  });
}

function normalizeEntry(entry) {
  const out = {
    ...ENTRY_DEFAULTS,
    ...(entry && typeof entry === 'object' ? entry : {}),
  };
  out.key = normalizeStringArray(out.key);
  out.keysecondary = normalizeStringArray(out.keysecondary);
  out.characterFilter = normalizeCharacterFilter(out);
  out.triggers = normalizeStringArray(out.triggers).map(value => value.toLowerCase());
  out.position = numberOr(out.position, ENTRY_DEFAULTS.position);
  out.order = numberOr(out.order, ENTRY_DEFAULTS.order);
  out.depth = numberOr(out.depth, ENTRY_DEFAULTS.depth);
  out.probability = numberOr(out.probability, ENTRY_DEFAULTS.probability);
  return out;
}

function normalizeCharacterFilter(entry) {
  const nested = entry?.characterFilter && typeof entry.characterFilter === 'object' && !Array.isArray(entry.characterFilter)
    ? entry.characterFilter
    : null;
  return {
    names: normalizeStringArray(nested ? nested.names : entry?.characterFilterNames),
    tags: normalizeStringArray(nested ? nested.tags : entry?.characterFilterTags),
    isExclude: booleanValue(nested ? nested.isExclude : entry?.characterFilterExclude),
  };
}

function normalizeCharacterCardObject(card, sourceName, pngMetadata) {
  const data = card?.data && typeof card.data === 'object' ? card.data : card || {};
  const characterBook = data.character_book || data.characterBook || card.character_book || card.characterBook || null;
  const extensions = data.extensions && typeof data.extensions === 'object' ? data.extensions : {};
  const depthPrompt = extensions.depth_prompt || extensions.depthPrompt || {};
  return {
    sourceName,
    format: pngMetadata ? 'png' : 'json',
    raw: card,
    name: cleanText(data.name || card.name),
    description: cleanText(data.description || card.description),
    personality: cleanText(data.personality || card.personality),
    scenario: cleanText(data.scenario || card.scenario),
    firstMes: cleanText(data.first_mes || data.firstMes || card.first_mes || card.firstMes),
    alternateGreetings: normalizeStringArray(data.alternate_greetings || data.alternateGreetings || card.alternate_greetings || card.alternateGreetings),
    mesExample: cleanText(data.mes_example || data.mesExample || card.mes_example || card.mesExample),
    creatorNotes: cleanText(data.creator_notes || data.creatorNotes || card.creator_notes || card.creatorNotes),
    characterDepthPrompt: cleanText(
      data.character_depth_prompt || data.characterDepthPrompt || depthPrompt.prompt || card.character_depth_prompt || card.characterDepthPrompt,
    ),
    tags: normalizeStringArray(data.tags || card.tags),
    characterBook,
  };
}

function parseCharacterPayload(raw) {
  if (!raw) throw new Error('Character card did not contain JSON metadata.');
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  const text = cleanText(raw);
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
    } catch (error) {
      throw new Error(`Character card JSON could not be parsed: ${error.message}`);
    }
  }
}

function extractPngTextChunks(buffer) {
  if (!isPng(buffer)) throw new Error('PNG signature not found.');
  const chunks = {};
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) break;
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === 'tEXt') {
      const zero = data.indexOf(0);
      if (zero >= 0) chunks[data.subarray(0, zero).toString('utf8')] = data.subarray(zero + 1).toString('utf8');
    } else if (type === 'zTXt') {
      const zero = data.indexOf(0);
      if (zero >= 0) {
        const keyword = data.subarray(0, zero).toString('utf8');
        const compressed = data.subarray(zero + 2);
        try {
          chunks[keyword] = zlib.inflateSync(compressed).toString('utf8');
        } catch {
          chunks[keyword] = '';
        }
      }
    } else if (type === 'iTXt') {
      const text = decodeITXt(data);
      if (text) chunks[text.keyword] = text.value;
    }
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  return chunks;
}

function decodeITXt(data) {
  let offset = 0;
  const readNull = () => {
    const zero = data.indexOf(0, offset);
    if (zero < 0) return null;
    const value = data.subarray(offset, zero).toString('utf8');
    offset = zero + 1;
    return value;
  };
  const keyword = readNull();
  if (!keyword || offset + 2 > data.length) return null;
  const compressionFlag = data[offset++];
  offset++; // compression method
  readNull(); // language tag
  readNull(); // translated keyword
  const rest = data.subarray(offset);
  try {
    return {
      keyword,
      value: compressionFlag ? zlib.inflateSync(rest).toString('utf8') : rest.toString('utf8'),
    };
  } catch {
    return null;
  }
}

function decodeCharacterPayloadFromMetadata(metadata) {
  const keys = ['chara', 'ccv3', 'ccv2', 'character', 'Character', 'tavern_character'];
  for (const key of keys) {
    if (!metadata[key]) continue;
    const value = cleanText(metadata[key]);
    try {
      return JSON.parse(value);
    } catch {
      try {
        return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
      } catch {
        // Try the next key.
      }
    }
  }
  throw new Error('PNG card does not contain supported character metadata.');
}

function isPng(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function countTokens(text, profile = 'estimate') {
  const normalizedProfile = cleanText(profile) || 'estimate';
  if (normalizedProfile.startsWith('openai')) {
    const exact = tryTiktokenCount(text, normalizedProfile);
    if (exact) return exact;
  }
  const count = estimateTokens(text, normalizedProfile);
  return {
    count,
    profile: normalizedProfile,
    accuracy: normalizedProfile === 'estimate' ? 'estimate' : 'fallback-estimate',
  };
}

function tokenizerInfo(profile = 'estimate') {
  const normalizedProfile = cleanText(profile) || 'estimate';
  if (normalizedProfile.startsWith('openai')) {
    try {
      require.resolve('tiktoken');
      return { profile: normalizedProfile, accuracy: 'exact-when-model-matches', source: 'tiktoken' };
    } catch {
      return { profile: normalizedProfile, accuracy: 'fallback-estimate', source: 'bytes-per-token' };
    }
  }
  return { profile: normalizedProfile, accuracy: 'estimate', source: 'bytes-per-token' };
}

function tryTiktokenCount(text, profile) {
  try {
    const tiktoken = require('tiktoken');
    const encodingName = profile.includes('p50k') ? 'p50k_base' : 'cl100k_base';
    const encoding = tiktoken.get_encoding(encodingName);
    const tokens = encoding.encode(String(text || ''));
    const count = tokens.length;
    if (typeof encoding.free === 'function') encoding.free();
    return { count, profile, accuracy: 'exact-when-model-matches' };
  } catch {
    return null;
  }
}

function estimateTokens(text, profile) {
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
  const divisor = profile.includes('llama') ? 3.6 : profile.includes('claude') ? 3.8 : 4;
  return Math.max(1, Math.ceil(cjk + other * 0.8 + ascii / divisor));
}

function summarizeBuckets(buckets) {
  return {
    beforeCharacter: buckets.beforeCharacter.map(summaryBucketItem),
    afterCharacter: buckets.afterCharacter.map(summaryBucketItem),
    authorNoteTop: buckets.authorNoteTop.map(summaryBucketItem),
    authorNoteBottom: buckets.authorNoteBottom.map(summaryBucketItem),
    exampleTop: buckets.exampleTop.map(summaryBucketItem),
    exampleBottom: buckets.exampleBottom.map(summaryBucketItem),
    atDepth: buckets.atDepth.map(summaryBucketItem),
    outlets: Object.fromEntries(Object.entries(buckets.outlets).map(([key, value]) => [key, value.map(summaryBucketItem)])),
  };
}

function summaryBucketItem(item) {
  return {
    id: item.id,
    title: item.title,
    role: item.role,
    depth: item.depth,
    order: item.order,
    tokens: item.tokens,
    sourceName: item.sourceName,
  };
}

function toActivatedSummary(item) {
  const entry = item.record.entry;
  return {
    id: item.record.fullId,
    title: entryTitle(entry),
    sourceName: item.record.sourceName,
    sourceType: item.record.sourceType,
    trigger: item.trigger,
    reasons: item.reasons,
    matchedKeys: item.matchedKeys,
    position: Number(entry.position),
    role: roleName(entry.role),
    depth: Number(entry.depth || 0),
    order: Number(entry.order || 0),
    tokens: item.tokens,
    runtimeFlags: runtimeFlags(entry),
  };
}

function toSkippedSummary(item) {
  return {
    id: item.record.fullId,
    title: entryTitle(item.record.entry),
    sourceName: item.record.sourceName,
    sourceType: item.record.sourceType,
    reason: item.reason,
    message: item.message,
    matchedKeys: item.matchedKeys || [],
    tokens: item.tokens,
    tokenAccuracy: item.tokenAccuracy,
  };
}

function runtimeWarnings(activeItems) {
  const warnings = [];
  for (const item of activeItems) {
    const flags = runtimeFlags(item.record.entry);
    for (const flag of flags) {
      warnings.push({
        code: `runtime_${flag}`,
        entryId: item.record.fullId,
        message: `${entryTitle(item.record.entry)} uses ${flag}; preview does not run SillyTavern external runtime hooks.`,
      });
    }
  }
  return warnings;
}

function runtimeFlags(entry) {
  const flags = [];
  if (entry.vectorized) flags.push('vectorized');
  if (cleanText(entry.automationId)) flags.push('automation');
  if (Number(entry.position) === POSITION.OUTLET) flags.push('outlet');
  if (entry.sticky || entry.cooldown || entry.delay) flags.push('timed-effect');
  return flags;
}

function parseJsonLike(input, label) {
  if (Buffer.isBuffer(input)) return JSON.parse(input.toString('utf8'));
  if (typeof input === 'string') return JSON.parse(input);
  if (input && typeof input === 'object') return clone(input);
  throw new Error(`${label} input must be JSON text, Buffer, or object.`);
}

function buildGlobalScanData(characterCard, scenario) {
  return {
    personaDescription: cleanText(scenario?.personaDescription),
    characterDescription: characterCard?.description || '',
    characterPersonality: characterCard?.personality || '',
    characterDepthPrompt: cleanText(scenario?.characterDepthPrompt || characterCard?.characterDepthPrompt),
    scenario: characterCard?.scenario || '',
    creatorNotes: characterCard?.creatorNotes || '',
    trigger: normalizeGenerationTrigger(scenario?.trigger),
  };
}

function expandMacros(value, characterCard, scenario) {
  const charName = cleanText(characterCard?.name || scenario?.charName || '{{char}}');
  const userName = cleanText(scenario?.userName || '{{user}}');
  return cleanText(value)
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/<BOT>/gi, charName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/<USER>/gi, userName);
}

function promptOrderSort(left, right) {
  const orderDiff = Number(right.entry?.order || 0) - Number(left.entry?.order || 0);
  if (orderDiff) return orderDiff;
  return Number(left.index || 0) - Number(right.index || 0);
}

function bucketSort(left, right) {
  const orderDiff = Number(left.order || 0) - Number(right.order || 0);
  if (orderDiff) return orderDiff;
  return String(left.id).localeCompare(String(right.id));
}

function outletSort(left, right) {
  const orderDiff = Number(right.order || 0) - Number(left.order || 0);
  if (orderDiff) return orderDiff;
  return String(left.id).localeCompare(String(right.id));
}

function seededPercent(seed) {
  return seededUnit(seed) * 100;
}

function seededUnit(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  return hash.readUInt32BE(0) / 0x100000000;
}

function normalizeGenerationTrigger(value) {
  const trigger = cleanText(value).toLowerCase();
  return GENERATION_TRIGGERS.includes(trigger) ? trigger : 'normal';
}

function entryTitle(entry) {
  return cleanText(entry?.comment || entry?.name || entry?.uid || 'Untitled entry');
}

function roleName(value) {
  return ROLE_NAMES[normalizedRole(value)] || 'system';
}

function normalizedRole(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 2 ? number : ROLE.SYSTEM;
}

function normalizeRoleName(value) {
  const role = cleanText(value).toLowerCase();
  if (role === 'assistant' || role === 'user' || role === 'system') return role;
  return 'user';
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map(cleanText).filter(Boolean);
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  POSITION,
  ROLE,
  SELECTIVE_LOGIC,
  GENERATION_TRIGGERS,
  WORLD_INFO_INSERTION_STRATEGY,
  ENTRY_DEFAULTS,
  DEFAULT_SETTINGS,
  createDefaultScenario,
  scenarioFilePath,
  historyFilePath,
  createDefaultHistory,
  parseHistoryJson,
  createHistorySnapshot,
  startHistoryExperiment,
  finishHistoryExperiment,
  summarizeHistory,
  getHistorySnapshot,
  copyWorldbookEntries,
  parseScenarioJson,
  parseWorldbookJson,
  serializeWorldbookJson,
  parseCharacterCard,
  compilePromptPreview,
  countTokens,
  tokenizerInfo,
  getEntryRecords,
};
