'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJsonArrayText } = require('../../webview-ui/scenario-fields.js');

test('scenario JSON fields accept arrays and reject invalid or lossy fallbacks', () => {
  assert.deepEqual(parseJsonArrayText('', 'Messages JSON'), []);
  assert.deepEqual(parseJsonArrayText('[{"role":"user","content":"hello"}]', 'Messages JSON'), [
    { role: 'user', content: 'hello' },
  ]);
  assert.throws(() => parseJsonArrayText('{', 'Messages JSON'), /contains invalid JSON/);
  assert.throws(() => parseJsonArrayText('{"role":"user"}', 'Messages JSON'), /must be a JSON array/);
});
