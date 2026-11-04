import { describe, expect, it } from 'vitest'
import { toWebm } from '../src/features/convert'
import { atempoChain, crop, speed, watermark } from '../src/features/edit'
import { imagesToVideo, thumbnails } from '../src/features/images'
import { canCopyConcat, merge } from '../src/features/merge'
import { normalize } from '../src/features/audio'
import { firstError } from '../src/features/options'
import { UserError } from '../src/features/util'
import type { MediaInfo } from '../src/ffmpeg/probe'

const clip = (over: Partial<{ w: number; h: number; vc: string; fps: number; ac: string; hz: number; ch: string; noAudio: boolean; noVideo: boolean }> = {}): MediaInfo => ({
  container: 'mov,mp4',
  durationSec: 3,
  video: over.noVideo ? [] : [{ codec: over.vc ?? 'h264', width: over.w ?? 1280, height: over.h ?? 720, fps: over.fps ?? 30 }],
  audio: over.noAudio ? [] : [{ codec: over.ac ?? 'aac', sampleRate: over.hz ?? 44100, channels: over.ch ?? 'stereo' }],
})
const ctx = (infos: (MediaInfo | null)[], inputs = infos.map((_, i) => `input${i}.mp4`)) => ({ inputs, infos })

describe('atempoChain', () => {
  it('keeps values inside 0.5–2 as one filter', () => {
    expect(atempoChain(1.5)).toEqual(['atempo=1.5'])
    expect(atempoChain(2)).toEqual(['atempo=2'])
    expect(atempoChain(0.5)).toEqual(['atempo=0.5'])
  })
  it('chains filters outside the range', () => {
    expect(atempoChain(4)).toEqual(['atempo=2', 'atempo=2'])
    expect(atempoChain(0.25)).toEqual(['atempo=0.5', 'atempo=0.5'])
    expect(atempoChain(8)).toEqual(['atempo=2', 'atempo=2', 'atempo=2'])
  })
  it('multiplies back to the requested speed', () => {
    for (const x of [0.1, 0.25, 0.3, 0.75, 3, 4, 5, 10]) {
      const product = atempoChain(x).reduce((p, f) => p * Number(f.split('=')[1]), 1)
      expect(product).toBeCloseTo(x, 3)
    }
  })
})

describe('speed', () => {
  it('speeds video up with setpts and audio with atempo', () => {
    const a = speed.buildArgs('in.mp4', 'out.mp4', { factor: '2' })
    expect(a[a.indexOf('-vf') + 1]).toBe('setpts=PTS/2')
    expect(a[a.indexOf('-af') + 1]).toBe('atempo=2')
  })
  it('chains audio filters for 4×', () => {
    const a = speed.buildArgs('in.mp4', 'out.mp4', { factor: '4' })
    expect(a[a.indexOf('-af') + 1]).toBe('atempo=2,atempo=2')
  })
  it('keeps audio files in their own format', () => {
    expect(speed.outputName('song.mp3')).toBe('song-speed.mp3')
    expect(speed.outputName('clip.mov')).toBe('clip-speed.mp4')
    expect(speed.buildArgs('in.mp3', 'out.mp3', { factor: '2' })).not.toContain('libx264')
  })
})

describe('normalize', () => {
  it('uses loudnorm at a normal sample rate and copies the picture', () => {
    expect(normalize.buildArgs('in.mp4', 'out.mp4', {})).toEqual(
      ['-i', 'in.mp4', '-af', 'loudnorm', '-ar', '48000', '-c:v', 'copy', 'out.mp4'])
    expect(normalize.outputName('a.wav')).toBe('a-normalized.wav')
  })
})

describe('to-webm', () => {
  it('uses VP8 + Vorbis in 4:2:0 (VP9 crashes the wasm core)', () => {
    const a = toWebm.buildArgs('in.mp4', 'out.webm', {})
    expect(a).toContain('libvpx')
    expect(a).not.toContain('libvpx-vp9')
    expect(a).toContain('libvorbis')
    expect(a[a.indexOf('-pix_fmt') + 1]).toBe('yuv420p')
  })
  it('names the output', () => {
    expect(toWebm.outputName('a.mp4')).toBe('a.webm')
    expect(toWebm.outputName('a.webm')).toBe('a-converted.webm')
  })
})

