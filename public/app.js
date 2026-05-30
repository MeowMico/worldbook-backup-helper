const apiRoot = '/api/plugins/worldbook-backup-helper';

const state = {
  books: [],
  snapshots: [],
  activeBook: null,
  activeSnapshot: null,
  diffMode: 'current',
};

const el = {
  statusLine: document.querySelector('#statusLine'),
  refreshButton: document.querySelector('#refreshButton'),
  snapshotButton: document.querySelector('#snapshotButton'),
  bookSearch: document.querySelector('#bookSearch'),
  bookCount: document.querySelector('#bookCount'),
  bookList: document.querySelector('#bookList'),
  activeTitle: document.querySelector('#activeTitle'),
  activeMeta: document.querySelector('#activeMeta'),
  snapshotLabel: document.querySelector('#snapshotLabel'),
  snapshotNote: document.querySelector('#snapshotNote'),
  compareCurrentButton: document.querySelector('#compareCurrentButton'),
  comparePreviousButton: document.querySelector('#comparePreviousButton'),
  restoreButton: document.querySelector('#restoreButton'),
  diffSummary: document.querySelector('#diffSummary'),
  diffView: document.querySelector('#diffView'),
  snapshotCount: document.querySelector('#snapshotCount'),
  snapshotList: document.querySelector('#snapshotList'),
  labelDialog: document.querySelector('#labelDialog'),
  dialogLabel: document.querySelector('#dialogLabel'),
  dialogNote: document.querySelector('#dialogNote'),
  saveLabelButton: document.querySelector('#saveLabelButton'),
};

let editingSnapshot = null;
let requestHeaders = { 'Content-Type': 'application/json' };

async function init() {
  await loadRequestHeaders();
  bindEvents();
  await refreshAll();
}

async function loadRequestHeaders() {
  try {
    const script = await import('/script.js');
    if (typeof script.getRequestHeaders === 'function') {
      requestHeaders = script.getRequestHeaders();
    }
  } catch {
    requestHeaders = { 'Content-Type': 'application/json' };
  }
}

function bindEvents() {
  el.refreshButton.addEventListener('click', refreshAll);
  el.snapshotButton.addEventListener('click', createManualSnapshot);
  el.bookSearch.addEventListener('input', renderBooks);
  el.compareCurrentButton.addEventListener('click', () => setDiffMode('current'));
  el.comparePreviousButton.addEventListener('click', () => setDiffMode('previous'));
  el.restoreButton.addEventListener('click', restoreSelectedSnapshot);
  el.saveLabelButton.addEventListener('click', saveSnapshotLabel);
}

async function refreshAll() {
  setStatus('Refreshing');
  state.books = await getJson('/worldbooks').then(x => x.books || []);
  if (!state.activeBook && state.books.length) {
    state.activeBook = state.books[0];
  } else if (state.activeBook) {
    state.activeBook = state.books.find(book => book.name === state.activeBook.name) || state.books[0] || null;
  }
  renderBooks();
  await loadSnapshots();
  setStatus('Ready');
}

async function loadSnapshots() {
  state.snapshots = [];
  state.activeSnapshot = null;
  if (state.activeBook) {
    state.snapshots = await getJson(`/snapshots?name=${encodeURIComponent(state.activeBook.name)}`).then(x => x.snapshots || []);
    state.activeSnapshot = state.snapshots[0] || null;
  }
  renderActiveBook();
  renderSnapshots();
  await renderDiff();
}

function renderBooks() {
  const filter = el.bookSearch.value.trim().toLowerCase();
  const books = state.books.filter(book => book.name.toLowerCase().includes(filter));
  el.bookCount.textContent = String(state.books.length);
  el.bookList.replaceChildren(...books.map(renderBookButton));
}

function renderBookButton(book) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `list-row ${state.activeBook?.name === book.name ? 'active' : ''}`;
  button.innerHTML = `
    <span class="row-title"></span>
    <span class="row-meta"></span>
  `;
  button.querySelector('.row-title').textContent = book.name;
  button.querySelector('.row-meta').textContent = `${book.entryCount || 0} entries`;
  button.addEventListener('click', async () => {
    state.activeBook = book;
    renderBooks();
    await loadSnapshots();
  });
  return button;
}

function renderActiveBook() {
  const book = state.activeBook;
  el.activeTitle.textContent = book?.name || 'No worldbook selected';
  el.activeMeta.textContent = book ? `${book.entryCount || 0} entries` : '0 entries';
  el.restoreButton.disabled = !book || !state.activeSnapshot;
}

function renderSnapshots() {
  el.snapshotCount.textContent = String(state.snapshots.length);
  if (!state.snapshots.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-list';
    empty.textContent = 'No versions';
    el.snapshotList.replaceChildren(empty);
    return;
  }
  el.snapshotList.replaceChildren(...state.snapshots.map(renderSnapshotRow));
}

function renderSnapshotRow(snapshot, index) {
  const row = document.createElement('div');
  row.className = `snapshot-row ${state.activeSnapshot?.file === snapshot.file ? 'active' : ''}`;

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'snapshot-main';
  main.innerHTML = `
    <span class="row-title"></span>
    <span class="row-meta"></span>
  `;
  main.querySelector('.row-title').textContent = snapshot.label || 'Untitled version';
  main.querySelector('.row-meta').textContent = `${formatDate(snapshot.createdAt)} | ${snapshot.entryCount || 0} entries`;
  main.addEventListener('click', async () => {
    state.activeSnapshot = snapshot;
    renderSnapshots();
    await renderDiff();
  });

  const rename = document.createElement('button');
  rename.type = 'button';
  rename.className = 'icon-button';
  rename.textContent = 'Name';
  rename.addEventListener('click', () => openLabelDialog(snapshot));

  row.append(main, rename);
  if (index === 0) {
    const latest = document.createElement('span');
    latest.className = 'latest-badge';
    latest.textContent = 'Latest';
    row.append(latest);
  }
  return row;
}

