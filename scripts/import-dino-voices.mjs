// Downloads each dinosaur's call from Freesound into public/audio/dinos, one MP3 per species.
//
// Usage: node scripts/import-dino-voices.mjs
//
// Every sound here is CC0 (checked on its own page) and recorded in CREDITS.md. They're Freesound's public HQ MP3
// previews rather than the originals, which need a Freesound account to download: every target browser decodes MP3,
// including the iPadOS Safari that can't decode Ogg, so no transcoding is needed. The game pitches each call up or
// down for the different moments it marks (src/audio/voices.ts). Downloads go through curl, which follows the
// system's network setup on some machines where Node's own fetch can't connect.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'public/audio/dinos';

// Species ID → Freesound sound, chosen for a short, friendly call and a distinct character per species.
const CALLS = {
  trex: { id: 233277, preview: 'https://cdn.freesound.org/previews/233/233277_4056007-hq.mp3' },
  stegosaurus: { id: 233279, preview: 'https://cdn.freesound.org/previews/233/233279_4056007-hq.mp3' },
  brontosaurus: { id: 527845, preview: 'https://cdn.freesound.org/previews/527/527845_11431915-hq.mp3' },
  triceratops: { id: 233183, preview: 'https://cdn.freesound.org/previews/233/233183_4056007-hq.mp3' },
  velociraptor: { id: 705839, preview: 'https://cdn.freesound.org/previews/705/705839_9159316-hq.mp3' },
};

mkdirSync(OUT, { recursive: true });
for (const [species, { id, preview }] of Object.entries(CALLS)) {
  const file = join(OUT, `${species}.mp3`);
  // `-q` ignores the user's .curlrc, so personal defaults can't clash with these options.
  execFileSync('curl', ['-q', '--fail', '--silent', '--show-error', '--location', '--output', file, preview]);
  console.log(`${file} ← freesound.org/s/${id}`);
}
