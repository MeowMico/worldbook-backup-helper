import { getRequestHeaders } from '/script.js';

const PLUGIN_ROOT = '/api/plugins/worldbook-backup-helper';
const DB_NAME = 'worldbook-backup-helper';
const DB_VERSION = 2;
const SNAPSHOT_STORE = 'snapshots';
const EXPERIMENT_STORE = 'experiments';

const app = {
  installed: false,
  snapshotInFlight: false,
  serverPluginAvailable: null,
  books: [],
  snapshots: [],
  experiments: [],
  activeBook: null,
  activeSnapshot: null,
  activeExperiment: null,
  activeView: 'snapshot',
  diffMode: 'current',
};

const ORIGINAL_FETCH = window.fetch.bind(window);

init();

function init() {
  if (app.installed) return;
  app.installed = true;
  installWorkbenchButton();
  installWorldbookEditInterceptor();
}

function installWorkbenchButton() {
  const add = () => {
    const menu = document.querySelector('#extensionsMenu');
    if (!menu || document.querySelector('#wbh-open-workbench')) return;

    const button = document.createElement('div');
    button.id = 'wbh-open-workbench';
    button.className = 'list-group-item flex-container flexGap5 interactable';
    button.tabIndex = 0;
    button.textContent = 'Worldbook Backups';
    button.addEventListener('click', openWorkbench);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWorkbench();
      }
    });
    menu.append(button);
  };

  add();
  const observer = new MutationObserver(add);
  observer.observe(document.body, { childList: true, subtree: true });
}

async function openWorkbench() {
  if (await hasServerPlugin()) {
    window.open(`${PLUGIN_ROOT}/ui`, '_blank', 'noopener,noreferrer');
    return;
  }

  ensureLocalWorkbench();
  await refreshLocalWorkbench();
  document.querySelector('#wbh-workbench').classList.add('open');
}

async function hasServerPlugin() {
  if (app.serverPluginAvailable !== null) return app.serverPluginAvailable;

  try {
    const response = await ORIGINAL_FETCH(`${PLUGIN_ROOT}/worldbooks`, { credentials: 'include' });
    app.serverPluginAvailable = response.ok;
  } catch {
    app.serverPluginAvailable = false;
  }

  return app.serverPluginAvailable;
}

function installWorldbookEditInterceptor() {
  window.fetch = async function worldbookBackupFetch(input, initOptions = {}) {
    const requestInfo = normalizeRequest(input, initOptions);
    if (shouldSnapshotBeforeSave(requestInfo)) {
      await snapshotBeforeSave(requestInfo.body);
      const response = await ORIGINAL_FETCH(input, initOptions);
      if (response.ok) {
        await snapshotAfterSave(requestInfo.body);
      }
      return response;
    }
    return ORIGINAL_FETCH(input, initOptions);
  };
}

function normalizeRequest(input, initOptions) {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.pathname
      : input?.url || '';
  const method = String(initOptions?.method || input?.method || 'GET').toUpperCase();
  const body = initOptions?.body || input?.body || null;
  return { url, method, body };
}

function shouldSnapshotBeforeSave({ url, method, body }) {
  if (app.snapshotInFlight || method !== 'POST' || !body) return false;
  try {
    const target = new URL(url, window.location.origin);
    return target.pathname === '/api/worldinfo/edit';
  } catch {
    return String(url).includes('/api/worldinfo/edit');
  }
}

async function snapshotBeforeSave(body) {
  let payload = null;
  try {
    payload = typeof body === 'string' ? JSON.parse(body) : null;
  } catch {
    payload = null;
  }

  const name = String(payload?.name || '').trim();
  if (!name) return;

  app.snapshotInFlight = true;
  try {
    if (await createRemoteSnapshot(name)) return;
    await createLocalSnapshot(name, {
      label: 'Before auto save',
      reason: 'auto',
      skipDuplicate: true,
    });
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Auto snapshot failed.', error);
  } finally {
    app.snapshotInFlight = false;
  }
}

