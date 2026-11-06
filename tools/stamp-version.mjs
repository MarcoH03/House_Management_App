// Pone en sw.js una versión calculada a partir del contenido de la app.
// Cualquier cambio en un archivo cambia sw.js, y eso hace que el iPhone
// descargue e instale la versión nueva (aunque Pages publique la rama tal cual).
//
// Uso: node tools/stamp-version.mjs          (actualiza sw.js)
//      node tools/stamp-version.mjs --check  (falla si sw.js no está al día)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const list = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!list) throw new Error('No se encontró la lista ASSETS en sw.js');
const files = [...list[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1] || 'index.html');

const hash = createHash('sha256');
for (const f of [...new Set(files)].sort()) {
  hash.update(f);
  hash.update(readFileSync(join(root, f)));
}
const version = `hogar-${hash.digest('hex').slice(0, 10)}`;
const next = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);

if (process.argv.includes('--check')) {
  if (next !== sw) { console.error(`sw.js desactualizado: debería ser ${version}`); process.exit(1); }
  console.log(`sw.js al día (${version})`);
} else if (next !== sw) {
  writeFileSync(swPath, next);
  console.log(`Versión actualizada: ${version}`);
} else {
  console.log(`Sin cambios (${version})`);
}
