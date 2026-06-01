import { getRequestHeaders } from '/script.js';
import { saveWorldInfo } from '/scripts/world-info.js';

const PLUGIN_ROOT = '/api/plugins/worldbook-backup-helper';
const DB_NAME = 'worldbook-backup-helper';
const DB_VERSION = 2;
const SNAPSHOT_STORE = 'snapshots';
const EXPERIMENT_STORE = 'experiments';

const POSITION_OPTIONS = [
  { value: 0, label: 'Before Char Defs' },
  { value: 1, label: 'After Char Defs' },
  { value: 5, label: 'Before Example Messages' },
  { value: 6, label: 'After Example Messages' },
  { value: 2, label: 'Top of AN' },
  { value: 3, label: 'Bottom of AN' },
  { value: 4, label: '@ Depth' },
];

const ROLE_OPTIONS = [
  { value: 0, label: 'System' },
  { value: 1, label: 'User' },
  { value: 2, label: 'Assistant' },
];

const SELECTIVE_LOGIC_OPTIONS = [
  { value: 0, label: 'AND any' },
  { value: 3, label: 'AND all' },
  { value: 2, label: 'NOT any' },
  { value: 1, label: 'NOT all' },
];

const LIST_FIELDS = new Set(['key', 'keysecondary', 'characterFilterNames', 'characterFilterTags', 'triggers']);
const NUMBER_FIELDS = new Set(['order', 'position', 'depth', 'probability', 'selectiveLogic', 'role', 'groupWeight', 'sticky', 'cooldown', 'delay', 'scanDepth', 'delayUntilRecursion']);
const NULLABLE_NUMBER_FIELDS = new Set(['groupWeight', 'sticky', 'cooldown', 'delay', 'scanDepth']);
const TRI_STATE_BOOLEAN_FIELDS = new Set(['caseSensitive', 'matchWholeWords', 'useGroupScoring']);
const FIND_FIELDS = ['comment', 'content', 'key', 'keysecondary', 'group', 'automationId', 'outletName', 'characterFilterNames', 'characterFilterTags', 'triggers'];
const MAX_UNDO_STEPS = 80;
const THEME_MODES = ['auto', 'light', 'dark'];
const THEME_QUERY = window.matchMedia?.('(prefers-color-scheme: dark)');
const DIFF_ENTRY_FIELDS = [
  'comment',
  'content',
  'key',
  'keysecondary',
  'constant',
  'disable',
  'selective',
  'vectorized',
  'useProbability',
  'ignoreBudget',
  'position',
  'role',
  'depth',
  'order',
  'probability',
  'scanDepth',
  'selectiveLogic',
  'caseSensitive',
  'matchWholeWords',
  'group',
  'groupWeight',
  'useGroupScoring',
  'groupOverride',
  'excludeRecursion',
  'preventRecursion',
  'delayUntilRecursion',
  'addMemo',
  'sticky',
  'cooldown',
  'delay',
  'automationId',
  'outletName',
  'characterFilterNames',
  'characterFilterTags',
  'triggers',
  'characterFilterExclude',
  'matchPersonaDescription',
  'matchCharacterDescription',
  'matchCharacterPersonality',
  'matchCharacterDepthPrompt',
  'matchScenario',
  'matchCreatorNotes',
];
const DIFF_FIELD_LABELS = {
  comment: 'Title',
  content: 'Content',
  key: 'Keys',
  keysecondary: 'Secondary keys',
  constant: 'Constant',
  disable: 'Enabled',
  selective: 'Selective',
  vectorized: 'Vectorized',
  useProbability: 'Use probability',
  ignoreBudget: 'Ignore budget',
  position: 'Position',
  role: 'Role',
  depth: 'Depth',
  order: 'Order',
  probability: 'Probability',
  scanDepth: 'Scan depth',
  selectiveLogic: 'Selective logic',
  caseSensitive: 'Case sensitive',
  matchWholeWords: 'Whole words',
  group: 'Group',
  groupWeight: 'Group weight',
  useGroupScoring: 'Group scoring',
  groupOverride: 'Group override',
  excludeRecursion: 'Exclude recursion',
  preventRecursion: 'Prevent recursion',
  delayUntilRecursion: 'Delay until recursion',
  addMemo: 'Add memo',
  sticky: 'Sticky',
  cooldown: 'Cooldown',
  delay: 'Delay',
  automationId: 'Automation ID',
  outletName: 'Outlet name',
  characterFilterNames: 'Character names',
  characterFilterTags: 'Character tags',
  triggers: 'Triggers',
  characterFilterExclude: 'Exclude character filter',
  matchPersonaDescription: 'Match persona',
  matchCharacterDescription: 'Match description',
  matchCharacterPersonality: 'Match personality',
  matchCharacterDepthPrompt: 'Match depth prompt',
  matchScenario: 'Match scenario',
  matchCreatorNotes: 'Match creator notes',
};
const BOOLEAN_DIFF_FIELDS = new Set([
  'constant',
  'selective',
  'vectorized',
  'useProbability',
  'ignoreBudget',
  'groupOverride',
  'excludeRecursion',
  'preventRecursion',
  'delayUntilRecursion',
  'addMemo',
  'characterFilterExclude',
  'matchPersonaDescription',
  'matchCharacterDescription',
  'matchCharacterPersonality',
  'matchCharacterDepthPrompt',
  'matchScenario',
  'matchCreatorNotes',
]);

const ENTRY_DEFAULTS = {
  key: [],
  keysecondary: [],
  comment: '',
  content: '',
  constant: false,
  vectorized: false,
  selective: true,
  selectiveLogic: 0,
  addMemo: true,
  order: 100,
  position: 0,
  disable: false,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: 0,
  probability: 100,
  useProbability: true,
  depth: 4,
  role: null,
  scanDepth: null,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  outletName: '',
  group: '',
  groupOverride: false,
  groupWeight: null,
  automationId: '',
  sticky: null,
  cooldown: null,
  delay: null,
  characterFilterNames: [],
  characterFilterTags: [],
  characterFilterExclude: false,
  triggers: [],
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
};

const app = {
  installed: false,
  snapshotInFlight: false,
  serverPluginAvailable: null,
  books: [],
  snapshots: [],
  experiments: [],
  originSnapshot: null,
  activeBook: null,
  activeData: null,
  activeDataHash: '',
  editorSourceLabel: '',
  activeEntryId: null,
  activeSnapshot: null,
  activeExperiment: null,
  activeView: 'snapshot',
  mainTab: 'edit',
  editorDirty: false,
  findQuery: '',
  replaceText: '',
  findMatches: [],
  activeFindIndex: -1,
  undoStack: [],
  redoStack: [],
  pendingInputHistoryKey: '',
  diffChangeIndex: -1,
  booksCollapsed: readBooleanSetting('wbh-books-collapsed'),
  historyCollapsed: readBooleanSetting('wbh-history-collapsed'),
  findCollapsed: readBooleanSetting('wbh-find-collapsed'),
  writerMode: readBooleanSetting('wbh-writer-mode'),
  themeMode: readStringSetting('wbh-theme-mode', 'auto', THEME_MODES),
  diffMode: 'current',
};

const ORIGINAL_FETCH = window.fetch.bind(window);

init();

function init() {
  if (app.installed) return;
  app.installed = true;
  installThemeListener();
  installWorkbenchButton();
  installWorldbookEditInterceptor();
}

function installThemeListener() {
  if (!THEME_QUERY) return;
  const render = () => renderThemeMode();
  if (typeof THEME_QUERY.addEventListener === 'function') {
    THEME_QUERY.addEventListener('change', render);
  } else if (typeof THEME_QUERY.addListener === 'function') {
    THEME_QUERY.addListener(render);
  }
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
    await syncWorkbenchFromSavedWorldbook(name, data);
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Post-save snapshot failed.', error);
  }
}

