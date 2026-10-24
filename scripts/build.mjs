import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output = join(root, 'dist');
// Syntax-check authored modules before replacing the working deployment.
async function check(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name); if (item.isDirectory()) await check(path);
    else if (/\.(m?js)$/.test(item.name)) { const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' }); if (result.status) throw new Error(result.stderr); }
  }
}
await check(join(root, 'src'));
await check(join(root, 'public/planet'));
await import('./adapt-room.mjs');
await mkdir(output, { recursive: true });
await cp(join(root, 'public'), output, { recursive: true });
await cp(join(root, 'src'), join(output, 'src'), { recursive: true });
await cp(join(root, 'app.html'), join(output, 'index.html'));
await cp(join(root, 'styles.css'), join(output, 'styles.css'));
await cp(join(root, 'LICENSE'), join(output, 'LICENSE'));
await cp(join(root, 'THIRD_PARTY.md'), join(output, 'THIRD_PARTY.md'));
const room = await readFile(join(output, 'room/index.html'), 'utf8');
const module = room.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (!module) throw new Error('Room module missing');
const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: module, encoding: 'utf8' }); if (result.status) throw new Error(result.stderr);
await writeFile(join(output, 'build.json'), JSON.stringify({ version: '0.5.0', builtAt: new Date().toISOString(), entry: 'miniature-music-planet', rooms: 3 }));
console.log('Built local memory world: dist/ (all dependencies included).');