describe('crop', () => {
  it('builds crop=w:h:x:y', () => {
    const a = crop.buildArgs('in.mp4', 'out.mp4', { x: 10, y: 20, w: 300, h: 200 })
    expect(a[a.indexOf('-vf') + 1]).toBe('crop=300:200:10:20')
  })
  it('rounds the size down to even numbers and the position to whole pixels', () => {
    const a = crop.buildArgs('in.mp4', 'out.mp4', { x: 10.7, y: 20.2, w: 301, h: 199.9 })
    expect(a[a.indexOf('-vf') + 1]).toBe('crop=300:198:10:20')
  })
  it('rejects an empty rectangle', () => {
    expect(firstError(crop.options, { x: 0, y: 0, w: 0, h: 0 })).not.toBeNull()
    expect(firstError(crop.options, { x: 0, y: 0, w: 100, h: 100 })).toBeNull()
    expect(firstError(crop.options, { x: -1, y: 0, w: 100, h: 100 })).not.toBeNull()
  })
})

describe('watermark', () => {
  const o = { corner: 'br', size: '0.2' }
  it('overlays the second input', () => {
    const a = watermark.buildArgs('in.mp4', 'out.mp4', o, { inputs: ['in.mp4'], extra: 'extra.png', infos: [clip({ w: 640, h: 360 })] })
    expect(a.slice(0, 4)).toEqual(['-i', 'in.mp4', '-i', 'extra.png'])
    const fc = a[a.indexOf('-filter_complex') + 1]
    expect(fc).toBe('[1:v]scale=128:-2[wm];[0:v][wm]overlay=W-w-10:H-h-10')
  })
  it('sizes the logo from the video width (even number)', () => {
    const w = (videoW: number, size: string) =>
      watermark.buildArgs('i', 'o', { corner: 'br', size }, { inputs: ['i'], extra: 'e.png', infos: [clip({ w: videoW })] })
        .find((x) => x.includes('scale='))!.match(/scale=(\d+):/)![1]
    expect(w(1920, '0.1')).toBe('192')
    expect(w(1280, '0.3')).toBe('384')
    expect(Number(w(1001, '0.2')) % 2).toBe(0)
  })
  it('maps every corner to a position', () => {
    const pos = (corner: string) =>
      watermark.buildArgs('i', 'o', { ...o, corner }, { inputs: ['i'], extra: 'e.png' }).find((x) => x.includes('overlay='))!.split('overlay=')[1]
    expect(pos('tl')).toBe('10:10')
    expect(pos('tr')).toBe('W-w-10:10')
    expect(pos('bl')).toBe('10:H-h-10')
  })
  it('asks for the logo when missing', () => {
    expect(() => watermark.buildArgs('in.mp4', 'out.mp4', o, { inputs: ['in.mp4'] })).toThrow(UserError)
  })
})

describe('thumbnails', () => {
  it('samples every N seconds into a numbered sequence, capped', () => {
    const a = thumbnails.buildArgs('in.mp4', 'out_%03d.png', { every: 5, width: '320' })
    expect(a[a.indexOf('-vf') + 1]).toBe('fps=1/5,scale=320:-1')
    expect(a[a.indexOf('-frames:v') + 1]).toBe('120')
    expect(a.at(-1)).toBe('out_%03d.png')
    expect(thumbnails.zipOutput).toEqual({ ext: 'png' })
    expect(thumbnails.outputName('clip.mp4')).toBe('clip-thumbnails.zip')
  })
  it('rejects a zero interval', () => {
    expect(firstError(thumbnails.options, { every: 0, width: '320' })).not.toBeNull()
  })
})

