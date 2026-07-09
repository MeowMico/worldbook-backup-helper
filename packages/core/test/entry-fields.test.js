'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const entryFields = import('../../../extension/entry-fields.mjs');

test('entry field adapter reads and updates canonical character filters', async () => {
  const { getEntryFieldValue, setEntryFieldValue } = await entryFields;
  const entry = {
    characterFilter: {
      isExclude: false,
      names: ['Alice'],
      tags: ['tag-id'],
      futureField: 'kept',
    },
    characterFilterNames: ['stale'],
  };

  assert.deepEqual(getEntryFieldValue(entry, 'characterFilterNames'), ['Alice']);
  setEntryFieldValue(entry, 'characterFilterExclude', true);
  assert.deepEqual(entry.characterFilter, {
    futureField: 'kept',
    isExclude: true,
    names: ['Alice'],
    tags: ['tag-id'],
  });
  assert.equal(Object.hasOwn(entry, 'characterFilterNames'), false);
});

test('entry field adapter migrates legacy top-level character filters', async () => {
  const { normalizeEntryCharacterFilter } = await entryFields;
  const entry = {
    characterFilterNames: ['Alice'],
    characterFilterTags: ['tag-id'],
    characterFilterExclude: true,
  };

  normalizeEntryCharacterFilter(entry);
  assert.deepEqual(entry.characterFilter, {
    isExclude: true,
    names: ['Alice'],
    tags: ['tag-id'],
  });
  assert.equal(Object.hasOwn(entry, 'characterFilterNames'), false);
  assert.equal(Object.hasOwn(entry, 'characterFilterTags'), false);
  assert.equal(Object.hasOwn(entry, 'characterFilterExclude'), false);
});

test('canonical character filters take precedence over stale legacy values', async () => {
  const { getEntryFieldValue, normalizeEntryCharacterFilter } = await entryFields;
  const entry = {
    characterFilter: { isExclude: false, names: ['Canonical'], tags: [] },
    characterFilterNames: ['Legacy'],
  };

  assert.deepEqual(getEntryFieldValue(entry, 'characterFilterNames'), ['Canonical']);
  normalizeEntryCharacterFilter(entry);
  assert.deepEqual(entry.characterFilter.names, ['Canonical']);
});
