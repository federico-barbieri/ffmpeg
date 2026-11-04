import type { Feature } from './types'
import { baseName, extOf } from './util'

export const toMp4: Feature = {
  id: 'to-mp4',
  label: 'Convert to MP4',
  group: 'Convert',
  icon: '🎞️',
  description: 'Turn any video into an MP4 that plays almost everywhere.',
  accepts: 'video',
  options: [],
  outputName: (name) => (extOf(name) === 'mp4' ? `${baseName(name)}-converted.mp4` : `${baseName(name)}.mp4`),
  buildArgs: (input, output) => [
    '-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', output,
  ],
}

export const toGif: Feature = {
  id: 'to-gif',
  label: 'Make a GIF',
  group: 'Convert',
  icon: '🖼️',
  description: 'Turn a short part of a video into an animated GIF.',
  accepts: 'video',
  options: [
    { kind: 'time', key: 'start', label: 'Start at', default: '00:00:00' },
    { kind: 'time', key: 'duration', label: 'How long (seconds or 0:05)', default: '5' },
    {
      kind: 'select', key: 'fps', label: 'Smoothness',
      choices: [
        { label: '10 frames per second (smallest)', value: '10' },
        { label: '12 frames per second', value: '12' },
        { label: '15 frames per second', value: '15' },
        { label: '24 frames per second (smoothest)', value: '24' },
      ],
      default: '12',
    },
    {
      kind: 'select', key: 'width', label: 'Width',
      choices: [
        { label: '320 pixels (small)', value: '320' },
        { label: '480 pixels', value: '480' },
        { label: '640 pixels (large)', value: '640' },
      ],
      default: '480',
    },
  ],
  outputName: (name) => `${baseName(name)}.gif`,
  buildArgs: (input, output, o) => [
    '-ss', String(o.start).trim(), '-t', String(o.duration).trim(), '-i', input,
    '-vf', `fps=${o.fps},scale=${o.width}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`,
    output,
  ],
}

export const convertFeatures: Feature[] = [toMp4, toGif]
