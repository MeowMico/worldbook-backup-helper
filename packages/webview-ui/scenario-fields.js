(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.WorldbookScenarioFields = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseJsonArrayText(text, label) {
    let value;
    try {
      value = JSON.parse(String(text || '[]'));
    } catch {
      throw new Error(`${label} contains invalid JSON.`);
    }
    if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array.`);
    return value;
  }

  return { parseJsonArrayText };
}));
