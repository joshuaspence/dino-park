// Fails when the built site exceeds the budgets in docs/design.md §10.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const JS_CSS_GZIP_LIMIT = 2 * 1024 * 1024;
const TOTAL_LIMIT = 15 * 1024 * 1024;

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* files(path);
    } else {
      yield path;
    }
  }
}

let codeGzip = 0;
let total = 0;
for (const path of files(DIST)) {
  const bytes = readFileSync(path);
  total += bytes.length;
  // The service worker isn't on the path to "play", so it doesn't count towards the JS budget.
  if (/\.(js|css)$/.test(path) && !/(^|\/)(sw|workbox-[^/]+)\.js$/.test(relative(DIST, path))) {
    codeGzip += gzipSync(bytes).length;
  }
}

const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;
console.log(`JS+CSS (gzip): ${kib(codeGzip)} of ${kib(JS_CSS_GZIP_LIMIT)}`);
console.log(`Total download: ${kib(total)} of ${kib(TOTAL_LIMIT)}`);
if (codeGzip > JS_CSS_GZIP_LIMIT || total > TOTAL_LIMIT) {
  console.error('Over budget.');
  process.exit(1);
}
