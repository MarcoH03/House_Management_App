// Prepara la carpeta www/ con la app web para empaquetarla en Android (Capacitor).
// Copia los archivos de la app y genera js/build-info.js con el número de versión.
//
// Uso: BUILD_NUMBER=12 node tools/build-web.mjs
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'rates.json']) {
  if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f), { recursive: true });
}
const build = Number(process.env.BUILD_NUMBER || 1);
const appVersion = (readFileSync(join(root, 'js/views/settings.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1] || '';
writeFileSync(join(out, 'js/build-info.js'),
  `// Generado por tools/build-web.mjs\nexport const BUILD = ${JSON.stringify({ native: true, build, version: appVersion })};\n`);
console.log(`www/ listo (versión ${appVersion}, compilación ${build})`);
