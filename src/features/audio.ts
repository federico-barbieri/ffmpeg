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

export const audioFeatures: Feature[] = [extractAudio, removeAudio]
