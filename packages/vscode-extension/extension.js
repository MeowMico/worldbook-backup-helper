'use strict';

const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const {
  createDefaultScenario,
  parseScenarioJson,
  scenarioFilePath,
  historyFilePath,
  createDefaultHistory,
  parseHistoryJson,
  createHistorySnapshot,
  startHistoryExperiment,
  finishHistoryExperiment,
  summarizeHistory,
  getHistorySnapshot,
  copyWorldbookEntries,
  parseWorldbookJson,
  serializeWorldbookJson,
  parseCharacterCard,
  compilePromptPreview,
} = loadCore();
const i18n = loadI18n();

let activePanel = null;
const DIFF_SCHEME = 'worldbook-workbench-diff';
const diffDocuments = new Map();
let diffDocumentSequence = 0;

function activate(context) {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, {
      provideTextDocumentContent(uri) {
        return diffDocuments.get(uri.toString()) || '';
      },
    }),
    vscode.commands.registerCommand('worldbookWorkbench.openWorkbench', uri => WorkbenchPanel.createOrShow(context, uri, 'edit')),
    vscode.commands.registerCommand('worldbookWorkbench.openPromptPreview', uri => WorkbenchPanel.createOrShow(context, uri, 'preview')),
    vscode.commands.registerCommand('worldbookWorkbench.importCharacterCard', () => withPanel(context, panel => panel.importCharacterCard())),
    vscode.commands.registerCommand('worldbookWorkbench.saveScenario', () => withPanel(context, panel => panel.saveScenario())),
    vscode.commands.registerCommand('worldbookWorkbench.exportWorldbookJson', () => withPanel(context, panel => panel.exportWorldbookJson())),
    vscode.commands.registerCommand('worldbookWorkbench.openUserGuide', () => openUserGuide(context)),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('worldbookWorkbench.language')) activePanel?.refreshLanguage();
    }),
  );
}

function deactivate() {}

async function withPanel(context, callback) {
  const panel = activePanel || await WorkbenchPanel.createOrShow(context, null, 'edit');
  if (!panel) return undefined;
  return callback(panel);
}

async function openUserGuide(context, language = getLanguageState().language) {
  const fileName = language === 'zh' ? 'USER_GUIDE.zh-CN.md' : 'USER_GUIDE.md';
  const uri = vscode.Uri.file(path.join(context.extensionPath, fileName));
  try {
    await vscode.workspace.openTextDocument(uri);
    await vscode.commands.executeCommand('markdown.showPreview', uri);
  } catch (error) {
    const message = hostText('Could not open the user guide: {message}', { message: error.message }, language);
    vscode.window.showErrorMessage(message);
  }
}

