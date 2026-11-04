# FFmpeg Buttons — build brief for Claude Code

## Goal
Build a browser app that puts FFmpeg's most useful features behind big, friendly buttons.
A user drops in a media file, clicks a button (e.g. "Extract audio"), fills in at most one or two
options, and downloads the result. No install, no command line, and files never leave the user's
computer — FFmpeg runs inside the page via **ffmpeg.wasm**.

The target user has never used a terminal. Every screen should make sense without reading docs.

## Tech stack
- **Vite + React + TypeScript**
- **@ffmpeg/ffmpeg** and **@ffmpeg/util** (ffmpeg.wasm, v0.12-style API: `new FFmpeg()`, `load()`,
  `writeFile()`, `exec()`, `readFile()`, `on('progress')`, `on('log')`).
  Check npm for the current versions and read the package README before writing code — don't rely
  on remembered API details.
- Use the **single-threaded core** (`@ffmpeg/core`) for the MVP. The multi-threaded core needs
  SharedArrayBuffer, which requires COOP/COEP headers; that's a later optimisation (see Phase 3).
- Plain CSS (CSS variables for theming) — no UI framework needed.
- **Vitest** for unit tests.

## Architecture
The central idea: **every button is data**. A feature is a definition object; the UI is generated
from the list. Adding a button must never require touching UI code.

```ts
// src/features/types.ts
export type OptionDef =
  | { kind: 'time';   key: string; label: string; default: string }            // "00:01:23"
  | { kind: 'select'; key: string; label: string; choices: {label: string; value: string}[]; default: string }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number; default: number; hint?: [string, string] }
  | { kind: 'number'; key: string; label: string; default: number };

export interface Feature {
  id: string;                 // 'extract-audio'
  label: string;              // 'Extract audio'
  group: 'Convert' | 'Audio' | 'Edit' | 'Size & quality' | 'Images' | 'Info';
  icon: string;               // emoji or icon name
  description: string;        // one plain-English sentence shown on hover / in the panel
  accepts: 'video' | 'audio' | 'media' | 'images';
  multiFile?: boolean;        // e.g. Merge
  options: OptionDef[];
  outputName: (inputName: string) => string;              // 'holiday.mp4' -> 'holiday.mp3'
  buildArgs: (input: string, output: string, opts: Record<string, string | number>) => string[];
}
```

Suggested layout:
```
src/
  features/        types.ts, registry.ts (array of all features), one file per group
  ffmpeg/          engine.ts  — single FFmpeg instance: load once, run(args), progress, cancel
  components/      DropZone, ButtonGrid, OptionsPanel, ProgressBar, ResultCard, CommandPreview
  App.tsx
tests/             buildArgs tests for every feature
```

### Engine (`src/ffmpeg/engine.ts`)
- Lazy-load ffmpeg.wasm on first button click (show "Loading FFmpeg… (~30 MB, once)").
  Load core files via `toBlobURL` from a CDN, or bundle them in `public/` — pick one and document it.
- `run(feature, file, opts)`: write input to the virtual FS → `exec(args)` → `readFile(output)`
  → return a Blob → delete both files from the virtual FS afterwards (memory is tight).
- Forward `progress` events (0–1) to the UI; keep the last ~200 `log` lines for an error view.
- Cancel button → `ffmpeg.terminate()`, then re-create the instance on next use.
- Only one job at a time; disable the grid while running.

## UI flow
1. **Drop zone** — drag & drop or click to pick a file. Show name, size, and (after a quick probe)
   duration and resolution.
2. **Button grid** — grouped by `group`, large tiles with icon + label. Buttons that don't accept
   the current file type are greyed out with a tooltip explaining why.
3. **Options panel** — appears only if the feature has options; sensible defaults so the user can
   just press **Run**.
4. **Progress bar** with percentage and a **Cancel** button.
5. **Result card** — output name, size (and % smaller/larger than input), preview
   (`<video>`, `<audio>` or `<img>`), **Download** button, "Do something else with this file" button
   that feeds the output back in as the new input.
6. **"Show command" toggle** — displays the equivalent `ffmpeg …` command so users can learn it.
7. Friendly error messages ("This file seems damaged or isn't a video") with an expandable raw log.

Must work at phone width; must support light and dark mode.

## Features

