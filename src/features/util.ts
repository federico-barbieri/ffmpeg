/** 'holiday.final.mp4' -> 'holiday.final' */
export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** 'holiday.mp4' -> 'mp4' (lowercase, '' if none) */
export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** An error whose message is already written for the user: shown as is. */
export class UserError extends Error {}

/** Codec flags for re-encoding into the container implied by the output file name. */
export function reencodeFlags(output: string): string[] {
  const ext = extOf(output)
  if (['mp4', 'mov', 'mkv', 'm4v'].includes(ext)) return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac']
  if (ext === 'webm') return ['-c:v', 'libvpx', '-c:a', 'libvorbis'] // VP8: VP9 is far too slow in wasm
  return [] // audio containers etc.: ffmpeg's default encoder for the format
}