async function createRemoteSnapshot(name) {
  if (app.serverPluginAvailable === false) return false;
  try {
    const response = await ORIGINAL_FETCH(`${PLUGIN_ROOT}/snapshots`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        name,
        reason: 'auto',
        label: 'Before auto save',
        skipDuplicate: true,
      }),
      credentials: 'include',
    });
    app.serverPluginAvailable = response.ok;
    return response.ok;
  } catch {
    app.serverPluginAvailable = false;
    return false;
  }
}

async function snapshotAfterSave(body) {
  let payload = null;
  try {
    payload = typeof body === 'string' ? JSON.parse(body) : null;
  } catch {
    payload = null;
  }

  const name = String(payload?.name || '').trim();
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : null;
  if (!name || !data) return;

  try {
    if (await createRemoteSnapshotFromData(name, data)) return;
    await createLocalSnapshotFromData(name, data, {
      label: 'After auto save',
      reason: 'auto-after',
      skipDuplicate: true,
    });
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Post-save snapshot failed.', error);
  }
}

async function createRemoteSnapshotFromData(name, data) {
  if (app.serverPluginAvailable === false) return false;
  try {
    const response = await ORIGINAL_FETCH(`${PLUGIN_ROOT}/snapshots`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        name,
        data,
        reason: 'auto-after',
        label: 'After auto save',
        skipDuplicate: true,
      }),
      credentials: 'include',
    });
    app.serverPluginAvailable = response.ok;
    return response.ok;
  } catch {
    app.serverPluginAvailable = false;
    return false;
  }
}

function ensureLocalWorkbench() {
  if (document.querySelector('#wbh-workbench')) return;

  const root = document.createElement('div');
  root.id = 'wbh-workbench';
  root.innerHTML = `
    <div class="wbh-panel" role="dialog" aria-modal="true" aria-label="Worldbook Backup Helper">
      <header class="wbh-header">
        <div>
          <h2>Worldbook Backup Helper</h2>
          <p id="wbh-status">Extension-only mode: snapshots are stored in this browser.</p>
        </div>
        <div class="wbh-actions">
          <button id="wbh-refresh" type="button">Refresh</button>
          <button id="wbh-close" type="button">Close</button>
        </div>
      </header>
      <main class="wbh-grid">
        <section class="wbh-pane">
          <div class="wbh-pane-head">
            <h3>Worldbooks</h3>
            <span id="wbh-book-count">0</span>
          </div>
          <input id="wbh-book-search" type="search" placeholder="Search">
          <div id="wbh-books" class="wbh-list"></div>
        </section>
        <section class="wbh-pane wbh-main">
          <div class="wbh-pane-head">
            <h3 id="wbh-active-title">No worldbook selected</h3>
            <span id="wbh-active-meta">0 entries</span>
          </div>
          <div class="wbh-experiment">
            <div class="wbh-experiment-text">
              <strong id="wbh-experiment-title">No experiment selected</strong>
              <small id="wbh-experiment-meta">Ready</small>
            </div>
            <div class="wbh-experiment-actions">
              <button id="wbh-start-experiment" type="button">Start</button>
              <button id="wbh-finish-experiment" type="button">Finish</button>
              <button id="wbh-keep-experiment" type="button">Keep</button>
              <button id="wbh-reject-experiment" type="button">Reject</button>
              <button id="wbh-restore-baseline" type="button">Baseline</button>
              <button id="wbh-restore-after" type="button">After</button>
            </div>
          </div>
          <div class="wbh-form">
            <input id="wbh-label" type="text" placeholder="Version name, e.g. 删减了 xxx">
            <button id="wbh-snapshot" type="button">Snapshot</button>
          </div>
          <div class="wbh-toolbar">
            <button id="wbh-mode-current" type="button" class="active">Current</button>
            <button id="wbh-mode-previous" type="button">Previous</button>
            <button id="wbh-restore" type="button" disabled>Restore</button>
          </div>
          <div id="wbh-diff-summary" class="wbh-diff-summary"></div>
          <div id="wbh-diff" class="wbh-diff">Select a snapshot</div>
        </section>
        <section class="wbh-pane wbh-side-stack">
          <div class="wbh-side-section">
            <div class="wbh-pane-head">
              <h3>Experiments</h3>
              <span id="wbh-experiment-count">0</span>
            </div>
            <div id="wbh-experiments" class="wbh-list"></div>
          </div>
          <div class="wbh-side-section">
            <div class="wbh-pane-head">
              <h3>Versions</h3>
              <span id="wbh-snapshot-count">0</span>
            </div>
            <div id="wbh-snapshots" class="wbh-list"></div>
          </div>
        </section>
      </main>
    </div>
  `;
  document.body.append(root);

  root.querySelector('#wbh-close').addEventListener('click', () => root.classList.remove('open'));
  root.querySelector('#wbh-refresh').addEventListener('click', refreshLocalWorkbench);
  root.querySelector('#wbh-book-search').addEventListener('input', renderBooks);
  root.querySelector('#wbh-snapshot').addEventListener('click', createManualLocalSnapshot);
  root.querySelector('#wbh-start-experiment').addEventListener('click', startExperiment);
  root.querySelector('#wbh-finish-experiment').addEventListener('click', finishExperiment);
  root.querySelector('#wbh-keep-experiment').addEventListener('click', () => setExperimentStatus('kept'));
  root.querySelector('#wbh-reject-experiment').addEventListener('click', () => setExperimentStatus('rejected'));
  root.querySelector('#wbh-restore-baseline').addEventListener('click', () => restoreExperimentSnapshot('baseline'));
  root.querySelector('#wbh-restore-after').addEventListener('click', () => restoreExperimentSnapshot('after'));
  root.querySelector('#wbh-mode-current').addEventListener('click', () => setDiffMode('current'));
  root.querySelector('#wbh-mode-previous').addEventListener('click', () => setDiffMode('previous'));
  root.querySelector('#wbh-restore').addEventListener('click', restoreLocalSnapshot);
}

