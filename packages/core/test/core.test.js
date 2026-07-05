'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {
  POSITION,
  parseWorldbookJson,
  parseCharacterCard,
  createDefaultScenario,
  parseScenarioJson,
  compilePromptPreview,
} = require('../index.js');

test('parseWorldbookJson supports object entries and preserves unknown fields', () => {
  const parsed = parseWorldbookJson({
    custom: 'kept',
    entries: {
      '7': { uid: 7, comment: 'A', content: 'Alpha', extra: true },
    },
  }, { sourceName: 'book' });
  assert.equal(parsed.entriesShape, 'object');
  assert.equal(parsed.data.custom, 'kept');
  assert.equal(parsed.records[0].id, '7');
  assert.equal(parsed.records[0].originalEntry.extra, true);
});

test('parseWorldbookJson supports array entries', () => {
  const parsed = parseWorldbookJson({
    entries: [{ uid: 3, comment: 'Array item', content: 'Text' }],
  });
  assert.equal(parsed.entriesShape, 'array');
  assert.equal(parsed.records[0].id, '3');
});

test('parseCharacterCard reads JSON character books', () => {
  const card = parseCharacterCard(JSON.stringify({
    data: {
      name: 'Eldoria',
      description: 'Forest',
      character_book: { entries: { a: { comment: 'Lore', content: 'Wood', constant: true } } },
    },
  }));
  assert.equal(card.name, 'Eldoria');
  assert.equal(card.characterBook.entries.a.comment, 'Lore');
});

test('parseCharacterCard reads PNG tEXt chara metadata', () => {
  const payload = Buffer.from(JSON.stringify({ data: { name: 'Png Card', description: 'Image card' } }), 'utf8').toString('base64');
  const png = makePngWithText('chara', payload);
  const card = parseCharacterCard(png);
  assert.equal(card.name, 'Png Card');
  assert.equal(card.description, 'Image card');
});

test('scenario JSON round trip normalizes defaults', () => {
  const scenario = createDefaultScenario('/tmp/book.json');
  const parsed = parseScenarioJson(JSON.stringify(scenario));
  assert.equal(parsed.worldbookPath, '/tmp/book.json');
  assert.equal(parsed.includeCharacterBook, true);
});

test('compilePromptPreview activates constants and depth entries in timeline order', () => {
  const worldbook = {
    entries: {
      before: { comment: 'Before', content: 'Before text', constant: true, position: POSITION.BEFORE_CHAR, order: 10 },
      depth: { comment: 'Depth', content: 'Depth text', constant: true, position: POSITION.AT_DEPTH, depth: 1, role: 0, order: 20 },
    },
  };
  const result = compilePromptPreview({
    worldbooks: [{ name: 'book', data: worldbook }],
    scenario: { ...createDefaultScenario(), messages: [{ role: 'user', content: 'hello' }] },
  });
  assert.deepEqual(result.activatedEntries.map(entry => entry.title), ['Depth', 'Before']);
  assert.ok(result.timeline.some(item => item.title === 'Depth' && item.bucket === 'world_info_depth_1'));
  assert.ok(result.timeline.some(item => item.title === 'Before' && item.bucket === 'world_info_before_character'));
});

test('compilePromptPreview explains secondary logic and budget skips', () => {
  const worldbook = {
    entries: {
      keep: { comment: 'Keep', content: 'short', key: ['alpha'], keysecondary: ['beta'], selective: true, selectiveLogic: 0, order: 100 },
      miss: { comment: 'Miss', content: 'short', key: ['alpha'], keysecondary: ['gamma'], selective: true, selectiveLogic: 0, order: 90 },
      budget: { comment: 'Budget', content: 'x '.repeat(500), key: ['alpha'], order: 80 },
    },
  };
  const result = compilePromptPreview({
    worldbooks: [{ name: 'book', data: worldbook }],
    scenario: {
      ...createDefaultScenario(),
      settings: { maxContextTokens: 100, budgetPercent: 10, recursive: false },
      messages: [{ role: 'user', content: 'alpha beta' }],
    },
  });
  assert.ok(result.activatedEntries.some(entry => entry.title === 'Keep'));
  assert.ok(result.skippedEntries.some(entry => entry.title === 'Miss' && entry.reason === 'secondary_logic_failed'));
  assert.ok(result.skippedEntries.some(entry => entry.title === 'Budget' && entry.reason === 'budget'));
});

test('compilePromptPreview handles groups, probability seed, recursion, and timed state', () => {
  const worldbook = {
    entries: {
      groupA: { comment: 'Group A', content: 'group a', key: ['root'], group: 'g', groupWeight: 1, order: 10 },
      groupB: { comment: 'Group B', content: 'group b recurse-key', key: ['root'], group: 'g', groupWeight: 5, order: 9 },
      recurse: { comment: 'Recursive', content: 'recursive hit', key: ['recurse-key'], order: 8 },
      delayed: { comment: 'Delayed', content: 'delayed hit', delay: 4, order: 7 },
      sticky: { comment: 'Sticky', content: 'sticky hit', sticky: 2, order: 6 },
      cooldown: { comment: 'Cooldown', content: 'cooldown hit', constant: true, cooldown: 2, order: 5 },
      chance: { comment: 'Chance', content: 'chance hit', key: ['root'], probability: 0, useProbability: true, order: 4 },
    },
  };
  const result = compilePromptPreview({
    worldbooks: [{ name: 'book', data: worldbook }],
    scenario: {
      ...createDefaultScenario(),
      settings: { recursive: true, maxRecursionSteps: 2, useGroupScoring: true, budgetPercent: 100 },
      messages: [{ role: 'user', content: 'root' }],
      timedState: { sticky: ['book:sticky'], cooldown: ['book:cooldown'] },
      seed: 'fixed',
    },
  });
  assert.ok(result.activatedEntries.some(entry => entry.title === 'Group B'));
  assert.ok(result.skippedEntries.some(entry => entry.title === 'Group A' && entry.reason === 'group_loser'));
  assert.ok(result.activatedEntries.some(entry => entry.title === 'Recursive'));
  assert.ok(result.activatedEntries.some(entry => entry.title === 'Delayed' && entry.trigger === 'delay'));
  assert.ok(result.activatedEntries.some(entry => entry.title === 'Sticky' && entry.trigger === 'sticky'));
  assert.ok(result.skippedEntries.some(entry => entry.title === 'Cooldown' && entry.reason === 'cooldown'));
  assert.ok(result.skippedEntries.some(entry => entry.title === 'Chance' && entry.reason === 'probability_failed'));
});

function makePngWithText(keyword, value) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]));
  const text = chunk('tEXt', Buffer.concat([Buffer.from(keyword), Buffer.from([0]), Buffer.from(value)]));
  const idat = chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0, 0, 0, 0])));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, text, idat, iend]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type);
  const crc = Buffer.alloc(4);
  return Buffer.concat([length, typeBuffer, data, crc]);
}