### Phase 1 — MVP (build these first)
| id | Label | Options | Args (input `in`, output `out`) |
|---|---|---|---|
| to-mp4 | Convert to MP4 | — | `-i in -c:v libx264 -preset veryfast -crf 23 -c:a aac out.mp4` |
| to-gif | Make a GIF | fps (select 10/15/24, default 12), width (select 320/480/640, default 480), start + duration | `-ss S -t D -i in -vf "fps=F,scale=W:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif` |
| extract-audio | Extract audio (MP3) | — | `-i in -vn -c:a libmp3lame -q:a 2 out.mp3` |
| remove-audio | Remove audio | — | `-i in -an -c:v copy out.<same ext>` |
| trim | Trim | start, end (time) | `-ss START -to END -i in -c copy out` (note: cuts snap to keyframes — offer a "precise cut" checkbox that re-encodes instead) |
| compress | Compress | quality slider CRF 18–35, default 28, hint ["better quality", "smaller file"] | `-i in -c:v libx264 -preset veryfast -crf N -c:a aac -b:a 128k out.mp4` |
| resize | Resize | select 1080p/720p/480p/360p | `-i in -vf scale=-2:H -c:v libx264 -preset veryfast -crf 23 -c:a copy out.mp4` |
| rotate | Rotate / flip | select 90° right / 90° left / 180° / flip horizontal | `transpose=1` / `transpose=2` / `transpose=1,transpose=1` / `hflip` in `-vf` |
| screenshot | Take screenshot | time | `-ss T -i in -frames:v 1 out.png` |
| info | File info | — | see note below — no output file |

**File info note:** ffmpeg.wasm has no `ffprobe`. Run `-i in` with no output (it will exit with an
error code — that's expected), capture the log, and parse duration, resolution, codecs, bitrate and
frame rate into a readable table. Reuse this parser for the drop-zone summary.

### Phase 2
| id | Label | Notes |
|---|---|---|
| merge | Merge clips | multiFile. Write a `list.txt` for the concat demuxer and try `-c copy`; if inputs differ in codec/resolution, re-encode. Let users reorder files. |
| speed | Change speed | select 0.5×/1.5×/2×. Video `setpts=(1/X)*PTS`; audio `atempo` only accepts 0.5–2, so chain filters outside that range. |
| normalize | Normalize volume | `-af loudnorm` |
| to-webm | Convert to WebM | VP9 is *very* slow in wasm — warn the user, or use VP8 (`libvpx`) by default. |
| crop | Crop | Draw a rectangle on a preview frame (take a screenshot first), convert to `crop=w:h:x:y`. |
| watermark | Add watermark | second file input (PNG), corner select → `overlay` position. |
| thumbnails | Thumbnail sheet | every N seconds → multiple PNGs; zip them for download (use `fflate`). |
| images-to-video | Slideshow | multiFile images, seconds per image. |

### Phase 3 (optional)
- Multi-threaded core: add COOP/COEP headers to the Vite dev server and deployment config, feature-detect `crossOriginIsolated`, fall back to single-thread.
- Batch mode: apply one button to many files.
- Burn subtitles (`subtitles=` needs a font file in the virtual FS — test carefully).
- Remember last-used options per feature in localStorage (wrapped in try/catch).

## Known limitations to handle in the UI
- ffmpeg.wasm is 32-bit: files above roughly **1.5–2 GB** will fail. Warn above 1 GB; refuse above 2 GB with a clear message.
- Encoding is several times slower than native FFmpeg. Show an honest estimate and keep the
  progress bar moving.
- Progress events can be unreliable for some operations (e.g. `-c copy`); fall back to an
  indeterminate bar.
- Vite: add `@ffmpeg/ffmpeg` and `@ffmpeg/util` to `optimizeDeps.exclude` if the worker fails to load.

## Testing & definition of done
- Unit test `buildArgs` and `outputName` for every feature (Vitest).
- Unit test the log parser used by File info against a few captured real logs.
- Manually verify each Phase 1 button end-to-end with a short sample MP4 (generate one in a test
  script with ffmpeg.wasm's `testsrc` / `sine` sources, or a small checked-in file under 1 MB).
- `npm run build` succeeds with no type errors; `npm run dev` works in current Chrome and Firefox.
- A README with: what it is, how to run, how to add a new button (one example), limitations.

## Working order
1. Scaffold Vite + React + TS, install deps, verify ffmpeg.wasm loads and runs `-version`.
2. Engine + DropZone + one feature (Extract audio) end-to-end.
3. Feature registry and generated ButtonGrid/OptionsPanel.
4. Remaining Phase 1 features, with tests.
5. Result card, command preview, errors, theming, mobile layout.
6. README. Then stop and summarise for the user before starting Phase 2.

Commit after each step with a clear message.