async function createManualSnapshot() {
  if (!state.activeBook) return;
  setStatus('Creating snapshot');
  const payload = {
    name: state.activeBook.name,
    label: el.snapshotLabel.value,
    note: el.snapshotNote.value,
    reason: 'manual',
  };
  const result = await postJson('/snapshots', payload);
  if (result.skipped) {
    setStatus('Skipped duplicate');
  } else {
    setStatus('Snapshot created');
  }
  el.snapshotLabel.value = '';
  el.snapshotNote.value = '';
  await refreshAll();
}

function setDiffMode(mode) {
  state.diffMode = mode;
  el.compareCurrentButton.classList.toggle('active', mode === 'current');
  el.comparePreviousButton.classList.toggle('active', mode === 'previous');
  void renderDiff();
}

async function renderDiff() {
  renderActiveBook();
  if (!state.activeBook || !state.activeSnapshot) {
    el.diffSummary.textContent = '';
    el.diffView.className = 'diff-view empty';
    el.diffView.textContent = 'Select a snapshot';
    return;
  }

  const base = state.diffMode === 'previous'
    ? getPreviousSnapshot(state.activeSnapshot)
    : state.activeSnapshot;
  if (!base) {
    el.diffSummary.textContent = '';
    el.diffView.className = 'diff-view empty';
    el.diffView.textContent = 'No previous version';
    return;
  }

  setStatus('Comparing');
  const data = state.diffMode === 'previous'
    ? await getJson(`/compare-snapshots?name=${encodeURIComponent(state.activeBook.name)}&left=${encodeURIComponent(base.file)}&right=${encodeURIComponent(state.activeSnapshot.file)}`)
    : await getJson(`/compare?name=${encodeURIComponent(state.activeBook.name)}&file=${encodeURIComponent(base.file)}`);
  el.diffSummary.textContent = `+${data.diff.summary.added} -${data.diff.summary.removed} ~${data.diff.summary.changed} unchanged ${data.diff.summary.unchanged}`;
  el.diffView.className = 'diff-view';
  el.diffView.replaceChildren(...renderDiffEntries(data.diff.entries));
  setStatus('Ready');
}

function renderDiffEntries(entries) {
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No changes';
    return [empty];
  }
  return entries.map((entry) => {
    const section = document.createElement('section');
    section.className = `diff-entry ${entry.status}`;
    const title = document.createElement('h3');
    title.textContent = `${entry.status.toUpperCase()} ${entry.title}`;
    section.append(title);

    if (entry.fields?.length) {
      for (const field of entry.fields) {
        section.append(renderFieldDiff(field));
      }
    }
    return section;
  });
}

function renderFieldDiff(field) {
  const wrap = document.createElement('div');
  wrap.className = 'field-diff';
  const title = document.createElement('h4');
  title.textContent = field.name;
  wrap.append(title);

  if (field.lines?.length) {
    const pre = document.createElement('pre');
    pre.className = 'line-diff';
    for (const line of field.lines) {
      const row = document.createElement('span');
      row.className = line.type;
      row.textContent = `${line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}${line.text}\n`;
      pre.append(row);
    }
    wrap.append(pre);
    return wrap;
  }

  const grid = document.createElement('div');
  grid.className = 'field-grid';
  const before = document.createElement('pre');
  const after = document.createElement('pre');
  before.textContent = field.before;
  after.textContent = field.after;
  grid.append(before, after);
  wrap.append(grid);
  return wrap;
}

function getPreviousSnapshot(snapshot) {
  const index = state.snapshots.findIndex(item => item.file === snapshot.file);
  return index >= 0 ? state.snapshots[index + 1] : null;
}

async function restoreSelectedSnapshot() {
  if (!state.activeBook || !state.activeSnapshot) return;
  const ok = window.confirm(`Restore "${state.activeBook.name}" to "${state.activeSnapshot.label || state.activeSnapshot.file}"?`);
  if (!ok) return;
  setStatus('Restoring');
  await postJson('/restore', { name: state.activeBook.name, file: state.activeSnapshot.file });
  await refreshAll();
  setStatus('Restored');
}

function openLabelDialog(snapshot) {
  editingSnapshot = snapshot;
  el.dialogLabel.value = snapshot.label || '';
  el.dialogNote.value = snapshot.note || '';
  el.labelDialog.showModal();
}

async function saveSnapshotLabel(event) {
  if (!editingSnapshot || !state.activeBook) return;
  event.preventDefault();
  await postJson('/snapshot/label', {
    name: state.activeBook.name,
    file: editingSnapshot.file,
    label: el.dialogLabel.value,
    note: el.dialogNote.value,
  });
  el.labelDialog.close();
  await loadSnapshots();
}

async function getJson(pathname) {
  const response = await fetch(`${apiRoot}${pathname}`, { credentials: 'include' });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function postJson(pathname, body) {
  const response = await fetch(`${apiRoot}${pathname}`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body || {}),
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function setStatus(message) {
  el.statusLine.textContent = message;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || 'Failed');
});
