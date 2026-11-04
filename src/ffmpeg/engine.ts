import { FFFSType, FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
// The core is bundled from node_modules (no CDN): Vite serves/emits these as same-origin assets.
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import type { Feature, OptionValues } from '../features/types'
import { extOf } from '../features/util'

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

/**
 * Run a feature on one file: write input → exec → read output → clean up.
 * Only one job at a time.
 */
export async function run(
  feature: Feature,
  file: File,
  opts: OptionValues,
  onProgress?: (p: number) => void,
  onLoading?: () => void,
): Promise<RunResult> {
  if (busy) throw new Error('Another job is already running')
  busy = true
  cancelled = false
  logLines = []
  progressCb = onProgress ?? null
  const outputName = feature.outputName(file.name)
  // Virtual file names are plain ASCII so odd user file names can't break the arguments.
  const inExt = extOf(file.name)
  const input = inExt ? `input.${inExt}` : 'input'
  const output = `output.${extOf(outputName) || 'bin'}`
  const args = feature.buildArgs(input, output, opts)
  let ff: FFmpeg | null = null
  try {
    if (!ffmpeg?.loaded) onLoading?.()
    ff = await getFFmpeg()
    await ff.writeFile(input, await fetchFile(file))
    const code = await ff.exec(args)
    if (cancelled) throw new CancelledError()
    if (feature.noOutput) return { blob: null, log: getLog(), outputName, args } // non-zero exit is expected
    if (code !== 0) throw new EngineError(`ffmpeg exited with code ${code}`, getLog())
    const data = await ff.readFile(output)
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    // Copy into a fresh buffer: the original may be backed by memory ffmpeg is about to reuse.
    const blob = new Blob([new Uint8Array(bytes)], { type: MIME[extOf(output)] ?? 'application/octet-stream' })
    return { blob, log: getLog(), outputName, args }
  } catch (e) {
    if (cancelled) throw new CancelledError()
    if (e instanceof EngineError) throw e
    throw new EngineError(e instanceof Error ? e.message : String(e), getLog())
  } finally {
    // Free the virtual FS (memory is tight). Skip if the instance was terminated.
    if (ff && !cancelled) {
      await ff.deleteFile(input).catch(() => {})
      if (!feature.noOutput) await ff.deleteFile(output).catch(() => {})
    }
    progressCb = null
    busy = false
  }
}

/**
 * Quick look at a file (`ffmpeg -i`) and return the log. The file is mounted read-only
 * (WORKERFS) instead of copied, so even a huge file costs no memory. Counts as a job.
 */
export async function probe(file: File, onLoading?: () => void): Promise<string[]> {
  if (busy) throw new Error('Another job is already running')
  busy = true
  cancelled = false
  logLines = []
  progressCb = null
  let ff: FFmpeg | null = null
  const dir = '/probe'
  try {
    if (!ffmpeg?.loaded) onLoading?.()
    ff = await getFFmpeg()
    await ff.createDir(dir)
    await ff.mount(FFFSType.WORKERFS, { files: [file] }, dir)
    await ff.exec(['-i', `${dir}/${file.name}`]) // exits non-zero: no output file, expected
    return getLog()
  } catch (e) {
    if (cancelled) throw new CancelledError()
    throw new EngineError(e instanceof Error ? e.message : String(e), getLog())
  } finally {
    if (ff && !cancelled) {
      await ff.unmount(dir).catch(() => {})
      await ff.deleteDir(dir).catch(() => {})
    }
    busy = false
  }
}
