import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = path.resolve(extensionRoot, '..');
const distRoot = path.join(extensionRoot, 'dist');

const files = [
  ['core/index.js', 'core/index.js'],
  ['webview-ui/main.js', 'webview/main.js'],
  ['webview-ui/i18n.js', 'webview/i18n.js'],
  ['webview-ui/scenario-fields.js', 'webview/scenario-fields.js'],
  ['webview-ui/worldbook-editor.js', 'webview/worldbook-editor.js'],
  ['webview-ui/style.css', 'webview/style.css'],
];

await rm(distRoot, { recursive: true, force: true });

for (const [source, destination] of files) {
  const target = path.join(distRoot, destination);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(packagesRoot, source), target);
}

console.log(`Prepared VSCode runtime files in ${path.relative(extensionRoot, distRoot)}/`);
