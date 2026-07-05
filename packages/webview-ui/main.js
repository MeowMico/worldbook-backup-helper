(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const state = {
    worldbookPath: '',
    worldbookText: '',
    scenario: null,
    characterCard: null,
    lastPreview: null,
  };

  const el = {
    status: document.querySelector('#status'),
    worldbookTitle: document.querySelector('#worldbookTitle'),
    worldbookMeta: document.querySelector('#worldbookMeta'),
    worldbookText: document.querySelector('#worldbookText'),
    seedInput: document.querySelector('#seedInput'),
    userInput: document.querySelector('#userInput'),
    charInput: document.querySelector('#charInput'),
    tokenizerInput: document.querySelector('#tokenizerInput'),
    depthInput: document.querySelector('#depthInput'),
    contextInput: document.querySelector('#contextInput'),
    budgetInput: document.querySelector('#budgetInput'),
    budgetCapInput: document.querySelector('#budgetCapInput'),
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
  };

  el.compileButton.addEventListener('click', () => post('compilePreview', gatherPayload()));
  el.saveButton.addEventListener('click', () => post('saveWorldbook', { worldbookText: el.worldbookText.value }));
  el.scenarioButton.addEventListener('click', () => post('saveScenario', { scenario: gatherScenario() }));
  el.cardButton.addEventListener('click', () => post('importCharacterCard'));
  el.exportButton.addEventListener('click', () => post('exportWorldbookJson', { worldbookText: el.worldbookText.value }));

  window.addEventListener('message', event => {
    const message = event.data || {};
    if (message.type === 'state') applyState(message);
    if (message.type === 'preview') applyPreview(message);
    if (message.type === 'saved') setStatus(message.message || 'Saved');
    if (message.type === 'error') setStatus(message.message || 'Error', true);
  });

  post('ready');

  function applyState(message) {
    state.worldbookPath = message.worldbookPath || '';
    state.worldbookText = message.worldbookText || '';
    state.scenario = message.scenario || {};
    state.characterCard = message.characterCard || null;
    el.worldbookText.value = state.worldbookText;
    el.worldbookTitle.textContent = basename(state.worldbookPath) || 'Worldbook';
    el.worldbookMeta.textContent = state.worldbookPath;
    renderScenario(state.scenario);
    renderCharacterCard();
    setStatus('Ready');
  }

  function applyPreview(message) {
    state.lastPreview = message.result;
    if (message.worldbookText) {
      state.worldbookText = message.worldbookText;
      el.worldbookText.value = message.worldbookText;
    }
    renderPreview(message.result);
    setStatus('Preview ready');
  }

  function renderScenario(scenario) {
    const settings = scenario.settings || {};
    el.seedInput.value = scenario.seed || '';
    el.userInput.value = scenario.userName || '{{user}}';
    el.charInput.value = scenario.charName || '';
    el.tokenizerInput.value = settings.tokenizerProfile || 'estimate';
    el.depthInput.value = settings.worldInfoDepth ?? 4;
    el.contextInput.value = settings.maxContextTokens ?? 8192;
    el.budgetInput.value = settings.budgetPercent ?? 25;
    el.budgetCapInput.value = settings.budgetCap ?? 0;
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
    if (!result) return;
    el.tokenMeta.textContent = `${result.tokenBudget.used}/${result.tokenBudget.limit || 'no limit'} WI tokens | ${result.tokenBudget.timelineTokens} timeline | ${result.tokenizer.accuracy}`;

    const summary = document.createElement('div');
    summary.className = 'summary-strip';
    summary.append(
      metric('Activated', result.activatedEntries.length),
      metric('Skipped', result.skippedEntries.length),
      metric('Sources', result.sources.length),
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
    for (const item of result.timeline) {
      timeline.append(renderTimelineItem(item));
    }
    el.preview.append(timeline);

    const details = document.createElement('section');
    details.className = 'details-grid';
    details.append(renderEntryList('Activated Entries', result.activatedEntries, true));
    details.append(renderEntryList('Skipped Entries', result.skippedEntries, false));
    el.preview.append(details);
  }

  function renderTimelineItem(item) {
    const row = document.createElement('article');
    row.className = `timeline-item role-${item.role}`;
    const head = document.createElement('div');
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

  function renderEntryList(title, entries, active) {
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
      const row = document.createElement('article');
      row.className = active ? 'entry active' : 'entry skipped';
      const name = document.createElement('strong');
      name.textContent = entry.title;
      const meta = document.createElement('span');
      meta.textContent = active
        ? `${entry.sourceName} | ${entry.trigger} | order ${entry.order} | ${entry.tokens || 0} tokens`
        : `${entry.sourceName} | ${entry.reason}`;
      row.append(name, meta);
      if (entry.message) {
        const message = document.createElement('p');
        message.textContent = entry.message;
        row.append(message);
      }
      section.append(row);
    }
    return section;
  }

  function gatherPayload() {
    return {
      worldbookText: el.worldbookText.value,
      scenario: gatherScenario(),
    };
  }

  function gatherScenario() {
    const previous = state.scenario || {};
    return {
      ...previous,
      seed: el.seedInput.value,
      userName: el.userInput.value,
      charName: el.charInput.value,
      includeCharacterBook: el.characterBookInput.checked,
      settings: {
        ...(previous.settings || {}),
        tokenizerProfile: el.tokenizerInput.value,
        worldInfoDepth: numberValue(el.depthInput.value, 4),
        maxContextTokens: numberValue(el.contextInput.value, 8192),
        budgetPercent: numberValue(el.budgetInput.value, 25),
        budgetCap: numberValue(el.budgetCapInput.value, 0),
        recursive: el.recursiveInput.checked,
      },
      messages: parseJsonField(el.messagesText.value, []),
      forceActivate: parseJsonField(el.forceText.value, []),
    };
  }

  function parseJsonField(value, fallback) {
    try {
      return JSON.parse(value || JSON.stringify(fallback));
    } catch {
      setStatus('Scenario JSON field is invalid.', true);
      return fallback;
    }
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

  function numberValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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
