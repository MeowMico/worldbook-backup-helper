const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

let sanitizeFilename = null;
try {
  sanitizeFilename = require('sanitize-filename');
} catch {
  sanitizeFilename = null;
}

const PLUGIN_ID = 'worldbook-backup-helper';
const SNAPSHOT_TYPE = 'worldbook-backup-helper.snapshot';
const SNAPSHOT_VERSION = 1;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const info = {
  id: PLUGIN_ID,
  name: 'Worldbook Backup Helper',
  description: 'Local timestamped snapshots, labels, diffs, and restores for SillyTavern worldbooks.',
};

async function init(router) {
  router.use(express.json({ limit: '50mb' }));

  router.get('/ui', (_req, res) => sendPublicFile(res, 'index.html'));
  router.get('/static/:file', (req, res) => sendPublicFile(res, req.params.file));

  router.get('/worldbooks', asyncRoute(async (req, res) => {
    requireUser(req);
    const books = await listWorldbooks(req.user.directories);
    res.json({ ok: true, books });
  }));

  router.get('/snapshots', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.query.name);
    if (!name) return res.status(400).json({ ok: false, error: 'missing_name' });
    const snapshots = await listSnapshots(req.user.directories, name);
    res.json({ ok: true, snapshots });
  }));

  router.get('/snapshot', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.query.name);
    const file = cleanSnapshotFile(req.query.file);
    if (!name || !file) return res.status(400).json({ ok: false, error: 'missing_params' });
    const snapshot = await readSnapshot(req.user.directories, name, file);
    res.json({ ok: true, snapshot });
  }));

  router.post('/snapshots', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ ok: false, error: 'missing_name' });

    const data = req.body?.data && typeof req.body.data === 'object'
      ? req.body.data
      : await readWorldbook(req.user.directories, name);
    const result = await createSnapshot(req.user.directories, name, data, {
      label: req.body?.label,
      note: req.body?.note,
      reason: req.body?.reason || 'manual',
      skipDuplicate: req.body?.skipDuplicate !== false,
    });

    res.json({ ok: true, ...result });
  }));

  router.post('/snapshot/label', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.body?.name);
    const file = cleanSnapshotFile(req.body?.file);
    if (!name || !file) return res.status(400).json({ ok: false, error: 'missing_params' });

    const snapshot = await updateSnapshotLabel(req.user.directories, name, file, {
      label: req.body?.label,
      note: req.body?.note,
    });
    res.json({ ok: true, snapshot: summarizeSnapshot(snapshot, file) });
  }));

  router.post('/restore', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.body?.name);
    const file = cleanSnapshotFile(req.body?.file);
    if (!name || !file) return res.status(400).json({ ok: false, error: 'missing_params' });

    const snapshot = await readSnapshot(req.user.directories, name, file);
    const before = await createSnapshot(req.user.directories, name, await readWorldbook(req.user.directories, name), {
      label: `Before restore ${formatDateForLabel(new Date())}`,
      reason: 'pre-restore',
      skipDuplicate: false,
    });
    await writeWorldbook(req.user.directories, name, snapshot.data);
    res.json({ ok: true, restored: summarizeSnapshot(snapshot, file), before });
  }));

  router.get('/compare', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.query.name);
    const file = cleanSnapshotFile(req.query.file);
    if (!name || !file) return res.status(400).json({ ok: false, error: 'missing_params' });

    const current = await readWorldbook(req.user.directories, name);
    const snapshot = await readSnapshot(req.user.directories, name, file);
    res.json({
      ok: true,
      base: summarizeSnapshot(snapshot, file),
      current: summarizeWorldbook(name, current),
      diff: diffWorldbooks(snapshot.data, current),
    });
  }));

  router.get('/compare-snapshots', asyncRoute(async (req, res) => {
    requireUser(req);
    const name = cleanName(req.query.name);
    const leftFile = cleanSnapshotFile(req.query.left);
    const rightFile = cleanSnapshotFile(req.query.right);
    if (!name || !leftFile || !rightFile) return res.status(400).json({ ok: false, error: 'missing_params' });

    const left = await readSnapshot(req.user.directories, name, leftFile);
    const right = await readSnapshot(req.user.directories, name, rightFile);
    res.json({
      ok: true,
      base: summarizeSnapshot(left, leftFile),
      current: summarizeSnapshot(right, rightFile),
      diff: diffWorldbooks(left.data, right.data),
    });
  }));

  console.log(`[${PLUGIN_ID}] loaded. UI: /api/plugins/${PLUGIN_ID}/ui`);
}

async function exit() {
  return Promise.resolve();
}

function asyncRoute(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((error) => {
    console.error(`[${PLUGIN_ID}] request failed`, error);
    res.status(error.statusCode || 500).json({ ok: false, error: error.code || 'internal_error', message: error.message });
  });
}

function requireUser(req) {
  if (!req.user?.directories) {
    const error = new Error('SillyTavern user session is required.');
    error.statusCode = 403;
    error.code = 'missing_user';
    throw error;
  }
}

