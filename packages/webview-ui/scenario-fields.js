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

  function parseJsonObjectText(text, label) {
    let value;
    try {
      value = JSON.parse(String(text || '{}'));
    } catch {
      throw new Error(`${label} contains invalid JSON.`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return value;
  }

  function parseStringListText(text, label) {
    const source = String(text || '').trim();
    if (!source) return [];
    if (source.startsWith('[')) {
      return parseJsonArrayText(source, label).map(value => String(value).trim()).filter(Boolean);
    }
    return source.split(/[\n,]/).map(value => value.trim()).filter(Boolean);
  }

  return { parseJsonArrayText, parseJsonObjectText, parseStringListText };
}));
