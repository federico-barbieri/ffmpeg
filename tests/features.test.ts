import { describe, expect, it } from 'vitest'
import { features } from '../src/features/registry'
import { defaultValues } from '../src/features/options'
import { extractAudio } from '../src/features/audio'
import { compress, resize } from '../src/features/size'
import { toGif, toMp4 } from '../src/features/convert'
import { removeAudio } from '../src/features/audio'
import { rotate, trim } from '../src/features/edit'
import { info } from '../src/features/info'
import { screenshot } from '../src/features/images'

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
      const args = f.buildArgs('input.mp4', 'output.x', defaultValues(f.options), {
        inputs: ['input.mp4', 'input2.mp4'], extra: 'logo.png',
      })
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

describe('to-mp4', () => {
  it('re-encodes with x264 + aac', () => {
    expect(toMp4.buildArgs('in.mov', 'out.mp4', {})).toEqual(
      ['-i', 'in.mov', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', 'out.mp4'])
  })
  it('avoids overwriting-looking names for mp4 input', () => {
    expect(toMp4.outputName('a.mov')).toBe('a.mp4')
    expect(toMp4.outputName('a.MP4')).toBe('a-converted.mp4')
  })
})

describe('to-gif', () => {
  it('seeks and limits before the input and uses a palette', () => {
    const args = toGif.buildArgs('in.mp4', 'out.gif', { start: '0:02', duration: '3', fps: '15', width: '320' })
    expect(args.slice(0, 5)).toEqual(['-ss', '0:02', '-t', '3', '-i'])
    expect(args[args.indexOf('-vf') + 1]).toBe(
      'fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse')
    expect(toGif.outputName('a.mp4')).toBe('a.gif')
  })
  it('offers the default frame rate as a choice', () => {
    const fps = toGif.options.find((o) => o.key === 'fps')!
    expect(fps.kind === 'select' && fps.choices.some((c) => c.value === fps.default)).toBe(true)
  })
})

describe('remove-audio', () => {
  it('copies the video and keeps the container', () => {
    expect(removeAudio.buildArgs('in.mkv', 'out.mkv', {})).toEqual(['-i', 'in.mkv', '-an', '-c:v', 'copy', 'out.mkv'])
    expect(removeAudio.outputName('a.webm')).toBe('a-no-audio.webm')
    expect(removeAudio.outputName('noext')).toBe('noext-no-audio.mp4')
  })
})

describe('trim', () => {
  const o = { start: '0:05', end: '0:10' }
  it('fast mode stream-copies', () => {
    expect(trim.buildArgs('in.mp4', 'out.mp4', { ...o, mode: 'fast' })).toEqual(
      ['-ss', '0:05', '-to', '0:10', '-i', 'in.mp4', '-c', 'copy', 'out.mp4'])
  })
  it('precise mode re-encodes for mp4', () => {
    const a = trim.buildArgs('in.mp4', 'out.mp4', { ...o, mode: 'precise' })
    expect(a).toContain('libx264')
    expect(a).not.toContain('copy')
  })
  it('precise mode picks a codec the container accepts', () => {
    expect(trim.buildArgs('in.webm', 'out.webm', { ...o, mode: 'precise' })).toContain('libvpx')
    const mp3 = trim.buildArgs('in.mp3', 'out.mp3', { ...o, mode: 'precise' })
    expect(mp3).toEqual(['-ss', '0:05', '-to', '0:10', '-i', 'in.mp3', 'out.mp3'])
  })
  it('keeps the input extension', () => {
    expect(trim.outputName('a.mov')).toBe('a-trimmed.mov')
  })
})

describe('resize', () => {
  it('scales to the chosen height keeping width even', () => {
    const a = resize.buildArgs('in.mp4', 'out.mp4', { height: '480' })
    expect(a[a.indexOf('-vf') + 1]).toBe('scale=-2:480')
    expect(resize.outputName('a.mov')).toBe('a-resized.mp4')
  })
})

describe('rotate', () => {
  const filter = (how: string) => {
    const a = rotate.buildArgs('in.mp4', 'out.mp4', { how })
    return a[a.indexOf('-vf') + 1]
  }
  it('maps each choice to its filter', () => {
    expect(filter('cw')).toBe('transpose=1')
    expect(filter('ccw')).toBe('transpose=2')
    expect(filter('180')).toBe('transpose=1,transpose=1')
    expect(filter('hflip')).toBe('hflip')
  })
  it('every select choice is handled', () => {
    const how = rotate.options[0]
    if (how.kind !== 'select') throw new Error('expected select')
    for (const c of how.choices) expect(filter(c.value)).toBeTruthy()
  })
})

describe('info', () => {
  it('runs with no output file', () => {
    expect(info.noOutput).toBe(true)
    expect(info.buildArgs('in.mp4', 'unused', {})).toEqual(['-i', 'in.mp4'])
  })
})
