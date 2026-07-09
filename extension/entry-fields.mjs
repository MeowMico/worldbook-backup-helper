const CHARACTER_FILTER_FIELD_MAP = Object.freeze({
  characterFilterNames: 'names',
  characterFilterTags: 'tags',
  characterFilterExclude: 'isExclude',
});

const CHARACTER_FILTER_KEYS = new Set(['names', 'tags', 'isExclude']);

export function isCharacterFilterField(field) {
  return Object.prototype.hasOwnProperty.call(CHARACTER_FILTER_FIELD_MAP, field);
}

export function getEntryFieldValue(entry, field) {
  if (!isCharacterFilterField(field)) return entry?.[field];
  const filter = readCharacterFilter(entry);
  return filter[CHARACTER_FILTER_FIELD_MAP[field]];
}

export function setEntryFieldValue(entry, field, value) {
  if (!entry || typeof entry !== 'object') return;
  if (!isCharacterFilterField(field)) {
    entry[field] = value;
    return;
  }

  const filter = readCharacterFilter(entry);
  const target = CHARACTER_FILTER_FIELD_MAP[field];
  filter[target] = target === 'isExclude' ? Boolean(value) : normalizeStringList(value);
  writeCharacterFilter(entry, filter);
}

export function normalizeEntryCharacterFilter(entry) {
  if (!entry || typeof entry !== 'object') return;
  const hasCharacterFilter = Object.prototype.hasOwnProperty.call(entry, 'characterFilter');
  const hasNested = isPlainObject(entry.characterFilter);
  const hasLegacy = Object.keys(CHARACTER_FILTER_FIELD_MAP).some(field => Object.prototype.hasOwnProperty.call(entry, field));
  if (!hasCharacterFilter && !hasNested && !hasLegacy) return;
  writeCharacterFilter(entry, readCharacterFilter(entry));
}

export function readCharacterFilter(entry) {
  const nested = isPlainObject(entry?.characterFilter) ? entry.characterFilter : null;
  const source = nested || entry || {};
  return {
    names: normalizeStringList(nested ? source.names : source.characterFilterNames),
    tags: normalizeStringList(nested ? source.tags : source.characterFilterTags),
    isExclude: booleanValue(nested ? source.isExclude : source.characterFilterExclude),
    extras: nested
      ? Object.fromEntries(Object.entries(nested).filter(([key]) => !CHARACTER_FILTER_KEYS.has(key)))
      : {},
  };
}

function writeCharacterFilter(entry, filter) {
  const names = normalizeStringList(filter.names);
  const tags = normalizeStringList(filter.tags);
  const isExclude = booleanValue(filter.isExclude);
  const extras = isPlainObject(filter.extras) ? filter.extras : {};

  if (names.length || tags.length || isExclude || Object.keys(extras).length) {
    entry.characterFilter = {
      ...extras,
      isExclude,
      names,
      tags,
    };
  } else {
    delete entry.characterFilter;
  }

  for (const field of Object.keys(CHARACTER_FILTER_FIELD_MAP)) delete entry[field];
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(/[\n,]/).map(item => item.trim()).filter(Boolean);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function booleanValue(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}
