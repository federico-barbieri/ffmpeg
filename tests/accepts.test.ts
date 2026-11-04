import { describe, expect, it } from 'vitest'
import { fileKind, unavailableReason } from '../src/features/accepts'
import { extractAudio } from '../src/features/audio'
import { screenshot } from '../src/features/edit'
import { firstError, validateOption } from '../src/features/options'

const video = { name: 'a.mp4', type: 'video/mp4' }
const audio = { name: 'a.mp3', type: 'audio/mpeg' }
const image = { name: 'a.png', type: 'image/png' }

describe('fileKind', () => {
  it('uses the MIME type', () => {
    expect(fileKind(video)).toBe('video')
    expect(fileKind(audio)).toBe('audio')
    expect(fileKind(image)).toBe('images')
  })
  it('falls back to the extension when the MIME type is empty', () => {
    expect(fileKind({ name: 'clip.MKV', type: '' })).toBe('video')
    expect(fileKind({ name: 'song.flac', type: '' })).toBe('audio')
    expect(fileKind({ name: 'readme.txt', type: '' })).toBe('unknown')
  })
})

describe('unavailableReason', () => {
  it('asks for a file first', () => expect(unavailableReason(extractAudio, null)).toMatch(/file/))
  it('allows media features on video and audio only', () => {
    expect(unavailableReason(extractAudio, video)).toBeNull()
    expect(unavailableReason(extractAudio, audio)).toBeNull()
    expect(unavailableReason(extractAudio, image)).toMatch(/video or audio/)
  })
  it('video-only features reject audio', () => {
    expect(unavailableReason(screenshot, audio)).toMatch(/video file/)
  })
  it('does not block files of unknown type', () => {
    expect(unavailableReason(screenshot, { name: 'x.bin', type: '' })).toBeNull()
  })
})

describe('option validation', () => {
  const time = { kind: 'time', key: 't', label: 'T', default: '0' } as const
  it('accepts sensible times', () => {
    for (const v of ['5', '1:30', '00:01:30', '00:00:01.5']) expect(validateOption(time, v)).toBeNull()
  })
  it('rejects bad times', () => {
    for (const v of ['', 'abc', '1:2:3:4', '-5']) expect(validateOption(time, v)).not.toBeNull()
  })
  it('rejects NaN numbers', () => {
    expect(validateOption({ kind: 'number', key: 'n', label: 'N', default: 1 }, NaN)).not.toBeNull()
  })
  it('firstError reports the first problem', () => {
    expect(firstError(screenshot.options, { time: 'nope' })).not.toBeNull()
    expect(firstError(screenshot.options, { time: '1:00' })).toBeNull()
  })
})
