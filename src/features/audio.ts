import type { Feature } from './types'
import { baseName, extOf } from './util'

export const extractAudio: Feature = {
  id: 'extract-audio',
  label: 'Extract audio (MP3)',
  group: 'Audio',
  icon: '🎵',
  description: 'Save just the sound of a video as an MP3 file.',
  accepts: 'media',
  options: [],
  outputName: (name) => `${baseName(name)}.mp3`,
  buildArgs: (input, output) => ['-i', input, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', output],
}

export const removeAudio: Feature = {
  id: 'remove-audio',
  label: 'Remove audio',
  group: 'Audio',
  icon: '🔇',
  description: 'Make the video silent. The picture is not re-encoded, so this is fast and lossless.',
  accepts: 'video',
  options: [],
  // same container as the input, because the video stream is copied untouched
  outputName: (name) => `${baseName(name)}-no-audio.${extOf(name) || 'mp4'}`,
  buildArgs: (input, output) => ['-i', input, '-an', '-c:v', 'copy', output],
}

export const normalize: Feature = {
  id: 'normalize',
  label: 'Normalize volume',
  group: 'Audio',
  icon: '📢',
  description: 'Even out the loudness so quiet parts are easier to hear and loud parts are not too loud.',
  accepts: 'media',
  options: [],
  outputName: (name) => `${baseName(name)}-normalized.${extOf(name) || 'mp4'}`,
  // loudnorm resamples to 192 kHz internally, so set a normal rate; the picture is copied untouched.
  buildArgs: (input, output) => ['-i', input, '-af', 'loudnorm', '-ar', '48000', '-c:v', 'copy', output],
}

export const audioFeatures: Feature[] = [extractAudio, removeAudio, normalize]
