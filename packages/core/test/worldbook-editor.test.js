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

test('worldbook editor maps strategies, positions, lists, and token estimates', () => {
  const entry = { custom: 'kept' };
  editor.applyEntryStrategy(entry, 'constant');
  assert.equal(editor.entryStrategy(entry), 'constant');
  assert.equal(entry.constant, true);
  assert.equal(entry.selective, false);

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
