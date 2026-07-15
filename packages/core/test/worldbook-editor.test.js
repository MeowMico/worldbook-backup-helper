'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const editor = require('../../webview-ui/worldbook-editor.js');

test('worldbook editor preserves object entries and unknown fields', () => {
  const data = editor.parseWorldbookText(JSON.stringify({
    customRoot: true,
    entries: {
      a: { comment: 'Alpha', content: 'Text', customEntry: { kept: true } },
    },
  }));
  const [record] = editor.getEntryRecords(data);
  record.entry.order = 220;
  const saved = JSON.parse(editor.serializeWorldbook(data));
  assert.equal(saved.customRoot, true);
  assert.deepEqual(saved.entries.a.customEntry, { kept: true });
  assert.equal(saved.entries.a.order, 220);
});

test('worldbook editor supports array entries and stable add/delete operations', () => {
  const data = editor.parseWorldbookText(JSON.stringify({
    entries: [{ uid: 4, comment: 'Existing', content: 'Text' }],
  }));
  const created = editor.createEntry(data);
  assert.equal(created.id, '5');
  assert.equal(data.entries[1].uid, 5);
  assert.equal(editor.deleteEntry(data, 0), true);
  assert.equal(editor.getEntryRecords(data)[0].id, '5');
});

test('entry browser records sort by order without strategy or activation-state priority', () => {
  const data = editor.parseWorldbookText(JSON.stringify({
    entries: {
      green61: { uid: 61, comment: 'Green 61', order: 61 },
      blue17: { uid: 17, comment: 'Blue 17', order: 17, constant: true, disable: true },
      blue12: { uid: 12, comment: 'Blue 12', order: 12, constant: true },
      green90: { uid: 90, comment: 'Green 90', order: 90 },
      blue2: { uid: 2, comment: 'Blue 2', order: 2, constant: true },
      defaultOrder: { uid: 100, comment: 'Default order' },
      green49: { uid: 49, comment: 'Green 49', order: 49 },
      tied49: { uid: 149, comment: 'Tied 49', order: 49, constant: true },
    },
  }));
  const records = editor.getEntryRecords(data);
  const sorted = editor.sortEntryRecordsByOrder(records);

  assert.deepEqual(sorted.map(record => record.entry.comment), [
    'Blue 2',
    'Blue 12',
    'Blue 17',
    'Green 49',
    'Tied 49',
    'Green 61',
    'Green 90',
    'Default order',
  ]);
  assert.deepEqual(records.map(record => record.entry.comment), [
    'Green 61',
    'Blue 17',
    'Blue 12',
    'Green 90',
    'Blue 2',
    'Default order',
    'Green 49',
    'Tied 49',
  ]);
});

test('worldbook editor maps strategies, positions, lists, and token estimates', () => {
  const entry = { custom: 'kept', selective: true };
  editor.applyEntryStrategy(entry, 'constant');
  assert.equal(editor.entryStrategy(entry), 'constant');
  assert.equal(entry.constant, true);
  assert.equal(entry.selective, true);

  editor.applyEntryStrategy(entry, 'normal');
  assert.equal(editor.entryStrategy(entry), 'normal');
  assert.equal(entry.constant, false);
  assert.equal(entry.vectorized, false);
  assert.equal(entry.selective, true);

  editor.applyEntryStrategy(entry, 'vectorized');
  assert.equal(editor.entryStrategy(entry), 'vectorized');
  assert.equal(entry.selective, true);

  editor.applyEntryPosition(entry, 4);
  entry.role = 2;
  entry.depth = 3;
  assert.equal(editor.positionLabel(entry.position, entry.role, entry.depth), 'Assistant @ Depth 3');
  editor.applyEntryPosition(entry, 1);
  assert.equal(entry.role, undefined);
  assert.deepEqual(editor.parseListText('one, two\nthree'), ['one', 'two', 'three']);
  assert.ok(editor.estimateTokens('中文 English') > 0);
  assert.equal(entry.custom, 'kept');
});

