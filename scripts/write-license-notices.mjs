import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Libraries whose runtime or template code is included in the generated website.
const packages = ['astro', '@astrojs/react', 'react', 'react-dom', 'scheduler', 'three'];
const notices = await Promise.all(packages.map(async name => {
  const directory = resolve(root, 'node_modules', name);
  const info = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  const license = await readFile(resolve(directory, 'LICENSE'), 'utf8');
  return `${name} ${info.version}\n${'='.repeat(64)}\n${license.trim()}`;
}));
const output = resolve(root, 'public/licenses/runtime-libraries.txt');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `Third-party runtime notices\nGenerated from installed package license files.\n\n${notices.join('\n\n')}\n`, 'utf8');
console.log('Updated runtime library notices.');
