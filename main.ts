// main.ts — EMBERFALL entry program for make.fun best-game-01.
// Copies game/ and screenshots/ next to this file into the output directory
// (MAKEFUN_OUTPUT_DIR outside the grader, /output inside it) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22 standard library only; runs twice and writes identical bytes.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(here, name);
  const dst = join(out, name);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