async function syncWorkbenchFromSavedWorldbook(name, data) {
  if (app.activeBook?.name !== name || app.editorDirty) return;
  if (app.editorSourceLabel && app.editorSourceLabel !== 'Current') return;
  app.activeData = cloneValue(data);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = 'Current';
  ensureActiveEntry();
  renderEditor();
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
          <div class="wbh-theme-toggle" role="group" aria-label="Theme">
            <button type="button" data-wbh-theme="auto">Auto</button>
            <button type="button" data-wbh-theme="light">Light</button>
            <button type="button" data-wbh-theme="dark">Dark</button>
          </div>
          <button id="wbh-refresh" type="button">Refresh</button>
          <button id="wbh-close" type="button">Close</button>
        </div>
      </header>
      <main class="wbh-grid">
        <section id="wbh-book-pane" class="wbh-pane wbh-book-pane">
          <div class="wbh-pane-head wbh-book-head">
            <div class="wbh-book-title">
              <h3>Worldbooks</h3>
              <span id="wbh-book-count">0</span>
            </div>
            <button id="wbh-toggle-books" class="wbh-icon-button" type="button" title="Hide worldbooks" aria-label="Hide worldbooks">&lt;</button>
          </div>
          <div class="wbh-book-content">
            <input id="wbh-book-search" type="search" placeholder="Search">
            <div id="wbh-books" class="wbh-list"></div>
          </div>
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
              <button id="wbh-restore-origin" type="button">Origin</button>
              <button id="wbh-restore-baseline" type="button">Baseline</button>
              <button id="wbh-restore-after" type="button">After</button>
            </div>
          </div>
          <div class="wbh-viewbar">
            <div class="wbh-tabs">
              <button id="wbh-tab-edit" type="button" class="active">Edit</button>
              <button id="wbh-tab-diff" type="button">Diff</button>
            </div>
            <div class="wbh-view-options">
              <button id="wbh-toggle-writer" type="button" title="Focus the editor and tuck away side history">Writer</button>
              <button id="wbh-toggle-history" type="button" title="Show or hide the history sidebar">History</button>
            </div>
            <div class="wbh-editor-actions">
              <button id="wbh-editor-undo" type="button" disabled>Undo</button>
              <button id="wbh-editor-redo" type="button" disabled>Redo</button>
              <button id="wbh-entry-new" type="button">New</button>
              <button id="wbh-entry-duplicate" type="button" disabled>Duplicate</button>
              <button id="wbh-entry-delete" type="button" class="danger" disabled>Delete</button>
              <button id="wbh-editor-reload" type="button">Reload</button>
              <button id="wbh-editor-save" type="button" disabled>Save</button>
            </div>
          </div>
          <div id="wbh-editor-view" class="wbh-editor-view">
            <aside class="wbh-entry-pane">
              <div class="wbh-entry-pane-head">
                <strong>Entries</strong>
                <button id="wbh-toggle-find" type="button" title="Show or hide find and replace">Find</button>
              </div>
              <div class="wbh-findbar">
                <div class="wbh-find-row">
                  <input id="wbh-entry-search" type="search" placeholder="Find in entries">
                  <span id="wbh-find-count">0/0</span>
                </div>
                <div class="wbh-find-row wbh-find-actions">
                  <button id="wbh-find-prev" type="button">Prev</button>
                  <button id="wbh-find-next" type="button">Next</button>
                </div>
                <div class="wbh-find-row">
                  <input id="wbh-replace-text" type="text" placeholder="Replace">
                </div>
                <div class="wbh-find-row wbh-find-actions">
                  <button id="wbh-replace-one" type="button">Replace</button>
                  <button id="wbh-replace-all" type="button">All</button>
                </div>
              </div>
              <div id="wbh-entries" class="wbh-list"></div>
            </aside>
            <section class="wbh-entry-editor">
              <div class="wbh-entry-title">
                <h3 id="wbh-entry-title">No entry selected</h3>
                <span id="wbh-entry-meta"></span>
              </div>
              <label class="wbh-editor-field wbh-title-field">
                <span>Title</span>
                <input id="wbh-entry-comment" type="text" data-wbh-field="comment">
              </label>
              <label class="wbh-editor-field wbh-editor-field-wide wbh-content-field">
                <span>Content</span>
                <textarea id="wbh-entry-content" data-wbh-field="content" rows="12"></textarea>
              </label>
              <div class="wbh-editor-section wbh-activation-section">
                <h4>Activation</h4>
                <div class="wbh-editor-grid">
                  <label class="wbh-editor-field">
                    <span>Keys</span>
                    <textarea id="wbh-entry-key" data-wbh-field="key" rows="3"></textarea>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Secondary</span>
                    <textarea id="wbh-entry-keysecondary" data-wbh-field="keysecondary" rows="3"></textarea>
                  </label>
                </div>
                <div class="wbh-editor-grid wbh-editor-grid-compact">
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="constant">
                    <span>Constant</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="disable">
                    <span>Disabled</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="selective">
                    <span>Selective</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="vectorized">
                    <span>Vectorized</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="useProbability">
                    <span>Use Probability</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="ignoreBudget">
                    <span>Ignore Budget</span>
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-insertion-section">
                <h4>Insertion</h4>
                <div class="wbh-editor-grid wbh-editor-grid-3">
                  <label class="wbh-editor-field">
                    <span>Position</span>
                    <select data-wbh-field="position" data-wbh-type="number">
                      ${POSITION_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Role</span>
                    <select data-wbh-field="role" data-wbh-type="number">
                      <option value=""></option>
                      ${ROLE_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Depth</span>
                    <input type="number" data-wbh-field="depth">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Order</span>
                    <input type="number" data-wbh-field="order">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Probability</span>
                    <input type="number" data-wbh-field="probability" min="0" max="100">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Scan Depth</span>
                    <input type="number" data-wbh-field="scanDepth">
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-logic-section">
                <h4>Logic</h4>
                <div class="wbh-editor-grid wbh-editor-grid-3">
                  <label class="wbh-editor-field">
                    <span>Selective Logic</span>
                    <select data-wbh-field="selectiveLogic" data-wbh-type="number">
                      ${SELECTIVE_LOGIC_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Case Sensitive</span>
                    <select data-wbh-field="caseSensitive" data-wbh-type="tri-state">
                      <option value="">Global</option>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Whole Words</span>
                    <select data-wbh-field="matchWholeWords" data-wbh-type="tri-state">
                      <option value="">Global</option>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Group</span>
                    <input type="text" data-wbh-field="group">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Group Weight</span>
                    <input type="number" data-wbh-field="groupWeight">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Group Scoring</span>
                    <select data-wbh-field="useGroupScoring" data-wbh-type="tri-state">
                      <option value="">Global</option>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </label>
                </div>
                <div class="wbh-editor-grid wbh-editor-grid-compact">
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="groupOverride">
                    <span>Group Override</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="excludeRecursion">
                    <span>Exclude Recursion</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="preventRecursion">
                    <span>Prevent Recursion</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="delayUntilRecursion">
                    <span>Delay Until Recursion</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="addMemo">
                    <span>Add Memo</span>
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-timing-section">
                <h4>Timing and Filters</h4>
                <div class="wbh-editor-grid wbh-editor-grid-3">
                  <label class="wbh-editor-field">
                    <span>Sticky</span>
                    <input type="number" data-wbh-field="sticky">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Cooldown</span>
                    <input type="number" data-wbh-field="cooldown">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Delay</span>
                    <input type="number" data-wbh-field="delay">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Automation ID</span>
                    <input type="text" data-wbh-field="automationId">
                  </label>
                  <label class="wbh-editor-field">
                    <span>Outlet Name</span>
                    <input type="text" data-wbh-field="outletName">
                  </label>
                </div>
                <div class="wbh-editor-grid">
                  <label class="wbh-editor-field">
                    <span>Character Names</span>
                    <textarea data-wbh-field="characterFilterNames" rows="3"></textarea>
                  </label>
                  <label class="wbh-editor-field">
                    <span>Character Tags</span>
                    <textarea data-wbh-field="characterFilterTags" rows="3"></textarea>
                  </label>
                </div>
                <div class="wbh-editor-grid">
                  <label class="wbh-editor-field">
                    <span>Triggers</span>
                    <textarea data-wbh-field="triggers" rows="3"></textarea>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="characterFilterExclude">
                    <span>Exclude Character Filter</span>
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-match-section">
                <h4>Match Sources</h4>
                <div class="wbh-editor-grid wbh-editor-grid-compact">
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchPersonaDescription">
                    <span>Persona</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCharacterDescription">
                    <span>Description</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCharacterPersonality">
                    <span>Personality</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCharacterDepthPrompt">
                    <span>Depth Prompt</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchScenario">
                    <span>Scenario</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCreatorNotes">
                    <span>Creator Notes</span>
                  </label>
                </div>
              </div>
            </section>
          </div>
          <div id="wbh-diff-view" class="wbh-diff-view hidden">
            <div class="wbh-form">
              <textarea id="wbh-experiment-note-input" rows="2" placeholder="Experiment note, e.g. 这个版本不太适配 Gemini，下次用 Claude 试试"></textarea>
              <button id="wbh-save-experiment-note" type="button">Save note</button>
              <button id="wbh-snapshot" type="button">Snapshot</button>
            </div>
            <div class="wbh-toolbar">
              <button id="wbh-mode-current" type="button" class="active">Current</button>
              <button id="wbh-mode-previous" type="button">Previous</button>
              <button id="wbh-change-prev" type="button" disabled>Prev change</button>
              <button id="wbh-change-next" type="button" disabled>Next change</button>
              <button id="wbh-restore" type="button" disabled>Restore</button>
            </div>
            <div id="wbh-diff-summary" class="wbh-diff-summary"></div>
            <div id="wbh-diff" class="wbh-diff">Select a snapshot</div>
          </div>
        </section>
        <section class="wbh-pane wbh-side-stack">
          <div class="wbh-side-section wbh-origin-section">
            <div class="wbh-pane-head">
              <h3>Origin</h3>
              <span id="wbh-origin-count">0</span>
            </div>
            <div id="wbh-origin" class="wbh-list"></div>
          </div>
          <div class="wbh-side-section">
            <div class="wbh-pane-head">
              <h3>Experiments</h3>
              <span id="wbh-experiment-count">0</span>
            </div>
            <input id="wbh-experiment-search" type="search" placeholder="Search experiments">
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
  root.querySelectorAll('[data-wbh-theme]').forEach(button => {
    button.addEventListener('click', () => setThemeMode(button.dataset.wbhTheme));
  });
  root.querySelector('#wbh-toggle-books').addEventListener('click', toggleBooksPane);
  root.querySelector('#wbh-toggle-writer').addEventListener('click', toggleWriterMode);
  root.querySelector('#wbh-toggle-history').addEventListener('click', toggleHistoryPane);
  root.querySelector('#wbh-toggle-find').addEventListener('click', toggleFindPane);
  root.querySelector('#wbh-book-search').addEventListener('input', renderBooks);
  root.querySelector('#wbh-experiment-search').addEventListener('input', renderExperiments);
  root.querySelector('#wbh-entry-search').addEventListener('input', handleFindInput);
  root.querySelector('#wbh-entry-search').addEventListener('keydown', handleFindKeydown);
  root.querySelector('#wbh-replace-text').addEventListener('input', handleReplaceInput);
  root.querySelector('#wbh-find-prev').addEventListener('click', () => navigateFind(-1));
  root.querySelector('#wbh-find-next').addEventListener('click', () => navigateFind(1));
  root.querySelector('#wbh-replace-one').addEventListener('click', replaceCurrentFindMatch);
  root.querySelector('#wbh-replace-all').addEventListener('click', replaceAllFindMatches);
  root.querySelector('#wbh-tab-edit').addEventListener('click', () => setMainTab('edit'));
  root.querySelector('#wbh-tab-diff').addEventListener('click', () => setMainTab('diff'));
  root.querySelector('#wbh-editor-undo').addEventListener('click', undoEditorChange);
  root.querySelector('#wbh-editor-redo').addEventListener('click', redoEditorChange);
  root.querySelector('#wbh-entry-new').addEventListener('click', createEntry);
  root.querySelector('#wbh-entry-duplicate').addEventListener('click', duplicateEntry);
  root.querySelector('#wbh-entry-delete').addEventListener('click', deleteEntry);
  root.querySelector('#wbh-editor-reload').addEventListener('click', reloadEditorWorldbook);
  root.querySelector('#wbh-editor-save').addEventListener('click', saveEditorWorldbook);
  root.querySelector('#wbh-save-experiment-note').addEventListener('click', saveActiveExperimentNote);
  root.querySelector('#wbh-experiment-note-input').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    void saveActiveExperimentNote();
  });
  root.querySelector('#wbh-snapshot').addEventListener('click', createManualLocalSnapshot);
  root.querySelector('#wbh-start-experiment').addEventListener('click', startExperiment);
  root.querySelector('#wbh-finish-experiment').addEventListener('click', finishExperiment);
  root.querySelector('#wbh-keep-experiment').addEventListener('click', () => setExperimentStatus('kept'));
  root.querySelector('#wbh-reject-experiment').addEventListener('click', () => setExperimentStatus('rejected'));
  root.querySelector('#wbh-restore-origin').addEventListener('click', restoreOriginSnapshot);
  root.querySelector('#wbh-restore-baseline').addEventListener('click', () => restoreExperimentSnapshot('baseline'));
  root.querySelector('#wbh-restore-after').addEventListener('click', () => restoreExperimentSnapshot('after'));
  root.querySelector('#wbh-mode-current').addEventListener('click', () => setDiffMode('current'));
  root.querySelector('#wbh-mode-previous').addEventListener('click', () => setDiffMode('previous'));
  root.querySelector('#wbh-change-prev').addEventListener('click', () => navigateDiffChange(-1));
  root.querySelector('#wbh-change-next').addEventListener('click', () => navigateDiffChange(1));
  root.querySelector('#wbh-restore').addEventListener('click', restoreLocalSnapshot);
  root.querySelectorAll('[data-wbh-field]').forEach(input => {
    const eventName = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener('blur', finishInputHistory);
    input.addEventListener(eventName, () => updateActiveEntryFromEditor(input));
  });
  renderBooksPane();
  renderThemeMode();
  renderLayoutMode();
}

async function refreshLocalWorkbench() {
  if (!await confirmDiscardEditorChanges()) return;
  setStatus('Refreshing');
  app.books = await listWorldbooks();
  app.activeBook = app.activeBook
    ? app.books.find(book => book.name === app.activeBook.name) || app.books[0] || null
    : app.books[0] || null;
  await loadEditorWorldbook({ force: true });
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
  app.snapshotInFlight = true;
  try {
    await saveWorldInfo(name, cloneValue(data), true);
    await refreshNativeWorldInfoEditor(name);
  } finally {
    app.snapshotInFlight = false;
  }
}

async function refreshNativeWorldInfoEditor(name) {
  try {
    const select = document.querySelector('#world_editor_select');
    if (!select) return;

    const selected = select.selectedOptions?.[0];
    const selectedName = selected?.textContent?.trim();
    if (!selectedName || selectedName !== name) return;

    if (typeof window.$ === 'function') {
      window.$(select).trigger('change');
    } else {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Native worldbook editor refresh failed.', error);
  }
}

async function loadEditorWorldbook({ force = false } = {}) {
  if (!app.activeBook) {
    app.activeData = null;
    app.activeDataHash = '';
    app.editorSourceLabel = '';
    app.activeEntryId = null;
    app.editorDirty = false;
    resetEditorHistory({ render: false });
    renderEditor();
    return;
  }

  if (!force && app.activeData) {
    renderEditor();
    return;
  }

  const data = await loadWorldbook(app.activeBook.name);
  app.activeData = cloneValue(data);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = 'Current';
  await ensureOriginSnapshot(app.activeBook.name, app.activeData);
  app.editorDirty = false;
  resetEditorHistory({ render: false });
  ensureActiveEntry();
  renderEditor();
}

async function loadLocalSnapshots() {
  const activeSnapshotId = app.activeSnapshot?.id;
  const activeExperimentId = app.activeExperiment?.id;
  app.snapshots = app.activeBook ? await getSnapshots(app.activeBook.name) : [];
  app.experiments = app.activeBook ? await getExperiments(app.activeBook.name) : [];
  app.originSnapshot = app.snapshots.find(snapshot => snapshot.reason === 'origin') || null;
  app.activeSnapshot = app.snapshots.find(snapshot => snapshot.id === activeSnapshotId) || app.snapshots[0] || null;
  app.activeExperiment = app.experiments.find(experiment => experiment.id === activeExperimentId) || (app.activeView === 'experiment' ? app.experiments[0] || null : null);
  if (!app.activeExperiment && app.activeView === 'experiment') app.activeView = 'snapshot';
  renderActiveBook();
  renderOriginSnapshot();
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
        if (!await confirmDiscardEditorChanges()) return;
        app.activeBook = book;
        app.activeData = null;
        app.activeDataHash = '';
        app.activeEntryId = null;
        app.editorDirty = false;
        resetEditorHistory({ render: false });
        app.activeSnapshot = null;
        app.activeExperiment = null;
        app.activeView = 'snapshot';
        await loadEditorWorldbook({ force: true });
        renderBooks();
        await loadLocalSnapshots();
      });
      return button;
    }));
}