describe('slideshow', () => {
  it('loops each picture for N seconds and joins them at one size', () => {
    const a = imagesToVideo.buildArgs('a.png', 'out.mp4', { seconds: 2, size: '720' }, { inputs: ['a.png', 'b.jpg'] })
    expect(a.filter((x) => x === '-loop').length).toBe(2)
    expect(a.slice(0, 6)).toEqual(['-loop', '1', '-t', '2', '-i', 'a.png'])
    const fc = a[a.indexOf('-filter_complex') + 1]
    expect(fc).toContain('scale=1280:720')
    expect(fc).toContain('concat=n=2:v=1:a=0[v]')
  })
  it('works with a single picture', () => {
    const a = imagesToVideo.buildArgs('a.png', 'out.mp4', { seconds: 3, size: '360' })
    expect(a[a.indexOf('-filter_complex') + 1]).toContain('concat=n=1')
  })
})

describe('merge', () => {
  it('copies when every clip matches', () => {
    const infos = [clip(), clip(), clip()]
    expect(canCopyConcat(infos)).toBe(true)
    expect(merge.buildArgs('a', 'out.mp4', {}, ctx(infos))).toEqual(
      ['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'out.mp4'])
    expect(merge.sideFiles?.({}, ctx(infos))).toEqual([{ name: 'list.txt', text: "file 'input0.mp4'\nfile 'input1.mp4'\nfile 'input2.mp4'" }])
  })
  it.each([
    ['resolution', clip({ w: 640, h: 360 })],
    ['video codec', clip({ vc: 'hevc' })],
    ['frame rate', clip({ fps: 25 })],
    ['audio codec', clip({ ac: 'mp3' })],
    ['sample rate', clip({ hz: 48000 })],
    ['channels', clip({ ch: 'mono' })],
    ['missing audio', clip({ noAudio: true })],
  ])('re-encodes when the %s differs', (_n, other) => {
    const infos = [clip(), other]
    expect(canCopyConcat(infos)).toBe(false)
    const a = merge.buildArgs('a', 'out.mp4', {}, ctx(infos))
    expect(a).not.toContain('copy')
    expect(merge.sideFiles?.({}, ctx(infos))).toEqual([]) // no concat list needed
    expect(a).toContain('libx264')
  })
  it('matches every clip to the first one’s size and joins video + audio', () => {
    const a = merge.buildArgs('a', 'out.mp4', {}, ctx([clip({ w: 1920, h: 1080 }), clip({ w: 640, h: 360 })]))
    const fc = a[a.indexOf('-filter_complex') + 1]
    expect(fc).toContain('[0:v]scale=1920:1080')
    expect(fc).toContain('[1:v]scale=1920:1080')
    expect(fc).toContain('[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]')
    expect(a.filter((x) => x === '-map')).toHaveLength(2)
  })
  it('drops sound when one clip has none', () => {
    const a = merge.buildArgs('a', 'out.mp4', {}, ctx([clip(), clip({ noAudio: true, w: 640 })]))
    const fc = a[a.indexOf('-filter_complex') + 1]
    expect(fc).toContain('concat=n=2:v=1:a=0[v]')
    expect(a.filter((x) => x === '-map')).toHaveLength(1)
  })
  it('joins audio-only files', () => {
    const a = merge.buildArgs('a', 'out.mp3', {}, ctx([clip({ noVideo: true }), clip({ noVideo: true, hz: 48000 })], ['input0.mp3', 'input1.mp3']))
    expect(a[a.indexOf('-filter_complex') + 1]).toContain('concat=n=2:v=0:a=1[a]')
    expect(a).not.toContain('libx264')
  })
  it('refuses a mix of video and audio-only files', () => {
    expect(() => merge.buildArgs('a', 'out.mp4', {}, ctx([clip(), clip({ noVideo: true })]))).toThrow(UserError)
  })
  it('reports an unreadable file', () => {
    expect(() => merge.buildArgs('a', 'out.mp4', {}, ctx([clip(), null]))).toThrow(/couldn't be read/)
  })
  it('needs at least two files', () => {
    expect(merge.multiFile).toBe(true)
    expect(merge.minFiles).toBe(2)
  })
})
