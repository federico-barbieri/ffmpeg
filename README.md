# FFmpeg Buttons

A browser app that puts FFmpeg's most useful features behind big, friendly buttons. Drop in a video,
audio or image file, click a button (for example **Extract audio**), set at most one or two options and
download the result.

- No install and no command line.
- **Your files never leave your computer.** FFmpeg runs inside the page through
  [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm); nothing is uploaded anywhere.
- A **Show command** toggle displays the equivalent `ffmpeg …` command, so you can learn it.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173 (Chrome or Firefox)
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

The FFmpeg core (about 30 MB) is bundled from the `@ffmpeg/core` package and served from your own
origin, so there is no CDN call. It downloads once, the first time a file is chosen or a button is clicked.

## Buttons (Phase 1)

| Group | Buttons |
|---|---|
| Convert | Convert to MP4, Make a GIF |
| Audio | Extract audio (MP3), Remove audio |
| Edit | Trim (fast or precise), Rotate / flip |
| Size & quality | Compress, Resize |
| Images | Take screenshot |
| Info | File info |

Buttons that do not fit the chosen file (for example video-only buttons on an MP3) are greyed out, with a
tooltip saying why.

## How it works

Every button is **data**. A feature is a plain object; the UI is generated from the list in
[src/features/registry.ts](src/features/registry.ts). Adding a button never requires touching UI code.

```
src/
  features/   types.ts (Feature, OptionDef), registry.ts, one file per group, options.ts, accepts.ts
  ffmpeg/     engine.ts (load once, run, progress, cancel, probe), probe.ts (parses `ffmpeg -i` logs),
              command.ts, errors.ts, estimate.ts
  components/ DropZone, ButtonGrid, OptionsPanel, ProgressBar, ResultCard, InfoCard, CommandPreview
  limits.ts   file size warnings / refusal
tests/        unit tests and small fixtures (sample.mp4, captured ffmpeg logs)
```

The engine runs one job at a time. For each job it writes the input into FFmpeg's in-memory file system,
runs FFmpeg, reads the output, and deletes both files again. It keeps the last 200 log lines for the error
view. Cancel terminates the FFmpeg worker, and a fresh one is created on next use.

ffmpeg.wasm has no `ffprobe`, so **File info** and the duration/size summary in the drop zone run
`ffmpeg -i file` with no output (it exits with an error, which is expected) and parse the log in
[src/ffmpeg/probe.ts](src/ffmpeg/probe.ts).

## Add a new button

Create the feature object and add it to a group file (or add a new file and list it in `registry.ts`).
For example, a **Make louder** button:

```ts
// src/features/audio.ts
export const louder: Feature = {
  id: 'louder',
  label: 'Make louder',
  group: 'Audio',
  icon: '🔊',
  description: 'Raise the volume of a video or audio file.',
  accepts: 'media',                       // 'video' | 'audio' | 'media' | 'images'
  options: [
    {
      kind: 'select', key: 'gain', label: 'How much louder?',
      choices: [
        { label: 'A little (+3 dB)', value: '3' },
        { label: 'A lot (+10 dB)', value: '10' },
      ],
      default: '3',
    },
  ],
  outputName: (name) => `${baseName(name)}-louder.${extOf(name) || 'mp4'}`,
  // `input` and `output` are virtual file names; `opts` holds the option values by key.
  buildArgs: (input, output, opts) => ['-i', input, '-af', `volume=${opts.gain}dB`, '-c:v', 'copy', output],
}

export const audioFeatures: Feature[] = [extractAudio, removeAudio, louder]   // add it to the list
```

That is all: the tile, the greying-out, the options panel, validation, progress, the result card and the
**Show command** preview all come from the definition. Option kinds are `time`, `select`, `slider` and
`number` (see [src/features/types.ts](src/features/types.ts)). Add the new feature to the tests in
`tests/features.test.ts` (the registry-wide tests already check that every feature builds arguments and an
output name from its defaults).

Set `reencodes: true` on a feature that re-encodes video so the app shows a time estimate for it, and
`noOutput: true` for a feature that only reads the file's log.

## Limitations

- **File size.** ffmpeg.wasm is 32-bit. The app warns above 1 GB and refuses above 2 GB; large files may
  still fail in some browsers.
- **Speed.** Encoding is several times slower than native FFmpeg: roughly 1.8× real time for 720p video on
  a recent laptop. The app shows an estimate and a progress bar, and a Cancel button.
- **Progress.** Some operations (such as stream copy) report no progress; the bar is then indeterminate.
- **Trim, fast mode** cuts at the nearest keyframe, so the start can be a moment early. Use "Precise".
- **Single-threaded core** for now. A multi-threaded core needs `SharedArrayBuffer`, which requires
  COOP/COEP headers (planned, see Phase 3 in `CLAUDE.md`).
- **Codecs.** The wasm build has x264, VP8/VP9, MP3, Opus and Vorbis, but not every format ever made.
- If the FFmpeg worker fails to load in dev, make sure `@ffmpeg/ffmpeg` and `@ffmpeg/util` stay in
  `optimizeDeps.exclude` in `vite.config.ts` (already set).

## Roadmap

Phase 2 (merge, speed, normalize, WebM, crop, watermark, thumbnail sheet, slideshow) and Phase 3
(multi-threading, batch mode, burned-in subtitles, remembered options) are described in `CLAUDE.md`.
