const GB = 1024 ** 3

/** ffmpeg.wasm is 32-bit: very large files fail. Warn above 1 GB, refuse above 2 GB. */
export type SizeCheck = { level: 'ok' } | { level: 'warn' | 'refuse'; message: string }

export function checkSize(bytes: number): SizeCheck {
  if (bytes > 2 * GB)
    return { level: 'refuse', message: 'This file is over 2 GB, which is more than FFmpeg in the browser can handle. Please choose a smaller file.' }
  if (bytes > GB)
    return { level: 'warn', message: 'This file is over 1 GB. It may be slow or fail in the browser. A smaller file works best.' }
  return { level: 'ok' }
}
