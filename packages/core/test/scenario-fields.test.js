'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseJsonArrayText,
  parseJsonObjectText,
  parseStringListText,
} = require('../../webview-ui/scenario-fields.js');

test('scenario JSON fields accept arrays and reject invalid or lossy fallbacks', () => {
  assert.deepEqual(parseJsonArrayText('', 'Messages JSON'), []);
  assert.deepEqual(parseJsonArrayText('[{"role":"user","content":"hello"}]', 'Messages JSON'), [
    { role: 'user', content: 'hello' },
  ]);
  assert.throws(() => parseJsonArrayText('{', 'Messages JSON'), /contains invalid JSON/);
  assert.throws(() => parseJsonArrayText('{"role":"user"}', 'Messages JSON'), /must be a JSON array/);
});

test('scenario full JSON accepts objects and preserves unknown fields', () => {
  assert.deepEqual(parseJsonObjectText('{"seed":"fixed","unknown":true}', 'Scenario JSON'), {
    seed: 'fixed',
    unknown: true,
  });
  assert.throws(() => parseJsonObjectText('[1]', 'Scenario JSON'), /must be a JSON object/);
  assert.throws(() => parseJsonObjectText('{', 'Scenario JSON'), /contains invalid JSON/);
});

test('force-activate IDs accept friendly lines and legacy JSON arrays', () => {
  assert.deepEqual(parseStringListText('book:1\nbook:2, book:3', 'Force Activate IDs'), [
    'book:1',
    'book:2',
    'book:3',
  ]);
  assert.deepEqual(parseStringListText('["book:1", 2]', 'Force Activate IDs'), ['book:1', '2']);
  assert.throws(() => parseStringListText('[', 'Force Activate IDs'), /contains invalid JSON/);
});
