import { FFFSType, FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { zipSync } from 'fflate'
// The core is bundled from node_modules (no CDN): Vite serves/emits these as same-origin assets.
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import type { BuildContext, Feature, OptionValues } from '../features/types'
import { UserError, extOf } from '../features/util'
import { parseInfo, type MediaInfo } from './probe'

const MAX_LOG_LINES = 200

export class CancelledError extends Error {
  constructor() {
    super('Cancelled')
  }
}

export class EngineError extends Error {
  log: string[]
  constructor(message: string, log: string[]) {
    super(message)
    this.log = log
  }
}

export interface RunResult {
  blob: Blob | null // null for features without an output file (File info)
  count?: number // number of files inside a zip output
  log: string[]
  outputName: string
  args: string[] // args using the virtual file names
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', zip: 'application/zip',
}

let ffmpeg: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null
let busy = false
let cancelled = false
let logLines: string[] = []
let progressCb: ((p: number) => void) | null = null

/** Load ffmpeg.wasm once (lazily); a new instance is created after cancel(). */
export function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return Promise.resolve(ffmpeg)
  if (loading) return loading
  const ff = new FFmpeg()
  ff.on('log', ({ message }) => {
    logLines.push(message)
    if (logLines.length > MAX_LOG_LINES) logLines.shift()
  })
  ff.on('progress', ({ progress }) => {
    // ffmpeg.wasm can report nonsense (negative, >1) for some operations: ignore those.
    if (progressCb && progress >= 0 && progress <= 1) progressCb(progress)
  })
  loading = ff
    .load({ coreURL, wasmURL })
    .then(() => (ffmpeg = ff))
    .finally(() => (loading = null))
  return loading
}

export function isBusy(): boolean {
  return busy
}

/** Last ~200 log lines of the most recent job. */
export function getLog(): string[] {
  return [...logLines]
}

/** Abort the running job. The instance is re-created on next use. */
export function cancel(): void {
  if (!busy) return
  cancelled = true
  ffmpeg?.terminate()
  ffmpeg = null
}

export interface RunCallbacks {
  onProgress?: (p: number) => void
  onLoading?: () => void // ffmpeg.wasm is about to be downloaded/initialised (first use)
  onLoaded?: () => void // ffmpeg is ready and the job starts
}

export interface RunInput {
  files: File[] // the main file, plus more for multiFile features (in order)
  extra?: File // separate extra input (e.g. watermark image)
}

/** `ffmpeg -i file` through a read-only WORKERFS mount (no copy into memory). Returns the log. */
async function probeWith(ff: FFmpeg, file: File): Promise<string[]> {
  const dir = '/probe'
  logLines = []
  try {
    await ff.createDir(dir)
    await ff.mount(FFFSType.WORKERFS, { files: [file] }, dir)
    await ff.exec(['-i', `${dir}/${file.name}`]) // exits non-zero: no output file, expected
    return getLog()
  } finally {
    if (!cancelled) {
      await ff.unmount(dir).catch(() => {})
      await ff.deleteDir(dir).catch(() => {})
    }
  }
}

/**
 * Run a feature: write inputs → (probe them) → exec → read output → clean up.
 * Only one job at a time.
 */
