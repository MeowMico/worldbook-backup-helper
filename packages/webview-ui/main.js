(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const { parseJsonArrayText } = window.WorldbookScenarioFields;
  const worldbook = window.WorldbookEditor;
  const state = {
    worldbookPath: '',
    worldbookData: null,
    records: [],
    selectedStorageKey: null,
    scenario: null,
    characterCard: null,
    lastPreview: null,
    previewEntries: new Map(),
    previewStale: false,
    rawJsonDirty: false,
  };

  const el = {
    status: document.querySelector('#status'),
    worldbookTitle: document.querySelector('#worldbookTitle'),
    worldbookMeta: document.querySelector('#worldbookMeta'),
    entryCount: document.querySelector('#entryCount'),
    entrySearch: document.querySelector('#entrySearch'),
    entryList: document.querySelector('#entryList'),
    newEntryButton: document.querySelector('#newEntryButton'),
    duplicateEntryButton: document.querySelector('#duplicateEntryButton'),
    deleteEntryButton: document.querySelector('#deleteEntryButton'),
    entryEmpty: document.querySelector('#entryEmpty'),
    entryEditor: document.querySelector('#entryEditor'),
    entryEditorTitle: document.querySelector('#entryEditorTitle'),
    entryEditorMeta: document.querySelector('#entryEditorMeta'),
    entryEnabledInput: document.querySelector('#entryEnabledInput'),
    entryTitleInput: document.querySelector('#entryTitleInput'),
    entryStrategyInput: document.querySelector('#entryStrategyInput'),
    entryStrategyIndicator: document.querySelector('#entryStrategyIndicator'),
    entryPositionInput: document.querySelector('#entryPositionInput'),
    entryOrderInput: document.querySelector('#entryOrderInput'),
    entryProbabilityInput: document.querySelector('#entryProbabilityInput'),
    entryDepthField: document.querySelector('#entryDepthField'),
    entryDepthInput: document.querySelector('#entryDepthInput'),
    entryRoleField: document.querySelector('#entryRoleField'),
    entryRoleInput: document.querySelector('#entryRoleInput'),
    entryOutletField: document.querySelector('#entryOutletField'),
    entryOutletInput: document.querySelector('#entryOutletInput'),
    entryKeysInput: document.querySelector('#entryKeysInput'),
    entrySecondaryInput: document.querySelector('#entrySecondaryInput'),
    entryLogicInput: document.querySelector('#entryLogicInput'),
    entryContentInput: document.querySelector('#entryContentInput'),
    rawJsonText: document.querySelector('#rawJsonText'),
    applyJsonButton: document.querySelector('#applyJsonButton'),
    seedInput: document.querySelector('#seedInput'),
    userInput: document.querySelector('#userInput'),
    charInput: document.querySelector('#charInput'),
    triggerInput: document.querySelector('#triggerInput'),
    tokenizerInput: document.querySelector('#tokenizerInput'),
    depthInput: document.querySelector('#depthInput'),
    recursiveInput: document.querySelector('#recursiveInput'),
    characterBookInput: document.querySelector('#characterBookInput'),
    messagesText: document.querySelector('#messagesText'),
    forceText: document.querySelector('#forceText'),
    cardMeta: document.querySelector('#cardMeta'),
    tokenMeta: document.querySelector('#tokenMeta'),
    preview: document.querySelector('#preview'),
    compileButton: document.querySelector('#compileButton'),
    saveButton: document.querySelector('#saveButton'),
    scenarioButton: document.querySelector('#scenarioButton'),
    cardButton: document.querySelector('#cardButton'),
    exportButton: document.querySelector('#exportButton'),
    tabs: [...document.querySelectorAll('[data-tab]')],
    tabPanels: {
      entry: document.querySelector('#entryTab'),
      scenario: document.querySelector('#scenarioTab'),
      json: document.querySelector('#jsonTab'),
    },
  };

  el.compileButton.addEventListener('click', () => withWorldbookText(worldbookText => {
    const scenario = gatherScenario();
    if (scenario) post('compilePreview', { worldbookText, scenario });
  }));
  el.saveButton.addEventListener('click', () => withWorldbookText(worldbookText => {
    post('saveWorldbook', { worldbookText });
  }));
  el.exportButton.addEventListener('click', () => withWorldbookText(worldbookText => {
    post('exportWorldbookJson', { worldbookText });
  }));
  el.scenarioButton.addEventListener('click', () => {
    const scenario = gatherScenario();
    if (scenario) post('saveScenario', { scenario });
  });
  el.cardButton.addEventListener('click', () => post('importCharacterCard'));
  el.entrySearch.addEventListener('input', renderEntryBrowser);
  el.newEntryButton.addEventListener('click', createEntry);
  el.duplicateEntryButton.addEventListener('click', duplicateEntry);
  el.deleteEntryButton.addEventListener('click', deleteSelectedEntry);
  el.applyJsonButton.addEventListener('click', () => applyRawJson(true));
  el.rawJsonText.addEventListener('input', () => {
    state.rawJsonDirty = true;
    el.rawJsonText.removeAttribute('aria-invalid');
    setStatus('Raw JSON changes are not applied yet.');
  });
  [el.messagesText, el.forceText].forEach(input => {
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
  });
  el.tabs.forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)));

  const entryInputs = [
    el.entryEnabledInput,
    el.entryTitleInput,
    el.entryStrategyInput,
    el.entryPositionInput,
    el.entryOrderInput,
    el.entryProbabilityInput,
    el.entryDepthInput,
    el.entryRoleInput,
    el.entryOutletInput,
    el.entryKeysInput,
    el.entrySecondaryInput,
    el.entryLogicInput,
    el.entryContentInput,
  ];
  entryInputs.forEach(input => input.addEventListener('input', () => updateSelectedEntry(input)));

  window.addEventListener('message', event => {
    const message = event.data || {};
    if (message.type === 'state') applyState(message);
    if (message.type === 'preview') applyPreview(message);
    if (message.type === 'saved') {
      if (message.worldbookText) loadWorldbookText(message.worldbookText, true);
      setStatus(message.message || 'Saved');
    }
    if (message.type === 'error') setStatus(message.message || 'Error', true);
  });

  post('ready');

  function applyState(message) {
    state.worldbookPath = message.worldbookPath || '';
    state.scenario = message.scenario || {};
    state.characterCard = message.characterCard || null;
    state.lastPreview = null;
    state.previewEntries = new Map();
    state.previewStale = false;
    loadWorldbookText(message.worldbookText || '', false);
    el.worldbookTitle.textContent = basename(state.worldbookPath) || 'Worldbook';
    el.worldbookMeta.textContent = state.worldbookPath;
    el.worldbookMeta.title = state.worldbookPath;
    renderScenario(state.scenario);
    renderCharacterCard();
    renderPreview(null);
    setStatus('Ready');
  }

  function applyPreview(message) {
    state.lastPreview = message.result || null;
    state.previewEntries = buildPreviewEntryMap(state.lastPreview);
    state.previewStale = false;
    el.preview.classList.remove('stale');
    if (message.result?.scenario) {
      state.scenario = message.result.scenario;
      renderScenario(state.scenario);
    }
    if (message.worldbookText) loadWorldbookText(message.worldbookText, true);
    renderEntryBrowser();
    renderEntryEditor();
    renderPreview(message.result);
    setStatus('Preview ready');
  }

  function loadWorldbookText(text, preserveSelection) {
    const selectedId = preserveSelection ? selectedRecord()?.id : null;
    try {
      state.worldbookData = worldbook.parseWorldbookText(text);
      state.records = worldbook.getEntryRecords(state.worldbookData);
      state.selectedStorageKey = selectStorageKey(selectedId);
      state.rawJsonDirty = false;
      el.rawJsonText.value = worldbook.serializeWorldbook(state.worldbookData);
      el.rawJsonText.removeAttribute('aria-invalid');
      renderEntryBrowser();
      renderEntryEditor();
    } catch (error) {
      state.worldbookData = null;
      state.records = [];
      state.selectedStorageKey = null;
      el.rawJsonText.value = String(text || '');
      el.rawJsonText.setAttribute('aria-invalid', 'true');
      renderEntryBrowser();
      renderEntryEditor();
      setActiveTab('json');
      setStatus(error.message, true);
    }
  }

  function selectStorageKey(preferredId) {
    const preferred = state.records.find(record => record.id === String(preferredId));
    return preferred?.storageKey ?? state.records[0]?.storageKey ?? null;
  }

  function selectedRecord() {
    return state.records.find(record => String(record.storageKey) === String(state.selectedStorageKey)) || null;
  }

  function selectRecord(record) {
    if (!record) return;
    state.selectedStorageKey = record.storageKey;
    renderEntryBrowser();
    renderEntryEditor();
    setActiveTab('entry');
  }

  function renderEntryBrowser() {
    el.entryList.replaceChildren();
    const query = el.entrySearch.value.trim().toLowerCase();
    const filtered = state.records.filter(record => entrySearchText(record.entry).includes(query));
    el.entryCount.textContent = query
      ? `${filtered.length} of ${state.records.length} entries`
      : `${state.records.length} ${state.records.length === 1 ? 'entry' : 'entries'}`;

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-list';
      empty.textContent = state.records.length ? 'No matching entries.' : 'This worldbook has no entries.';
      el.entryList.append(empty);
      return;
    }

    const profile = state.scenario?.settings?.tokenizerProfile || 'estimate';
    for (const record of filtered) {
      const entry = record.entry || {};
      const strategy = worldbook.entryStrategy(entry);
      const previewState = previewStateFor(record);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entry-browser-row';
      if (String(record.storageKey) === String(state.selectedStorageKey)) row.classList.add('selected');
      if (entry.disable) row.classList.add('disabled-entry');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(String(record.storageKey) === String(state.selectedStorageKey)));

      const top = document.createElement('span');
      top.className = 'entry-browser-main';
      const dot = document.createElement('span');
      dot.className = `strategy-dot strategy-${strategy}`;
      dot.title = strategyLabel(strategy);
      const title = document.createElement('strong');
      title.textContent = worldbook.entryTitle(entry);
      const tokens = document.createElement('span');
      tokens.className = 'entry-token-count';
      tokens.textContent = `${worldbook.estimateTokens(entry.content, profile)} tokens`;
      top.append(dot, title, tokens);

      const meta = document.createElement('span');
      meta.className = 'entry-browser-meta';
      const parts = [
        worldbook.positionLabel(entry.position ?? 0, entry.role, entry.depth),
        `order ${numberValue(entry.order, 100)}`,
      ];
      if (entry.disable) parts.push('disabled');
      else if (previewState?.active) parts.push('triggered');
      else if (previewState) parts.push('not triggered');
      meta.textContent = parts.join(' | ');
      row.append(top, meta);
      row.addEventListener('click', () => selectRecord(record));
      el.entryList.append(row);
    }
  }

  function renderEntryEditor() {
    const record = selectedRecord();
    const hasEntry = Boolean(record);
    el.entryEmpty.classList.toggle('hidden', hasEntry);
    el.entryEditor.classList.toggle('hidden', !hasEntry);
    el.duplicateEntryButton.disabled = !hasEntry;
    el.deleteEntryButton.disabled = !hasEntry;
    if (!record) return;

    const entry = record.entry || {};
    el.entryEnabledInput.checked = !entry.disable;
    el.entryTitleInput.value = entry.comment || entry.name || '';
    el.entryStrategyInput.value = worldbook.entryStrategy(entry);
    el.entryPositionInput.value = String(numberValue(entry.position, 0));
    el.entryOrderInput.value = String(numberValue(entry.order, 100));
    el.entryProbabilityInput.value = String(numberValue(entry.probability, 100));
    el.entryDepthInput.value = String(numberValue(entry.depth, 4));
    el.entryRoleInput.value = String(numberValue(entry.role, 0));
    el.entryOutletInput.value = entry.outletName || '';
    el.entryKeysInput.value = worldbook.formatList(entry.key);
    el.entrySecondaryInput.value = worldbook.formatList(entry.keysecondary);
    el.entryLogicInput.value = String(numberValue(entry.selectiveLogic, 0));
    el.entryContentInput.value = entry.content || '';
    updateEntryDependentControls(entry);
    updateEntryEditorMeta(record);
  }

  function updateEntryEditorMeta(record) {
    const entry = record.entry || {};
    const profile = state.scenario?.settings?.tokenizerProfile || 'estimate';
    const tokens = worldbook.estimateTokens(entry.content, profile);
    el.entryEditorTitle.textContent = worldbook.entryTitle(entry);
    el.entryEditorMeta.textContent = `ID ${record.id} | ${worldbook.positionLabel(entry.position ?? 0, entry.role, entry.depth)} | order ${numberValue(entry.order, 100)} | ${tokens} tokens`;
    const strategy = worldbook.entryStrategy(entry);
    el.entryStrategyIndicator.className = `strategy-dot strategy-${strategy}`;
    el.entryStrategyIndicator.title = strategyLabel(strategy);
  }

  function updateEntryDependentControls(entry) {
    const atDepth = Number(entry.position) === 4;
    const outlet = Number(entry.position) === 7;
    el.entryDepthField.classList.toggle('hidden', !atDepth);
    el.entryRoleField.classList.toggle('hidden', !atDepth);
    el.entryOutletField.classList.toggle('hidden', !outlet);
  }

  function updateSelectedEntry(input) {
    const record = selectedRecord();
    if (!record) return;
    const entry = record.entry;

    if (input === el.entryEnabledInput) entry.disable = !input.checked;
    if (input === el.entryTitleInput) entry.comment = input.value;
    if (input === el.entryStrategyInput) worldbook.applyEntryStrategy(entry, input.value);
    if (input === el.entryPositionInput) worldbook.applyEntryPosition(entry, input.value);
    if (input === el.entryOrderInput) entry.order = numberValue(input.value, 100);
    if (input === el.entryProbabilityInput) entry.probability = clamp(numberValue(input.value, 100), 0, 100);
    if (input === el.entryDepthInput) entry.depth = Math.max(0, numberValue(input.value, 4));
    if (input === el.entryRoleInput) entry.role = clamp(numberValue(input.value, 0), 0, 2);
    if (input === el.entryOutletInput) entry.outletName = input.value;
    if (input === el.entryKeysInput) entry.key = worldbook.parseListText(input.value);
    if (input === el.entrySecondaryInput) entry.keysecondary = worldbook.parseListText(input.value);
    if (input === el.entryLogicInput) entry.selectiveLogic = numberValue(input.value, 0);
    if (input === el.entryContentInput) entry.content = input.value;

    updateEntryDependentControls(entry);
    updateEntryEditorMeta(record);
    markWorldbookChanged();
    renderEntryBrowser();
  }

  function createEntry() {
    if (!ensureWorldbookData()) return;
    const record = worldbook.createEntry(state.worldbookData);
    refreshRecords(record?.id);
    markWorldbookChanged('New entry created.');
    setActiveTab('entry');
    el.entryTitleInput.focus();
    el.entryTitleInput.select();
  }

  function duplicateEntry() {
    if (!ensureWorldbookData()) return;
    const selected = selectedRecord();
    if (!selected) return;
    const record = worldbook.createEntry(state.worldbookData, selected.entry);
    refreshRecords(record?.id);
    markWorldbookChanged('Entry duplicated.');
    setActiveTab('entry');
  }

  function deleteSelectedEntry() {
    if (!ensureWorldbookData()) return;
    const selected = selectedRecord();
    if (!selected) return;
    if (!window.confirm(`Delete "${worldbook.entryTitle(selected.entry)}"?`)) return;
    worldbook.deleteEntry(state.worldbookData, selected.storageKey);
    state.selectedStorageKey = null;
    refreshRecords(null);
    markWorldbookChanged('Entry deleted.');
  }

  function refreshRecords(preferredId) {
    state.records = worldbook.getEntryRecords(state.worldbookData);
    state.selectedStorageKey = selectStorageKey(preferredId);
    renderEntryBrowser();
    renderEntryEditor();
  }

  function markWorldbookChanged(message = 'Unsaved worldbook changes.') {
    state.rawJsonDirty = false;
    el.rawJsonText.value = worldbook.serializeWorldbook(state.worldbookData);
    state.previewStale = true;
    el.preview.classList.add('stale');
    el.tokenMeta.textContent = 'Preview out of date';
    setStatus(message);
  }

  function applyRawJson(showStatus) {
    if (!state.rawJsonDirty) return true;
    const selectedId = selectedRecord()?.id;
    try {
      state.worldbookData = worldbook.parseWorldbookText(el.rawJsonText.value);
      state.records = worldbook.getEntryRecords(state.worldbookData);
      state.selectedStorageKey = selectStorageKey(selectedId);
      state.rawJsonDirty = false;
      el.rawJsonText.value = worldbook.serializeWorldbook(state.worldbookData);
      el.rawJsonText.removeAttribute('aria-invalid');
      state.previewStale = true;
      el.preview.classList.add('stale');
      el.tokenMeta.textContent = 'Preview out of date';
      renderEntryBrowser();
      renderEntryEditor();
      if (showStatus) setStatus('Raw JSON applied.');
      return true;
    } catch (error) {
      el.rawJsonText.setAttribute('aria-invalid', 'true');
      setStatus(error.message, true);
      setActiveTab('json');
      return false;
    }
  }

  function ensureWorldbookData() {
    return applyRawJson(false) && Boolean(state.worldbookData);
  }

  function withWorldbookText(callback) {
    if (!ensureWorldbookData()) return;
    callback(worldbook.serializeWorldbook(state.worldbookData));
  }

  function renderScenario(scenario) {
    const settings = scenario.settings || {};
    el.seedInput.value = scenario.seed || '';
    el.userInput.value = scenario.userName || '{{user}}';
    el.charInput.value = scenario.charName || '';
    el.triggerInput.value = scenario.trigger || 'normal';
    el.tokenizerInput.value = settings.tokenizerProfile || 'estimate';
    el.depthInput.value = settings.worldInfoDepth ?? 4;
    el.recursiveInput.checked = settings.recursive !== false;
    el.characterBookInput.checked = scenario.includeCharacterBook !== false;
    el.messagesText.value = JSON.stringify(scenario.messages || [], null, 2);
    el.forceText.value = JSON.stringify(scenario.forceActivate || [], null, 2);
  }

  function renderCharacterCard() {
    const card = state.characterCard;
    if (!card) {
      el.cardMeta.textContent = 'No card';
      return;
    }
    const parts = [card.name || 'Character'];
    if (card.hasCharacterBook) parts.push('book');
    if (card.alternateGreetingCount) parts.push(`${card.alternateGreetingCount} greetings`);
    el.cardMeta.textContent = parts.join(' | ');
  }

  function renderPreview(result) {
    el.preview.replaceChildren();
    if (!result) {
      el.tokenMeta.textContent = '';
      const empty = document.createElement('p');
      empty.className = 'empty-state preview-empty';
      empty.textContent = 'Run Preview to inspect activation and prompt order.';
      el.preview.append(empty);
      return;
    }
    el.tokenMeta.textContent = `${result.tokenUsage.allEntriesTokens} all entries | ${result.tokenUsage.worldInfoTokens} active WI | ${result.tokenUsage.timelineTokens} timeline | ${result.tokenizer.accuracy}`;

    const summary = document.createElement('div');
    summary.className = 'summary-strip';
    summary.append(
      metric('Triggered', result.activatedEntries.length),
      metric('Not triggered', result.skippedEntries.length),
      metric('All entry tokens', result.tokenUsage.allEntriesTokens),
    );
    el.preview.append(summary);

    if (result.warnings.length) {
      const warnings = document.createElement('section');
      warnings.className = 'warnings';
      warnings.append(heading('Warnings'));
      for (const warning of result.warnings) {
        const row = document.createElement('p');
        row.textContent = warning.message || warning.code;
        warnings.append(row);
      }
      el.preview.append(warnings);
    }

    const timeline = document.createElement('section');
    timeline.className = 'timeline';
    timeline.append(heading('Timeline'));
    for (const item of result.timeline) timeline.append(renderTimelineItem(item));
    el.preview.append(timeline);

    const details = document.createElement('section');
    details.className = 'details-grid';
    details.append(renderPreviewEntryList('Triggered Entries', result.activatedEntries, true));
    details.append(renderPreviewEntryList('Not Triggered', result.skippedEntries, false));
    el.preview.append(details);
  }

  function renderTimelineItem(item) {
    const row = document.createElement('details');
    row.className = `timeline-item role-${item.role}`;
    const head = document.createElement('summary');
    head.className = 'timeline-head';
    const title = document.createElement('strong');
    title.textContent = item.title || item.bucket;
    const meta = document.createElement('span');
    meta.textContent = `${item.role} | ${item.bucket} | ${item.tokens || 0} tokens`;
    head.append(title, meta);
    const body = document.createElement('pre');
    body.textContent = item.content || '';
    row.append(head, body);
    return row;
  }

  function renderPreviewEntryList(title, entries, active) {
    const section = document.createElement('section');
    section.className = 'entry-list';
    section.append(heading(title));
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'None';
      section.append(empty);
      return section;
    }
    for (const entry of entries) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = active ? 'entry-result active' : 'entry-result inactive';
      const name = document.createElement('strong');
      name.textContent = entry.title;
      const meta = document.createElement('span');
      meta.textContent = active
        ? `${entry.sourceName} | ${entry.trigger} | order ${entry.order} | ${entry.tokens || 0} tokens`
        : `${entry.sourceName} | ${reasonLabel(entry.reason)} | ${entry.tokens || 0} tokens`;
      row.append(name, meta);
      if (entry.message) {
        const message = document.createElement('span');
        message.className = 'entry-result-reason';
        message.textContent = entry.message;
        row.append(message);
      }
      if (entry.sourceType === 'worldbook') {
        row.title = 'Edit this entry';
        row.addEventListener('click', () => selectPreviewEntry(entry));
      } else {
        row.disabled = true;
      }
      section.append(row);
    }
    return section;
  }

  function selectPreviewEntry(entry) {
    const localId = worldbook.previewLocalId(entry.id);
    const record = state.records.find(item => item.id === localId);
    if (record) selectRecord(record);
  }

  function buildPreviewEntryMap(result) {
    const map = new Map();
    for (const entry of result?.activatedEntries || []) {
      if (entry.sourceType === 'worldbook') map.set(worldbook.previewLocalId(entry.id), { ...entry, active: true });
    }
    for (const entry of result?.skippedEntries || []) {
      if (entry.sourceType === 'worldbook') map.set(worldbook.previewLocalId(entry.id), { ...entry, active: false });
    }
    return map;
  }

  function previewStateFor(record) {
    if (state.previewStale) return null;
    return state.previewEntries.get(record.id) || null;
  }

  function gatherScenario() {
    try {
      const previous = state.scenario || {};
      return {
        ...previous,
        seed: el.seedInput.value,
        trigger: el.triggerInput.value || 'normal',
        userName: el.userInput.value,
        charName: el.charInput.value,
        includeCharacterBook: el.characterBookInput.checked,
        settings: {
          ...(previous.settings || {}),
          tokenizerProfile: el.tokenizerInput.value,
          worldInfoDepth: numberValue(el.depthInput.value, 4),
          recursive: el.recursiveInput.checked,
        },
        messages: parseJsonArrayField(el.messagesText, 'Messages JSON'),
        forceActivate: parseJsonArrayField(el.forceText, 'Force Activate IDs'),
      };
    } catch (error) {
      setStatus(error.message, true);
      setActiveTab('scenario');
      return null;
    }
  }

  function parseJsonArrayField(input, label) {
    try {
      const value = parseJsonArrayText(input.value, label);
      input.removeAttribute('aria-invalid');
      return value;
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      throw error;
    }
  }

  function setActiveTab(name) {
    el.tabs.forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    for (const [key, panel] of Object.entries(el.tabPanels)) panel.classList.toggle('active', key === name);
  }

  function metric(label, value) {
    const box = document.createElement('div');
    box.className = 'metric';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    box.append(strong, span);
    return box;
  }

  function heading(text) {
    const h = document.createElement('h3');
    h.textContent = text;
    return h;
  }

  function entrySearchText(entry) {
    return [
      worldbook.entryTitle(entry),
      entry?.content,
      worldbook.formatList(entry?.key),
      worldbook.formatList(entry?.keysecondary),
    ].join('\n').toLowerCase();
  }

  function strategyLabel(strategy) {
    if (strategy === 'constant') return 'Constant';
    if (strategy === 'vectorized') return 'Vectorized';
    if (strategy === 'selective') return 'Selective';
    return 'Normal';
  }

  function reasonLabel(reason) {
    return String(reason || 'not triggered').replaceAll('_', ' ');
  }

  function numberValue(value, fallback) {
    if (String(value ?? '').trim() === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function basename(value) {
    return String(value || '').split(/[\\/]/).pop();
  }

  function setStatus(message, isError) {
    el.status.textContent = message;
    el.status.classList.toggle('error', Boolean(isError));
  }

  function post(type, payload) {
    vscode.postMessage({ type, ...(payload || {}) });
  }
}());