async function refreshLocalWorkbench() {
  setStatus('Refreshing');
  app.books = await listWorldbooks();
  app.activeBook = app.activeBook
    ? app.books.find(book => book.name === app.activeBook.name) || app.books[0] || null
    : app.books[0] || null;
  renderBooks();
  await loadLocalSnapshots();
  setStatus('Ready');
}

async function listWorldbooks() {
  const result = await stPost('/api/worldinfo/list', {});
  return (Array.isArray(result) ? result : [])
    .map(item => ({
      name: String(item.file_id || item.name || '').trim(),
      title: String(item.name || item.file_id || '').trim(),
    }))
    .filter(book => book.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadWorldbook(name) {
  return stPost('/api/worldinfo/get', { name });
}

async function saveWorldbook(name, data) {
  return stPost('/api/worldinfo/edit', { name, data });
}

async function loadLocalSnapshots() {
  const activeSnapshotId = app.activeSnapshot?.id;
  const activeExperimentId = app.activeExperiment?.id;
  app.snapshots = app.activeBook ? await getSnapshots(app.activeBook.name) : [];
  app.experiments = app.activeBook ? await getExperiments(app.activeBook.name) : [];
  app.activeSnapshot = app.snapshots.find(snapshot => snapshot.id === activeSnapshotId) || app.snapshots[0] || null;
  app.activeExperiment = app.experiments.find(experiment => experiment.id === activeExperimentId) || (app.activeView === 'experiment' ? app.experiments[0] || null : null);
  if (!app.activeExperiment && app.activeView === 'experiment') app.activeView = 'snapshot';
  renderActiveBook();
  renderExperiments();
  renderSnapshots();
  await renderDiff();
}

function renderBooks() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const filter = root.querySelector('#wbh-book-search').value.trim().toLowerCase();
  const list = root.querySelector('#wbh-books');
  root.querySelector('#wbh-book-count').textContent = String(app.books.length);

  list.replaceChildren(...app.books
    .filter(book => book.name.toLowerCase().includes(filter) || book.title.toLowerCase().includes(filter))
    .map(book => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `wbh-row ${app.activeBook?.name === book.name ? 'active' : ''}`;
      button.innerHTML = '<span></span><small></small>';
      button.querySelector('span').textContent = book.title || book.name;
      button.querySelector('small').textContent = book.name;
      button.addEventListener('click', async () => {
        app.activeBook = book;
        app.activeSnapshot = null;
        app.activeExperiment = null;
        app.activeView = 'snapshot';
        renderBooks();
        await loadLocalSnapshots();
      });
      return button;
    }));
}