test('new entries include SillyTavern-compatible advanced defaults', () => {
  const data = { entries: {} };
  const record = editor.createEntry(data);
  assert.equal(record.entry.selective, true);
  assert.equal(record.entry.useProbability, true);
  assert.equal(record.entry.addMemo, false);
  assert.equal(record.entry.scanDepth, null);
  assert.equal(record.entry.caseSensitive, null);
  assert.equal(record.entry.groupWeight, 100);
  assert.deepEqual(record.entry.triggers, []);
});

test('worldbook editor batch selection actions support object and array entries', () => {
  const objectData = editor.parseWorldbookText(JSON.stringify({
    entries: {
      a: { uid: 1, comment: 'A', disable: false },
      b: { uid: 2, comment: 'B', disable: false },
    },
  }));
  assert.equal(editor.setEntriesDisabled(objectData, ['a', 'b'], true), 2);
  assert.equal(objectData.entries.a.disable, true);
  assert.equal(editor.deleteEntries(objectData, ['a']), 1);
  assert.deepEqual(Object.keys(objectData.entries), ['b']);

  const arrayData = editor.parseWorldbookText(JSON.stringify({
    entries: [{ uid: 1 }, { uid: 2 }, { uid: 3 }],
  }));
  assert.equal(editor.deleteEntries(arrayData, ['1', '3']), 2);
  assert.deepEqual(arrayData.entries.map(entry => entry.uid), [2]);
});

test('worldbook editor batch find and replace reports literal field matches', () => {
  const data = editor.parseWorldbookText(JSON.stringify({
    entries: {
      a: {
        uid: 1,
        comment: '{{user}} title',
        key: ['{{user}}', 'other'],
        keysecondary: [],
        content: 'Hello {{user}} and {{USER}}.',
      },
      b: { uid: 2, comment: 'No match', key: [], content: 'Text' },
    },
  }));
  const matches = editor.findEntryMatches(data, '{{user}}');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].count, 4);
  assert.deepEqual(new Set(matches[0].details.map(detail => detail.field)), new Set(['title', 'keywords', 'content']));

  const result = editor.replaceEntryMatches(data, '{{user}}', '<user>');
  assert.deepEqual(result, { entriesChanged: 1, replacements: 4 });
  assert.equal(data.entries.a.comment, '<user> title');
  assert.deepEqual(data.entries.a.key, ['<user>', 'other']);
  assert.equal(data.entries.a.content, 'Hello <user> and <user>.');

  const contentOnly = editor.findEntryMatches(data, '<user>', { fields: ['content'], caseSensitive: true });
  assert.equal(contentOnly[0].count, 2);
  assert.deepEqual(contentOnly[0].details.map(detail => detail.field), ['content']);

  data.entries.a.key = ['remove', 'remove', 'keep'];
  const deleted = editor.replaceEntryMatches(data, 'remove', '', { fields: ['keywords'] });
  assert.deepEqual(deleted, { entriesChanged: 1, replacements: 2 });
  assert.deepEqual(data.entries.a.key, ['keep']);
});

test('worldbook undo manager supports bounded undo, redo, and branching edits', () => {
  const history = editor.createUndoManager(2);
  const state = { data: { entries: { a: { content: 'zero' } } }, selectedEntryId: 'a' };

  history.capture(state, 'First edit');
  state.data.entries.a.content = 'one';
  history.capture(state, 'Second edit');
  state.data.entries.a.content = 'two';
  history.capture(state, 'Third edit');
  state.data.entries.a.content = 'three';

  assert.deepEqual(history.status(), {
    canUndo: true,
    canRedo: false,
    undoCount: 2,
    redoCount: 0,
    undoLabel: 'Third edit',
    redoLabel: '',
  });

  const undoThird = history.undo(state);
  assert.equal(undoThird.label, 'Third edit');
  assert.equal(undoThird.state.data.entries.a.content, 'two');
  undoThird.state.data.entries.a.content = 'changed clone';

  const undoSecond = history.undo({ ...state, data: { entries: { a: { content: 'two' } } } });
  assert.equal(undoSecond.state.data.entries.a.content, 'one');
  assert.equal(history.undo(state), null);

  const redoSecond = history.redo(undoSecond.state);
  assert.equal(redoSecond.label, 'Second edit');
  assert.equal(redoSecond.state.data.entries.a.content, 'two');

  history.capture(redoSecond.state, 'New branch');
  assert.equal(history.status().canRedo, false);
});
