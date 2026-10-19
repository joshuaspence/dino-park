// Records Ranger Rosie's lines with Piper text-to-speech into src/assets/voice, one MP3 per line ID.
//
// Usage: PIPER_MODEL=<path to voice .onnx> pnpm exec tsx scripts/generate-rosie.ts [--force]
//        pnpm exec tsx scripts/generate-rosie.ts --list    (prints every line, recording nothing)
//
// Needs `piper` (https://github.com/rhasspy/piper, e.g. `pip install piper-tts`) and `ffmpeg` on the PATH, and a
// Piper voice: the .onnx file with its .onnx.json beside it, from https://huggingface.co/rhasspy/piper-voices.
// Check the voice's own licence on its model card before committing what it records, and record it in CREDITS.md.
// The lines come from src/core/rosie.ts, so changing a line there and re-running this re-records it. Existing
// recordings are kept unless --force is given, so re-running only records lines that are new.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rosieLines } from '../src/core/rosie';

const OUT = 'src/assets/voice';
if (process.argv.includes('--list')) {
  for (const [id, text] of rosieLines()) {
    console.log(`${id}\t${text}`);
  }
  process.exit(0);
}
const model = process.env.PIPER_MODEL;
if (!model || !existsSync(model)) {
  throw new Error('Set PIPER_MODEL to the path of a Piper voice (.onnx, with its .onnx.json beside it)');
}
const force = process.argv.includes('--force');

mkdirSync(OUT, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'rosie-'));
try {
  for (const [id, text] of rosieLines()) {
    const file = join(OUT, `${id}.mp3`);
    if (existsSync(file) && !force) {
      continue;
    }
    const wav = join(scratch, `${id}.wav`);
    execFileSync('piper', ['--model', model, '--output_file', wav], { input: text });
    // Mono at 96 kbps is plenty for speech, and keeps every line together well under a megabyte.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '96k', file]);
    console.log(`${file}: ${text}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
