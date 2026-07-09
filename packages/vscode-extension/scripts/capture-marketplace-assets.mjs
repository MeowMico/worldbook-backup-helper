import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const core = require('../../core/index.js');

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiRoot = path.resolve(extensionRoot, '..', 'webview-ui');
const screenshotRoot = path.join(extensionRoot, 'media', 'screenshots');

const worldbook = {
  name: 'Lumenport Worldbook',
  entries: {
    0: {
      uid: 0,
      comment: 'Skyrail Network',
      key: ['skyrail', 'midnight line'],
      keysecondary: [],
      content: 'Lumenport\'s skyrail links the Archive Quarter, Glassmarket, and North Harbor. The midnight line is the only service that crosses the old observatory bridge after dusk.',
      selective: true,
      constant: false,
      vectorized: false,
      position: 1,
      order: 120,
      probability: 100,
      useProbability: true,
      disable: false,
    },
    1: {
      uid: 1,
      comment: 'Lumenport Overview',
      key: [],
      keysecondary: [],
      content: 'Lumenport is a rain-bright coastal city built around an ancient tidal archive. Public clocks follow the moon-tide calendar, and every district keeps its own archive bell.',
      selective: false,
      constant: true,
      vectorized: false,
      position: 0,
      order: 100,
      probability: 100,
      useProbability: true,
      disable: false,
    },
    2: {
      uid: 2,
      comment: 'Archivist Mira',
      key: ['Mira', 'archive'],
      keysecondary: [],
      content: 'Mira carries a brass index key and knows which catalog passages are safe after the archive lamps dim. She prefers practical directions over ceremonial explanations.',
      selective: true,
      constant: false,
      vectorized: false,
      position: 4,
      role: 0,
      depth: 1,
      order: 140,
      probability: 100,
      useProbability: true,
      disable: false,
    },
    3: {
      uid: 3,
      comment: 'Response Style',
      key: [],
      keysecondary: [],
      content: 'Keep spatial directions concrete. Mention district names when movement between locations matters.',
      selective: false,
      constant: true,
      vectorized: false,
      position: 3,
      order: 80,
      probability: 100,
      useProbability: true,
      disable: false,
    },
    4: {
      uid: 4,
      comment: 'Lantern Market',
      key: ['lantern market', 'Glassmarket'],
      keysecondary: ['festival'],
      content: 'During the moon-tide festival, Glassmarket stays open until dawn and accepts stamped archive chits alongside ordinary coin.',
      selective: true,
      constant: false,
      vectorized: false,
      selectiveLogic: 0,
      position: 0,
      order: 70,
      probability: 100,
      useProbability: true,
      disable: false,
    },
    5: {
      uid: 5,
      comment: 'Draft: Harbor Weather',
      key: ['harbor weather'],
      keysecondary: [],
      content: 'Draft notes for a future weather entry.',
      selective: true,
      constant: false,
      vectorized: false,
      position: 0,
      order: 60,
      probability: 100,
      useProbability: true,
      disable: true,
    },
  },
};

const characterCard = {
  data: {
    name: 'Mira Vale',
    description: 'Mira Vale is a field archivist who maps the shifting routes beneath Lumenport.',
    personality: 'Observant, concise, and quietly curious.',
    scenario: 'Mira is helping Rowan cross the city before the midnight archive bell.',
    creator_notes: 'Demonstration character for Worldbook Workbench screenshots.',
    first_mes: 'The midnight line leaves in twelve minutes. Which district are we starting from?',
  },
};

const scenario = {
  ...core.createDefaultScenario('/Users/demo/Lumenport Worldbook.json'),
  seed: 'lumenport-demo',
  userName: 'Rowan',
  charName: 'Mira Vale',
  settings: {
    ...core.createDefaultScenario().settings,
    tokenizerProfile: 'estimate',
    recursive: true,
    worldInfoDepth: 4,
  },
  messages: [
    { role: 'user', content: 'Mira, can the skyrail take us from the archive to North Harbor?' },
    { role: 'assistant', content: 'Yes. We take the midnight line across the observatory bridge.' },
    { role: 'user', content: 'What should I know before we leave the archive?' },
  ],
};

const preview = core.compilePromptPreview({
  worldbooks: [{ name: 'Lumenport Worldbook', path: scenario.worldbookPath, data: worldbook }],
  characterCard,
  scenario,
});

