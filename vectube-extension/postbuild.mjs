// ============================================================================
// Post-build script: copies manifest.json, icons, and content.css into dist/
// ============================================================================

import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');

console.log('[VecTube] Running post-build steps...');

// 1. Copy manifest.json
cpSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));
console.log('  ✓ manifest.json');

// 2. Copy icons
const iconsDir = resolve(distDir, 'icons');
if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
cpSync(resolve(__dirname, 'icons'), iconsDir, { recursive: true });
console.log('  ✓ icons/');

// 3. Copy content.css
const contentCssSrc = resolve(__dirname, 'src/content/content.css');
if (existsSync(contentCssSrc)) {
  cpSync(contentCssSrc, resolve(distDir, 'content.css'));
  console.log('  ✓ content.css');
}

console.log('[VecTube] Post-build complete. Load dist/ as unpacked extension in chrome://extensions');
