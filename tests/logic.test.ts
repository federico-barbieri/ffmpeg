import { describe, expect, it } from 'vitest'
import { commandString, shellQuote } from '../src/ffmpeg/command'
import { friendlyError } from '../src/ffmpeg/errors'
import { estimateSeconds, formatEstimate } from '../src/ffmpeg/estimate'
import { checkSize } from '../src/limits'
import { extractAudio } from '../src/features/audio'
import { toGif } from '../src/features/convert'
import { trim } from '../src/features/edit'
import { info } from '../src/features/info'
import { defaultValues } from '../src/features/options'
import { willReencode } from '../src/features/types'
import { features } from '../src/features/registry'

describe('commandString', () => {
  it('uses the real file names', () => {
    expect(commandString(extractAudio, 'holiday.mp4', {})).toBe(
      'ffmpeg -i holiday.mp4 -vn -c:a libmp3lame -q:a 2 holiday.mp3')
  })
  it('quotes names with spaces and filter graphs', () => {
    const cmd = commandString(toGif, 'my clip.mp4', defaultValues(toGif.options))
    expect(cmd).toContain("'my clip.mp4'")
    expect(cmd).toContain("'fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse'")
  })
  it('escapes single quotes', () => {
    expect(shellQuote("it's.mp4")).toBe(`'it'\\''s.mp4'`)
  })
  it('works for info (no output file)', () => {
    expect(commandString(info, 'a.mp4', {})).toBe('ffmpeg -i a.mp4')
  })
})

describe('friendlyError', () => {
  it('damaged files', () => {
    expect(friendlyError('x', ['moov atom not found'])).toMatch(/damaged/)
    expect(friendlyError('x', ['Invalid data found when processing input'])).toMatch(/damaged/)
  })
  it('out of memory', () => {
    expect(friendlyError('RangeError: Array buffer allocation failed', [])).toMatch(/too big/)
  })
  it('empty output', () => expect(friendlyError('Output file is empty', [])).toMatch(/start and end/))
  it('no matching stream', () => {
    expect(friendlyError('x', ['Output file #0 does not contain any stream'])).toMatch(/kind of content/)
  })
  it('falls back to a generic sentence', () => expect(friendlyError('weird', [])).toMatch(/Something went wrong/))
})

describe('checkSize', () => {
  const GB = 1024 ** 3
  it('ok / warn / refuse thresholds', () => {
    expect(checkSize(500 * 1024 ** 2).level).toBe('ok')
    expect(checkSize(GB).level).toBe('ok')
    expect(checkSize(GB + 1).level).toBe('warn')
    expect(checkSize(2 * GB).level).toBe('warn')
    expect(checkSize(2 * GB + 1).level).toBe('refuse')
  })
})

describe('estimate', () => {
  const mk = (w: number, h: number, d: number) => ({ container: 'x', durationSec: d, video: [{ codec: 'h264', width: w, height: h }], audio: [] })
  it('scales with duration and resolution', () => {
    expect(estimateSeconds(mk(1280, 720, 40))).toBeCloseTo(24, 0)
    expect(estimateSeconds(mk(2560, 1440, 40))).toBeCloseTo(96, 0)
  })
  it('is null without video or duration', () => {
    expect(estimateSeconds(null)).toBeNull()
    expect(estimateSeconds({ container: 'mp3', durationSec: 5, video: [], audio: [] })).toBeNull()
  })
  it('formats readable text', () => {
    expect(formatEstimate(3)).toBe('a few seconds')
    expect(formatEstimate(42)).toBe('about 40 seconds')
    expect(formatEstimate(300)).toBe('about 5 minutes')
  })
})

describe('willReencode', () => {
  it('trim only re-encodes in precise mode', () => {
    expect(willReencode(trim, { mode: 'fast' })).toBe(false)
    expect(willReencode(trim, { mode: 'precise' })).toBe(true)
  })
  it('copy-only features do not', () => {
    expect(willReencode(extractAudio, {})).toBe(false)
  })
  it('flags the slow video features', () => {
    const slow = features.filter((f) => willReencode(f, defaultValues(f.options))).map((f) => f.id)
    expect(slow.sort()).toEqual(['compress', 'crop', 'resize', 'rotate', 'speed', 'to-mp4', 'to-webm', 'watermark'])
  })
})