const state = {
  type: 'state',
  mode: 'edit',
  worldbookPath: scenario.worldbookPath,
  worldbookText: `${JSON.stringify(worldbook, null, 2)}\n`,
  scenario,
  characterCard: {
    name: 'Mira Vale',
    description: characterCard.data.description,
    scenario: characterCard.data.scenario,
    format: 'json',
    hasCharacterBook: false,
    alternateGreetingCount: 0,
  },
};

const previewMessage = {
  type: 'preview',
  result: preview,
  worldbookText: state.worldbookText,
};

await mkdir(screenshotRoot, { recursive: true });

const extensionSource = await readFile(path.join(extensionRoot, 'extension.js'), 'utf8');
const templateMatch = extensionSource.match(/return `(?<html><!doctype html>[\s\S]*?<\/html>)`;/);
if (!templateMatch?.groups?.html) throw new Error('Could not extract the webview HTML template.');

const bridge = `<script>
  const demoState = ${safeJson(state)};
  const demoPreview = ${safeJson(previewMessage)};
  window.acquireVsCodeApi = () => ({
    postMessage(message) {
      if (message.type === 'ready') {
        setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: demoState })), 0);
        setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: demoPreview })), 40);
      }
      if (message.type === 'compilePreview') {
        setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: demoPreview })), 0);
      }
    },
  });
  window.confirm = () => true;
</script>`;

const theme = `<style>
  :root {
    --vscode-editor-background: #1f2023;
    --vscode-sideBar-background: #18191c;
    --vscode-editorWidget-background: #292b30;
    --vscode-editor-foreground: #e5e7eb;
    --vscode-descriptionForeground: #a4a9b2;
    --vscode-panel-border: #3d4149;
    --vscode-button-background: #2f6fce;
    --vscode-button-foreground: #ffffff;
    --vscode-errorForeground: #ef8b80;
    --vscode-list-activeSelectionBackground: #254e7b;
    --vscode-list-activeSelectionForeground: #ffffff;
    --vscode-list-hoverBackground: #30333a;
    --vscode-input-background: #24262b;
    --vscode-input-foreground: #e5e7eb;
    --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --vscode-editor-font-family: "SFMono-Regular", Consolas, monospace;
    --vscode-font-size: 13px;
  }
</style>`;

const html = templateMatch.groups.html
  .replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]+>/, '')
  .replace('${styleUri}', '/style.css')
  .replace('${scenarioFieldsUri}', '/scenario-fields.js')
  .replace('${worldbookEditorUri}', '/worldbook-editor.js')
  .replace('${scriptUri}', '/main.js')
  .replaceAll(' nonce="${nonce}"', '')
  .replace('</head>', `${theme}</head>`)
  .replace('<script src="/scenario-fields.js">', `${bridge}<script src="/scenario-fields.js">`);

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') return send(response, html, 'text/html; charset=utf-8');
    const files = {
      '/style.css': ['style.css', 'text/css; charset=utf-8'],
      '/scenario-fields.js': ['scenario-fields.js', 'text/javascript; charset=utf-8'],
      '/worldbook-editor.js': ['worldbook-editor.js', 'text/javascript; charset=utf-8'],
      '/main.js': ['main.js', 'text/javascript; charset=utf-8'],
    };
    const file = files[request.url];
    if (!file) return send(response, 'Not found', 'text/plain; charset=utf-8', 404);
    return send(response, await readFile(path.join(uiRoot, file[0])), file[1]);
  } catch (error) {
    return send(response, error.stack || error.message, 'text/plain; charset=utf-8', 500);
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    || process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    || undefined,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Preview ready');
  await page.screenshot({
    path: path.join(screenshotRoot, 'workbench-overview.png'),
    fullPage: false,
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.timeline-item').nth(0).evaluate(element => {
    element.open = true;
  });
  await page.locator('.preview-pane').screenshot({
    path: path.join(screenshotRoot, 'prompt-preview.png'),
  });
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(`Captured marketplace screenshots in ${path.relative(extensionRoot, screenshotRoot)}/`);

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function send(response, body, contentType, statusCode = 200) {
  response.writeHead(statusCode, { 'Content-Type': contentType });
  response.end(body);
}