function toggleBooksPane() {
  app.booksCollapsed = !app.booksCollapsed;
  writeBooleanSetting('wbh-books-collapsed', app.booksCollapsed);
  renderBooksPane();
}

function toggleWriterMode() {
  app.writerMode = !app.writerMode;
  if (app.writerMode) app.historyCollapsed = true;
  writeBooleanSetting('wbh-writer-mode', app.writerMode);
  writeBooleanSetting('wbh-history-collapsed', app.historyCollapsed);
  renderLayoutMode();
}

function toggleHistoryPane() {
  app.historyCollapsed = !app.historyCollapsed;
  writeBooleanSetting('wbh-history-collapsed', app.historyCollapsed);
  renderLayoutMode();
}

function toggleFindPane() {
  app.findCollapsed = !app.findCollapsed;
  writeBooleanSetting('wbh-find-collapsed', app.findCollapsed);
  renderLayoutMode();
}

function setThemeMode(mode) {
  app.themeMode = THEME_MODES.includes(mode) ? mode : 'auto';
  writeStringSetting('wbh-theme-mode', app.themeMode);
  renderThemeMode();
}

function getResolvedThemeMode() {
  if (app.themeMode === 'light' || app.themeMode === 'dark') return app.themeMode;
  return THEME_QUERY?.matches ? 'dark' : 'light';
}

function renderThemeMode() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const resolved = getResolvedThemeMode();
  root.dataset.theme = resolved;
  root.dataset.themeMode = app.themeMode;
  root.querySelectorAll('[data-wbh-theme]').forEach(button => {
    const active = button.dataset.wbhTheme === app.themeMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderBooksPane() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const grid = root.querySelector('.wbh-grid');
  const pane = root.querySelector('#wbh-book-pane');
  const toggle = root.querySelector('#wbh-toggle-books');
  grid.classList.toggle('books-collapsed', app.booksCollapsed);
  pane.classList.toggle('collapsed', app.booksCollapsed);
  toggle.textContent = app.booksCollapsed ? '>' : '<';
  toggle.title = app.booksCollapsed ? 'Show worldbooks' : 'Hide worldbooks';
  toggle.setAttribute('aria-label', toggle.title);
  renderLayoutMode();
}

function renderLayoutMode() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const grid = root.querySelector('.wbh-grid');
  const entryPane = root.querySelector('.wbh-entry-pane');
  const writer = root.querySelector('#wbh-toggle-writer');
  const history = root.querySelector('#wbh-toggle-history');
  const find = root.querySelector('#wbh-toggle-find');

  root.classList.toggle('writer-mode', app.writerMode);
  grid?.classList.toggle('history-collapsed', app.historyCollapsed);
  entryPane?.classList.toggle('find-collapsed', app.findCollapsed);

  if (writer) {
    writer.classList.toggle('active', app.writerMode);
    writer.setAttribute('aria-pressed', String(app.writerMode));
  }
  if (history) {
    history.classList.toggle('active', !app.historyCollapsed);
    history.textContent = app.historyCollapsed ? 'Show history' : 'Hide history';
    history.setAttribute('aria-pressed', String(!app.historyCollapsed));
  }
  if (find) {
    find.classList.toggle('active', !app.findCollapsed);
    find.textContent = app.findCollapsed ? 'Find' : 'Hide find';
    find.setAttribute('aria-pressed', String(!app.findCollapsed));
  }
}

function renderActiveBook() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  root.querySelector('#wbh-active-title').textContent = app.activeBook?.title || app.activeBook?.name || 'No worldbook selected';
  const entryCount = app.activeData ? countEntries(app.activeData) : 0;
  const dirty = app.editorDirty ? ' | unsaved' : '';
  const source = app.editorSourceLabel && app.editorSourceLabel !== 'Current' ? ` | loaded: ${app.editorSourceLabel}` : '';
  root.querySelector('#wbh-active-meta').textContent = app.activeBook ? `${entryCount} entries${dirty}${source}` : '0 entries';
  root.querySelector('#wbh-restore').disabled = !app.activeBook || app.activeView !== 'snapshot' || !app.activeSnapshot;
  renderExperimentPanel();
  renderEditorState();
}

async function ensureOriginSnapshot(name, data) {
  const snapshots = await getSnapshots(name);
  if (snapshots.some(snapshot => snapshot.reason === 'origin')) return;

  const sourceHash = await hashObject(data);
  const now = new Date();
  await putSnapshot({
    id: `${name}:origin:${formatDateForFile(now)}:${sourceHash.slice(0, 10)}`,
    bookName: name,
    label: `Origin: ${name}`,
    reason: 'origin',
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    sourceHash,
    entryCount: countEntries(data),
    data: cloneValue(data),
  });
}