export async function run(feature: Feature, input: RunInput, opts: OptionValues, cb: RunCallbacks = {}): Promise<RunResult> {
  const { onProgress, onLoading, onLoaded } = cb
  const { files, extra } = input
  if (busy) throw new Error('Another job is already running')
  busy = true
  cancelled = false
  logLines = []
  progressCb = onProgress ?? null
  const outputName = feature.outputName(files[0].name)
  // Virtual file names are plain ASCII so odd user file names can't break the arguments.
  const inputs = files.map((f, i) => (extOf(f.name) ? `input${i}.${extOf(f.name)}` : `input${i}`))
  const extraName = extra ? `extra.${extOf(extra.name) || 'png'}` : undefined
  const zipPrefix = 'out_'
  const output = feature.zipOutput ? `${zipPrefix}%03d.${feature.zipOutput.ext}` : `output.${extOf(outputName) || 'bin'}`
  const written: string[] = []
  let ff: FFmpeg | null = null
  try {
    if (!ffmpeg?.loaded) onLoading?.()
    ff = await getFFmpeg()
    onLoaded?.()
    for (const [i, f] of files.entries()) {
      await ff.writeFile(inputs[i], await fetchFile(f))
      written.push(inputs[i])
    }
    if (extra && extraName) {
      await ff.writeFile(extraName, await fetchFile(extra))
      written.push(extraName)
    }
    let infos: (MediaInfo | null)[] | undefined
    if (feature.needsInfo) {
      infos = []
      for (const f of files) infos.push(parseInfo(await probeWith(ff, f)))
      if (cancelled) throw new CancelledError()
      logLines = []
    }
    const ctx: BuildContext = { inputs, extra: extraName, infos }
    const args = feature.buildArgs(inputs[0], output, opts, ctx)
    for (const side of feature.sideFiles?.(opts, ctx) ?? []) {
      await ff.writeFile(side.name, side.text)
      written.push(side.name)
    }
    const code = await ff.exec(args)
    if (cancelled) throw new CancelledError()
    if (feature.noOutput) return { blob: null, log: getLog(), outputName, args } // non-zero exit is expected
    if (code !== 0) throw new EngineError(`ffmpeg exited with code ${code}`, getLog())

    if (feature.zipOutput) {
      const ext = `.${feature.zipOutput.ext}`
      const listed = (await ff.listDir('/')).filter((n) => !n.isDir && n.name.startsWith(zipPrefix) && n.name.endsWith(ext))
      const names = listed.map((n) => n.name).sort()
      if (names.length === 0) throw new EngineError('Output file is empty', getLog())
      const entries: Record<string, Uint8Array> = {}
      for (const [i, n] of names.entries()) {
        const d = await ff.readFile(n)
        entries[`${String(i + 1).padStart(3, '0')}${ext}`] = typeof d === 'string' ? new TextEncoder().encode(d) : d
        written.push(n)
      }
      const zip = zipSync(entries, { level: 0 }) // PNGs are already compressed
      return { blob: new Blob([new Uint8Array(zip)], { type: MIME.zip }), log: getLog(), outputName, args, count: names.length }
    }

    const data = await ff.readFile(output)
    if (data.length === 0) throw new EngineError('Output file is empty', getLog())
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    // Copy into a fresh buffer: the original may be backed by memory ffmpeg is about to reuse.
    const blob = new Blob([new Uint8Array(bytes)], { type: MIME[extOf(output)] ?? 'application/octet-stream' })
    if (!feature.noOutput) written.push(output)
    return { blob, log: getLog(), outputName, args }
  } catch (e) {
    if (cancelled) throw new CancelledError()
    if (e instanceof EngineError || e instanceof UserError) throw e
    // ffmpeg crashed or aborted (e.g. out of memory): its state is unreliable, so start fresh next time.
    ffmpeg?.terminate()
    ffmpeg = null
    ff = null
    throw new EngineError(e instanceof Error ? e.message : String(e), getLog())
  } finally {
    // Free the virtual FS (memory is tight). Skip if the instance was terminated.
    if (ff && !cancelled) {
      for (const n of written) await ff.deleteFile(n).catch(() => {})
      if (!feature.noOutput && !feature.zipOutput) await ff.deleteFile(output).catch(() => {})
    }
    progressCb = null
    busy = false
  }
}

/**
 * Quick look at a file (`ffmpeg -i`) and return the log. The file is mounted read-only
 * (WORKERFS) instead of copied, so even a huge file costs no memory. Counts as a job.
 */
export async function probe(file: File, cb: Pick<RunCallbacks, 'onLoading' | 'onLoaded'> = {}): Promise<string[]> {
  const { onLoading, onLoaded } = cb
  if (busy) throw new Error('Another job is already running')
  busy = true
  cancelled = false
  logLines = []
  progressCb = null
  let ff: FFmpeg | null = null
  try {
    if (!ffmpeg?.loaded) onLoading?.()
    ff = await getFFmpeg()
    onLoaded?.()
    return await probeWith(ff, file)
  } catch (e) {
    if (cancelled) throw new CancelledError()
    throw new EngineError(e instanceof Error ? e.message : String(e), getLog())
  } finally {
    busy = false
  }
}
