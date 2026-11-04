import type { Feature } from './types'

export const info: Feature = {
  id: 'info',
  label: 'File info',
  group: 'Info',
  icon: 'ℹ️',
  description: 'Show how long the file is, its size in pixels, codecs and more.',
  accepts: 'media',
  noOutput: true,
  options: [],
  outputName: (name) => name, // unused: no output file
  // No output given on purpose: ffmpeg prints the file details and exits with an error, which is expected.
  buildArgs: (input) => ['-i', input],
}

export const infoFeatures: Feature[] = [info]
