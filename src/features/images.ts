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

export const imageFeatures: Feature[] = [screenshot]
