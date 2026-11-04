import type { Feature } from './types'
import { baseName } from './util'

export const compress: Feature = {
  id: 'compress',
  reencodes: true,
  label: 'Compress',
  group: 'Size & quality',
  icon: '🗜️',
  description: 'Make the video file smaller by lowering its quality a little.',
  accepts: 'video',
  options: [
    { kind: 'slider', key: 'crf', label: 'Quality', min: 18, max: 35, step: 1, default: 28, hint: ['better quality', 'smaller file'] },
  ],
  outputName: (name) => `${baseName(name)}-compressed.mp4`,
  buildArgs: (input, output, o) => [
    '-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(o.crf), '-c:a', 'aac', '-b:a', '128k', output,
  ],
}

export const resize: Feature = {
  id: 'resize',
  reencodes: true,
  label: 'Resize',
  group: 'Size & quality',
  icon: '📐',
  description: 'Make the picture smaller (for example 1080p down to 480p) to save space.',
  accepts: 'video',
  options: [
    {
      kind: 'select', key: 'height', label: 'New size',
      choices: [
        { label: '1080p (Full HD)', value: '1080' },
        { label: '720p (HD)', value: '720' },
        { label: '480p', value: '480' },
        { label: '360p', value: '360' },
      ],
      default: '720',
    },
  ],
  outputName: (name) => `${baseName(name)}-resized.mp4`,
  buildArgs: (input, output, o) => [
    '-i', input, '-vf', `scale=-2:${o.height}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', output,
  ],
}

export const sizeFeatures: Feature[] = [compress, resize]