function renderExperimentPanel() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const experiment = app.activeView === 'experiment' ? app.activeExperiment : null;
  const title = root.querySelector('#wbh-experiment-title');
  const meta = root.querySelector('#wbh-experiment-meta');
  const noteInput = root.querySelector('#wbh-experiment-note-input');
  const saveNote = root.querySelector('#wbh-save-experiment-note');
  const start = root.querySelector('#wbh-start-experiment');
  const finish = root.querySelector('#wbh-finish-experiment');
  const keep = root.querySelector('#wbh-keep-experiment');
  const reject = root.querySelector('#wbh-reject-experiment');
  const origin = root.querySelector('#wbh-restore-origin');
  const baseline = root.querySelector('#wbh-restore-baseline');
  const after = root.querySelector('#wbh-restore-after');
  const openExperiment = getOpenExperiment();
  const experimentOpen = isExperimentOpen(experiment);

  title.textContent = experiment?.title || 'No experiment selected';
  meta.textContent = experiment
    ? [
      statusLabel(experiment.status),
      formatDate(experiment.startedAt),
      experiment.changeNote || '',
    ].filter(Boolean).join(' | ')
    : 'Ready';
  if (noteInput) {
    noteInput.disabled = !experiment;
    noteInput.placeholder = experiment
      ? 'Experiment note, e.g. 这个版本不太适配 Gemini，下次用 Claude 试试'
      : 'Select an experiment to write a note';
    if (document.activeElement !== noteInput) noteInput.value = experiment?.resultNote || '';
  }
  if (saveNote) saveNote.disabled = !experiment;

  start.disabled = !app.activeBook || Boolean(openExperiment);
  start.title = openExperiment ? `Finish "${openExperiment.title || 'current experiment'}" before starting another` : '';
  finish.disabled = !app.activeBook || !experiment;
  finish.textContent = experimentOpen ? 'Finish' : experiment?.afterSnapshotId ? 'Update After' : 'Finish';
  keep.disabled = !experiment;
  reject.disabled = !experiment;
  origin.disabled = !app.activeBook || !app.originSnapshot;
  baseline.disabled = !experiment?.baselineSnapshotId;
  after.disabled = !experiment?.afterSnapshotId;
}

function getOpenExperiment() {
  return app.activeBook
    ? app.experiments.find(experiment => experiment.bookName === app.activeBook.name && isExperimentOpen(experiment)) || null
    : null;
}

function isExperimentOpen(experiment) {
  return Boolean(experiment && !experiment.finishedAt && !experiment.finishedAtMs);
}

function renderOriginSnapshot() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-origin');
  root.querySelector('#wbh-origin-count').textContent = app.originSnapshot ? '1' : '0';

  if (!app.originSnapshot) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No origin yet';
    list.replaceChildren(empty);
    return;
  }

  const row = document.createElement('div');
  row.className = `wbh-history-row ${app.activeView === 'snapshot' && app.activeSnapshot?.id === app.originSnapshot.id ? 'active' : ''}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'wbh-row';
  button.innerHTML = '<span></span><small></small>';
  button.querySelector('span').textContent = app.originSnapshot.label || 'Origin';
  button.querySelector('small').textContent = `${formatDate(app.originSnapshot.createdAt)} | ${app.originSnapshot.entryCount || 0} entries`;
  button.addEventListener('click', async () => {
    await loadSnapshotIntoEditor(app.originSnapshot, 'Origin');
  });

  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'wbh-mini';
  restore.textContent = 'Restore';
  restore.addEventListener('click', async () => restoreSnapshot(app.originSnapshot, 'Origin'));

  row.append(button, restore);
  list.replaceChildren(row);
}

function renderExperiments() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-experiments');
  const search = root.querySelector('#wbh-experiment-search').value.trim().toLowerCase();
  const visibleExperiments = search
    ? app.experiments.filter(experiment => experimentSearchText(experiment).toLowerCase().includes(search))
    : app.experiments;
  root.querySelector('#wbh-experiment-count').textContent = search
    ? `${visibleExperiments.length}/${app.experiments.length}`
    : String(app.experiments.length);

  if (!app.experiments.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No experiments yet';
    list.replaceChildren(empty);
    return;
  }

  if (!visibleExperiments.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No matching experiments';
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...visibleExperiments.map(experiment => {
    const row = document.createElement('div');
    row.className = `wbh-history-row ${app.activeView === 'experiment' && app.activeExperiment?.id === experiment.id ? 'active' : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wbh-row';
    button.innerHTML = '<span></span><small></small>';
    button.querySelector('span').textContent = experiment.title || 'Untitled experiment';
    button.querySelector('small').textContent = experimentMeta(experiment);
    button.addEventListener('click', async () => {
      app.activeView = 'experiment';
      app.mainTab = 'diff';
      app.activeExperiment = experiment;
      app.activeSnapshot = await getSnapshotById(experiment.afterSnapshotId || experiment.baselineSnapshotId) || app.activeSnapshot;
      renderActiveBook();
      renderOriginSnapshot();
      renderExperiments();
      renderSnapshots();
      await renderDiff({ focusChange: true });
      setStatus(`Viewing experiment: ${experiment.title || 'Untitled experiment'}`);
    });

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'wbh-mini';
    rename.textContent = 'Name';
    rename.addEventListener('click', async () => renameExperiment(experiment));

    const note = document.createElement('button');
    note.type = 'button';
    note.className = 'wbh-mini';
    note.textContent = 'Note';
    note.addEventListener('click', async () => editExperimentNote(experiment));

    const exportJson = document.createElement('button');
    exportJson.type = 'button';
    exportJson.className = 'wbh-mini';
    exportJson.textContent = 'JSON';
    exportJson.title = 'Export experiment JSON';
    exportJson.addEventListener('click', async () => exportExperimentJson(experiment));

    row.append(button, exportJson, note, rename);
    return row;
  }));
}

function experimentMeta(experiment) {
  const parts = [statusLabel(experiment.status), formatDate(experiment.startedAt)];
  if (experiment.changeNote) parts.push(`change: ${experiment.changeNote}`);
  if (experiment.resultNote) parts.push(`note: ${experiment.resultNote}`);
  return parts.join(' | ');
}

function experimentSearchText(experiment) {
  return [
    experiment.title,
    statusLabel(experiment.status),
    experiment.status,
    experiment.changeNote,
    experiment.resultNote,
    experiment.startedAt,
    experiment.finishedAt,
  ].map(comparableField).join('\n');
}

async function renameExperiment(experiment) {
  if (!experiment) return;
  const title = window.prompt('Experiment name / problem', experiment.title || '');
  if (title === null) return;

  const updated = {
    ...experiment,
    title: title.trim() || 'Untitled experiment',
  };
  await putExperiment(updated);
  if (app.activeExperiment?.id === updated.id) app.activeExperiment = updated;
  await loadLocalSnapshots();
  setStatus('Experiment renamed');
}

async function editExperimentNote(experiment) {
  if (!experiment) return;
  const note = window.prompt('Experiment note', experiment.resultNote || experiment.changeNote || '');
  if (note === null) return;

  const updated = {
    ...experiment,
    resultNote: note.trim(),
  };
  await putExperiment(updated);
  if (app.activeExperiment?.id === updated.id) app.activeExperiment = updated;
  await loadLocalSnapshots();
  setStatus('Experiment note saved');
}

async function saveActiveExperimentNote() {
  const root = document.querySelector('#wbh-workbench');
  const experiment = app.activeView === 'experiment' ? app.activeExperiment : null;
  if (!root || !experiment) return;

  const note = root.querySelector('#wbh-experiment-note-input')?.value.trim() || '';
  const updated = {
    ...experiment,
    resultNote: note,
  };
  await putExperiment(updated);
  if (app.activeExperiment?.id === updated.id) app.activeExperiment = updated;
  await loadLocalSnapshots();
  setStatus('Experiment note saved');
}

async function exportExperimentJson(experiment) {
  if (!experiment) return;

  const baseline = await getSnapshotById(experiment.baselineSnapshotId);
  const after = await getSnapshotById(experiment.afterSnapshotId);
  const payload = {
    type: 'worldbook-backup-helper-experiment',
    version: 1,
    exportedAt: new Date().toISOString(),
    bookName: experiment.bookName,
    experiment: cloneValue(experiment),
    versions: {
      baseline: baseline ? cloneValue(baseline) : null,
      after: after ? cloneValue(after) : null,
    },
  };
  const filename = `${safeFileName(experiment.title || 'experiment')}-${formatDateForFile(new Date())}.json`;
  downloadJson(filename, payload);
  setStatus('Experiment JSON exported');
}

async function loadSnapshotIntoEditor(snapshot, sourceName = 'Version') {
  if (!app.activeBook || !snapshot) return;
  if (!await confirmDiscardEditorChanges()) return;

  app.activeData = cloneValue(snapshot.data);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = snapshot.label || sourceName;
  app.editorDirty = false;
  resetEditorHistory({ render: false });
  app.activeEntryId = null;
  ensureActiveEntry();
  app.activeView = 'snapshot';
  const showChanges = sourceName === 'Version';
  app.mainTab = showChanges ? 'diff' : 'edit';
  if (showChanges) {
    app.diffMode = 'previous';
    app.diffChangeIndex = -1;
  }
  app.activeExperiment = null;
  app.activeSnapshot = snapshot;
  renderEditor();
  renderOriginSnapshot();
  renderExperiments();
  renderSnapshots();
  if (showChanges) await renderDiff({ focusChange: true });
  setStatus(`Loaded ${sourceName.toLowerCase()} for editing: ${snapshot.label || formatDate(snapshot.createdAt)}`);
}

function setMainTab(tab) {
  app.mainTab = tab;
  renderEditorState();
  if (tab === 'diff') void renderDiff();
}

function renderEditor() {
  renderActiveBook();
  renderEditorState();
  renderEntryList();
  renderEntryEditor();
}

