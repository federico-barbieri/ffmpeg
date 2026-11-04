import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatDuration, parseInfo, summarize, toRows } from '../src/ffmpeg/probe'

const log = (name: string) => readFileSync(`tests/fixtures/logs/${name}.txt`, 'utf8').split('\n')

describe('parseInfo (captured real ffmpeg logs)', () => {
  it('mp4 with video and audio', () => {
    const i = parseInfo(log('mp4'))!
    expect(i.container).toBe('mov,mp4,m4a,3gp,3g2,mj2')
    expect(i.durationSec).toBeCloseTo(3)
    expect(i.bitrateKbps).toBe(122)
    expect(i.video).toEqual([{ codec: 'h264', width: 320, height: 240, fps: 25, bitrateKbps: 42 }])
    expect(i.audio).toEqual([{ codec: 'aac', sampleRate: 44100, channels: 'mono', bitrateKbps: 69 }])
  })
  it('does not mistake the hex codec tag for a resolution', () => {
    expect(parseInfo(log('mp4'))!.video[0].width).toBe(320)
  })
  it('mkv with several audio tracks and a comma inside the pixel format', () => {
    const i = parseInfo(log('mkv'))!
    expect(i.container).toBe('matroska,webm')
    expect(i.video[0]).toMatchObject({ codec: 'h264', width: 1280, height: 720, fps: 30 })
    expect(i.audio.map((a) => [a.sampleRate, a.channels])).toEqual([[48000, 'stereo'], [44100, 'mono']])
  })
  it('audio-only mp3 has no video', () => {
    const i = parseInfo(log('mp3'))!
    expect(i.video).toEqual([])
    expect(i.audio[0]).toMatchObject({ codec: 'mp3', sampleRate: 44100, channels: 'mono', bitrateKbps: 64 })
    expect(i.durationSec).toBeCloseTo(2)
  })
  it('image has "Duration: N/A"', () => {
    const i = parseInfo(log('png'))!
    expect(i.durationSec).toBeUndefined()
    expect(i.video[0]).toMatchObject({ codec: 'png', width: 64, height: 64 })
  })
  it('returns null for a damaged file', () => {
    expect(parseInfo(log('bad'))).toBeNull()
  })
  it('returns null for an empty log', () => {
    expect(parseInfo([])).toBeNull()
  })
})

describe('parseInfo (log captured from ffmpeg.wasm itself)', () => {
  it('parses the wasm build output', () => {
    const lines: string[] = JSON.parse(readFileSync('tests/fixtures/logs/wasm-mp4.json', 'utf8'))
    const i = parseInfo(lines)!
    expect(i.container).toBe('mov,mp4,m4a,3gp,3g2,mj2')
    expect(i.durationSec).toBeCloseTo(3)
    expect(i.video[0]).toMatchObject({ codec: 'h264', width: 320, height: 240, fps: 25 })
    expect(i.audio[0]).toMatchObject({ codec: 'aac', sampleRate: 44100, channels: 'mono' })
  })
})

describe('formatting', () => {
  it('formatDuration', () => {
    expect(formatDuration(3)).toBe('0:03')
    expect(formatDuration(83)).toBe('1:23')
    expect(formatDuration(3723)).toBe('1:02:03')
  })
  it('summarize', () => {
    expect(summarize(parseInfo(log('mp4'))!)).toBe('0:03 · 320×240')
    expect(summarize(parseInfo(log('mp3'))!)).toBe('0:02')
  })
  it('toRows labels multiple audio tracks', () => {
    const labels = toRows(parseInfo(log('mkv'))!).map(([k]) => k)
    expect(labels).toContain('Audio 1 codec')
    expect(labels).toContain('Audio 2 sample rate')
    expect(labels).toContain('Video size')
  })
})
