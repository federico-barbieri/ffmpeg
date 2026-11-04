import type { Feature } from './types'
import { baseName } from './util'

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

export const audioFeatures: Feature[] = [extractAudio]
