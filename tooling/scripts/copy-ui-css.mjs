import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = join(root, 'packages/ui/src/globals.css');
const dest = join(root, 'packages/ui/dist/globals.css');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
