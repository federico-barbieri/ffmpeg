import { describe, expect, it } from 'vitest'
import { features } from '../src/features/registry'
import { defaultValues } from '../src/features/options'
import { extractAudio } from '../src/features/audio'
import { compress, screenshot } from '../src/features/edit'

describe('registry', () => {
  it('has unique ids and option keys', () => {
    const ids = features.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of features) {
      const keys = f.options.map((o) => o.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
  it('every feature builds args and an output name from its defaults', () => {
    for (const f of features) {
      const out = f.outputName('holiday.mp4')
      expect(out).toMatch(/\.\w+$/)
      const args = f.buildArgs('input.mp4', 'output.x', defaultValues(f.options))
      expect(args.length).toBeGreaterThan(0)
      expect(args.every((a) => typeof a === 'string')).toBe(true)
    }
  })
})

describe('extract-audio', () => {
  it('names the output .mp3', () => {
    expect(extractAudio.outputName('holiday.mp4')).toBe('holiday.mp3')
    expect(extractAudio.outputName('my.holiday.final.mov')).toBe('my.holiday.final.mp3')
    expect(extractAudio.outputName('noext')).toBe('noext.mp3')
  })
  it('builds args', () => {
    expect(extractAudio.buildArgs('in.mp4', 'out.mp3', {})).toEqual(
      ['-i', 'in.mp4', '-vn', '-c:a', 'libmp3lame', '-q:a', '2', 'out.mp3'])
  })
})

describe('screenshot', () => {
  it('seeks before the input and grabs one frame', () => {
    expect(screenshot.buildArgs('in.mp4', 'out.png', { time: ' 00:00:05 ' })).toEqual(
      ['-ss', '00:00:05', '-i', 'in.mp4', '-frames:v', '1', 'out.png'])
    expect(screenshot.outputName('clip.mp4')).toBe('clip.png')
  })
})

describe('compress', () => {
  it('uses the chosen CRF', () => {
    const args = compress.buildArgs('in.mp4', 'out.mp4', { crf: 31 })
    expect(args[args.indexOf('-crf') + 1]).toBe('31')
    expect(compress.outputName('clip.mov')).toBe('clip-compressed.mp4')
  })
})