function renderActiveBook() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  root.querySelector('#wbh-active-title').textContent = app.activeBook?.title || app.activeBook?.name || 'No worldbook selected';
  root.querySelector('#wbh-active-meta').textContent = app.activeBook?.name || '0 entries';
  root.querySelector('#wbh-restore').disabled = !app.activeBook || app.activeView !== 'snapshot' || !app.activeSnapshot;
  renderExperimentPanel();
}

function renderExperimentPanel() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const experiment = app.activeView === 'experiment' ? app.activeExperiment : null;
  const title = root.querySelector('#wbh-experiment-title');
  const meta = root.querySelector('#wbh-experiment-meta');
  const start = root.querySelector('#wbh-start-experiment');
  const finish = root.querySelector('#wbh-finish-experiment');
  const keep = root.querySelector('#wbh-keep-experiment');
  const reject = root.querySelector('#wbh-reject-experiment');
  const baseline = root.querySelector('#wbh-restore-baseline');
  const after = root.querySelector('#wbh-restore-after');

  title.textContent = experiment?.title || 'No experiment selected';
  meta.textContent = experiment
    ? [
      statusLabel(experiment.status),
      formatDate(experiment.startedAt),
      experiment.changeNote || '',
    ].filter(Boolean).join(' | ')
    : 'Ready';

  start.disabled = !app.activeBook;
  finish.disabled = !app.activeBook || !experiment;
  finish.textContent = experiment?.afterSnapshotId ? 'Update After' : 'Finish';
  keep.disabled = !experiment;
  reject.disabled = !experiment;
  baseline.disabled = !experiment?.baselineSnapshotId;
  after.disabled = !experiment?.afterSnapshotId;
}

function renderExperiments() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-experiments');
  root.querySelector('#wbh-experiment-count').textContent = String(app.experiments.length);

  if (!app.experiments.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No experiments yet';
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...app.experiments.map(experiment => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `wbh-row ${app.activeView === 'experiment' && app.activeExperiment?.id === experiment.id ? 'active' : ''}`;
    button.innerHTML = '<span></span><small></small>';
    button.querySelector('span').textContent = experiment.title || 'Untitled experiment';
    button.querySelector('small').textContent = `${statusLabel(experiment.status)} | ${formatDate(experiment.startedAt)}`;
    button.addEventListener('click', async () => {
      app.activeView = 'experiment';
      app.activeExperiment = experiment;
      app.activeSnapshot = await getSnapshotById(experiment.afterSnapshotId || experiment.baselineSnapshotId) || app.activeSnapshot;
      renderActiveBook();
      renderExperiments();
      renderSnapshots();
      await renderDiff();
    });
    return button;
  }));
}