function sendPublicFile(res, requestedFile) {
  const file = path.basename(String(requestedFile || ''));
  const target = path.join(PUBLIC_DIR, file);
  if (!isPathInside(PUBLIC_DIR, target) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return res.sendStatus(404);
  }
  res.type(MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  return res.sendFile(target);
}

async function listWorldbooks(directories) {
  const files = await fsp.readdir(directories.worlds, { withFileTypes: true });
  const books = [];
  for (const file of files) {
    if (!file.isFile() || path.extname(file.name).toLowerCase() !== '.json') continue;
    const name = path.parse(file.name).name;
    try {
      const data = await readWorldbook(directories, name);
      books.push(summarizeWorldbook(name, data));
    } catch (error) {
      books.push({ name, file: file.name, error: error.message, entryCount: 0 });
    }
  }
  return books.sort((left, right) => left.name.localeCompare(right.name));
}

async function readWorldbook(directories, name) {
  const filePath = worldbookPath(directories, name);
  const text = await fsp.readFile(filePath, 'utf8');
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.entries || typeof data.entries !== 'object') {
    throw Object.assign(new Error('Worldbook must contain an entries object.'), { code: 'invalid_worldbook' });
  }
  return data;
}

async function writeWorldbook(directories, name, data) {
  if (!data || typeof data !== 'object' || !data.entries || typeof data.entries !== 'object') {
    throw Object.assign(new Error('Worldbook must contain an entries object.'), { code: 'invalid_worldbook' });
  }
  await writeJsonAtomic(worldbookPath(directories, name), data);
}

function worldbookPath(directories, name) {
  const filename = `${safeSegment(name)}.json`;
  const target = path.join(directories.worlds, filename);
  if (!isPathInside(directories.worlds, target)) {
    throw Object.assign(new Error('Invalid worldbook path.'), { code: 'invalid_path', statusCode: 400 });
  }
  return target;
}

async function createSnapshot(directories, name, data, options = {}) {
  const hash = hashObject(data);
  const snapshots = await listSnapshots(directories, name);
  const latest = snapshots[0];
  if (options.skipDuplicate && latest?.sourceHash === hash) {
    return { skipped: true, snapshot: latest };
  }

  const now = new Date();
  const dir = await ensureSnapshotDir(directories, name);
  const file = `${formatDateForFile(now)}__${hash.slice(0, 10)}.json`;
  const snapshot = {
    type: SNAPSHOT_TYPE,
    version: SNAPSHOT_VERSION,
    id: `${safeSegment(name)}:${file}`,
    bookName: name,
    bookFile: `${safeSegment(name)}.json`,
    label: cleanOptionalText(options.label) || defaultSnapshotLabel(options.reason),
    note: cleanOptionalText(options.note),
    reason: cleanOptionalText(options.reason) || 'manual',
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    sourceHash: hash,
    entryCount: countEntries(data),
    data,
  };
  await writeJsonAtomic(path.join(dir, file), snapshot);
  return { skipped: false, snapshot: summarizeSnapshot(snapshot, file) };
}

async function listSnapshots(directories, name) {
  const dir = snapshotDir(directories, name);
  if (!fs.existsSync(dir)) return [];
  const files = await fsp.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const file of files) {
    if (!file.isFile() || path.extname(file.name).toLowerCase() !== '.json') continue;
    try {
      const snapshot = JSON.parse(await fsp.readFile(path.join(dir, file.name), 'utf8'));
      if (snapshot?.type === SNAPSHOT_TYPE) {
        out.push(summarizeSnapshot(snapshot, file.name));
      }
    } catch (error) {
      out.push({ file: file.name, error: error.message, createdAtMs: 0 });
    }
  }
  return out.sort((left, right) => Number(right.createdAtMs || 0) - Number(left.createdAtMs || 0));
}

async function readSnapshot(directories, name, file) {
  const target = path.join(snapshotDir(directories, name), file);
  if (!isPathInside(snapshotDir(directories, name), target)) {
    throw Object.assign(new Error('Invalid snapshot path.'), { code: 'invalid_path', statusCode: 400 });
  }
  const snapshot = JSON.parse(await fsp.readFile(target, 'utf8'));
  if (snapshot?.type !== SNAPSHOT_TYPE || !snapshot.data) {
    throw Object.assign(new Error('Invalid snapshot file.'), { code: 'invalid_snapshot', statusCode: 400 });
  }
  return snapshot;
}

async function updateSnapshotLabel(directories, name, file, { label, note }) {
  const snapshot = await readSnapshot(directories, name, file);
  snapshot.label = cleanOptionalText(label) || snapshot.label || '';
  snapshot.note = cleanOptionalText(note);
  snapshot.updatedAt = new Date().toISOString();
  await writeJsonAtomic(path.join(snapshotDir(directories, name), file), snapshot);
  return snapshot;
}

