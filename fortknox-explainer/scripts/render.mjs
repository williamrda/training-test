// Renders out/fortknox-explainer.mp4 (1920x1080, 30 fps, 15.000 s, H.264 + AAC 48 kHz).
//   node scripts/render.mjs                -> full video
//   node scripts/render.mjs --stills 20,80 -> PNG stills of the given frames (for checking)
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const withVoiceover = fs.existsSync(path.join(root, 'public/vo.wav'));
const withMusic = fs.existsSync(path.join(root, 'public/music.wav'));
if (!withMusic) console.warn('! public/music.wav missing - run `npm run music` first.');
if (!withVoiceover) console.warn('! public/vo.wav missing - rendering WITHOUT voiceover (run `npm run vo`).');

// Use a local Chromium if REMOTION_BROWSER is set (or the Playwright one exists); otherwise Remotion fetches its own.
const candidates = [process.env.REMOTION_BROWSER, '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'];
const browserExecutable = candidates.find((p) => p && fs.existsSync(p)) ?? null;

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')});
const inputProps = {withVoiceover, withMusic};
const composition = await selectComposition({serveUrl, id: 'FortKnoxExplainer', inputProps, browserExecutable});
fs.mkdirSync(path.join(root, 'out'), {recursive: true});

if (stillsArg) {
  for (const frame of stillsArg.split(',').map(Number)) {
    const output = path.join(root, `out/still-${String(frame).padStart(3, '0')}.png`);
    await renderStill({serveUrl, composition, frame, output, inputProps, browserExecutable});
    console.log('still', output);
  }
} else {
  const output = path.join(root, 'out/fortknox-explainer.mp4');
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    crf: 16,
    pixelFormat: 'yuv420p',
    colorSpace: 'bt709',
    audioCodec: 'aac',
    audioBitrate: '320k',
    outputLocation: output,
    inputProps,
    browserExecutable,
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 20);
      if (p !== last) {
        last = p;
        process.stdout.write(`\rrendering ${Math.round(progress * 100)}%`);
      }
    },
  });
  console.log(`\ndone -> ${output}`);
}
