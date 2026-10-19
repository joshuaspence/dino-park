// Downloads the game's recorded sounds into public/audio: each dinosaur's call, and the background music.
//
// Usage: node scripts/import-sounds.mjs
//
// Every sound here is CC0 (checked on its own page) and recorded in CREDITS.md. All are MP3, which every target
// browser decodes, including the iPadOS Safari that can't decode Ogg, so nothing needs transcoding. The calls are
// Freesound's public HQ MP3 previews, since the originals need a Freesound account to download; the game pitches each
// call up or down for the different moments it marks (src/audio/voices.ts). Downloads go through curl, which follows
// the system's network setup on some machines where Node's own fetch can't connect.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Output file → source. Calls are chosen for a short, friendly sound and a distinct character per species.
const SOUNDS = {
  'public/audio/dinos/trex.mp3': 'https://cdn.freesound.org/previews/233/233277_4056007-hq.mp3',
  'public/audio/dinos/stegosaurus.mp3': 'https://cdn.freesound.org/previews/233/233279_4056007-hq.mp3',
  'public/audio/dinos/brontosaurus.mp3': 'https://cdn.freesound.org/previews/527/527845_11431915-hq.mp3',
  'public/audio/dinos/triceratops.mp3': 'https://cdn.freesound.org/previews/233/233183_4056007-hq.mp3',
  'public/audio/dinos/velociraptor.mp3': 'https://cdn.freesound.org/previews/705/705839_9159316-hq.mp3',
  // "Once Upon a Time (loop)" by TAD, from https://opengameart.org/content/once-upon-a-time-loop.
  'public/audio/music/park.mp3': 'https://opengameart.org/sites/default/files/once_upon_a_time_loop_0.mp3',
};

for (const [file, source] of Object.entries(SOUNDS)) {
  mkdirSync(dirname(file), { recursive: true });
  // `-q` ignores the user's .curlrc, so personal defaults can't clash with these options.
  execFileSync('curl', ['-q', '--fail', '--silent', '--show-error', '--location', '--output', file, source]);
  console.log(`${file} ← ${source}`);
}
