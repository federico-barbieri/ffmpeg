import type { Feature } from './types'
import { baseName } from './util'

export const screenshot: Feature = {
  id: 'screenshot',
  label: 'Take screenshot',
  group: 'Images',
  icon: '📸',
  description: 'Save a single picture from the video at a moment you choose.',
  accepts: 'video',
  options: [{ kind: 'time', key: 'time', label: 'At what time?', default: '00:00:01' }],
  outputName: (name) => `${baseName(name)}.png`,
  buildArgs: (input, output, o) => ['-ss', String(o.time).trim(), '-i', input, '-frames:v', '1', output],
}

export const compress: Feature = {
  id: 'compress',
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

export const editFeatures: Feature[] = [screenshot, compress]
