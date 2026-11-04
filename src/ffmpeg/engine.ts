import { FFmpeg } from '@ffmpeg/ffmpeg'
// The core is bundled from node_modules (no CDN): Vite serves/emits these as same-origin assets.
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

let ffmpeg: FFmpeg | null = null

/** Load ffmpeg.wasm once (lazily); re-creates the instance after terminate(). */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg
  ffmpeg = new FFmpeg()
  await ffmpeg.load({ coreURL, wasmURL })
  return ffmpeg
}

/** Smoke test: run `-version` and return the log text. */
export async function version(): Promise<string> {
  const ff = await getFFmpeg()
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => lines.push(message)
  ff.on('log', onLog)
  await ff.exec(['-version'])
  ff.off('log', onLog)
  return lines.join('\n')
}
