import type { MediaInfo } from './probe'

/**
 * Rough time to re-encode, in seconds. Measured: a 720p clip encodes at ~1.8x real time in
 * single-threaded ffmpeg.wasm (x264 veryfast), scaling with pixel count. Deliberately approximate.
 */
export function estimateSeconds(info: MediaInfo | null): number | null {
  const v = info?.video[0]
  if (!info?.durationSec || !v?.width || !v.height) return null
  const pixelRatio = (v.width * v.height) / (1280 * 720)
  return info.durationSec * pixelRatio * 0.6
}

export function formatEstimate(sec: number): string {
  if (sec < 10) return 'a few seconds'
  if (sec < 90) return `about ${Math.round(sec / 5) * 5} seconds`
  if (sec < 3600) return `about ${Math.round(sec / 60)} minutes`
  return `about ${(sec / 3600).toFixed(1)} hours`
}
