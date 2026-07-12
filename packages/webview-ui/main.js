(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const { parseJsonObjectText, parseStringListText } = window.WorldbookScenarioFields;
  const worldbook = window.WorldbookEditor;
  const state = {
    worldbookPath: '',
    worldbookData: null,
    records: [],
    selectedStorageKey: null,
    selectedEntryIds: new Set(),
    scenario: null,
    characterCard: null,
    history: null,
    lastPreview: null,
    previewEntries: new Map(),
    previewStale: false,
    rawJsonDirty: false,
    scenarioJsonDirty: false,
    entryToolsCollapsed: false,
  };

  const el = {
    status: document.querySelector('#status'),
    worldbookTitle: document.querySelector('#worldbookTitle'),
    worldbookMeta: document.querySelector('#worldbookMeta'),
    entryCount: document.querySelector('#entryCount'),
    entrySearch: document.querySelector('#entrySearch'),
    entryList: document.querySelector('#entryList'),
    entryToolbox: document.querySelector('#entryToolbox'),
    toggleEntryToolsButton: document.querySelector('#toggleEntryToolsButton'),
    entryToolsToggleIcon: document.querySelector('#entryToolsToggleIcon'),
    newEntryButton: document.querySelector('#newEntryButton'),
    duplicateEntryButton: document.querySelector('#duplicateEntryButton'),
    deleteEntryButton: document.querySelector('#deleteEntryButton'),
    selectAllEntries: document.querySelector('#selectAllEntries'),
    selectedEntryCount: document.querySelector('#selectedEntryCount'),
    enableSelectedButton: document.querySelector('#enableSelectedButton'),
    disableSelectedButton: document.querySelector('#disableSelectedButton'),
    copySelectedButton: document.querySelector('#copySelectedButton'),
    deleteSelectedButton: document.querySelector('#deleteSelectedButton'),
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
    scenarioStructuredFields: document.querySelector('#scenarioStructuredFields'),
    seedInput: document.querySelector('#seedInput'),
    triggerInput: document.querySelector('#triggerInput'),
    tokenizerInput: document.querySelector('#tokenizerInput'),
    depthInput: document.querySelector('#depthInput'),
    contextSizeInput: document.querySelector('#contextSizeInput'),
    budgetPercentInput: document.querySelector('#budgetPercentInput'),
    budgetCapInput: document.querySelector('#budgetCapInput'),
    minActivationsInput: document.querySelector('#minActivationsInput'),
    minActivationsDepthMaxInput: document.querySelector('#minActivationsDepthMaxInput'),
    maxRecursionStepsInput: document.querySelector('#maxRecursionStepsInput'),
    insertionStrategyInput: document.querySelector('#insertionStrategyInput'),
    includeNamesInput: document.querySelector('#includeNamesInput'),
    recursiveInput: document.querySelector('#recursiveInput'),
    caseSensitiveInput: document.querySelector('#caseSensitiveInput'),
    matchWholeWordsInput: document.querySelector('#matchWholeWordsInput'),
    useGroupScoringInput: document.querySelector('#useGroupScoringInput'),
    alertOnOverflowInput: document.querySelector('#alertOnOverflowInput'),
    characterBookInput: document.querySelector('#characterBookInput'),
    messageCount: document.querySelector('#messageCount'),
    messageList: document.querySelector('#messageList'),
    addMessageButton: document.querySelector('#addMessageButton'),
    forceText: document.querySelector('#forceText'),
    scenarioJsonText: document.querySelector('#scenarioJsonText'),
    applyScenarioJsonButton: document.querySelector('#applyScenarioJsonButton'),
    cardMeta: document.querySelector('#cardMeta'),
    batchFindInput: document.querySelector('#batchFindInput'),
    batchReplaceInput: document.querySelector('#batchReplaceInput'),
    batchTitleField: document.querySelector('#batchTitleField'),
    batchKeywordsField: document.querySelector('#batchKeywordsField'),
    batchContentField: document.querySelector('#batchContentField'),
    batchCaseSensitive: document.querySelector('#batchCaseSensitive'),
    batchSummary: document.querySelector('#batchSummary'),
    batchResults: document.querySelector('#batchResults'),
    batchReplaceButton: document.querySelector('#batchReplaceButton'),
    batchDeleteButton: document.querySelector('#batchDeleteButton'),
    historyMeta: document.querySelector('#historyMeta'),
    snapshotButton: document.querySelector('#snapshotButton'),
    startExperimentButton: document.querySelector('#startExperimentButton'),
    finishExperimentButton: document.querySelector('#finishExperimentButton'),
    experimentList: document.querySelector('#experimentList'),
    snapshotList: document.querySelector('#snapshotList'),
    tokenMeta: document.querySelector('#tokenMeta'),
    preview: document.querySelector('#preview'),
    compileButton: document.querySelector('#compileButton'),
    saveButton: document.querySelector('#saveButton'),
    historyButton: document.querySelector('#historyButton'),
    scenarioButton: document.querySelector('#scenarioButton'),
    cardButton: document.querySelector('#cardButton'),
    exportButton: document.querySelector('#exportButton'),
    tabs: [...document.querySelectorAll('[data-tab]')],
    tabPanels: {
      entry: document.querySelector('#entryTab'),
      scenario: document.querySelector('#scenarioTab'),
      batch: document.querySelector('#batchTab'),
      history: document.querySelector('#historyTab'),
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
  el.historyButton.addEventListener('click', () => setActiveTab('history'));
  el.exportButton.addEventListener('click', () => withWorldbookText(worldbookText => {
    post('exportWorldbookJson', { worldbookText });
  }));
  el.scenarioButton.addEventListener('click', () => {
    const scenario = gatherScenario();
    if (scenario) post('saveScenario', { scenario });
  });
  el.cardButton.addEventListener('click', () => {
    const scenario = gatherScenario();
    if (scenario) post('importCharacterCard', { scenario });
  });
  el.entrySearch.addEventListener('input', renderEntryBrowser);
  el.toggleEntryToolsButton.addEventListener('click', toggleEntryTools);
  el.newEntryButton.addEventListener('click', createEntry);
  el.duplicateEntryButton.addEventListener('click', duplicateEntry);
  el.deleteEntryButton.addEventListener('click', deleteSelectedEntry);
  el.selectAllEntries.addEventListener('change', toggleAllVisibleEntries);
  el.enableSelectedButton.addEventListener('click', () => setSelectedEntriesEnabled(true));
  el.disableSelectedButton.addEventListener('click', () => setSelectedEntriesEnabled(false));
  el.deleteSelectedButton.addEventListener('click', deleteCheckedEntries);
  el.copySelectedButton.addEventListener('click', copyCheckedEntries);
  [el.batchFindInput, el.batchTitleField, el.batchKeywordsField, el.batchContentField, el.batchCaseSensitive]
    .forEach(input => input.addEventListener('input', renderBatchResults));
  el.batchReplaceButton.addEventListener('click', () => applyBatchReplacement(false));
  el.batchDeleteButton.addEventListener('click', () => applyBatchReplacement(true));
  el.snapshotButton.addEventListener('click', () => withWorldbookText(worldbookText => post('createSnapshot', { worldbookText })));
  el.startExperimentButton.addEventListener('click', () => withWorldbookText(worldbookText => post('startExperiment', { worldbookText })));
  el.finishExperimentButton.addEventListener('click', () => withWorldbookText(worldbookText => {
    const active = state.history?.experiments?.find(experiment => experiment.status === 'active');
    post('finishExperiment', { worldbookText, experimentId: active?.id || '' });
  }));
  el.applyJsonButton.addEventListener('click', () => applyRawJson(true));
  el.rawJsonText.addEventListener('input', () => {
    state.rawJsonDirty = true;
    el.rawJsonText.removeAttribute('aria-invalid');
    setStatus('Raw JSON changes are not applied yet.');
  });
  el.applyScenarioJsonButton.addEventListener('click', () => applyScenarioJson(true));
  el.scenarioJsonText.addEventListener('input', () => {
    state.scenarioJsonDirty = true;
    el.scenarioJsonText.removeAttribute('aria-invalid');
    el.scenarioStructuredFields.disabled = true;
    setStatus('Scenario JSON changes are not applied yet.');
  });
  el.addMessageButton.addEventListener('click', addScenarioMessage);
  const scenarioInputs = [
    el.seedInput,
    el.triggerInput,
    el.tokenizerInput,
    el.depthInput,
    el.contextSizeInput,
    el.budgetPercentInput,
    el.budgetCapInput,
    el.minActivationsDepthMaxInput,
    el.insertionStrategyInput,
    el.recursiveInput,
    el.caseSensitiveInput,
    el.matchWholeWordsInput,
    el.useGroupScoringInput,
    el.alertOnOverflowInput,
    el.characterBookInput,
    el.forceText,
  ];
  scenarioInputs.forEach(input => input.addEventListener('input', handleScenarioControlsChanged));
  el.includeNamesInput.addEventListener('input', () => {
    renderScenarioMessages();
    handleScenarioControlsChanged();
  });
  el.minActivationsInput.addEventListener('input', () => {
    if (numberValue(el.minActivationsInput.value, 0) > 0) el.maxRecursionStepsInput.value = '0';
    handleScenarioControlsChanged();
  });
  el.maxRecursionStepsInput.addEventListener('input', () => {
    if (numberValue(el.maxRecursionStepsInput.value, 0) > 0) el.minActivationsInput.value = '0';
    handleScenarioControlsChanged();
  });
  el.tabs.forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)));
  renderEntryToolsVisibility();

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
      if (message.history) applyHistory(message.history);
      setStatus(message.message || 'Saved');
    }
    if (message.type === 'history') {
      applyHistory(message.history);
      setStatus(message.message || 'History updated.');
    }
    if (message.type === 'restored') {
      if (message.worldbookText) loadWorldbookText(message.worldbookText, false);
      if (message.history) applyHistory(message.history);
      state.previewStale = true;
      el.preview.classList.add('stale');
      el.tokenMeta.textContent = 'Preview out of date';
      setStatus(message.message || 'Snapshot restored.');
    }
    if (message.type === 'copiedEntries') setStatus(message.message || 'Entries copied.');
    if (message.type === 'error') setStatus(message.message || 'Error', true);
  });

  post('ready');

  function applyState(message) {
    state.worldbookPath = message.worldbookPath || '';
    state.scenario = message.scenario || {};
    state.characterCard = message.characterCard || null;
    state.history = message.history || null;
    state.selectedEntryIds.clear();
    state.lastPreview = null;
    state.previewEntries = new Map();
    state.previewStale = false;
    loadWorldbookText(message.worldbookText || '', false);
    el.worldbookTitle.textContent = basename(state.worldbookPath) || 'Worldbook';
    el.worldbookMeta.textContent = state.worldbookPath;
    el.worldbookMeta.title = state.worldbookPath;
    renderScenario(state.scenario);
    renderCharacterCard();
    renderHistory();
    renderBatchResults();
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
      pruneCheckedEntries();
      state.selectedStorageKey = selectStorageKey(selectedId);
      state.rawJsonDirty = false;
      el.rawJsonText.value = worldbook.serializeWorldbook(state.worldbookData);
      el.rawJsonText.removeAttribute('aria-invalid');
      renderEntryBrowser();
      renderEntryEditor();
      renderBatchResults();
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
    const filtered = visibleEntryRecords();
    el.entryCount.textContent = query
      ? `${filtered.length} of ${state.records.length} entries`
      : `${state.records.length} ${state.records.length === 1 ? 'entry' : 'entries'}`;

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-list';
      empty.textContent = state.records.length ? 'No matching entries.' : 'This worldbook has no entries.';
      el.entryList.append(empty);
      renderSelectionToolbar(filtered);
      return;
    }

    const profile = state.scenario?.settings?.tokenizerProfile || 'estimate';
    for (const record of filtered) {
      const entry = record.entry || {};
      const strategy = worldbook.entryStrategy(entry);
      const previewState = previewStateFor(record);
      const row = document.createElement('div');
      row.className = 'entry-browser-row';
      if (String(record.storageKey) === String(state.selectedStorageKey)) row.classList.add('selected');
      if (state.selectedEntryIds.has(String(record.id))) row.classList.add('checked');
      if (entry.disable) row.classList.add('disabled-entry');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(String(record.storageKey) === String(state.selectedStorageKey)));

      const checkWrap = document.createElement('label');
      checkWrap.className = 'entry-select-check';
      checkWrap.title = 'Select for batch actions';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedEntryIds.has(String(record.id));
      checkbox.setAttribute('aria-label', `Select ${worldbook.entryTitle(entry)}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.selectedEntryIds.add(String(record.id));
        else state.selectedEntryIds.delete(String(record.id));
        renderEntryBrowser();
      });
      checkWrap.append(checkbox);

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'entry-browser-open';

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
      openButton.append(top, meta);
      openButton.addEventListener('click', () => selectRecord(record));
      row.append(checkWrap, openButton);
      el.entryList.append(row);
    }
    renderSelectionToolbar(filtered);
  }

  function visibleEntryRecords() {
    const query = el.entrySearch.value.trim().toLowerCase();
    return state.records.filter(record => entrySearchText(record.entry).includes(query));
  }

  function toggleEntryTools() {
    state.entryToolsCollapsed = !state.entryToolsCollapsed;
    renderEntryToolsVisibility();
  }

  function renderEntryToolsVisibility() {
    const expanded = !state.entryToolsCollapsed;
    el.entryToolbox.classList.toggle('hidden', !expanded);
    el.toggleEntryToolsButton.setAttribute('aria-expanded', String(expanded));
    el.toggleEntryToolsButton.setAttribute('aria-label', expanded ? 'Hide entry tools' : 'Show entry tools');
    el.toggleEntryToolsButton.title = expanded ? 'Hide entry tools' : 'Show entry tools';
    el.entryToolsToggleIcon.textContent = expanded ? '\u25B2' : '\u25BC';
  }

  function renderSelectionToolbar(filtered = visibleEntryRecords()) {
    pruneCheckedEntries();
    const selectedCount = state.selectedEntryIds.size;
    const selectedVisible = filtered.filter(record => state.selectedEntryIds.has(String(record.id))).length;
    el.selectedEntryCount.textContent = `${selectedCount} selected`;
    el.selectAllEntries.checked = Boolean(filtered.length) && selectedVisible === filtered.length;
    el.selectAllEntries.indeterminate = selectedVisible > 0 && selectedVisible < filtered.length;
    el.selectAllEntries.disabled = !filtered.length;
    [el.enableSelectedButton, el.disableSelectedButton, el.copySelectedButton, el.deleteSelectedButton]
      .forEach(button => { button.disabled = !selectedCount; });
  }

  function pruneCheckedEntries() {
    const valid = new Set(state.records.map(record => String(record.id)));
    for (const id of [...state.selectedEntryIds]) {
      if (!valid.has(id)) state.selectedEntryIds.delete(id);
    }
  }

  function toggleAllVisibleEntries() {
    const records = visibleEntryRecords();
    if (el.selectAllEntries.checked) {
      for (const record of records) state.selectedEntryIds.add(String(record.id));
    } else {
      for (const record of records) state.selectedEntryIds.delete(String(record.id));
    }
    renderEntryBrowser();
  }

  function setSelectedEntriesEnabled(enabled) {
    if (!ensureWorldbookData()) return;
    const changed = worldbook.setEntriesDisabled(state.worldbookData, [...state.selectedEntryIds], !enabled);
    if (!changed) {
      setStatus(`Selected entries are already ${enabled ? 'enabled' : 'disabled'}.`);
      return;
    }
    refreshRecords(selectedRecord()?.id);
    markWorldbookChanged(`${changed} ${changed === 1 ? 'entry' : 'entries'} ${enabled ? 'enabled' : 'disabled'}.`);
  }

  function deleteCheckedEntries() {
    if (!ensureWorldbookData() || !state.selectedEntryIds.size) return;
    const count = state.selectedEntryIds.size;
    if (!window.confirm(`Delete ${count} selected ${count === 1 ? 'entry' : 'entries'}?`)) return;
    const activeId = selectedRecord()?.id;
    const deleted = worldbook.deleteEntries(state.worldbookData, [...state.selectedEntryIds]);
    state.selectedEntryIds.clear();
    refreshRecords(activeId);
    markWorldbookChanged(`${deleted} ${deleted === 1 ? 'entry' : 'entries'} deleted.`);
  }

  function copyCheckedEntries() {
    if (!state.selectedEntryIds.size) return;
    withWorldbookText(worldbookText => post('copyEntriesToWorldbook', {
      worldbookText,
      entryIds: [...state.selectedEntryIds],
    }));
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

  function batchOptions() {
    const fields = [];
    if (el.batchTitleField.checked) fields.push('title');
    if (el.batchKeywordsField.checked) fields.push('keywords');
    if (el.batchContentField.checked) fields.push('content');
    return { fields, caseSensitive: el.batchCaseSensitive.checked };
  }

  function renderBatchResults() {
    el.batchResults.replaceChildren();
    const query = el.batchFindInput.value;
    const options = batchOptions();
    const matches = state.worldbookData && query && options.fields.length
      ? worldbook.findEntryMatches(state.worldbookData, query, options)
      : [];
    const total = matches.reduce((sum, match) => sum + match.count, 0);
    el.batchReplaceButton.disabled = !total;
    el.batchDeleteButton.disabled = !total;

    if (!query) el.batchSummary.textContent = 'Enter text to find.';
    else if (!options.fields.length) el.batchSummary.textContent = 'Choose at least one field.';
    else el.batchSummary.textContent = `${total} ${total === 1 ? 'match' : 'matches'} in ${matches.length} ${matches.length === 1 ? 'entry' : 'entries'}.`;

    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-list';
      empty.textContent = query && options.fields.length ? 'No matches.' : 'Matches will appear here.';
      el.batchResults.append(empty);
      return;
    }

    for (const match of matches) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'batch-result-row';
      const title = document.createElement('strong');
      title.textContent = match.title;
      const detail = document.createElement('span');
      const fields = [...new Set(match.details.map(item => item.field))].join(', ');
      detail.textContent = `${match.count} ${match.count === 1 ? 'match' : 'matches'} | ${fields}`;
      row.append(title, detail);
      row.addEventListener('click', () => {
        const record = state.records.find(item => item.id === match.id);
        if (record) selectRecord(record);
      });
      el.batchResults.append(row);
    }
  }

  function applyBatchReplacement(deleteMatches) {
    if (!ensureWorldbookData()) return;
    const query = el.batchFindInput.value;
    const options = batchOptions();
    if (!query || !options.fields.length) return;
    const matches = worldbook.findEntryMatches(state.worldbookData, query, options);
    const total = matches.reduce((sum, match) => sum + match.count, 0);
    if (!total) return;
    const action = deleteMatches ? 'delete' : 'replace';
    if (!window.confirm(`${action === 'delete' ? 'Delete' : 'Replace'} ${total} ${total === 1 ? 'match' : 'matches'} across ${matches.length} ${matches.length === 1 ? 'entry' : 'entries'}?`)) return;
    const result = worldbook.replaceEntryMatches(
      state.worldbookData,
      query,
      deleteMatches ? '' : el.batchReplaceInput.value,
      options,
    );
    refreshRecords(selectedRecord()?.id);
    markWorldbookChanged(`${result.replacements} ${result.replacements === 1 ? 'match' : 'matches'} ${action === 'delete' ? 'deleted' : 'replaced'}.`);
    renderBatchResults();
  }

  function refreshRecords(preferredId) {
    state.records = worldbook.getEntryRecords(state.worldbookData);
    state.selectedStorageKey = selectStorageKey(preferredId);
    renderEntryBrowser();
    renderEntryEditor();
    renderBatchResults();
  }

  function markWorldbookChanged(message = 'Unsaved worldbook changes.') {
    state.rawJsonDirty = false;
    el.rawJsonText.value = worldbook.serializeWorldbook(state.worldbookData);
    state.previewStale = true;
    el.preview.classList.add('stale');
    el.tokenMeta.textContent = 'Preview out of date';
    setStatus(message);
  }

  function markScenarioChanged(message = 'Scenario changes have not been previewed.') {
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
    const source = isObject(scenario) ? cloneValue(scenario) : {};
    const settings = isObject(source.settings) ? source.settings : {};
    source.settings = settings;
    source.userName = '{{user}}';
    source.messages = Array.isArray(source.messages)
      ? source.messages.map(normalizeScenarioMessage)
      : [];
    source.forceActivate = Array.isArray(source.forceActivate)
      ? source.forceActivate.map(value => String(value)).filter(Boolean)
      : [];
    state.scenario = source;

    el.seedInput.value = source.seed || '';
    el.triggerInput.value = source.trigger || 'normal';
    el.tokenizerInput.value = settings.tokenizerProfile || 'estimate';
    el.depthInput.value = settings.worldInfoDepth ?? 4;
    el.contextSizeInput.value = settings.maxContextTokens ?? 0;
    el.budgetPercentInput.value = settings.budgetPercent ?? 100;
    el.budgetCapInput.value = settings.budgetCap ?? 0;
    el.minActivationsInput.value = settings.minActivations ?? 0;
    el.minActivationsDepthMaxInput.value = settings.minActivationsDepthMax ?? 0;
    el.maxRecursionStepsInput.value = settings.maxRecursionSteps ?? 2;
    el.insertionStrategyInput.value = settings.worldInfoInsertionStrategy || 'character-first';
    el.includeNamesInput.checked = settings.includeNames === true;
    el.recursiveInput.checked = settings.recursive !== false;
    el.caseSensitiveInput.checked = settings.caseSensitive === true;
    el.matchWholeWordsInput.checked = settings.matchWholeWords === true;
    el.useGroupScoringInput.checked = settings.useGroupScoring === true;
    el.alertOnOverflowInput.checked = settings.alertOnOverflow === true;
    el.characterBookInput.checked = source.includeCharacterBook !== false;
    el.forceText.value = source.forceActivate.join('\n');
    el.forceText.removeAttribute('aria-invalid');
    el.scenarioStructuredFields.disabled = false;
    updateActivationControlState();
    renderScenarioMessages();
    syncScenarioJsonText();
  }

  function renderScenarioMessages() {
    const messages = state.scenario?.messages || [];
    el.messageList.replaceChildren();
    el.messageCount.textContent = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`;
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-list scenario-message-empty';
      empty.textContent = 'No chat messages.';
      el.messageList.append(empty);
      return;
    }

    messages.forEach((message, index) => {
      const row = document.createElement('article');
      row.className = `scenario-message-row role-${message.role}`;

      const head = document.createElement('div');
      head.className = 'scenario-message-head';
      const number = document.createElement('strong');
      number.textContent = `Message ${index + 1}`;

      const roleLabel = document.createElement('label');
      roleLabel.textContent = 'Role';
      const role = document.createElement('select');
      role.setAttribute('aria-label', `Message ${index + 1} role`);
      for (const value of ['system', 'user', 'assistant']) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        role.append(option);
      }
      role.value = message.role;
      role.addEventListener('input', () => {
        message.role = role.value;
        row.className = `scenario-message-row role-${message.role}`;
        handleScenarioControlsChanged();
      });
      roleLabel.append(role);

      const actions = document.createElement('div');
      actions.className = 'scenario-message-actions';
      actions.append(
        scenarioMessageAction('Up', 'Move message up', index === 0, () => moveScenarioMessage(index, -1)),
        scenarioMessageAction('Down', 'Move message down', index === messages.length - 1, () => moveScenarioMessage(index, 1)),
        scenarioMessageAction('Delete', 'Delete message', false, () => deleteScenarioMessage(index), true),
      );
      head.append(number, roleLabel, actions);

      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Name';
      const name = document.createElement('input');
      name.type = 'text';
      name.value = String(message.name || '');
      name.placeholder = 'Optional message name';
      name.setAttribute('aria-label', `Message ${index + 1} name`);
      name.addEventListener('input', () => {
        message.name = name.value;
        handleScenarioControlsChanged();
      });
      nameLabel.append(name);

      const contentLabel = document.createElement('label');
      contentLabel.textContent = 'Content';
      const content = document.createElement('textarea');
      content.rows = 4;
      content.spellcheck = false;
      content.value = message.content;
      content.setAttribute('aria-label', `Message ${index + 1} content`);
      content.addEventListener('input', () => {
        message.content = content.value;
        handleScenarioControlsChanged();
      });
      contentLabel.append(content);
      row.append(head);
      if (el.includeNamesInput.checked) row.append(nameLabel);
      row.append(contentLabel);
      el.messageList.append(row);
    });
  }

  function normalizeScenarioMessage(message, index) {
    const source = isObject(message) ? cloneValue(message) : { content: String(message ?? '') };
    const role = String(source.role || '').toLowerCase();
    return {
      ...source,
      role: ['system', 'user', 'assistant'].includes(role) ? role : (index % 2 ? 'assistant' : 'user'),
      content: String(source.content ?? ''),
    };
  }

  function scenarioMessageAction(label, title, disabled, handler, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.disabled = disabled;
    if (danger) button.className = 'danger-command';
    button.addEventListener('click', handler);
    return button;
  }

  function addScenarioMessage() {
    const messages = state.scenario.messages;
    const role = messages.at(-1)?.role === 'user' ? 'assistant' : 'user';
    messages.push({ role, content: '' });
    renderScenarioMessages();
    handleScenarioControlsChanged();
    el.messageList.querySelector('.scenario-message-row:last-child textarea')?.focus();
  }

  function moveScenarioMessage(index, offset) {
    const messages = state.scenario.messages;
    const target = index + offset;
    if (target < 0 || target >= messages.length) return;
    const [message] = messages.splice(index, 1);
    messages.splice(target, 0, message);
    renderScenarioMessages();
    handleScenarioControlsChanged();
  }

  function deleteScenarioMessage(index) {
    state.scenario.messages.splice(index, 1);
    renderScenarioMessages();
    handleScenarioControlsChanged();
  }

  function updateActivationControlState() {
    const minActivationsEnabled = numberValue(el.minActivationsInput.value, 0) > 0;
    el.minActivationsDepthMaxInput.disabled = !minActivationsEnabled;
  }

  function handleScenarioControlsChanged() {
    const scenario = updateScenarioFromControls();
    if (!scenario) return;
    syncScenarioJsonText();
    renderEntryBrowser();
    renderEntryEditor();
    markScenarioChanged();
  }

  function syncScenarioJsonText() {
    el.scenarioJsonText.value = JSON.stringify(state.scenario || {}, null, 2);
    el.scenarioJsonText.removeAttribute('aria-invalid');
    state.scenarioJsonDirty = false;
    el.scenarioStructuredFields.disabled = false;
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

  function applyHistory(history) {
    state.history = history || null;
    renderHistory();
  }

  function renderHistory() {
    const history = state.history || { snapshots: [], experiments: [] };
    const snapshots = [...(history.snapshots || [])].reverse();
    const experiments = [...(history.experiments || [])].reverse();
    const active = experiments.find(experiment => experiment.status === 'active');
    el.startExperimentButton.disabled = Boolean(active);
    el.finishExperimentButton.disabled = !active;
    el.historyButton.classList.toggle('has-active-experiment', Boolean(active));
    el.historyButton.title = active ? `Active experiment: ${active.title}` : 'Open snapshots and experiments';
    el.historyMeta.textContent = active
      ? `Active experiment: ${active.title}`
      : `${snapshots.length} ${snapshots.length === 1 ? 'snapshot' : 'snapshots'} | ${basename(historyFileName())}`;

    el.experimentList.replaceChildren();
    if (!experiments.length) el.experimentList.append(historyEmpty('No experiments yet.'));
    for (const experiment of experiments) {
      const row = document.createElement('article');
      row.className = `history-row experiment-${experiment.status}`;
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = experiment.title;
      const meta = document.createElement('span');
      meta.textContent = `${experiment.status === 'active' ? 'Active' : 'Finished'} | ${formatDate(experiment.createdAt)}`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'history-row-actions';
      actions.append(historyAction('Diff', () => withWorldbookText(worldbookText => post('diffExperiment', { experimentId: experiment.id, worldbookText }))));
      if (experiment.baselineSnapshotId) {
        actions.append(historyAction('Restore baseline', () => restoreFromHistory(experiment.baselineSnapshotId)));
      }
      if (experiment.afterSnapshotId) {
        actions.append(historyAction('Restore result', () => restoreFromHistory(experiment.afterSnapshotId)));
      }
      row.append(copy, actions);
      el.experimentList.append(row);
    }

    el.snapshotList.replaceChildren();
    if (!snapshots.length) el.snapshotList.append(historyEmpty('No snapshots yet.'));
    for (const snapshot of snapshots) {
      const row = document.createElement('article');
      row.className = 'history-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = snapshot.label;
      const meta = document.createElement('span');
      meta.textContent = `${snapshot.entryCount || 0} entries | ${formatDate(snapshot.createdAt)} | ${String(snapshot.reason || 'snapshot').replaceAll('-', ' ')}`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'history-row-actions';
      actions.append(
        historyAction('Diff', () => withWorldbookText(worldbookText => post('diffSnapshot', { snapshotId: snapshot.id, worldbookText }))),
        historyAction('Restore', () => restoreFromHistory(snapshot.id), true),
      );
      row.append(copy, actions);
      el.snapshotList.append(row);
    }
  }

  function historyAction(label, handler, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (danger) button.className = 'danger-command';
    button.addEventListener('click', handler);
    return button;
  }

  function historyEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = message;
    return empty;
  }

  function restoreFromHistory(snapshotId) {
    withWorldbookText(worldbookText => post('restoreSnapshot', { snapshotId, worldbookText }));
  }

  function historyFileName() {
    const file = basename(state.worldbookPath || 'worldbook.json');
    return file.replace(/\.json$/i, '') + '.wbh-history.json';
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
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
    const tokenParts = [
      `${result.tokenUsage.allEntriesTokens} all entries`,
      `${result.tokenUsage.worldInfoTokens} active WI`,
      `${result.tokenUsage.timelineTokens} timeline`,
    ];
    if (result.tokenBudget?.limit > 0) tokenParts.push(`${result.tokenBudget.used}/${result.tokenBudget.limit} WI budget`);
    if (Number(result.activationScanDepth) > Number(result.settings?.worldInfoDepth)) tokenParts.push(`scan depth ${result.activationScanDepth}`);
    tokenParts.push(result.tokenizer.accuracy);
    el.tokenMeta.textContent = tokenParts.join(' | ');

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
    if (state.scenarioJsonDirty && !applyScenarioJson(false)) return null;
    const scenario = updateScenarioFromControls();
    if (!scenario) return null;
    syncScenarioJsonText();
    return cloneValue(scenario);
  }

  function updateScenarioFromControls() {
    try {
      const previous = isObject(state.scenario) ? state.scenario : {};
      const previousSettings = isObject(previous.settings) ? previous.settings : {};
      const scenario = {
        ...previous,
        seed: el.seedInput.value,
        trigger: el.triggerInput.value || 'normal',
        userName: '{{user}}',
        includeCharacterBook: el.characterBookInput.checked,
        settings: {
          ...previousSettings,
          tokenizerProfile: el.tokenizerInput.value,
          worldInfoDepth: Math.max(0, numberValue(el.depthInput.value, 4)),
          maxContextTokens: Math.max(0, numberValue(el.contextSizeInput.value, 0)),
          budgetPercent: clamp(numberValue(el.budgetPercentInput.value, 100), 0, 100),
          budgetCap: Math.max(0, numberValue(el.budgetCapInput.value, 0)),
          minActivations: Math.max(0, numberValue(el.minActivationsInput.value, 0)),
          minActivationsDepthMax: Math.max(0, numberValue(el.minActivationsDepthMaxInput.value, 0)),
          maxRecursionSteps: Math.max(0, numberValue(el.maxRecursionStepsInput.value, 2)),
          worldInfoInsertionStrategy: el.insertionStrategyInput.value || 'character-first',
          includeNames: el.includeNamesInput.checked,
          recursive: el.recursiveInput.checked,
          caseSensitive: el.caseSensitiveInput.checked,
          matchWholeWords: el.matchWholeWordsInput.checked,
          useGroupScoring: el.useGroupScoringInput.checked,
          alertOnOverflow: el.alertOnOverflowInput.checked,
        },
        messages: Array.isArray(previous.messages) ? previous.messages : [],
        forceActivate: parseStringListText(el.forceText.value, 'Force Activate IDs'),
      };
      el.forceText.removeAttribute('aria-invalid');
      state.scenario = scenario;
      updateActivationControlState();
      return scenario;
    } catch (error) {
      el.forceText.setAttribute('aria-invalid', 'true');
      setStatus(error.message, true);
      setActiveTab('scenario');
      return null;
    }
  }

  function applyScenarioJson(showStatus) {
    try {
      const scenario = parseJsonObjectText(el.scenarioJsonText.value, 'Scenario JSON');
      scenario.userName = '{{user}}';
      state.scenarioJsonDirty = false;
      renderScenario(scenario);
      markScenarioChanged(showStatus ? 'Scenario JSON applied.' : 'Scenario JSON applied for preview.');
      return true;
    } catch (error) {
      el.scenarioJsonText.setAttribute('aria-invalid', 'true');
      el.scenarioStructuredFields.disabled = true;
      setStatus(error.message, true);
      setActiveTab('scenario');
      return false;
    }
  }

  function setActiveTab(name) {
    el.tabs.forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    for (const [key, panel] of Object.entries(el.tabPanels)) panel.classList.toggle('active', key === name);
    const historyActive = name === 'history';
    el.historyButton.classList.toggle('active-command', historyActive);
    el.historyButton.setAttribute('aria-pressed', String(historyActive));
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

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
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