function renderEditorState() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  root.querySelector('#wbh-tab-edit').classList.toggle('active', app.mainTab === 'edit');
  root.querySelector('#wbh-tab-diff').classList.toggle('active', app.mainTab === 'diff');
  root.querySelector('#wbh-mode-current').classList.toggle('active', app.diffMode === 'current');
  root.querySelector('#wbh-mode-previous').classList.toggle('active', app.diffMode === 'previous');
  root.querySelector('#wbh-editor-view').classList.toggle('hidden', app.mainTab !== 'edit');
  root.querySelector('#wbh-diff-view').classList.toggle('hidden', app.mainTab !== 'diff');
  root.querySelector('#wbh-editor-undo').disabled = !app.activeData || !app.undoStack.length;
  root.querySelector('#wbh-editor-redo').disabled = !app.activeData || !app.redoStack.length;
  root.querySelector('#wbh-editor-save').disabled = !app.activeBook || !app.activeData || !app.editorDirty;
  root.querySelector('#wbh-editor-reload').disabled = !app.activeBook;
  root.querySelector('#wbh-entry-new').disabled = !app.activeBook || !app.activeData;
  root.querySelector('#wbh-entry-duplicate').disabled = !getActiveEntryRecord();
  root.querySelector('#wbh-entry-delete').disabled = !getActiveEntryRecord();
  renderLayoutMode();
  renderFindControls();
  updateDiffChangeControls();
}

function handleFindInput() {
  refreshFindMatches({ resetIndex: true });
  renderEntryList();
  renderFindControls();
}

function handleFindKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  navigateFind(event.shiftKey ? -1 : 1);
}

function handleReplaceInput() {
  const root = document.querySelector('#wbh-workbench');
  app.replaceText = root?.querySelector('#wbh-replace-text')?.value || '';
}

function renderEntryList() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-entries');
  refreshFindMatches();
  const search = app.findQuery.trim();
  const matchesByEntry = getFindCountsByEntry();
  const entries = getSortedEntryRecords(app.activeData)
    .filter(record => {
      if (!search) return true;
      return matchesByEntry.has(record.id);
    });

  if (!app.activeData) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No worldbook loaded';
    list.replaceChildren(empty);
    renderFindControls();
    return;
  }

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No entries';
    list.replaceChildren(empty);
    renderFindControls();
    return;
  }

  const activeMatch = getActiveFindMatch();
  list.replaceChildren(...entries.map(record => {
    const matchCount = matchesByEntry.get(record.id) || 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `wbh-row ${app.activeEntryId === record.id ? 'active' : ''} ${activeMatch?.entryId === record.id ? 'find-active' : ''}`;
    button.innerHTML = '<span></span><small></small>';
    button.querySelector('span').textContent = entryTitle(record.entry);
    button.querySelector('small').textContent = matchCount
      ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'} | ${entryMeta(record.entry)}`
      : entryMeta(record.entry);
    button.addEventListener('click', () => {
      app.activeEntryId = record.id;
      const firstMatch = app.findMatches.findIndex(match => match.entryId === record.id);
      if (firstMatch >= 0) app.activeFindIndex = firstMatch;
      renderEntryList();
      renderEntryEditor();
      if (firstMatch >= 0) queueFocusActiveFindMatch();
    });
    return button;
  }));
  renderFindControls();
}

function renderEntryEditor() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const record = getActiveEntryRecord();
  const inputs = getEditorInputs(root);
  const disabled = !record;

  root.querySelector('#wbh-entry-title').textContent = record ? entryTitle(record.entry) : 'No entry selected';
  root.querySelector('#wbh-entry-meta').textContent = record ? entryMeta(record.entry) : '';
  Object.values(inputs).forEach(input => {
    input.disabled = disabled;
  });

  if (!record) {
    setEditorInputValues(inputs, {});
    renderFindControls();
    return;
  }

  setEditorInputValues(inputs, record.entry);
  renderFindControls();
}

function refreshFindMatches({ resetIndex = false } = {}) {
  const root = document.querySelector('#wbh-workbench');
  const previousMatch = getActiveFindMatch();
  const query = root?.querySelector('#wbh-entry-search')?.value ?? app.findQuery ?? '';
  const queryChanged = query !== app.findQuery;
  app.findQuery = query;
  app.findMatches = app.activeData && app.findQuery.trim()
    ? collectFindMatches(app.findQuery.trim())
    : [];

  if (!app.findMatches.length) {
    app.activeFindIndex = -1;
    return;
  }

  if (resetIndex || queryChanged) {
    const activeEntryIndex = app.activeEntryId
      ? app.findMatches.findIndex(match => match.entryId === app.activeEntryId)
      : -1;
    app.activeFindIndex = activeEntryIndex >= 0 ? activeEntryIndex : 0;
    return;
  }

  if (previousMatch) {
    const sameIndex = app.findMatches.findIndex(match => sameFindMatch(match, previousMatch));
    if (sameIndex >= 0) {
      app.activeFindIndex = sameIndex;
      return;
    }
  }

  if (app.activeFindIndex < 0) {
    app.activeFindIndex = 0;
  } else if (app.activeFindIndex >= app.findMatches.length) {
    app.activeFindIndex = app.findMatches.length - 1;
  }
}

function collectFindMatches(query) {
  const needle = query.toLowerCase();
  if (!needle) return [];

  const matches = [];
  for (const record of getSortedEntryRecords(app.activeData)) {
    for (const field of FIND_FIELDS) {
      const value = findFieldText(record.entry, field);
      const haystack = value.toLowerCase();
      let start = haystack.indexOf(needle);
      while (start >= 0) {
        matches.push({
          entryId: record.id,
          field,
          start,
          end: start + query.length,
        });
        start = haystack.indexOf(needle, start + Math.max(needle.length, 1));
      }
    }
  }
  return matches;
}

function getFindCountsByEntry() {
  const counts = new Map();
  for (const match of app.findMatches) {
    counts.set(match.entryId, (counts.get(match.entryId) || 0) + 1);
  }
  return counts;
}

function renderFindControls() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const total = app.findMatches.length;
  const count = root.querySelector('#wbh-find-count');
  const hasQuery = Boolean(app.findQuery.trim());
  count.textContent = hasQuery ? `${total ? app.activeFindIndex + 1 : 0}/${total}` : '0/0';
  root.querySelector('#wbh-find-prev').disabled = !total;
  root.querySelector('#wbh-find-next').disabled = !total;
  root.querySelector('#wbh-replace-one').disabled = !total;
  root.querySelector('#wbh-replace-all').disabled = !total;
}

function navigateFind(direction) {
  refreshFindMatches();
  if (!app.findMatches.length) {
    renderEntryList();
    renderFindControls();
    setStatus(app.findQuery.trim() ? 'No matches' : 'Ready');
    return;
  }

  const total = app.findMatches.length;
  if (app.activeFindIndex < 0) {
    app.activeFindIndex = direction < 0 ? total - 1 : 0;
  } else {
    app.activeFindIndex = (app.activeFindIndex + direction + total) % total;
  }

  openActiveFindMatch();
}

function openActiveFindMatch() {
  const match = getActiveFindMatch();
  if (!match) return;

  app.activeEntryId = match.entryId;
  app.mainTab = 'edit';
  renderEditor();
  queueFocusActiveFindMatch();
  setStatus(`${app.activeFindIndex + 1}/${app.findMatches.length} matches`);
}

function queueFocusActiveFindMatch() {
  const match = getActiveFindMatch();
  if (!match) return;
  window.requestAnimationFrame(() => focusFindMatch(match));
}

function focusFindMatch(match) {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const input = root.querySelector(`[data-wbh-field="${match.field}"]`);
  if (!input || typeof input.setSelectionRange !== 'function') return;

  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  input.focus();
  input.setSelectionRange(match.start, match.end);
  scrollTextControlToPosition(input, match.start);
}

function scrollTextControlToPosition(input, start) {
  if (input.tagName !== 'TEXTAREA') return;
  const before = input.value.slice(0, start);
  const line = before.split(/\r?\n/).length - 1;
  const lineHeight = Number.parseFloat(window.getComputedStyle(input).lineHeight) || 20;
  input.scrollTop = Math.max(0, (line * lineHeight) - (input.clientHeight / 2));
}

function replaceCurrentFindMatch() {
  const root = document.querySelector('#wbh-workbench');
  app.replaceText = root?.querySelector('#wbh-replace-text')?.value || '';
  refreshFindMatches();

  const match = getActiveFindMatch();
  const record = match ? getEntryRecordById(match.entryId) : null;
  if (!match || !record) {
    setStatus('No match to replace');
    return;
  }

  captureUndoState('Replace match');
  replaceMatchInRecord(record, match, app.replaceText);
  app.activeEntryId = match.entryId;
  setEditorDirty(true);
  const nextIndex = app.activeFindIndex;
  app.findMatches = collectFindMatches(app.findQuery.trim());
  app.activeFindIndex = app.findMatches.length ? Math.min(nextIndex, app.findMatches.length - 1) : -1;
  renderEditor();
  queueFocusActiveFindMatch();
  setStatus('Replaced match');
}

