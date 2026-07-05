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
  addMemo: true,
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
  groupWeight: null,
  automationId: '',
  sticky: null,
  cooldown: null,
  delay: null,
  characterFilterNames: [],
  characterFilterTags: [],
  characterFilterExclude: false,
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
  maxContextTokens: 8192,
  budgetPercent: 25,
  budgetCap: 0,
  recursive: true,
  maxRecursionSteps: 2,
  includeNames: false,
  caseSensitive: false,
  matchWholeWords: false,
  useGroupScoring: false,
  tokenizerProfile: 'estimate',
});

const DEFAULT_SCENARIO_VERSION = 1;
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
  const data = worldbook && worldbook.data ? worldbook.data : worldbook;
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
    userName: '{{user}}',
    charName: '',
    settings: { ...DEFAULT_SETTINGS },
    messages: [
      { role: 'user', content: '' },
    ],
    forceActivate: [],
  });
}

function normalizeScenario(input) {
  const scenario = {
    version: Number(input.version || DEFAULT_SCENARIO_VERSION),
    worldbookPath: cleanText(input.worldbookPath),
    characterCardPath: cleanText(input.characterCardPath),
    includeCharacterBook: input.includeCharacterBook !== false,
    seed: cleanText(input.seed) || 'worldbook-workbench',
    userName: cleanText(input.userName) || '{{user}}',
    charName: cleanText(input.charName),
    settings: normalizeSettings(input.settings),
    messages: normalizeMessages(input.messages),
    forceActivate: normalizeStringArray(input.forceActivate),
    timedState: normalizeTimedState(input.timedState),
  };
  return scenario;
}

function scenarioFilePath(worldbookPath) {
  const parsed = path.parse(worldbookPath || 'worldbook.json');
  return path.join(parsed.dir, `${parsed.name}.wbh.json`);
}

