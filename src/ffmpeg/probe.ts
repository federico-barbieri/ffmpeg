export interface VideoStream { codec: string; width?: number; height?: number; fps?: number; bitrateKbps?: number }
export interface AudioStream { codec: string; sampleRate?: number; channels?: string; bitrateKbps?: number }

export interface MediaInfo {
  container: string
  durationSec?: number // undefined for images / live streams ("N/A")
  bitrateKbps?: number
  video: VideoStream[]
  audio: AudioStream[]
}

function parseDuration(s: string): number | undefined {
  const m = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(s)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined
}

/**
 * Parse the log printed by `ffmpeg -i file` (ffmpeg.wasm has no ffprobe).
 * Returns null if the log doesn't describe a readable input (damaged / unsupported file).
 */
export function parseInfo(log: string[]): MediaInfo | null {
  const text = log.join('\n')
  const input = /^Input #0, ([^,]+(?:,[^,]+)*?), from /m.exec(text)
  if (!input) return null
  const info: MediaInfo = { container: input[1].trim(), video: [], audio: [] }

  const dur = /^\s*Duration: ([^,\s]+)(?:, start: [^,]+)?(?:, bitrate: (\d+) kb\/s)?/m.exec(text)
  if (dur) {
    info.durationSec = parseDuration(dur[1])
    if (dur[2]) info.bitrateKbps = Number(dur[2])
  }

  for (const line of text.split('\n')) {
    const s = /^\s*Stream #\d+:\d+[^:]*: (Video|Audio): (.*)$/.exec(line)
    if (!s) continue
    const [, kind, rest] = s
    const codec = /^([^\s,(]+)/.exec(rest)?.[1] ?? 'unknown'
    const kbps = /(\d+) kb\/s/.exec(rest)?.[1]
    if (kind === 'Video') {
      const res = /,\s*(\d{2,5})x(\d{2,5})(?=[\s,[]|$)/.exec(rest)
      const fps = /([\d.]+) fps/.exec(rest)?.[1] ?? /([\d.]+) tbr/.exec(rest)?.[1]
      info.video.push({
        codec,
        width: res ? Number(res[1]) : undefined,
        height: res ? Number(res[2]) : undefined,
        fps: fps ? Number(fps) : undefined,
        bitrateKbps: kbps ? Number(kbps) : undefined,
      })
    } else {
      const hz = /(\d+) Hz, ([^,]+)/.exec(rest)
      info.audio.push({
        codec,
        sampleRate: hz ? Number(hz[1]) : undefined,
        channels: hz?.[2].trim(),
        bitrateKbps: kbps ? Number(kbps) : undefined,
      })
    }
  }
  return info
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`
}

/** One-line summary for the drop zone, e.g. "0:03 · 1280×720". */
export function summarize(info: MediaInfo): string {
  const parts: string[] = []
  if (info.durationSec !== undefined) parts.push(formatDuration(info.durationSec))
  const v = info.video[0]
  if (v?.width && v.height) parts.push(`${v.width}×${v.height}`)
  return parts.join(' · ')
}

/** Rows for the "File info" table. */
export function toRows(info: MediaInfo): [string, string][] {
  const rows: [string, string][] = [['Format', info.container]]
  if (info.durationSec !== undefined) rows.push(['Duration', formatDuration(info.durationSec)])
  if (info.bitrateKbps) rows.push(['Overall bitrate', `${info.bitrateKbps} kb/s`])
  info.video.forEach((v, i) => {
    const n = info.video.length > 1 ? ` ${i + 1}` : ''
    if (v.width && v.height) rows.push([`Video${n} size`, `${v.width}×${v.height}`])
    rows.push([`Video${n} codec`, v.codec])
    if (v.fps) rows.push([`Video${n} frame rate`, `${v.fps} fps`])
    if (v.bitrateKbps) rows.push([`Video${n} bitrate`, `${v.bitrateKbps} kb/s`])
  })
  info.audio.forEach((a, i) => {
    const n = info.audio.length > 1 ? ` ${i + 1}` : ''
    rows.push([`Audio${n} codec`, a.codec])
    if (a.sampleRate) rows.push([`Audio${n} sample rate`, `${a.sampleRate} Hz`])
    if (a.channels) rows.push([`Audio${n} channels`, a.channels])
    if (a.bitrateKbps) rows.push([`Audio${n} bitrate`, `${a.bitrateKbps} kb/s`])
  })
  return rows
}