function replaceAllFindMatches() {
  const root = document.querySelector('#wbh-workbench');
  app.replaceText = root?.querySelector('#wbh-replace-text')?.value || '';
  refreshFindMatches();

  const total = app.findMatches.length;
  if (!total) {
    setStatus('No matches to replace');
    return;
  }

  const ok = window.confirm(`Replace ${total} ${total === 1 ? 'match' : 'matches'}?`);
  if (!ok) return;

  captureUndoState('Replace all');
  const grouped = new Map();
  for (const match of app.findMatches) {
    const key = `${match.entryId}\u0000${match.field}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(match);
  }

  for (const matches of grouped.values()) {
    const first = matches[0];
    const record = getEntryRecordById(first.entryId);
    if (!record) continue;
    const sorted = [...matches].sort((left, right) => right.start - left.start);
    for (const match of sorted) {
      replaceMatchInRecord(record, match, app.replaceText);
    }
  }

  setEditorDirty(true);
  app.findMatches = collectFindMatches(app.findQuery.trim());
  app.activeFindIndex = app.findMatches.length ? 0 : -1;
  renderEditor();
  queueFocusActiveFindMatch();
  setStatus(`Replaced ${total} ${total === 1 ? 'match' : 'matches'}`);
}

function replaceMatchInRecord(record, match, replacement) {
  const value = findFieldText(record.entry, match.field);
  const nextValue = `${value.slice(0, match.start)}${replacement}${value.slice(match.end)}`;
  writeFindFieldText(record.entry, match.field, nextValue);
}

function getActiveFindMatch() {
  return app.activeFindIndex >= 0 ? app.findMatches[app.activeFindIndex] || null : null;
}

function sameFindMatch(left, right) {
  return left.entryId === right.entryId
    && left.field === right.field
    && left.start === right.start
    && left.end === right.end;
}

function findFieldText(entry, field) {
  return LIST_FIELDS.has(field) ? listField(entry?.[field]) : stringField(entry?.[field]);
}

function writeFindFieldText(entry, field, value) {
  entry[field] = LIST_FIELDS.has(field) ? parseListField(value) : value;
}

function fieldLabel(field) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^\w/, letter => letter.toUpperCase());
}

function setEditorInputValues(inputs, entry) {
  for (const input of inputs) {
    const field = input.dataset.wbhField;
    const value = entry[field];
    if (input.type === 'checkbox') {
      input.checked = Boolean(value);
    } else if (LIST_FIELDS.has(field)) {
      input.value = listField(value);
    } else if (TRI_STATE_BOOLEAN_FIELDS.has(field)) {
      input.value = value === null || value === undefined ? '' : String(Boolean(value));
    } else if (NUMBER_FIELDS.has(field)) {
      input.value = numberField(value);
    } else {
      input.value = stringField(value);
    }
  }
  updateRoleControl(entry);
}

function updateRoleControl(entry) {
  const root = document.querySelector('#wbh-workbench');
  const role = root?.querySelector('[data-wbh-field="role"]');
  if (!role) return;

  const atDepth = Number(entry?.position) === 4;
  role.disabled = !atDepth;
  role.title = atDepth ? '' : 'Role is only used for @ Depth entries';
  if (!atDepth) {
    role.value = '';
  } else if (role.value === '') {
    role.value = String(entry?.role ?? 0);
  }
}

function normalizeEntryRole(entry) {
  if (!entry) return;
  if (Number(entry.position) === 4) {
    if (entry.role === undefined || entry.role === null || entry.role === '') entry.role = 0;
    return;
  }
  delete entry.role;
}

function normalizeWorldbookRoles(data) {
  getEntryRecords(data).forEach(record => normalizeEntryRole(record.entry));
}

function getEditorInputs(root) {
  return [...root.querySelectorAll('.wbh-entry-editor [data-wbh-field]')];
}

function beginInputHistory(input) {
  const record = getActiveEntryRecord();
  if (!record || !app.activeData) return;
  const field = input.dataset.wbhField;
  if (!field) return;
  const key = `${record.id}:${field}`;
  if (app.pendingInputHistoryKey === key) return;
  captureUndoState(`Edit ${fieldLabel(field)}`);
  app.pendingInputHistoryKey = key;
}

function finishInputHistory() {
  app.pendingInputHistoryKey = '';
}

function updateActiveEntryFromEditor(input) {
  const record = getActiveEntryRecord();
  if (!record) return;

  const field = input.dataset.wbhField;
  if (!field) return;

  const nextValue = readEditorInputValue(input);
  if (comparableField(record.entry[field]) === comparableField(nextValue)) return;

  beginInputHistory(input);
  record.entry[field] = nextValue;
  normalizeEntryRole(record.entry);

  setEditorDirty(true);
  if (field === 'comment') {
    document.querySelector('#wbh-entry-title').textContent = entryTitle(record.entry);
  }
  document.querySelector('#wbh-entry-meta').textContent = entryMeta(record.entry);
  if (field === 'position') updateRoleControl(record.entry);
}

function readEditorInputValue(input) {
  const field = input.dataset.wbhField;
  if (input.type === 'checkbox') return input.checked;
  if (LIST_FIELDS.has(field)) return parseListField(input.value);
  if (TRI_STATE_BOOLEAN_FIELDS.has(field)) {
    if (input.value === '') return null;
    return input.value === 'true';
  }
  if (NUMBER_FIELDS.has(field)) {
    if (field === 'role' && input.value === '') return null;
    if (input.value === '') return NULLABLE_NUMBER_FIELDS.has(field) ? null : 0;
    return Number(input.value);
  }
  return input.value;
}

function createEntry() {
  if (!app.activeData) return;
  finishInputHistory();
  captureUndoState('New entry');
  const uid = getFreeEntryUid(app.activeData);
  const entry = createEntryTemplate(uid, 'New entry');
  insertEntry(app.activeData, entry);
  app.activeEntryId = String(uid);
  setEditorDirty(true);
  renderEditor();
}

function duplicateEntry() {
  const record = getActiveEntryRecord();
  if (!app.activeData || !record) return;

  finishInputHistory();
  captureUndoState('Duplicate entry');
  const uid = getFreeEntryUid(app.activeData);
  const entry = {
    ...cloneValue(record.entry),
    uid,
    comment: `Copy of ${entryTitle(record.entry)}`,
  };
  insertEntry(app.activeData, entry);
  app.activeEntryId = String(uid);
  setEditorDirty(true);
  renderEditor();
}

function deleteEntry() {
  const record = getActiveEntryRecord();
  if (!app.activeData || !record) return;
  const ok = window.confirm(`Delete "${entryTitle(record.entry)}"?`);
  if (!ok) return;

  finishInputHistory();
  captureUndoState('Delete entry');
  removeEntry(app.activeData, record);
  ensureActiveEntry();
  setEditorDirty(true);
  renderEditor();
}

function setEditorDirty(dirty) {
  app.editorDirty = dirty;
  renderActiveBook();
  renderEntryList();
  if (dirty) setStatus('Unsaved edits');
}

function captureUndoState(label = 'Edit') {
  if (!app.activeData) return;
  app.undoStack.push({
    label,
    data: cloneValue(app.activeData),
    activeEntryId: app.activeEntryId,
    editorDirty: app.editorDirty,
    editorSourceLabel: app.editorSourceLabel,
    activeFindIndex: app.activeFindIndex,
  });
  if (app.undoStack.length > MAX_UNDO_STEPS) app.undoStack.shift();
  app.redoStack = [];
  renderEditorState();
}

function resetEditorHistory({ render = true } = {}) {
  app.undoStack = [];
  app.redoStack = [];
  app.pendingInputHistoryKey = '';
  if (render) renderEditorState();
}

function undoEditorChange() {
  finishInputHistory();
  if (!app.undoStack.length || !app.activeData) return;

  const previous = app.undoStack.pop();
  const current = createHistoryState(previous.label);
  app.redoStack.push(current);
  restoreHistoryState(previous);
  setStatus(`Undo: ${previous.label}`);
}

function redoEditorChange() {
  finishInputHistory();
  if (!app.redoStack.length || !app.activeData) return;

  const next = app.redoStack.pop();
  const current = createHistoryState(next.label);
  app.undoStack.push(current);
  restoreHistoryState(next);
  setStatus(`Redo: ${next.label}`);
}

function createHistoryState(label) {
  return {
    label,
    data: cloneValue(app.activeData),
    activeEntryId: app.activeEntryId,
    editorDirty: app.editorDirty,
    editorSourceLabel: app.editorSourceLabel,
    activeFindIndex: app.activeFindIndex,
  };
}

function restoreHistoryState(state) {
  app.activeData = cloneValue(state.data);
  app.activeEntryId = state.activeEntryId;
  app.editorDirty = state.editorDirty;
  app.editorSourceLabel = state.editorSourceLabel;
  app.activeFindIndex = state.activeFindIndex;
  ensureActiveEntry();
  refreshFindMatches();
  renderEditor();
  queueFocusActiveFindMatch();
}

async function saveEditorWorldbook() {
  if (!app.activeBook || !app.activeData || !app.editorDirty) return;

  setStatus('Saving worldbook');
  const name = app.activeBook.name;
  const title = app.activeExperiment?.title || 'Workbench edit';
  const before = await loadWorldbook(name);
  await createLocalSnapshotFromData(name, before, {
    label: `Before save: ${title}`,
    reason: 'editor-before',
    skipDuplicate: true,
  });

  normalizeWorldbookRoles(app.activeData);
  await saveWorldbook(name, app.activeData);
  const saved = await loadWorldbook(name);
  app.activeData = cloneValue(saved);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = 'Current';
  app.editorDirty = false;
  resetEditorHistory({ render: false });
  ensureActiveEntry();

  const after = await createLocalSnapshotFromData(name, app.activeData, {
    label: `After save: ${title}`,
    reason: 'editor-after',
    skipDuplicate: false,
  });

  app.activeSnapshot = after.snapshot;
  if (app.activeExperiment) {
    app.activeExperiment = {
      ...app.activeExperiment,
      status: app.activeExperiment.status || 'testing',
      afterSnapshotId: after.snapshot.id,
      changeNote: app.activeExperiment.changeNote || 'Saved from workbench',
    };
    await putExperiment(app.activeExperiment);
    app.activeView = 'experiment';
  } else {
    app.activeView = 'snapshot';
  }

  await loadLocalSnapshots();
  renderEditor();
  setStatus('Saved');
}

async function reloadEditorWorldbook() {
  if (!await confirmDiscardEditorChanges()) return;
  setStatus('Reloading worldbook');
  await loadEditorWorldbook({ force: true });
  await loadLocalSnapshots();
  setStatus('Ready');
}

async function confirmDiscardEditorChanges() {
  if (!app.editorDirty) return true;
  return window.confirm('Discard unsaved workbench edits?');
}

function renderSnapshots() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-snapshots');
  const visibleSnapshots = app.snapshots.filter(snapshot => snapshot.reason !== 'origin');
  root.querySelector('#wbh-snapshot-count').textContent = String(visibleSnapshots.length);

  if (!visibleSnapshots.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No versions yet';
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...visibleSnapshots.map(snapshot => {
    const row = document.createElement('div');
    row.className = `wbh-history-row ${app.activeView === 'snapshot' && app.activeSnapshot?.id === snapshot.id ? 'active' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'wbh-row';
    main.innerHTML = '<span></span><small></small>';
    main.querySelector('span').textContent = snapshot.label || 'Untitled version';
    main.querySelector('small').textContent = `${formatDate(snapshot.createdAt)} | ${snapshot.entryCount || 0} entries`;
    main.addEventListener('click', async () => {
      await loadSnapshotIntoEditor(snapshot, 'Version');
    });

    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'wbh-mini';
    restore.textContent = 'Restore';
    restore.addEventListener('click', async () => restoreSnapshot(snapshot, snapshot.label || 'version'));

    const promote = document.createElement('button');
    promote.type = 'button';
    promote.className = 'wbh-mini';
    promote.textContent = 'Exp';
    promote.title = 'Create experiment from this version';
    promote.addEventListener('click', async () => createExperimentFromSnapshot(snapshot));

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

    row.append(main, restore, promote, rename);
    return row;
  }));
}