function parseCharacterCard(input, options = {}) {
  const sourceName = options.sourceName || options.filePath && path.basename(options.filePath) || 'character';
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
  const globalScanData = buildGlobalScanData(characterCard);
  const evaluation = evaluateEntries(entries, messages, globalScanData, settings, {
    seed,
    forceActivate,
    timedState,
    characterCard,
  });
  const budget = applyBudget(evaluation.activated, settings);
  const buckets = bucketActivatedEntries(budget.activated, scenario, characterCard);
  const timeline = buildTimeline(buckets, messages, characterCard, scenario, settings);
  const tokenizer = tokenizerInfo(settings.tokenizerProfile);
  const timelineTokens = timeline.reduce((sum, item) => sum + countTokens(item.content, settings.tokenizerProfile).count, 0);

  return {
    scenario,
    settings,
    tokenizer,
    sources: sources.map(source => ({
      name: source.name,
      type: source.type,
      entryCount: source.records.length,
    })),
    timeline,
    activatedEntries: budget.activated.map(toActivatedSummary),
    skippedEntries: [
      ...evaluation.skipped,
      ...budget.skipped,
    ].map(toSkippedSummary),
    buckets: summarizeBuckets(buckets),
    tokenBudget: {
      profile: tokenizer.profile,
      accuracy: tokenizer.accuracy,
      limit: budget.limit,
      used: budget.used,
      worldInfoTokens: budget.used,
      timelineTokens,
      truncated: budget.skipped.length > 0,
    },
    warnings: [
      ...warnings,
      ...budget.warnings,
      ...runtimeWarnings(budget.activated),
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
  const maxPasses = settings.recursive ? Math.max(1, Number(settings.maxRecursionSteps || 0) + 1) : 1;
  const sorted = [...records].sort(promptOrderSort);

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    const recursivePass = pass > 0;
    for (const record of sorted) {
      if (activated.has(record.fullId)) continue;
      const result = evaluateEntry(record, messages, globalScanData, settings, {
        ...options,
        recursionBuffer,
        recursivePass,
      });
      if (result.active) {
        activated.set(record.fullId, result);
        changed = true;
        if (!record.entry.preventRecursion && !record.entry.excludeRecursion && cleanText(record.entry.content)) {
          recursionBuffer.push(expandMacros(record.entry.content, options.characterCard, options));
        }
      } else {
        skipped.set(record.fullId, result);
      }
    }
    if (!settings.recursive || !changed) break;
  }

  const grouped = applyGrouping([...activated.values()], settings);
  for (const loser of grouped.skipped) {
    skipped.set(loser.record.fullId, loser);
  }

  return {
    activated: grouped.activated,
    skipped: [...skipped.values()].filter(item => !grouped.activated.some(active => active.record.fullId === item.record.fullId)),
  };
}

function evaluateEntry(record, messages, globalScanData, settings, options) {
  const entry = record.entry;
  const reasons = [];
  const matchedKeys = [];

  if (entry.disable && !options.forceActivate.has(record.fullId) && !options.forceActivate.has(String(record.id))) {
    return inactive(record, 'disabled', 'Entry is disabled.');
  }
  if (timedStateHas(options.timedState?.cooldown, record)) {
    return inactive(record, 'cooldown', 'Entry is on cooldown in the preview scenario.');
  }
  if (timedStateHas(options.timedState?.sticky, record)) {
    return active(record, 'sticky', reasons, matchedKeys, 150);
  }
  if (entry.delay && messages.length < Number(entry.delay)) {
    return active(record, 'delay', reasons, matchedKeys, 120);
  }
  if (options.forceActivate.has(record.fullId) || options.forceActivate.has(String(record.id))) {
    return active(record, 'force', reasons, matchedKeys, 999);
  }
  if (entry.constant) {
    return active(record, 'constant', reasons, matchedKeys, 100);
  }
  if (options.recursivePass && entry.excludeRecursion) {
    return inactive(record, 'exclude_recursion', 'Entry is excluded from recursive activation.');
  }
  if (!entry.key.length) {
    return inactive(record, 'no_primary_keys', 'Entry has no primary keys and is not constant.');
  }
  if (!characterFilterMatches(entry, options.characterCard)) {
    return inactive(record, 'character_filter', 'Character filter does not match.');
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

  const probability = Number(entry.probability ?? 100);
  if (entry.useProbability !== false && probability < 100) {
    const roll = seededPercent(`${options.seed}:${record.fullId}`);
    if (roll >= probability) {
      return inactive(record, 'probability_failed', `Deterministic probability roll ${roll.toFixed(2)} >= ${probability}.`, matchedKeys);
    }
    reasons.push(`probability:${roll.toFixed(2)}`);
  }

  const score = primaryMatches.length + secondaryMatches.length + Number(entry.groupWeight || 0);
  return active(record, 'keys', reasons, matchedKeys, score);
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

function applyGrouping(activeItems, settings) {
  const groups = new Map();
  const passthrough = [];
  for (const item of activeItems) {
    const group = cleanText(item.record.entry.group);
    if (!group) {
      passthrough.push(item);
      continue;
    }
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }

  const activated = [...passthrough];
  const skipped = [];
  for (const [group, items] of groups) {
    if (items.length === 1) {
      activated.push(items[0]);
      continue;
    }
    const useScoring = settings.useGroupScoring || items.some(item => item.record.entry.useGroupScoring === true);
    const winner = [...items].sort((left, right) => {
      if (useScoring) {
        const scoreDiff = Number(right.score || 0) - Number(left.score || 0);
        if (scoreDiff) return scoreDiff;
      }
      if (left.record.entry.groupOverride !== right.record.entry.groupOverride) {
        return left.record.entry.groupOverride ? -1 : 1;
      }
      return promptOrderSort(left.record, right.record);
    })[0];
    activated.push(winner);
    for (const item of items) {
      if (item !== winner) {
        skipped.push({
          active: false,
          record: item.record,
          reason: 'group_loser',
          message: `Another entry won group "${group}".`,
          matchedKeys: item.matchedKeys,
        });
      }
    }
  }
  return { activated: activated.sort((left, right) => promptOrderSort(left.record, right.record)), skipped };
}

function applyBudget(activeItems, settings) {
  const tokenizerProfile = settings.tokenizerProfile;
  const maxContext = Math.max(0, Number(settings.maxContextTokens || 0));
  const percentLimit = Math.floor(maxContext * Math.max(0, Number(settings.budgetPercent || 0)) / 100);
  const cap = Number(settings.budgetCap || 0);
  const limit = cap > 0 ? Math.min(percentLimit || cap, cap) : percentLimit;
  const warnings = [];
  if (!limit) warnings.push({ code: 'budget_disabled', message: 'World info budget is disabled or zero.' });

  let used = 0;
  const activated = [];
  const skipped = [];
  for (const item of activeItems) {
    const tokenResult = countTokens(item.record.entry.content, tokenizerProfile);
    const next = {
      ...item,
      tokens: tokenResult.count,
      tokenAccuracy: tokenResult.accuracy,
    };
    if (limit && !item.record.entry.ignoreBudget && used + tokenResult.count > limit) {
      skipped.push({
        active: false,
        record: item.record,
        reason: 'budget',
        message: `Entry would exceed world info budget (${used + tokenResult.count}/${limit}).`,
        matchedKeys: item.matchedKeys,
      });
      continue;
    }
    used += tokenResult.count;
    activated.push(next);
  }
  return { activated, skipped, used, limit, warnings };
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
    const content = expandMacros(entry.content, characterCard, scenario);
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
  for (const outlet of Object.values(buckets.outlets)) outlet.sort(bucketSort);
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
  const names = normalizeStringArray(entry.characterFilterNames).map(value => value.toLowerCase());
  const tags = normalizeStringArray(entry.characterFilterTags).map(value => value.toLowerCase());
  if (!names.length && !tags.length) return true;
  const cardName = cleanText(characterCard?.name).toLowerCase();
  const cardTags = normalizeStringArray(characterCard?.tags).map(value => value.toLowerCase());
  const matched = (names.length && names.includes(cardName)) || (tags.length && tags.some(tag => cardTags.includes(tag)));
  return entry.characterFilterExclude ? !matched : matched;
}

function normalizeSettings(input = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    worldInfoDepth: numberOr(input.worldInfoDepth, DEFAULT_SETTINGS.worldInfoDepth),
    maxContextTokens: numberOr(input.maxContextTokens, DEFAULT_SETTINGS.maxContextTokens),
    budgetPercent: numberOr(input.budgetPercent, DEFAULT_SETTINGS.budgetPercent),
    budgetCap: numberOr(input.budgetCap, DEFAULT_SETTINGS.budgetCap),
    maxRecursionSteps: numberOr(input.maxRecursionSteps, DEFAULT_SETTINGS.maxRecursionSteps),
    tokenizerProfile: cleanText(input.tokenizerProfile) || DEFAULT_SETTINGS.tokenizerProfile,
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message, index) => ({
    role: normalizeRoleName(message?.role || (index % 2 ? 'assistant' : 'user')),
    name: cleanText(message?.name),
    content: cleanText(message?.content),
  })).filter(message => message.content || message.name);
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
  out.characterFilterNames = normalizeStringArray(out.characterFilterNames);
  out.characterFilterTags = normalizeStringArray(out.characterFilterTags);
  out.triggers = normalizeStringArray(out.triggers);
  out.position = numberOr(out.position, ENTRY_DEFAULTS.position);
  out.order = numberOr(out.order, ENTRY_DEFAULTS.order);
  out.depth = numberOr(out.depth, ENTRY_DEFAULTS.depth);
  out.probability = numberOr(out.probability, ENTRY_DEFAULTS.probability);
  return out;
}

function normalizeCharacterCardObject(card, sourceName, pngMetadata) {
  const data = card?.data && typeof card.data === 'object' ? card.data : card || {};
  const characterBook = data.character_book || data.characterBook || card.character_book || card.characterBook || null;
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

function buildGlobalScanData(characterCard) {
  return {
    personaDescription: '',
    characterDescription: characterCard?.description || '',
    characterPersonality: characterCard?.personality || '',
    characterDepthPrompt: '',
    scenario: characterCard?.scenario || '',
    creatorNotes: characterCard?.creatorNotes || '',
    trigger: 'normal',
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
  const orderDiff = Number(right.order || 0) - Number(left.order || 0);
  if (orderDiff) return orderDiff;
  return String(left.id).localeCompare(String(right.id));
}

function seededPercent(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  return hash.readUInt32BE(0) / 0xffffffff * 100;
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
  ENTRY_DEFAULTS,
  DEFAULT_SETTINGS,
  createDefaultScenario,
  scenarioFilePath,
  parseScenarioJson,
  parseWorldbookJson,
  serializeWorldbookJson,
  parseCharacterCard,
  compilePromptPreview,
  countTokens,
  tokenizerInfo,
  getEntryRecords,
};
