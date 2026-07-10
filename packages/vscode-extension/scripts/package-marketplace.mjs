import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const targets = {
  openvsx: {
    publisher: 'meowmico',
    suffix: '',
  },
  microsoft: {
    publisher: 'MeowMico',
    suffix: '-microsoft',
  },
};

const targetName = process.argv[2];
const target = targets[targetName];
if (!target) {
  throw new Error(`Expected one of: ${Object.keys(targets).join(', ')}`);
}

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(extensionRoot, 'package.json');
const originalManifestText = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(originalManifestText);
const outputName = `${manifest.name}-${manifest.version}${target.suffix}.vsix`;
let restored = false;

function restoreManifest() {
  if (restored) return;
  writeFileSync(manifestPath, originalManifestText, 'utf8');
  restored = true;
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    restoreManifest();
    process.exit(exitCode);
  });
}

try {
  await writeFile(manifestPath, `${JSON.stringify({
    ...manifest,
    publisher: target.publisher,
  }, null, 2)}\n`, 'utf8');

  await run(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['@vscode/vsce', 'package', '--out', outputName],
    extensionRoot,
  );
} finally {
  restoreManifest();
}

console.log(`Created ${outputName} for publisher ${target.publisher}.`);

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal || code}.`));
    });
  });
}
