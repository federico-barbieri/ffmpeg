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

export const thumbnails: Feature = {
  id: 'thumbnails',
  label: 'Thumbnail sheet',
  group: 'Images',
  icon: '🎬',
  description: 'Save a picture every few seconds of the video, all together in one ZIP file.',
  accepts: 'video',
  zipOutput: { ext: 'png' },
  options: [
    { kind: 'number', key: 'every', label: 'One picture every … seconds', default: 10, min: 0.5 },
    {
      kind: 'select', key: 'width', label: 'Picture width',
      choices: [
        { label: '160 pixels (tiny)', value: '160' },
        { label: '320 pixels', value: '320' },
        { label: '640 pixels', value: '640' },
      ],
      default: '320',
    },
  ],
  outputName: (name) => `${baseName(name)}-thumbnails.zip`,
  // capped at 120 pictures so a long video can't use up the browser's memory
  buildArgs: (input, output, o) => [
    '-i', input, '-vf', `fps=1/${o.every},scale=${o.width}:-1`, '-frames:v', '120', output,
  ],
}

const SLIDE_SIZES: Record<string, [number, number]> = { '1080': [1920, 1080], '720': [1280, 720], '360': [640, 360] }

export const imagesToVideo: Feature = {
  id: 'images-to-video',
  label: 'Slideshow',
  group: 'Images',
  icon: '📽️',
  description: 'Turn pictures into a video, one after another.',
  accepts: 'images',
  multiFile: true,
  minFiles: 1,
  options: [
    { kind: 'number', key: 'seconds', label: 'Seconds per picture', default: 3, min: 0.5 },
    {
      kind: 'select', key: 'size', label: 'Video size',
      choices: [
        { label: '1080p (Full HD)', value: '1080' },
        { label: '720p (HD)', value: '720' },
        { label: '360p (small)', value: '360' },
      ],
      default: '720',
    },
  ],
  outputName: (name) => `${baseName(name)}-slideshow.mp4`,
  buildArgs: (input, output, o, ctx) => {
    const inputs = ctx?.inputs ?? [input]
    const [W, H] = SLIDE_SIZES[String(o.size)] ?? SLIDE_SIZES['720']
    const per = inputs.map(
      (_, i) =>
        `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`,
    )
    const join = `${inputs.map((_, i) => `[v${i}]`).join('')}concat=n=${inputs.length}:v=1:a=0[v]`
    return [
      ...inputs.flatMap((n) => ['-loop', '1', '-t', String(o.seconds), '-i', n]),
      '-filter_complex', [...per, join].join(';'),
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', output,
    ]
  },
}

export const imageFeatures: Feature[] = [screenshot, thumbnails, imagesToVideo]