async function createExperimentFromSnapshot(snapshot) {
  if (!app.activeBook || !snapshot) return;

  const defaultTitle = snapshot.label
    ? snapshot.label.replace(/^(After save:|After:|Manual snapshot)\s*/i, '').trim()
    : '';
  const title = window.prompt('Experiment name / problem', defaultTitle || `Experiment ${formatDate(snapshot.createdAt)}`);
  if (title === null) return;

  const baseline = getPreviousSnapshot(snapshot) || app.originSnapshot || snapshot;
  const now = new Date();
  const cleanTitle = title.trim() || `Experiment ${formatDate(now.toISOString())}`;
  const experiment = {
    id: `${app.activeBook.name}:experiment:${formatDateForFile(now)}:${randomId()}`,
    bookName: app.activeBook.name,
    title: cleanTitle,
    status: 'testing',
    startedAt: baseline.createdAt || snapshot.createdAt || now.toISOString(),
    startedAtMs: Number(baseline.createdAtMs || snapshot.createdAtMs || now.getTime()),
    finishedAt: snapshot.createdAt || now.toISOString(),
    finishedAtMs: Number(snapshot.createdAtMs || now.getTime()),
    baselineSnapshotId: baseline.id,
    afterSnapshotId: snapshot.id,
    changeNote: snapshot.label ? `From version: ${snapshot.label}` : 'Created from saved version',
    resultNote: '',
    parentExperimentId: '',
  };

  await putExperiment(experiment);
  app.activeView = 'experiment';
  app.mainTab = 'diff';
  app.activeExperiment = experiment;
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus('Experiment created from version');
}

async function createManualLocalSnapshot() {
  if (!app.activeBook) return;
  setStatus('Creating snapshot');
  const label = app.activeExperiment?.title
    ? `Manual snapshot: ${app.activeExperiment.title}`
    : 'Manual snapshot';
  const result = await createLocalSnapshot(app.activeBook.name, {
    label,
    reason: 'manual',
    skipDuplicate: false,
  });
  app.activeView = 'snapshot';
  app.activeExperiment = null;
  app.activeSnapshot = result.snapshot;
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
  const openExperiment = getOpenExperiment();
  if (openExperiment) {
    app.activeView = 'experiment';
    app.activeExperiment = openExperiment;
    app.mainTab = 'edit';
    renderActiveBook();
    renderExperiments();
    setStatus(`Finish "${openExperiment.title || 'current experiment'}" before starting another`);
    return;
  }

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
  app.mainTab = 'edit';
  app.activeExperiment = experiment;
  app.activeSnapshot = baseline.snapshot;
  setStatus('Experiment started');
  await loadLocalSnapshots();
}

async function finishExperiment() {
  if (!app.activeBook || !app.activeExperiment) return;
  if (app.editorDirty) {
    const saveFirst = window.confirm('Save workbench edits before finishing this experiment?');
    if (!saveFirst) return;
    await saveEditorWorldbook();
  }

  const experiment = app.activeExperiment;
  const note = window.prompt('Change / result note', experiment.changeNote || '');
  if (note === null) return;

  setStatus(isExperimentOpen(experiment) ? 'Finishing experiment' : 'Updating experiment');
  let afterSnapshot = experiment.afterSnapshotId ? await getSnapshotById(experiment.afterSnapshotId) : null;
  if (!afterSnapshot || !isExperimentOpen(experiment)) {
    const after = await createLocalSnapshot(app.activeBook.name, {
      label: `After: ${experiment.title}`,
      reason: 'experiment-after',
      skipDuplicate: false,
    });
    afterSnapshot = after.snapshot;
  }
  const now = new Date();
  const updated = {
    ...experiment,
    status: experiment.status || 'testing',
    finishedAt: now.toISOString(),
    finishedAtMs: now.getTime(),
    afterSnapshotId: afterSnapshot.id,
    changeNote: note.trim(),
  };

  await putExperiment(updated);
  app.activeView = 'experiment';
  app.activeExperiment = updated;
  app.activeSnapshot = afterSnapshot;
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

async function restoreOriginSnapshot() {
  if (!app.activeBook || !app.originSnapshot) return;
  await restoreSnapshot(app.originSnapshot, 'Origin');
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
  await loadEditorWorldbook({ force: true });
  app.activeView = 'experiment';
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus('Restored');
}

function setDiffMode(mode) {
  app.diffMode = mode;
  app.diffChangeIndex = -1;
  const root = document.querySelector('#wbh-workbench');
  root.querySelector('#wbh-mode-current').classList.toggle('active', mode === 'current');
  root.querySelector('#wbh-mode-previous').classList.toggle('active', mode === 'previous');
  void renderDiff({ focusChange: true });
}

async function renderDiff({ focusChange = false } = {}) {
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
    updateDiffChangeControls();
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
      updateDiffChangeControls();
      return;
    }
    base = previous.data;
    target = app.activeSnapshot.data;
  }

  const diff = diffWorldbooks(base, target);
  summary.textContent = `+${diff.summary.added} -${diff.summary.removed} ~${diff.summary.changed} unchanged ${diff.summary.unchanged}`;
  view.replaceChildren(...renderDiffPreview(base, target, diff));
  updateDiffChangeControls();
  if (focusChange) queueFocusDiffChange(0);
}

async function renderExperimentDiff(summary, view) {
  const baseline = await getSnapshotById(app.activeExperiment.baselineSnapshotId);
  if (!app.activeBook || !baseline) {
    summary.textContent = '';
    view.textContent = 'No baseline';
    updateDiffChangeControls();
    return;
  }

  const after = app.activeExperiment.afterSnapshotId
    ? await getSnapshotById(app.activeExperiment.afterSnapshotId)
    : null;
  const target = after?.data || await loadWorldbook(app.activeBook.name);
  const diff = diffWorldbooks(baseline.data, target);
  const range = after ? 'Baseline -> After' : 'Baseline -> Current';
  summary.textContent = `${range} | +${diff.summary.added} -${diff.summary.removed} ~${diff.summary.changed} unchanged ${diff.summary.unchanged}`;
  view.replaceChildren(...renderDiffPreview(baseline.data, target, diff));
  updateDiffChangeControls();
}

function navigateDiffChange(direction) {
  const changes = getDiffChangeElements();
  if (!changes.length) {
    updateDiffChangeControls();
    return;
  }

  const next = app.diffChangeIndex < 0
    ? (direction < 0 ? changes.length - 1 : 0)
    : (app.diffChangeIndex + direction + changes.length) % changes.length;
  focusDiffChange(next);
}

function queueFocusDiffChange(index = 0) {
  window.requestAnimationFrame(() => focusDiffChange(index));
}

function focusDiffChange(index = 0) {
  const changes = getDiffChangeElements();
  if (!changes.length) {
    app.diffChangeIndex = -1;
    updateDiffChangeControls();
    return;
  }

  app.diffChangeIndex = Math.min(Math.max(index, 0), changes.length - 1);
  changes.forEach(element => element.classList.remove('change-active'));
  const active = changes[app.diffChangeIndex];
  active.classList.add('change-active');
  active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateDiffChangeControls();
  setStatus(`${app.diffChangeIndex + 1}/${changes.length} changed entries`);
}

function updateDiffChangeControls() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const changes = getDiffChangeElements();
  root.querySelector('#wbh-change-prev').disabled = !changes.length;
  root.querySelector('#wbh-change-next').disabled = !changes.length;
  if (!changes.length) app.diffChangeIndex = -1;
}

function getDiffChangeElements() {
  return [...document.querySelectorAll('#wbh-diff [data-wbh-change="true"]')];
}

function renderDiffPreview(base, target, diff) {
  const baseEntries = normalizeEntries(base?.entries);
  const targetEntries = normalizeEntries(target?.entries);
  const diffById = new Map((diff?.entries || []).map(entry => [entry.id, entry]));
  const ids = [...new Set([
    ...Object.keys(targetEntries),
    ...[...diffById.values()].filter(entry => entry.status === 'removed').map(entry => entry.id),
  ])].sort((left, right) => entryTitle(targetEntries[left] || baseEntries[left]).localeCompare(entryTitle(targetEntries[right] || baseEntries[right])));

  if (!ids.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = 'No entries';
    return [empty];
  }

  return ids.map(id => {
    const diffEntry = diffById.get(id);
    const status = diffEntry?.status || 'unchanged';
    const entry = targetEntries[id] || baseEntries[id] || {};
    const section = document.createElement('section');
    section.className = `wbh-diff-entry ${status}`;
    if (status !== 'unchanged') section.dataset.wbhChange = 'true';
    const title = document.createElement('h4');
    title.textContent = `${status === 'unchanged' ? 'ENTRY' : status.toUpperCase()} ${entryTitle(entry)}`;
    section.append(title);

    const meta = document.createElement('div');
    meta.className = 'wbh-preview-meta';
    meta.textContent = entryMeta(entry);
    section.append(meta);

    const fields = diffEntry?.fields || [];
    const summary = renderDiffFieldSummaries(fields);
    if (summary) section.append(summary);
    fields.filter(field => field.name !== 'content').forEach(field => section.append(renderDiffField(field)));
    section.append(renderPreviewContentField(entry, fields.find(field => field.name === 'content'), status));
    return section;
  });
}