class WorkbenchPanel {
  static async createOrShow(context, uri, mode) {
    const worldbookUri = await resolveWorldbookUri(uri);
    if (!worldbookUri) {
      vscode.window.showWarningMessage(hostText('Open or select a worldbook JSON file first.'));
      return null;
    }

    if (activePanel) {
      activePanel.panel.reveal(vscode.ViewColumn.One);
      await activePanel.loadWorldbook(worldbookUri, mode);
      return activePanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'worldbookWorkbench',
      hostText('Worldbook Workbench'),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(resolveWebviewRoot(context.extensionPath))],
      },
    );
    activePanel = new WorkbenchPanel(context, panel);
    panel.onDidDispose(() => {
      activePanel = null;
    }, null, context.subscriptions);
    await activePanel.loadWorldbook(worldbookUri, mode);
    return activePanel;
  }

  constructor(context, panel) {
    this.context = context;
    this.panel = panel;
    this.worldbookUri = null;
    this.worldbookText = '';
    this.scenario = createDefaultScenario('');
    this.characterCard = null;
    this.characterCardPath = '';
    this.history = createDefaultHistory('');
    this.mode = 'edit';
    this.languageState = getLanguageState();
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage(message => this.onMessage(message), null, context.subscriptions);
  }

  async loadWorldbook(uri, mode = 'edit') {
    this.worldbookUri = uri;
    this.mode = mode;
    this.worldbookText = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    const parsed = parseWorldbookJson(this.worldbookText, { filePath: uri.fsPath });
    this.worldbookText = serializeWorldbookJson(parsed);
    this.history = await this.loadHistoryForWorldbook(uri.fsPath, parsed.data);
    this.scenario = await this.loadScenarioForWorldbook(uri);
    this.scenario.worldbookPath = uri.fsPath;
    this.characterCardPath = this.scenario.characterCardPath || '';
    this.characterCard = this.characterCardPath ? await readCharacterCardSafely(this.characterCardPath) : null;
    this.postState();
    if (mode === 'preview') await this.compilePreview(this.worldbookText, this.scenario);
  }

  text(key, values) {
    return hostText(key, values, this.languageState.language);
  }

  async loadScenarioForWorldbook(uri) {
    const filePath = scenarioFilePath(uri.fsPath);
    try {
      return parseScenarioJson(Buffer.from(await fs.readFile(filePath)).toString('utf8'));
    } catch {
      return createDefaultScenario(uri.fsPath);
    }
  }

  async onMessage(message) {
    try {
      switch (message?.type) {
        case 'ready':
          this.postState();
          break;
        case 'compilePreview':
          await this.compilePreview(message.worldbookText, message.scenario);
          break;
        case 'saveWorldbook':
          await this.saveWorldbook(message.worldbookText);
          break;
        case 'importCharacterCard':
          await this.importCharacterCard(message.scenario);
          break;
        case 'saveScenario':
          await this.saveScenario(message.scenario);
          break;
        case 'exportWorldbookJson':
          await this.exportWorldbookJson(message.worldbookText);
          break;
        case 'copyEntriesToWorldbook':
          await this.copyEntriesToWorldbook(message.worldbookText, message.entryIds);
          break;
        case 'createSnapshot':
          await this.createSnapshot(message.worldbookText);
          break;
        case 'startExperiment':
          await this.startExperiment(message.worldbookText);
          break;
        case 'finishExperiment':
          await this.finishExperiment(message.worldbookText, message.experimentId);
          break;
        case 'setLanguage':
          await this.setLanguage(message.preference);
          break;
        case 'openUserGuide':
          await openUserGuide(this.context, this.languageState.language);
          break;
        case 'diffSnapshot':
          await this.diffSnapshot(message.snapshotId, message.worldbookText);
          break;
        case 'restoreSnapshot':
          await this.restoreSnapshot(message.snapshotId, message.worldbookText);
          break;
        case 'diffExperiment':
          await this.diffExperiment(message.experimentId, message.worldbookText);
          break;
        default:
          break;
      }
    } catch (error) {
      this.post({ type: 'error', message: error.message });
      vscode.window.showErrorMessage(error.message);
    }
  }

  async compilePreview(worldbookText = this.worldbookText, scenario = this.scenario) {
    const parsed = parseWorldbookJson(worldbookText, {
      sourceName: path.basename(this.worldbookUri.fsPath, path.extname(this.worldbookUri.fsPath)),
      filePath: this.worldbookUri.fsPath,
    });
    this.worldbookText = serializeWorldbookJson(parsed);
    this.scenario = normalizeScenarioForPanel(scenario, this.worldbookUri.fsPath, this.characterCardPath);
    const result = compilePromptPreview({
      worldbooks: [{ name: parsed.sourceName, path: this.worldbookUri.fsPath, data: parsed.data }],
      characterCard: this.characterCard,
      scenario: this.scenario,
    });
    this.post({ type: 'preview', result, worldbookText: this.worldbookText });
  }

  async saveWorldbook(worldbookText = this.worldbookText) {
    const parsed = parseWorldbookJson(worldbookText, {
      sourceName: path.basename(this.worldbookUri.fsPath, path.extname(this.worldbookUri.fsPath)),
      filePath: this.worldbookUri.fsPath,
    });
    const text = serializeWorldbookJson(parsed);
    const diskText = Buffer.from(await vscode.workspace.fs.readFile(this.worldbookUri)).toString('utf8');
    const disk = parseWorldbookJson(diskText, { filePath: this.worldbookUri.fsPath });
    let snapshotResult = createHistorySnapshot(this.history, disk.data, {
      label: 'Before save',
      reason: 'save-before',
      worldbookPath: this.worldbookUri.fsPath,
    });
    this.history = snapshotResult.history;
    if (snapshotResult.created) await this.writeHistory(this.worldbookUri.fsPath, this.history);
    await vscode.workspace.fs.writeFile(this.worldbookUri, Buffer.from(text, 'utf8'));
    snapshotResult = createHistorySnapshot(this.history, parsed.data, {
      label: 'After save',
      reason: 'save-after',
      worldbookPath: this.worldbookUri.fsPath,
    });
    this.history = snapshotResult.history;
    await this.writeHistory(this.worldbookUri.fsPath, this.history);
    this.worldbookText = text;
    this.post({
      type: 'saved',
      message: this.text('Worldbook saved.'),
      worldbookText: text,
      history: summarizeHistory(this.history),
    });
  }

  async loadHistoryForWorldbook(worldbookPath, worldbookData) {
    const target = historyFilePath(worldbookPath);
    let history;
    let needsWrite = false;
    try {
      history = parseHistoryJson(await fs.readFile(target, 'utf8'), { worldbookPath });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error(this.text('Could not read {file}: {message}', { file: path.basename(target), message: error.message }));
      history = createDefaultHistory(worldbookPath);
      needsWrite = true;
    }
    const hasSnapshots = history.snapshots.length > 0;
    const result = createHistorySnapshot(history, worldbookData, {
      label: hasSnapshots ? 'Opened state' : 'Origin',
      reason: hasSnapshots ? 'open' : 'origin',
      worldbookPath,
    });
    if (needsWrite || result.created) await this.writeHistory(worldbookPath, result.history);
    return result.history;
  }

  async writeHistory(worldbookPath, history) {
    await fs.writeFile(historyFilePath(worldbookPath), `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  }

  async createSnapshot(worldbookText = this.worldbookText) {
    const label = await vscode.window.showInputBox({
      title: this.text('Create Worldbook Snapshot'),
      prompt: this.text('Name this snapshot'),
      value: this.text('Snapshot {date}', { date: new Date().toLocaleString(this.languageState.language === 'zh' ? 'zh-CN' : undefined) }),
      ignoreFocusOut: true,
    });
    if (label === undefined) return;
    const parsed = parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath });
    const result = createHistorySnapshot(this.history, parsed.data, {
      label: label.trim() || 'Snapshot',
      reason: 'manual',
      skipDuplicate: false,
      worldbookPath: this.worldbookUri.fsPath,
    });
    this.history = result.history;
    await this.writeHistory(this.worldbookUri.fsPath, this.history);
    this.postHistory(this.text('Snapshot created: {label}', { label: result.snapshot.label }));
  }

  async startExperiment(worldbookText = this.worldbookText) {
    const title = await vscode.window.showInputBox({
      title: this.text('New Worldbook Experiment'),
      prompt: this.text('What are you testing?'),
      value: this.text('New experiment'),
      ignoreFocusOut: true,
    });
    if (title === undefined) return;
    const parsed = parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath });
    const result = startHistoryExperiment(this.history, parsed.data, title.trim() || 'Experiment', {
      worldbookPath: this.worldbookUri.fsPath,
    });
    this.history = result.history;
    await this.writeHistory(this.worldbookUri.fsPath, this.history);
    this.postHistory(this.text('Experiment started: {title}', { title: result.experiment.title }));
  }

  async finishExperiment(worldbookText = this.worldbookText, experimentId = '') {
    const active = this.history.experiments.find(experiment => experiment.id === String(experimentId || '') && experiment.status === 'active')
      || this.history.experiments.find(experiment => experiment.status === 'active');
    if (!active) throw new Error(this.text('There is no active experiment to save.'));
    const parsed = parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath });
    const result = finishHistoryExperiment(this.history, active.id, parsed.data, {
      worldbookPath: this.worldbookUri.fsPath,
    });
    this.history = result.history;
    await this.writeHistory(this.worldbookUri.fsPath, this.history);
    this.postHistory(this.text('Experiment result saved: {title}', { title: result.experiment.title }));
  }

  async diffSnapshot(snapshotId, worldbookText = this.worldbookText) {
    const snapshot = getHistorySnapshot(this.history, snapshotId);
    if (!snapshot?.data) throw new Error(this.text('Snapshot not found.'));
    const current = parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath });
    await openWorldbookDiff(
      serializeWorldbookJson(snapshot.data),
      serializeWorldbookJson(current.data),
      `${snapshot.label} <-> ${this.text('Current')}`,
      snapshot.label,
      this.text('Current draft'),
    );
  }

  async diffExperiment(experimentId, worldbookText = this.worldbookText) {
    const experiment = this.history.experiments.find(item => item.id === String(experimentId || ''));
    if (!experiment) throw new Error(this.text('Experiment not found.'));
    const baseline = getHistorySnapshot(this.history, experiment.baselineSnapshotId);
    if (!baseline?.data) throw new Error(this.text('Experiment baseline not found.'));
    const after = experiment.afterSnapshotId ? getHistorySnapshot(this.history, experiment.afterSnapshotId) : null;
    const right = after?.data || parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath }).data;
    await openWorldbookDiff(
      serializeWorldbookJson(baseline.data),
      serializeWorldbookJson(right),
      this.text('Experiment: {title}', { title: experiment.title }),
      this.text('Baseline'),
      after ? this.text('After') : this.text('Current draft'),
    );
  }

  async restoreSnapshot(snapshotId, worldbookText = this.worldbookText) {
    const snapshot = getHistorySnapshot(this.history, snapshotId);
    if (!snapshot?.data) throw new Error(this.text('Snapshot not found.'));
    const restoreLabel = this.text('Restore');
    const choice = await vscode.window.showWarningMessage(
      this.text('Restore "{label}"? The current draft will be saved to history first.', { label: snapshot.label }),
      { modal: true },
      restoreLabel,
    );
    if (choice !== restoreLabel) return;

    const current = parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath });
    const before = createHistorySnapshot(this.history, current.data, {
      label: `Before restore: ${snapshot.label}`,
      reason: 'restore-before',
      skipDuplicate: false,
      worldbookPath: this.worldbookUri.fsPath,
    });
    this.history = before.history;
    await this.writeHistory(this.worldbookUri.fsPath, this.history);
    const text = serializeWorldbookJson(snapshot.data);
    await vscode.workspace.fs.writeFile(this.worldbookUri, Buffer.from(text, 'utf8'));
    this.worldbookText = text;
    this.post({
      type: 'restored',
      message: this.text('Restored: {label}', { label: snapshot.label }),
      worldbookText: text,
      history: summarizeHistory(this.history),
    });
  }

  async copyEntriesToWorldbook(worldbookText = this.worldbookText, entryIds = []) {
    const source = parseWorldbookJson(worldbookText, { filePath: this.worldbookUri.fsPath });
    const [targetUri] = await vscode.window.showOpenDialog({
      title: this.text('Copy Entries to Worldbook'),
      defaultUri: vscode.Uri.file(path.dirname(this.worldbookUri.fsPath)),
      canSelectMany: false,
      filters: { 'Worldbook JSON': ['json'] },
    }) || [];
    if (!targetUri) return;
    if (path.resolve(targetUri.fsPath) === path.resolve(this.worldbookUri.fsPath)) {
      throw new Error(this.text('Choose a different worldbook as the copy target.'));
    }

    const targetText = Buffer.from(await vscode.workspace.fs.readFile(targetUri)).toString('utf8');
    const target = parseWorldbookJson(targetText, { filePath: targetUri.fsPath });
    let targetHistory = await this.loadHistoryForWorldbook(targetUri.fsPath, target.data);
    let snapshotResult = createHistorySnapshot(targetHistory, target.data, {
      label: `Before copy from ${path.basename(this.worldbookUri.fsPath)}`,
      reason: 'copy-before',
      skipDuplicate: false,
      worldbookPath: targetUri.fsPath,
    });
    targetHistory = snapshotResult.history;
    await this.writeHistory(targetUri.fsPath, targetHistory);

    const result = copyWorldbookEntries(source.data, target.data, entryIds);
    if (!result.copied.length) throw new Error(this.text('No selected entries were found to copy.'));
    const copiedText = serializeWorldbookJson(result.data);
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(copiedText, 'utf8'));
    snapshotResult = createHistorySnapshot(targetHistory, result.data, {
      label: `After copy from ${path.basename(this.worldbookUri.fsPath)}`,
      reason: 'copy-after',
      skipDuplicate: false,
      worldbookPath: targetUri.fsPath,
    });
    await this.writeHistory(targetUri.fsPath, snapshotResult.history);
    const message = this.text('Copied {count} entries to {file}.', {
      count: result.copied.length,
      file: path.basename(targetUri.fsPath),
    });
    this.post({ type: 'copiedEntries', message });
    vscode.window.showInformationMessage(message);
  }

  postHistory(message) {
    this.post({ type: 'history', message, history: summarizeHistory(this.history) });
  }

  async importCharacterCard(scenario = this.scenario) {
    this.scenario = normalizeScenarioForPanel(scenario, this.worldbookUri.fsPath, this.characterCardPath);
    const [uri] = await vscode.window.showOpenDialog({
      title: this.text('Import Character Card'),
      canSelectMany: false,
      filters: {
        'Character cards': ['json', 'png'],
      },
    }) || [];
    if (!uri) return;
    const buffer = Buffer.from(await vscode.workspace.fs.readFile(uri));
    this.characterCard = parseCharacterCard(buffer, { filePath: uri.fsPath });
    this.characterCardPath = uri.fsPath;
    this.scenario.characterCardPath = uri.fsPath;
    this.postState();
    await this.compilePreview(this.worldbookText, this.scenario);
  }

  async saveScenario(scenario = this.scenario) {
    this.scenario = normalizeScenarioForPanel(scenario, this.worldbookUri.fsPath, this.characterCardPath);
    const target = scenarioFilePath(this.worldbookUri.fsPath);
    await fs.writeFile(target, `${JSON.stringify(this.scenario, null, 2)}\n`, 'utf8');
    this.post({ type: 'saved', message: this.text('Preview setup saved: {file}', { file: path.basename(target) }) });
  }

  async exportWorldbookJson(worldbookText = this.worldbookText) {
    const parsed = parseWorldbookJson(worldbookText, {
      sourceName: path.basename(this.worldbookUri.fsPath, path.extname(this.worldbookUri.fsPath)),
      filePath: this.worldbookUri.fsPath,
    });
    const target = await vscode.window.showSaveDialog({
      title: this.text('Export Worldbook JSON'),
      defaultUri: vscode.Uri.file(this.worldbookUri.fsPath),
      filters: { JSON: ['json'] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(serializeWorldbookJson(parsed), 'utf8'));
    this.post({ type: 'saved', message: this.text('Exported: {file}', { file: path.basename(target.fsPath) }) });
  }

  postState() {
    this.post({
      type: 'state',
      mode: this.mode,
      worldbookPath: this.worldbookUri?.fsPath || '',
      worldbookText: this.worldbookText,
      scenario: this.scenario,
      characterCard: summarizeCharacterCard(this.characterCard),
      history: summarizeHistory(this.history),
      ...this.languageState,
    });
  }

  post(message) {
    void this.panel.webview.postMessage(message);
  }

  async setLanguage(preference) {
    const value = i18n.normalizePreference(preference);
    await vscode.workspace.getConfiguration('worldbookWorkbench').update('language', value, vscode.ConfigurationTarget.Global);
    this.refreshLanguage();
  }

  refreshLanguage() {
    this.languageState = getLanguageState();
    this.panel.title = hostText('Worldbook Workbench', {}, this.languageState.language);
    this.post({ type: 'language', ...this.languageState });
  }

  html() {
    const webview = this.panel.webview;
    const uiRoot = vscode.Uri.file(resolveWebviewRoot(this.context.extensionPath));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'style.css'));
    const i18nUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'i18n.js'));
    const scenarioFieldsUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'scenario-fields.js'));
    const worldbookEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'worldbook-editor.js'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'main.js'));
    const nonce = String(Date.now());
    const languageState = JSON.stringify(this.languageState).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Worldbook Workbench</title>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div>
          <h1>Worldbook Workbench</h1>
          <p id="status">Ready</p>
        </div>
        <div class="actions">
          <button id="undoButton" class="icon-button toolbar-icon" type="button" title="Undo worldbook edit" aria-label="Undo worldbook edit" disabled>&#x21B6;</button>
          <button id="redoButton" class="icon-button toolbar-icon" type="button" title="Redo worldbook edit" aria-label="Redo worldbook edit" disabled>&#x21B7;</button>
          <button id="compileButton" class="primary" type="button">Preview</button>
          <button id="saveButton" type="button">Save</button>
          <button id="historyButton" type="button" title="Open snapshots and experiments" aria-pressed="false">Experiments</button>
          <button id="scenarioButton" type="button">Save Preview Setup</button>
          <button id="cardButton" type="button">Import Card</button>
          <button id="exportButton" type="button">Export JSON</button>
          <button id="helpButton" class="icon-button toolbar-icon" type="button" title="Open user guide" aria-label="Open user guide">?</button>
          <select id="languageInput" class="language-input" aria-label="Language">
            <option value="auto">Follow VS Code/Cursor</option>
            <option value="en">English</option>
            <option value="zh-cn">Simplified Chinese</option>
          </select>
        </div>
      </header>
      <main class="workspace">
        <section class="pane entries-pane">
          <div class="pane-head">
            <div class="pane-title">
              <h2 id="worldbookTitle">Worldbook</h2>
              <span id="entryCount">0 entries</span>
            </div>
            <div class="pane-head-actions">
              <button id="toggleEntryToolsButton" class="icon-button" type="button" title="Hide entry tools" aria-label="Hide entry tools" aria-expanded="true" aria-controls="entryToolbox"><span id="entryToolsToggleIcon" aria-hidden="true">&#x25B2;</span></button>
              <button id="newEntryButton" class="icon-button" type="button" title="New entry" aria-label="New entry">+</button>
            </div>
          </div>
          <div id="entryToolbox" class="entry-toolbox">
            <div class="entry-tools">
              <input id="entrySearch" type="search" placeholder="Filter entries" aria-label="Filter entries">
              <div class="entry-actions">
                <button id="duplicateEntryButton" type="button">Duplicate</button>
                <button id="deleteEntryButton" class="danger-command" type="button">Delete</button>
              </div>
            </div>
            <div class="selection-toolbar" aria-label="Selected entry actions">
              <label class="select-all"><input id="selectAllEntries" type="checkbox"> All shown</label>
              <span id="selectedEntryCount">0 selected</span>
              <div class="selection-actions">
                <button id="enableSelectedButton" type="button" disabled>Enable</button>
                <button id="disableSelectedButton" type="button" disabled>Disable</button>
                <button id="copySelectedButton" type="button" disabled>Copy to...</button>
                <button id="deleteSelectedButton" class="danger-command" type="button" disabled>Delete</button>
              </div>
            </div>
          </div>
          <div id="entryList" class="entry-browser" role="listbox" aria-label="Worldbook entries"></div>
        </section>
        <section class="pane workbench-pane">
          <div class="tabbar" role="tablist" aria-label="Workbench views">
            <button class="tab active" type="button" role="tab" aria-selected="true" data-tab="entry">Entry</button>
            <button class="tab tab-wide" type="button" role="tab" aria-selected="false" data-tab="scenario">Preview Setup</button>
            <button class="tab tab-wide" type="button" role="tab" aria-selected="false" data-tab="batch">Find &amp; Replace</button>
            <button class="tab" type="button" role="tab" aria-selected="false" data-tab="history">History</button>
            <button class="tab" type="button" role="tab" aria-selected="false" data-tab="json">JSON</button>
          </div>
          <section id="entryTab" class="tab-panel active" role="tabpanel">
            <div id="entryEmpty" class="empty-state">Select an entry to edit it.</div>
            <div id="entryEditor" class="entry-editor hidden">
              <div class="entry-editor-head">
                <div>
                  <h2 id="entryEditorTitle">Entry</h2>
                  <span id="entryEditorMeta"></span>
                </div>
                <label class="enabled-toggle"><input id="entryEnabledInput" type="checkbox"> Enabled</label>
              </div>
              <div class="entry-editor-scroll">
                <section class="editor-section">
                  <label>Title<input id="entryTitleInput" type="text"></label>
                  <div class="editor-grid">
                    <label title="Vectorized matching requires a compatible SillyTavern runtime.">Status<span class="strategy-control"><span id="entryStrategyIndicator" class="strategy-dot" aria-hidden="true"></span><select id="entryStrategyInput">
                      <option value="normal">Normal</option>
                      <option value="constant">Constant</option>
                      <option value="vectorized">Vectorized</option>
                    </select></span></label>
                    <label>Position<select id="entryPositionInput">
                      <option value="0">Before Character</option>
                      <option value="1">After Character</option>
                      <option value="5">Before Example Messages</option>
                      <option value="6">After Example Messages</option>
                      <option value="2">Top of Author Note</option>
                      <option value="3">Bottom of Author Note</option>
                      <option value="4">At Depth</option>
                      <option value="7">Outlet</option>
                    </select></label>
                    <label>Order<input id="entryOrderInput" type="number"></label>
                    <label>Probability<input id="entryProbabilityInput" type="number" min="0" max="100"></label>
                    <label id="entryDepthField" class="hidden">Depth<input id="entryDepthInput" type="number" min="0"></label>
                    <label id="entryRoleField" class="hidden">Role<select id="entryRoleInput">
                      <option value="0">System</option>
                      <option value="1">User</option>
                      <option value="2">Assistant</option>
                    </select></label>
                    <label id="entryOutletField" class="hidden">Outlet<input id="entryOutletInput" type="text"></label>
                  </div>
                </section>
                <section class="editor-section">
                  <div class="editor-grid">
                    <label>Primary Keywords<textarea id="entryKeysInput" rows="3" spellcheck="false"></textarea></label>
                    <label id="entrySecondaryField">Secondary Keywords<textarea id="entrySecondaryInput" rows="3" spellcheck="false"></textarea></label>
                  </div>
                  <label id="entryLogicField">Selective Logic<select id="entryLogicInput">
                    <option value="0">AND Any</option>
                    <option value="3">AND All</option>
                    <option value="2">NOT Any</option>
                    <option value="1">NOT All</option>
                  </select></label>
                  <div class="entry-inline-options">
                    <label class="check-row"><input id="entrySelectiveInput" type="checkbox"> Use Optional Filter</label>
                    <label class="check-row"><input id="entryUseProbabilityInput" type="checkbox"> Use Probability</label>
                  </div>
                </section>
                <section class="editor-section content-section">
                  <label>Content<textarea id="entryContentInput" rows="16" spellcheck="false"></textarea></label>
                </section>
                <details class="entry-advanced-settings">
                  <summary>Advanced Entry Settings</summary>
                  <div class="entry-advanced-content">
                    <section class="advanced-section">
                      <h3>Per-entry Overrides</h3>
                      <div class="editor-grid">
                        <label>Scan Depth<input id="entryScanDepthInput" type="number" min="0" placeholder="Use global"></label>
                        <label>Case-sensitive<select id="entryCaseSensitiveInput">
                          <option value="null">Use global</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select></label>
                        <label>Whole Words<select id="entryMatchWholeWordsInput">
                          <option value="null">Use global</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select></label>
                        <label>Group Scoring<select id="entryUseGroupScoringInput">
                          <option value="null">Use global</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select></label>
                        <label title="Requires the SillyTavern Quick Replies runtime.">Automation ID<input id="entryAutomationIdInput" type="text"></label>
                        <label class="check-field"><span>Add Memo</span><input id="entryAddMemoInput" type="checkbox"></label>
                      </div>
                    </section>
                    <section class="advanced-section">
                      <h3>Recursion and Budget</h3>
                      <div class="advanced-check-grid">
                        <label class="check-row"><input id="entryExcludeRecursionInput" type="checkbox"> Non-recursable</label>
                        <label class="check-row"><input id="entryPreventRecursionInput" type="checkbox"> Prevent further recursion</label>
                        <label class="check-row"><input id="entryDelayUntilRecursionInput" type="checkbox"> Delay until recursion</label>
                        <label class="check-row"><input id="entryIgnoreBudgetInput" type="checkbox"> Ignore budget</label>
                      </div>
                      <label id="entryRecursionLevelField" class="compact-field">Recursion Level<input id="entryRecursionLevelInput" type="number" min="1" placeholder="1"></label>
                    </section>
                    <section class="advanced-section">
                      <h3>Groups and Timing</h3>
                      <div class="editor-grid">
                        <label>Inclusion Group<input id="entryGroupInput" type="text"></label>
                        <label>Group Weight<input id="entryGroupWeightInput" type="number" min="1"></label>
                        <label>Sticky<input id="entryStickyInput" type="number" min="0" placeholder="Not sticky"></label>
                        <label>Cooldown<input id="entryCooldownInput" type="number" min="0" placeholder="No cooldown"></label>
                        <label>Delay<input id="entryDelayInput" type="number" min="0" placeholder="No delay"></label>
                        <label class="check-field"><span>Prioritize Inclusion</span><input id="entryGroupOverrideInput" type="checkbox"></label>
                      </div>
                    </section>
                    <section class="advanced-section">
                      <h3>Filters</h3>
                      <div class="editor-grid">
                        <label>Character Names<textarea id="entryCharacterNamesInput" rows="2" spellcheck="false"></textarea></label>
                        <label title="SillyTavern stores tag identifiers in this field.">Character Tag IDs<textarea id="entryCharacterTagsInput" rows="2" spellcheck="false"></textarea></label>
                      </div>
                      <label class="check-row"><input id="entryCharacterExcludeInput" type="checkbox"> Exclude listed characters or tags</label>
                      <fieldset class="advanced-fieldset">
                        <legend>Generation Triggers</legend>
                        <label class="check-row"><input type="checkbox" data-entry-trigger="normal"> Normal</label>
                        <label class="check-row"><input type="checkbox" data-entry-trigger="continue"> Continue</label>
                        <label class="check-row"><input type="checkbox" data-entry-trigger="impersonate"> Impersonate</label>
                        <label class="check-row"><input type="checkbox" data-entry-trigger="swipe"> Swipe</label>
                        <label class="check-row"><input type="checkbox" data-entry-trigger="regenerate"> Regenerate</label>
                        <label class="check-row"><input type="checkbox" data-entry-trigger="quiet"> Quiet</label>
                      </fieldset>
                    </section>
                    <section class="advanced-section">
                      <h3>Additional Matching Sources</h3>
                      <div class="advanced-check-grid">
                        <label class="check-row"><input id="entryMatchCharacterDescriptionInput" type="checkbox"> Character Description</label>
                        <label class="check-row"><input id="entryMatchCharacterPersonalityInput" type="checkbox"> Character Personality</label>
                        <label class="check-row"><input id="entryMatchScenarioInput" type="checkbox"> Scenario</label>
                        <label class="check-row"><input id="entryMatchPersonaDescriptionInput" type="checkbox"> Persona Description</label>
                        <label class="check-row"><input id="entryMatchCharacterDepthPromptInput" type="checkbox"> Character's Note</label>
                        <label class="check-row"><input id="entryMatchCreatorNotesInput" type="checkbox"> Creator's Notes</label>
                      </div>
                    </section>
                  </div>
                </details>
              </div>
            </div>
          </section>
          <section id="scenarioTab" class="tab-panel settings-pane" role="tabpanel">
            <div class="section-head"><h2>Prompt Preview Setup</h2><span id="cardMeta">No card</span></div>
            <p class="section-description">Use chat messages and ST-style activation settings to test which entries trigger and where they appear. This setup only affects preview, is stored separately, and is never exported into the worldbook JSON.</p>
            <fieldset id="scenarioStructuredFields" class="scenario-structured-fields">
              <div class="form-grid">
                <label title="Keeps probability and group choices stable between previews.">Preview Seed<input id="seedInput" type="text"></label>
                <label>Tokenizer<select id="tokenizerInput">
                  <option value="estimate">Estimate</option>
                  <option value="openai-cl100k">OpenAI cl100k</option>
                  <option value="openai-p50k">OpenAI p50k</option>
                  <option value="llama-estimate">Llama estimate</option>
                  <option value="claude-estimate">Claude estimate</option>
                </select></label>
              </div>
              <div class="scenario-toggles scenario-source-toggles">
                <label class="check-row"><input id="characterBookInput" type="checkbox"> Character book</label>
              </div>
              <details class="scenario-global-settings" open>
                <summary>Global Activation Settings</summary>
                <div class="settings-actions">
                  <button id="workbenchDefaultsButton" type="button">Workbench defaults</button>
                  <button id="sillyTavernDefaultsButton" type="button" title="Set Context Size separately to preview the native percentage budget.">ST 1.18 defaults</button>
                </div>
                <div class="form-grid scenario-global-grid">
                  <label title="How many recent chat messages world-info keyword matching scans.">Scan Depth<input id="depthInput" type="number" min="0"></label>
                  <label title="Standalone context size used to calculate the world-info budget. Zero disables the percentage budget.">Context Size<input id="contextSizeInput" type="number" min="0"></label>
                  <label title="Percentage of Context Size available to activated world info.">Context %<input id="budgetPercentInput" type="number" min="0" max="100"></label>
                  <label title="Maximum world-info tokens. Zero means no separate cap.">Budget Cap<input id="budgetCapInput" type="number" min="0"></label>
                  <label title="Continue scanning older messages until this many entries activate. Setting this above zero resets Max Recursion Steps.">Min Activations<input id="minActivationsInput" type="number" min="0"></label>
                  <label title="Oldest message depth Min Activations may reach. Zero allows the whole chat.">Max Depth<input id="minActivationsDepthMaxInput" type="number" min="0"></label>
                  <label title="Maximum scan passes. Zero continues until no new recursive entries activate. Setting this above zero resets Min Activations.">Max Recursion Steps<input id="maxRecursionStepsInput" type="number" min="0"></label>
                  <label>Insertion Strategy<select id="insertionStrategyInput">
                    <option value="evenly">Sorted Evenly</option>
                    <option value="character-first">Character Lore First</option>
                    <option value="global-first">Global Lore First</option>
                  </select></label>
                </div>
                <div class="scenario-toggles scenario-global-toggles">
                  <label class="check-row"><input id="includeNamesInput" type="checkbox"> Include Names</label>
                  <label class="check-row"><input id="recursiveInput" type="checkbox"> Recursive Scan</label>
                  <label class="check-row"><input id="caseSensitiveInput" type="checkbox"> Case-sensitive</label>
                  <label class="check-row"><input id="matchWholeWordsInput" type="checkbox"> Match Whole Words</label>
                  <label class="check-row"><input id="useGroupScoringInput" type="checkbox"> Use Group Scoring</label>
                  <label class="check-row"><input id="alertOnOverflowInput" type="checkbox"> Alert On Overflow</label>
                </div>
              </details>
              <details class="scenario-global-settings scenario-preview-settings">
                <summary>Preview Advanced Settings</summary>
                <div class="form-grid scenario-preview-grid">
                  <label>Preview Generation Type<select id="triggerInput">
                    <option value="normal">Normal</option>
                    <option value="continue">Continue</option>
                    <option value="impersonate">Impersonate</option>
                    <option value="swipe">Swipe</option>
                    <option value="regenerate">Regenerate</option>
                    <option value="quiet">Quiet</option>
                  </select></label>
                  <label>Persona Description<textarea id="personaDescriptionInput" rows="3" spellcheck="false"></textarea></label>
                  <label title="Leave empty to use the imported character card value.">Character's Note<textarea id="characterDepthPromptInput" rows="3" spellcheck="false"></textarea></label>
                  <label>Force Activate IDs<textarea id="forceText" rows="3" spellcheck="false" placeholder="One entry ID per line"></textarea></label>
                  <label>Sticky Active IDs<textarea id="stickyText" rows="3" spellcheck="false" placeholder="One entry ID per line"></textarea></label>
                  <label>Cooldown Active IDs<textarea id="cooldownText" rows="3" spellcheck="false" placeholder="One entry ID per line"></textarea></label>
                </div>
              </details>
              <section class="scenario-editor-section">
                <div class="scenario-section-head">
                  <div><h3>Chat Messages</h3><span id="messageCount">0 messages</span></div>
                  <button id="addMessageButton" type="button">Add message</button>
                </div>
                <div id="messageList" class="scenario-message-list"></div>
              </section>
            </fieldset>
            <section class="scenario-json-section">
              <div class="scenario-section-head">
                <div><h3>Full Preview Setup JSON</h3><span>Advanced</span></div>
                <button id="applyScenarioJsonButton" type="button">Apply JSON</button>
              </div>
              <textarea id="scenarioJsonText" spellcheck="false" aria-label="Full Preview Setup JSON"></textarea>
            </section>
          </section>
          <section id="batchTab" class="tab-panel batch-pane" role="tabpanel">
            <div class="section-head">
              <div><h2>Find and Replace</h2><span id="batchSummary">Enter text to find.</span></div>
            </div>
            <div class="batch-form">
              <label>Find<input id="batchFindInput" type="search" spellcheck="false"></label>
              <label>Replace with<input id="batchReplaceInput" type="text" spellcheck="false"></label>
              <fieldset>
                <legend>Fields</legend>
                <label class="check-row"><input id="batchTitleField" type="checkbox" checked> Title</label>
                <label class="check-row"><input id="batchKeywordsField" type="checkbox" checked> Keywords</label>
                <label class="check-row"><input id="batchContentField" type="checkbox" checked> Content</label>
                <label class="check-row"><input id="batchCaseSensitive" type="checkbox"> Case-sensitive</label>
              </fieldset>
              <div class="batch-actions">
                <button id="batchReplaceButton" class="primary" type="button" disabled>Replace all</button>
                <button id="batchDeleteButton" class="danger-command" type="button" disabled>Delete matches</button>
              </div>
            </div>
            <div id="batchResults" class="batch-results"></div>
          </section>
          <section id="historyTab" class="tab-panel history-pane" role="tabpanel">
            <div class="section-head history-head">
              <div><h2>Snapshots and Experiments</h2><span id="historyMeta">History is stored beside the worldbook.</span></div>
              <div class="history-create-actions">
                <button id="snapshotButton" type="button">Snapshot</button>
                <button id="startExperimentButton" class="primary" type="button">New experiment</button>
                <button id="finishExperimentButton" type="button" disabled>Save result</button>
              </div>
            </div>
            <section class="history-section">
              <h3>Experiments</h3>
              <div id="experimentList" class="history-list"></div>
            </section>
            <section class="history-section">
              <h3>Snapshots</h3>
              <div id="snapshotList" class="history-list"></div>
            </section>
          </section>
          <section id="jsonTab" class="tab-panel json-pane" role="tabpanel">
            <div class="section-head">
              <div><h2>Raw Worldbook JSON</h2><span id="worldbookMeta"></span></div>
              <button id="applyJsonButton" type="button">Apply JSON</button>
            </div>
            <textarea id="rawJsonText" spellcheck="false"></textarea>
          </section>
        </section>
        <section class="pane preview-pane">
          <div class="pane-head">
            <h2>Prompt Preview</h2>
            <span id="tokenMeta"></span>
          </div>
          <div id="preview"></div>
        </section>
      </main>
    </div>
    <script nonce="${nonce}">window.WORLDBOOK_WORKBENCH_LANGUAGE = ${languageState};</script>
    <script nonce="${nonce}" src="${i18nUri}"></script>
    <script nonce="${nonce}" src="${scenarioFieldsUri}"></script>
    <script nonce="${nonce}" src="${worldbookEditorUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

async function resolveWorldbookUri(uri) {
  if (uri && uri.fsPath) return uri;
  const active = vscode.window.activeTextEditor?.document?.uri;
  if (active?.scheme === 'file' && active.fsPath.toLowerCase().endsWith('.json')) return active;
  const [selected] = await vscode.window.showOpenDialog({
    title: hostText('Open Worldbook JSON'),
    canSelectMany: false,
    filters: { JSON: ['json'] },
  }) || [];
  return selected || null;
}

async function openWorldbookDiff(leftText, rightText, title, leftLabel, rightLabel) {
  const left = createDiffDocument(leftLabel, leftText);
  const right = createDiffDocument(rightLabel, rightText);
  await vscode.commands.executeCommand('vscode.diff', left, right, title, { preview: true });
}

function createDiffDocument(label, content) {
  const sequence = ++diffDocumentSequence;
  const safeLabel = String(label || 'worldbook').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'worldbook';
  const uri = vscode.Uri.from({ scheme: DIFF_SCHEME, path: `/${sequence}-${safeLabel}.json` });
  diffDocuments.set(uri.toString(), String(content || ''));
  while (diffDocuments.size > 40) diffDocuments.delete(diffDocuments.keys().next().value);
  return uri;
}

function loadCore() {
  const bundled = path.join(__dirname, 'dist', 'core', 'index.js');
  if (require('fs').existsSync(bundled)) return require(bundled);
  try {
    return require('@worldbook-workbench/core');
  } catch {
    return require('../core');
  }
}

function loadI18n() {
  const bundled = path.join(__dirname, 'dist', 'webview', 'i18n.js');
  if (require('fs').existsSync(bundled)) return require(bundled);
  try {
    return require('@worldbook-workbench/webview-ui/i18n');
  } catch {
    return require('../webview-ui/i18n');
  }
}

function getLanguageState() {
  const preference = i18n.normalizePreference(
    vscode.workspace.getConfiguration('worldbookWorkbench').get('language', 'auto'),
  );
  return {
    preference,
    language: i18n.resolveLanguage(preference, vscode.env.language),
    editorLanguage: vscode.env.language,
  };
}

function hostText(key, values = {}, language = getLanguageState().language) {
  return i18n.translate(language, key, values);
}

function resolveWebviewRoot(extensionPath) {
  const bundled = path.join(extensionPath, 'dist', 'webview');
  if (require('fs').existsSync(bundled)) return bundled;
  const packaged = path.join(extensionPath, 'node_modules', '@worldbook-workbench', 'webview-ui');
  const local = path.join(extensionPath, '..', 'webview-ui');
  return require('fs').existsSync(packaged) ? packaged : local;
}

async function readCharacterCardSafely(filePath) {
  try {
    return parseCharacterCard(await fs.readFile(filePath), { filePath });
  } catch {
    return null;
  }
}

function normalizeScenarioForPanel(scenario, worldbookPath, characterCardPath) {
  return parseScenarioJson(JSON.stringify({
    ...scenario,
    worldbookPath,
    characterCardPath: characterCardPath || scenario?.characterCardPath || '',
  }));
}

function summarizeCharacterCard(card) {
  if (!card) return null;
  return {
    name: card.name,
    description: card.description,
    scenario: card.scenario,
    format: card.format,
    hasCharacterBook: Boolean(card.characterBook),
    alternateGreetingCount: card.alternateGreetings?.length || 0,
  };
}

module.exports = { activate, deactivate };