async function ensureSnapshotDir(directories, name) {
  const dir = snapshotDir(directories, name);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

function snapshotDir(directories, name) {
  const root = path.join(directories.backups, PLUGIN_ID);
  const target = path.join(root, safeSegment(name));
  if (!isPathInside(root, target)) {
    throw Object.assign(new Error('Invalid snapshot directory.'), { code: 'invalid_path', statusCode: 400 });
  }
  return target;
}

function summarizeWorldbook(name, data) {
  return {
    name,
    file: `${safeSegment(name)}.json`,
    entryCount: countEntries(data),
    sourceHash: hashObject(data),
    title: cleanOptionalText(data?.name) || name,
    updatedAt: data?.extensions?.updatedAt || null,
  };
}

function summarizeSnapshot(snapshot, file) {
  return {
    file,
    id: snapshot.id || file,
    bookName: snapshot.bookName,
    label: snapshot.label || '',
    note: snapshot.note || '',
    reason: snapshot.reason || '',
    createdAt: snapshot.createdAt,
    createdAtMs: snapshot.createdAtMs || Date.parse(snapshot.createdAt || '') || 0,
    sourceHash: snapshot.sourceHash,
    entryCount: snapshot.entryCount ?? countEntries(snapshot.data),
  };
}

function diffWorldbooks(base, current) {
  const baseEntries = normalizeEntries(base?.entries);
  const currentEntries = normalizeEntries(current?.entries);
  const allIds = [...new Set([...Object.keys(baseEntries), ...Object.keys(currentEntries)])]
    .sort((left, right) => entryTitle(baseEntries[left] || currentEntries[left]).localeCompare(entryTitle(baseEntries[right] || currentEntries[right])));
  const entries = [];

  for (const id of allIds) {
    const before = baseEntries[id] || null;
    const after = currentEntries[id] || null;
    if (!before) {
      entries.push({ id, status: 'added', title: entryTitle(after), fields: [] });
      continue;
    }
    if (!after) {
      entries.push({ id, status: 'removed', title: entryTitle(before), fields: [] });
      continue;
    }

    const fields = diffEntryFields(before, after);
    if (fields.length) {
      entries.push({ id, status: 'changed', title: entryTitle(after), fields });
    }
  }

  return {
    summary: {
      added: entries.filter(x => x.status === 'added').length,
      removed: entries.filter(x => x.status === 'removed').length,
      changed: entries.filter(x => x.status === 'changed').length,
      unchanged: allIds.length - entries.length,
    },
    entries,
  };
}

function diffEntryFields(before, after) {
  const fields = ['comment', 'content', 'key', 'keysecondary', 'selectiveLogic', 'position', 'order', 'depth', 'constant', 'disable', 'probability', 'useProbability', 'excludeRecursion', 'preventRecursion'];
  return fields
    .map((field) => {
      const left = comparableField(before[field]);
      const right = comparableField(after[field]);
      if (left === right) return null;
      return {
        name: field,
        before: left,
        after: right,
        lines: field === 'content' || field === 'comment' ? diffLines(String(left), String(right)) : [],
      };
    })
    .filter(Boolean);
}

function diffLines(before, after) {
  const a = String(before || '').split(/\r?\n/);
  const b = String(after || '').split(/\r?\n/);
  const table = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ type: 'removed', text: a[i++] });
    } else {
      rows.push({ type: 'added', text: b[j++] });
    }
  }
  while (i < a.length) rows.push({ type: 'removed', text: a[i++] });
  while (j < b.length) rows.push({ type: 'added', text: b[j++] });
  return rows;
}

function normalizeEntries(entries) {
  if (!entries || typeof entries !== 'object') return {};
  if (Array.isArray(entries)) {
    return Object.fromEntries(entries.map((entry, index) => [String(entry.uid ?? entry.id ?? index), entry]));
  }
  return entries;
}

function entryTitle(entry) {
  return cleanOptionalText(entry?.comment) || cleanOptionalText(entry?.name) || cleanOptionalText(entry?.uid) || '(untitled)';
}

function comparableField(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return stableStringify(value);
  return value === undefined || value === null ? '' : String(value);
}

function countEntries(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== 'object') return 0;
  return Array.isArray(entries) ? entries.length : Object.keys(entries).length;
}

function hashObject(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

async function writeJsonAtomic(target, value) {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(temp, `${JSON.stringify(value, null, 4)}\n`, 'utf8');
  await fsp.rename(temp, target);
}

function cleanName(value) {
  const text = String(value ?? '').trim();
  return text.length ? text : '';
}

function cleanOptionalText(value) {
  return String(value ?? '').trim();
}

function cleanSnapshotFile(value) {
  const file = path.basename(String(value ?? '').trim());
  return file.endsWith('.json') ? file : '';
}

function safeSegment(value) {
  if (sanitizeFilename) {
    return sanitizeFilename(String(value ?? '').trim()) || 'untitled';
  }
  const cleaned = String(value ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+$/, '_')
    .trim();
  return cleaned || 'untitled';
}

function defaultSnapshotLabel(reason) {
  if (reason === 'auto') return 'Auto before save';
  if (reason === 'pre-restore') return 'Before restore';
  return 'Manual snapshot';
}

function formatDateForFile(date) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function formatDateForLabel(date) {
  return formatDateForFile(date).replace('_', ' ').replace(/-/g, ':').replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

module.exports = { init, exit, info };
