'use strict';

const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const {
  createDefaultScenario,
  parseScenarioJson,
  scenarioFilePath,
  parseWorldbookJson,
  serializeWorldbookJson,
  parseCharacterCard,
  compilePromptPreview,
} = loadCore();

let activePanel = null;

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('worldbookWorkbench.openWorkbench', uri => WorkbenchPanel.createOrShow(context, uri, 'edit')),
    vscode.commands.registerCommand('worldbookWorkbench.openPromptPreview', uri => WorkbenchPanel.createOrShow(context, uri, 'preview')),
    vscode.commands.registerCommand('worldbookWorkbench.importCharacterCard', () => withPanel(context, panel => panel.importCharacterCard())),
    vscode.commands.registerCommand('worldbookWorkbench.saveScenario', () => withPanel(context, panel => panel.saveScenario())),
    vscode.commands.registerCommand('worldbookWorkbench.exportWorldbookJson', () => withPanel(context, panel => panel.exportWorldbookJson())),
  );
}

function deactivate() {}

async function withPanel(context, callback) {
  const panel = activePanel || await WorkbenchPanel.createOrShow(context, null, 'edit');
  if (!panel) return undefined;
  return callback(panel);
}

class WorkbenchPanel {
  static async createOrShow(context, uri, mode) {
    const worldbookUri = await resolveWorldbookUri(uri);
    if (!worldbookUri) {
      vscode.window.showWarningMessage('Open or select a worldbook JSON file first.');
      return null;
    }

    if (activePanel) {
      activePanel.panel.reveal(vscode.ViewColumn.One);
      await activePanel.loadWorldbook(worldbookUri, mode);
      return activePanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'worldbookWorkbench',
      'Worldbook Workbench',
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
    this.mode = 'edit';
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage(message => this.onMessage(message), null, context.subscriptions);
  }

  async loadWorldbook(uri, mode = 'edit') {
    this.worldbookUri = uri;
    this.mode = mode;
    this.worldbookText = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    this.scenario = await this.loadScenarioForWorldbook(uri);
    this.scenario.worldbookPath = uri.fsPath;
    this.characterCardPath = this.scenario.characterCardPath || '';
    this.characterCard = this.characterCardPath ? await readCharacterCardSafely(this.characterCardPath) : null;
    this.postState();
    if (mode === 'preview') await this.compilePreview(this.worldbookText, this.scenario);
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
          await this.importCharacterCard();
          break;
        case 'saveScenario':
          await this.saveScenario(message.scenario);
          break;
        case 'exportWorldbookJson':
          await this.exportWorldbookJson(message.worldbookText);
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
    await vscode.workspace.fs.writeFile(this.worldbookUri, Buffer.from(text, 'utf8'));
    this.worldbookText = text;
    this.post({ type: 'saved', message: 'Worldbook saved.', worldbookText: text });
  }

  async importCharacterCard() {
    const [uri] = await vscode.window.showOpenDialog({
      title: 'Import Character Card',
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
    if (!this.scenario.charName && this.characterCard.name) this.scenario.charName = this.characterCard.name;
    this.postState();
    await this.compilePreview(this.worldbookText, this.scenario);
  }

  async saveScenario(scenario = this.scenario) {
    this.scenario = normalizeScenarioForPanel(scenario, this.worldbookUri.fsPath, this.characterCardPath);
    const target = scenarioFilePath(this.worldbookUri.fsPath);
    await fs.writeFile(target, `${JSON.stringify(this.scenario, null, 2)}\n`, 'utf8');
    this.post({ type: 'saved', message: `Scenario saved: ${path.basename(target)}` });
  }

  async exportWorldbookJson(worldbookText = this.worldbookText) {
    const parsed = parseWorldbookJson(worldbookText, {
      sourceName: path.basename(this.worldbookUri.fsPath, path.extname(this.worldbookUri.fsPath)),
      filePath: this.worldbookUri.fsPath,
    });
    const target = await vscode.window.showSaveDialog({
      title: 'Export Worldbook JSON',
      defaultUri: vscode.Uri.file(this.worldbookUri.fsPath),
      filters: { JSON: ['json'] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(serializeWorldbookJson(parsed), 'utf8'));
    this.post({ type: 'saved', message: `Exported: ${path.basename(target.fsPath)}` });
  }

  postState() {
    this.post({
      type: 'state',
      mode: this.mode,
      worldbookPath: this.worldbookUri?.fsPath || '',
      worldbookText: this.worldbookText,
      scenario: this.scenario,
      characterCard: summarizeCharacterCard(this.characterCard),
    });
  }

  post(message) {
    void this.panel.webview.postMessage(message);
  }

  html() {
    const webview = this.panel.webview;
    const uiRoot = vscode.Uri.file(resolveWebviewRoot(this.context.extensionPath));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'style.css'));
    const scenarioFieldsUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'scenario-fields.js'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(uiRoot, 'main.js'));
    const nonce = String(Date.now());
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
          <button id="compileButton" class="primary" type="button">Preview</button>
          <button id="saveButton" type="button">Save</button>
          <button id="scenarioButton" type="button">Save Scenario</button>
          <button id="cardButton" type="button">Import Card</button>
          <button id="exportButton" type="button">Export JSON</button>
        </div>
      </header>
      <main class="workspace">
        <section class="pane editor-pane">
          <div class="pane-head">
            <h2 id="worldbookTitle">Worldbook</h2>
            <span id="worldbookMeta"></span>
          </div>
          <textarea id="worldbookText" spellcheck="false"></textarea>
        </section>
        <section class="pane settings-pane">
          <div class="pane-head">
            <h2>Scenario</h2>
            <span id="cardMeta">No card</span>
          </div>
          <div class="form-grid">
            <label>Seed<input id="seedInput" type="text"></label>
            <label>User<input id="userInput" type="text"></label>
            <label>Character<input id="charInput" type="text"></label>
            <label>Generation<select id="triggerInput">
              <option value="normal">Normal</option>
              <option value="continue">Continue</option>
              <option value="impersonate">Impersonate</option>
              <option value="swipe">Swipe</option>
              <option value="regenerate">Regenerate</option>
              <option value="quiet">Quiet</option>
            </select></label>
            <label>Tokenizer<select id="tokenizerInput">
              <option value="estimate">Estimate</option>
              <option value="openai-cl100k">OpenAI cl100k</option>
              <option value="openai-p50k">OpenAI p50k</option>
              <option value="llama-estimate">Llama estimate</option>
              <option value="claude-estimate">Claude estimate</option>
            </select></label>
            <label>Depth<input id="depthInput" type="number" min="0"></label>
            <label>Max Context<input id="contextInput" type="number" min="0"></label>
            <label>Budget %<input id="budgetInput" type="number" min="0" max="100"></label>
            <label>Budget Cap<input id="budgetCapInput" type="number" min="0"></label>
          </div>
          <label class="check-row"><input id="recursiveInput" type="checkbox"> Recursive</label>
          <label class="check-row"><input id="characterBookInput" type="checkbox"> Character book</label>
          <label class="block-label">Messages JSON<textarea id="messagesText" spellcheck="false"></textarea></label>
          <label class="block-label">Force Activate IDs<textarea id="forceText" spellcheck="false"></textarea></label>
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
    <script nonce="${nonce}" src="${scenarioFieldsUri}"></script>
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
    title: 'Open Worldbook JSON',
    canSelectMany: false,
    filters: { JSON: ['json'] },
  }) || [];
  return selected || null;
}

function loadCore() {
  try {
    return require('@worldbook-workbench/core');
  } catch {
    return require('../core');
  }
}

function resolveWebviewRoot(extensionPath) {
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