function renderDiffFieldSummaries(fields) {
  const summaryFields = fields.filter(field => field.name !== 'content');
  if (!summaryFields.length) return null;

  const list = document.createElement('div');
  list.className = 'wbh-change-summary';
  summaryFields.forEach(field => {
    const item = document.createElement('span');
    item.className = 'wbh-change-pill';
    item.textContent = diffFieldSummary(field);
    list.append(item);
  });
  return list;
}

function renderDiffField(field) {
  const block = document.createElement('div');
  block.className = 'wbh-field';
  const name = document.createElement('strong');
  name.textContent = diffFieldLabel(field.name);
  block.append(name);

  if (field.lines?.length) {
    block.append(renderDiffLines(field.lines));
  } else {
    const grid = document.createElement('div');
    grid.className = 'wbh-field-grid';
    const before = document.createElement('pre');
    const after = document.createElement('pre');
    before.textContent = formatDiffFieldValue(field.name, field.before);
    after.textContent = formatDiffFieldValue(field.name, field.after);
    grid.append(before, after);
    block.append(grid);
  }

  return block;
}

function renderPreviewContentField(entry, contentDiff, status) {
  const block = document.createElement('div');
  block.className = 'wbh-field';
  const name = document.createElement('strong');
  name.textContent = 'Content';
  block.append(name);

  if (contentDiff?.lines?.length) {
    block.append(renderDiffLines(contentDiff.lines));
  } else if (status === 'added' || status === 'removed') {
    const lines = String(entry?.content || '').split(/\r?\n/).map(text => ({
      type: status === 'added' ? 'added' : 'removed',
      text,
    }));
    block.append(renderDiffLines(lines));
  } else {
    const pre = document.createElement('pre');
    pre.textContent = entry?.content || '';
    block.append(pre);
  }

  return block;
}

function diffFieldLabel(field) {
  return DIFF_FIELD_LABELS[field] || fieldLabel(field);
}

function diffFieldSummary(field) {
  const before = shortDiffValue(formatDiffFieldValue(field.name, field.before));
  const after = shortDiffValue(formatDiffFieldValue(field.name, field.after));
  return `${diffFieldLabel(field.name)}: ${before} -> ${after}`;
}

function shortDiffValue(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim() || '(blank)';
  return text.length > 84 ? `${text.slice(0, 81)}...` : text;
}

function formatDiffFieldValue(field, value) {
  if (value === '' || value === null || value === undefined) return '(blank)';
  if (field === 'position') return positionLabel(value);
  if (field === 'role') return roleLabel(value);
  if (field === 'selectiveLogic') return SELECTIVE_LOGIC_OPTIONS.find(option => option.value === Number(value))?.label || blankable(value);
  if (field === 'disable') return truthyString(value) ? 'Disabled' : 'Enabled';
  if (field === 'constant') return truthyString(value) ? 'Constant' : 'Normal';
  if (TRI_STATE_BOOLEAN_FIELDS.has(field)) return triStateLabel(value);
  if (BOOLEAN_DIFF_FIELDS.has(field)) return truthyString(value) ? 'On' : 'Off';
  if (LIST_FIELDS.has(field)) return formatListDiffValue(value);
  if (field === 'probability' && value !== '') return `${value}%`;
  return blankable(value);
}

function blankable(value) {
  return value === undefined || value === null || value === '' ? '(blank)' : String(value);
}

function truthyString(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function triStateLabel(value) {
  if (value === '' || value === null || value === undefined) return 'Global';
  return truthyString(value) ? 'On' : 'Off';
}

function formatListDiffValue(value) {
  if (value === '' || value === null || value === undefined) return '(blank)';
  const text = String(value);
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.join('\n') || '(blank)';
    } catch {
      return text;
    }
  }
  return text;
}

function renderDiffLines(lines) {
  const pre = document.createElement('pre');
  for (const line of lines) {
    const row = document.createElement('span');
    row.className = line.type;
    row.textContent = `${line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}${line.text}\n`;
    pre.append(row);
  }
  return pre;
}

async function restoreLocalSnapshot() {
  await restoreSnapshot(app.activeSnapshot, app.activeSnapshot?.label || 'version');
}

async function restoreSnapshot(snapshot, label = 'version') {
  if (!app.activeBook || !snapshot) return;
  const restoreLabel = label || snapshot.label || snapshot.createdAt || 'version';
  const ok = window.confirm(`Restore "${app.activeBook.name}" to "${restoreLabel}"?`);
  if (!ok) return;

  setStatus('Restoring');
  await createLocalSnapshot(app.activeBook.name, {
    label: `Before restore to ${restoreLabel} ${formatDate(new Date().toISOString())}`,
    reason: 'pre-restore',
    skipDuplicate: false,
  });
  await saveWorldbook(app.activeBook.name, snapshot.data);
  await loadEditorWorldbook({ force: true });
  app.activeView = 'snapshot';
  app.mainTab = 'edit';
  app.activeExperiment = null;
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus(`Restored ${restoreLabel}`);
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
  return DIFF_ENTRY_FIELDS.map(field => {
    const left = comparableEntryField(before, field);
    const right = comparableEntryField(after, field);
    if (left === right) return null;
    return {
      name: field,
      before: left,
      after: right,
      lines: field === 'content' || field === 'comment' ? diffLines(String(left), String(right)) : [],
    };
  }).filter(Boolean);
}

function comparableEntryField(entry, field) {
  const hasValue = Object.prototype.hasOwnProperty.call(entry || {}, field);
  const fallback = Object.prototype.hasOwnProperty.call(ENTRY_DEFAULTS, field) ? ENTRY_DEFAULTS[field] : '';
  const value = hasValue ? entry[field] : fallback;

  if (field === 'role') {
    const isBlank = value === undefined || value === null || value === '';
    if (isBlank) return Number(entry?.position) === 4 ? '0' : '';
  }
  if (field === 'disable' || BOOLEAN_DIFF_FIELDS.has(field)) {
    return truthyString(value) ? 'true' : 'false';
  }
  if (TRI_STATE_BOOLEAN_FIELDS.has(field)) {
    return value === undefined || value === null || value === '' ? '' : truthyString(value) ? 'true' : 'false';
  }
  return comparableField(value);
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

function getEntryRecords(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== 'object') return [];
  if (Array.isArray(entries)) {
    return entries.map((entry, index) => ({
      id: String(entry?.uid ?? entry?.id ?? index),
      storageKey: index,
      index,
      entry,
    }));
  }
  return Object.entries(entries).map(([key, entry], index) => ({
    id: String(key),
    storageKey: key,
    index,
    entry,
  }));
}

function insertEntry(data, entry) {
  if (!data.entries || typeof data.entries !== 'object') data.entries = {};
  if (Array.isArray(data.entries)) {
    data.entries.push(entry);
    return;
  }
  data.entries[String(entry.uid)] = entry;
}

function removeEntry(data, record) {
  if (!data?.entries || typeof data.entries !== 'object') return;
  if (Array.isArray(data.entries)) {
    data.entries.splice(record.storageKey, 1);
    return;
  }
  delete data.entries[record.storageKey];
}

function createEntryTemplate(uid, comment = '') {
  return {
    uid,
    ...cloneValue(ENTRY_DEFAULTS),
    comment,
  };
}

function getFreeEntryUid(data) {
  const used = new Set(getEntryRecords(data).flatMap(record => [
    String(record.id),
    String(record.entry?.uid ?? ''),
  ]));

  let uid = 0;
  while (used.has(String(uid))) uid++;
  return uid;
}

function getSortedEntryRecords(data) {
  return getEntryRecords(data).sort((left, right) => {
    const orderDiff = numericSort(left.entry?.order) - numericSort(right.entry?.order);
    if (orderDiff) return orderDiff;
    return left.index - right.index;
  });
}

function getActiveEntryRecord() {
  return getEntryRecords(app.activeData).find(record => record.id === app.activeEntryId) || null;
}

function getEntryRecordById(id) {
  return getEntryRecords(app.activeData).find(record => record.id === id) || null;
}

function ensureActiveEntry() {
  const records = getSortedEntryRecords(app.activeData);
  if (!records.length) {
    app.activeEntryId = null;
    return;
  }
  if (!records.some(record => record.id === app.activeEntryId)) {
    app.activeEntryId = records[0].id;
  }
}

function entryTitle(entry) {
  return cleanText(entry?.comment) || cleanText(entry?.name) || cleanText(entry?.uid) || '(untitled)';
}

function entryMeta(entry) {
  const parts = [];
  if (entry?.constant) parts.push('constant');
  if (entry?.disable) parts.push('disabled');
  if (entry?.position !== undefined) parts.push(positionLabel(entry.position));
  if (Number(entry?.position) === 4) parts.push(`${roleLabel(entry.role)} depth ${entry?.depth ?? 0}`);
  if (entry?.order !== undefined) parts.push(`order ${entry.order}`);
  return parts.join(' | ') || 'entry';
}

function positionLabel(value) {
  return POSITION_OPTIONS.find(option => option.value === Number(value))?.label || `position ${value}`;
}

function roleLabel(value) {
  return ROLE_OPTIONS.find(option => option.value === Number(value))?.label || 'System';
}

function downloadJson(filename, data) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value) {
  return String(value || 'export')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'export';
}

function numericSort(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function comparableField(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return stableStringify(value);
  return value === undefined || value === null ? '' : String(value);
}

function stringField(value) {
  return value === undefined || value === null ? '' : String(value);
}

function numberField(value) {
  return value === undefined || value === null || Number.isNaN(Number(value)) ? '' : String(value);
}

function listField(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function parseListField(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(item => String(item));
    } catch {
      return [text];
    }
  }
  return text
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
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

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
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

function readBooleanSetting(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function readStringSetting(key, fallback, allowedValues = null) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    if (allowedValues && !allowedValues.includes(value)) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

function writeBooleanSetting(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // The toggle is cosmetic; ignore storage failures.
  }
}

function writeStringSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The toggle is cosmetic; ignore storage failures.
  }
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