function renderSnapshots() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-snapshots');
  root.querySelector('#wbh-snapshot-count').textContent = String(app.snapshots.length);

  if (!app.snapshots.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No versions yet';
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...app.snapshots.map(snapshot => {
    const row = document.createElement('div');
    row.className = `wbh-snapshot-row ${app.activeView === 'snapshot' && app.activeSnapshot?.id === snapshot.id ? 'active' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'wbh-row';
    main.innerHTML = '<span></span><small></small>';
    main.querySelector('span').textContent = snapshot.label || 'Untitled version';
    main.querySelector('small').textContent = `${formatDate(snapshot.createdAt)} | ${snapshot.entryCount || 0} entries`;
    main.addEventListener('click', async () => {
      app.activeView = 'snapshot';
      app.activeExperiment = null;
      app.activeSnapshot = snapshot;
      renderActiveBook();
      renderExperiments();
      renderSnapshots();
      await renderDiff();
    });

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'wbh-mini';
    rename.textContent = 'Name';
    rename.addEventListener('click', async () => {
      const label = window.prompt('Version name', snapshot.label || '');
      if (label === null) return;
      snapshot.label = label.trim();
      await putSnapshot(snapshot);
      await loadLocalSnapshots();
    });

    row.append(main, rename);
    return row;
  }));
}

async function createManualLocalSnapshot() {
  if (!app.activeBook) return;
  const root = document.querySelector('#wbh-workbench');
  const label = root.querySelector('#wbh-label').value.trim();
  setStatus('Creating snapshot');
  const result = await createLocalSnapshot(app.activeBook.name, {
    label: label || 'Manual snapshot',
    reason: 'manual',
    skipDuplicate: false,
  });
  app.activeView = 'snapshot';
  app.activeExperiment = null;
  app.activeSnapshot = result.snapshot;
  root.querySelector('#wbh-label').value = '';
  setStatus(result.skipped ? 'Skipped duplicate' : 'Snapshot created');
  await loadLocalSnapshots();
}

async function createLocalSnapshot(name, { label = '', reason = 'manual', skipDuplicate = true } = {}) {
  const data = await loadWorldbook(name);
  return createLocalSnapshotFromData(name, data, { label, reason, skipDuplicate });
}

async function createLocalSnapshotFromData(name, data, { label = '', reason = 'manual', skipDuplicate = true } = {}) {
  const sourceHash = await hashObject(data);
  const snapshots = await getSnapshots(name);
  if (skipDuplicate && snapshots[0]?.sourceHash === sourceHash) {
    return { skipped: true, snapshot: snapshots[0] };
  }

  const now = new Date();
  const snapshot = {
    id: `${name}:${formatDateForFile(now)}:${sourceHash.slice(0, 10)}`,
    bookName: name,
    label,
    reason,
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    sourceHash,
    entryCount: countEntries(data),
    data,
  };
  await putSnapshot(snapshot);
  return { skipped: false, snapshot };
}

async function startExperiment() {
  if (!app.activeBook) return;
  const title = window.prompt('Experiment name / problem', '');
  if (title === null) return;

  const cleanTitle = title.trim() || `Experiment ${formatDate(new Date().toISOString())}`;
  setStatus('Starting experiment');
  const baseline = await createLocalSnapshot(app.activeBook.name, {
    label: `Baseline: ${cleanTitle}`,
    reason: 'experiment-baseline',
    skipDuplicate: false,
  });
  const now = new Date();
  const experiment = {
    id: `${app.activeBook.name}:experiment:${formatDateForFile(now)}:${randomId()}`,
    bookName: app.activeBook.name,
    title: cleanTitle,
    status: 'testing',
    startedAt: now.toISOString(),
    startedAtMs: now.getTime(),
    finishedAt: '',
    finishedAtMs: 0,
    baselineSnapshotId: baseline.snapshot.id,
    afterSnapshotId: '',
    changeNote: '',
    resultNote: '',
    parentExperimentId: app.activeView === 'experiment' ? app.activeExperiment?.id || '' : '',
  };

  await putExperiment(experiment);
  app.activeView = 'experiment';
  app.activeExperiment = experiment;
  app.activeSnapshot = baseline.snapshot;
  setStatus('Experiment started');
  await loadLocalSnapshots();
}

async function finishExperiment() {
  if (!app.activeBook || !app.activeExperiment) return;

  const note = window.prompt('Change / result note', app.activeExperiment.changeNote || '');
  if (note === null) return;

  setStatus(app.activeExperiment.afterSnapshotId ? 'Updating experiment' : 'Finishing experiment');
  const after = await createLocalSnapshot(app.activeBook.name, {
    label: `After: ${app.activeExperiment.title}`,
    reason: 'experiment-after',
    skipDuplicate: false,
  });
  const now = new Date();
  const updated = {
    ...app.activeExperiment,
    status: app.activeExperiment.status || 'testing',
    finishedAt: now.toISOString(),
    finishedAtMs: now.getTime(),
    afterSnapshotId: after.snapshot.id,
    changeNote: note.trim(),
  };

  await putExperiment(updated);
  app.activeView = 'experiment';
  app.activeExperiment = updated;
  app.activeSnapshot = after.snapshot;
  setStatus('Experiment saved');
  await loadLocalSnapshots();
}

async function setExperimentStatus(status) {
  if (!app.activeExperiment) return;
  const updated = {
    ...app.activeExperiment,
    status,
    decidedAt: new Date().toISOString(),
  };
  await putExperiment(updated);
  app.activeExperiment = updated;
  await loadLocalSnapshots();
}

async function restoreExperimentSnapshot(point) {
  if (!app.activeBook || !app.activeExperiment) return;
  const snapshotId = point === 'baseline'
    ? app.activeExperiment.baselineSnapshotId
    : app.activeExperiment.afterSnapshotId;
  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot) return;

  const label = point === 'baseline' ? 'baseline' : 'after';
  const ok = window.confirm(`Restore "${app.activeBook.name}" to ${label} of "${app.activeExperiment.title}"?`);
  if (!ok) return;

  setStatus('Restoring');
  await createLocalSnapshot(app.activeBook.name, {
    label: `Before restore ${formatDate(new Date().toISOString())}`,
    reason: 'pre-restore',
    skipDuplicate: false,
  });
  await saveWorldbook(app.activeBook.name, snapshot.data);
  app.activeView = 'experiment';
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus('Restored');
}

function setDiffMode(mode) {
  app.diffMode = mode;
  const root = document.querySelector('#wbh-workbench');
  root.querySelector('#wbh-mode-current').classList.toggle('active', mode === 'current');
  root.querySelector('#wbh-mode-previous').classList.toggle('active', mode === 'previous');
  void renderDiff();
}

async function renderDiff() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  renderActiveBook();
  const summary = root.querySelector('#wbh-diff-summary');
  const view = root.querySelector('#wbh-diff');

  if (app.activeView === 'experiment' && app.activeExperiment) {
    await renderExperimentDiff(summary, view);
    return;
  }

  if (!app.activeBook || !app.activeSnapshot) {
    summary.textContent = '';
    view.className = 'wbh-diff';
    view.textContent = 'Select a snapshot';
    return;
  }

  let base = app.activeSnapshot.data;
  let target = null;
  if (app.diffMode === 'current') {
    target = await loadWorldbook(app.activeBook.name);
  } else {
    const previous = getPreviousSnapshot(app.activeSnapshot);
    if (!previous) {
      summary.textContent = '';
      view.textContent = 'No previous version';
      return;
    }
    base = previous.data;
    target = app.activeSnapshot.data;
  }

  const diff = diffWorldbooks(base, target);
  summary.textContent = `+${diff.summary.added} -${diff.summary.removed} ~${diff.summary.changed} unchanged ${diff.summary.unchanged}`;
  view.replaceChildren(...renderDiffEntries(diff.entries));
}

async function renderExperimentDiff(summary, view) {
  const baseline = await getSnapshotById(app.activeExperiment.baselineSnapshotId);
  if (!app.activeBook || !baseline) {
    summary.textContent = '';
    view.textContent = 'No baseline';
    return;
  }

  const after = app.activeExperiment.afterSnapshotId
    ? await getSnapshotById(app.activeExperiment.afterSnapshotId)
    : null;
  const target = after?.data || await loadWorldbook(app.activeBook.name);
  const diff = diffWorldbooks(baseline.data, target);
  const range = after ? 'Baseline -> After' : 'Baseline -> Current';
  summary.textContent = `${range} | +${diff.summary.added} -${diff.summary.removed} ~${diff.summary.changed} unchanged ${diff.summary.unchanged}`;
  view.replaceChildren(...renderDiffEntries(diff.entries));
}

function renderDiffEntries(entries) {
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No changes';
    return [empty];
  }

  return entries.map(entry => {
    const section = document.createElement('section');
    section.className = `wbh-diff-entry ${entry.status}`;
    const title = document.createElement('h4');
    title.textContent = `${entry.status.toUpperCase()} ${entry.title}`;
    section.append(title);

    for (const field of entry.fields || []) {
      const block = document.createElement('div');
      block.className = 'wbh-field';
      const name = document.createElement('strong');
      name.textContent = field.name;
      block.append(name);

      if (field.lines?.length) {
        const pre = document.createElement('pre');
        for (const line of field.lines) {
          const row = document.createElement('span');
          row.className = line.type;
          row.textContent = `${line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}${line.text}\n`;
          pre.append(row);
        }
        block.append(pre);
      } else {
        const grid = document.createElement('div');
        grid.className = 'wbh-field-grid';
        const before = document.createElement('pre');
        const after = document.createElement('pre');
        before.textContent = field.before;
        after.textContent = field.after;
        grid.append(before, after);
        block.append(grid);
      }

      section.append(block);
    }
    return section;
  });
}

async function restoreLocalSnapshot() {
  if (!app.activeBook || !app.activeSnapshot) return;
  const ok = window.confirm(`Restore "${app.activeBook.name}" to "${app.activeSnapshot.label || app.activeSnapshot.createdAt}"?`);
  if (!ok) return;

  setStatus('Restoring');
  await createLocalSnapshot(app.activeBook.name, {
    label: `Before restore ${formatDate(new Date().toISOString())}`,
    reason: 'pre-restore',
    skipDuplicate: false,
  });
  await saveWorldbook(app.activeBook.name, app.activeSnapshot.data);
  await loadLocalSnapshots();
  setStatus('Restored');
}

function getPreviousSnapshot(snapshot) {
  const index = app.snapshots.findIndex(item => item.id === snapshot.id);
  return index >= 0 ? app.snapshots[index + 1] : null;
}

async function stPost(url, body) {
  const response = await ORIGINAL_FETCH(url, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(body || {}),
    credentials: 'include',
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const store = db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
        store.createIndex('bookName', 'bookName', { unique: false });
        store.createIndex('createdAtMs', 'createdAtMs', { unique: false });
      }
      if (!db.objectStoreNames.contains(EXPERIMENT_STORE)) {
        const store = db.createObjectStore(EXPERIMENT_STORE, { keyPath: 'id' });
        store.createIndex('bookName', 'bookName', { unique: false });
        store.createIndex('startedAtMs', 'startedAtMs', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSnapshots(bookName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const store = tx.objectStore(SNAPSHOT_STORE);
    const index = store.index('bookName');
    const request = index.getAll(bookName);
    request.onsuccess = () => {
      resolve((request.result || []).sort((left, right) => Number(right.createdAtMs || 0) - Number(left.createdAtMs || 0)));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putSnapshot(snapshot) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
    tx.objectStore(SNAPSHOT_STORE).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getSnapshotById(id) {
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const request = tx.objectStore(SNAPSHOT_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function getExperiments(bookName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPERIMENT_STORE, 'readonly');
    const store = tx.objectStore(EXPERIMENT_STORE);
    const index = store.index('bookName');
    const request = index.getAll(bookName);
    request.onsuccess = () => {
      resolve((request.result || []).sort((left, right) => Number(right.startedAtMs || 0) - Number(left.startedAtMs || 0)));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putExperiment(experiment) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPERIMENT_STORE, 'readwrite');
    tx.objectStore(EXPERIMENT_STORE).put(experiment);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
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
    if (fields.length) entries.push({ id, status: 'changed', title: entryTitle(after), fields });
  }

  return {
    summary: {
      added: entries.filter(item => item.status === 'added').length,
      removed: entries.filter(item => item.status === 'removed').length,
      changed: entries.filter(item => item.status === 'changed').length,
      unchanged: allIds.length - entries.length,
    },
    entries,
  };
}

function diffEntryFields(before, after) {
  const fields = ['comment', 'content', 'key', 'keysecondary', 'selectiveLogic', 'position', 'order', 'depth', 'constant', 'disable', 'probability', 'useProbability', 'excludeRecursion', 'preventRecursion'];
  return fields.map(field => {
    const left = comparableField(before[field]);
    const right = comparableField(after[field]);
    if (left === right) return null;
    return {
      name: field,
      before: left,
      after: right,
      lines: field === 'content' || field === 'comment' ? diffLines(String(left), String(right)) : [],
    };
  }).filter(Boolean);
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
  return cleanText(entry?.comment) || cleanText(entry?.name) || cleanText(entry?.uid) || '(untitled)';
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

async function hashObject(value) {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
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

function cleanText(value) {
  return String(value ?? '').trim();
}

function statusLabel(status) {
  if (status === 'kept') return 'Kept';
  if (status === 'rejected') return 'Rejected';
  return 'Testing';
}

function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(6))]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
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

function setStatus(message) {
  const status = document.querySelector('#wbh-status');
  if (status) status.textContent = message;
}
