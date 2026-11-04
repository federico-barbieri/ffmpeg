import type { Feature } from './types'
import { fileKind } from './accepts'
import { merge } from './merge'
import { UserError, baseName, extOf, reencodeFlags } from './util'

export const trim: Feature = {
  id: 'trim',
  reencodes: (o) => o.mode === 'precise',
  label: 'Trim',
  group: 'Edit',
  icon: '✂️',
  description: 'Keep only the part between a start and an end time.',
  accepts: 'media',
  options: [
    { kind: 'time', key: 'start', label: 'Start', default: '00:00:00' },
    { kind: 'time', key: 'end', label: 'End', default: '00:00:05' },
    {
      kind: 'select', key: 'mode', label: 'Cutting method',
      choices: [
        { label: 'Fast (may start a moment early)', value: 'fast' },
        { label: 'Precise (slower, cuts exactly)', value: 'precise' },
      ],
      default: 'fast',
    },
  ],
  outputName: (name) => `${baseName(name)}-trimmed.${extOf(name) || 'mp4'}`,
  buildArgs: (input, output, o) => [
    // both before -i, so END is a position in the original file
    '-ss', String(o.start).trim(), '-to', String(o.end).trim(), '-i', input,
    ...(o.mode === 'precise' ? reencodeFlags(output) : ['-c', 'copy']),
    output,
  ],
}

const ROTATE_FILTERS: Record<string, string> = {
  cw: 'transpose=1',
  ccw: 'transpose=2',
  '180': 'transpose=1,transpose=1',
  hflip: 'hflip',
}

export const rotate: Feature = {
  id: 'rotate',
  reencodes: true,
  label: 'Rotate / flip',
  group: 'Edit',
  icon: '🔄',
  description: 'Turn the video sideways or upside down, or mirror it.',
  accepts: 'video',
  options: [
    {
      kind: 'select', key: 'how', label: 'How?',
      choices: [
        { label: '90° to the right', value: 'cw' },
        { label: '90° to the left', value: 'ccw' },
        { label: '180° (upside down)', value: '180' },
        { label: 'Mirror (flip left–right)', value: 'hflip' },
      ],
      default: 'cw',
    },
  ],
  outputName: (name) => `${baseName(name)}-rotated.mp4`,
  buildArgs: (input, output, o) => [
    '-i', input, '-vf', ROTATE_FILTERS[String(o.how)] ?? ROTATE_FILTERS.cw,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', output,
  ],
}

/** atempo only accepts 0.5–2, so chain filters for anything outside that range (4× = 2×2×). */
export function atempoChain(speed: number): string[] {
  const out: string[] = []
  let x = speed
  while (x > 2) { out.push('atempo=2'); x /= 2 }
  while (x < 0.5) { out.push('atempo=0.5'); x /= 0.5 }
  out.push(`atempo=${Number(x.toFixed(4))}`)
  return out
}

export const speed: Feature = {
  id: 'speed',
  label: 'Change speed',
  group: 'Edit',
  icon: '⏩',
  description: 'Make a video or audio file play faster or in slow motion.',
  accepts: 'media',
  reencodes: true,
  options: [
    {
      kind: 'select', key: 'factor', label: 'Speed',
      choices: [
        { label: '0.25× (very slow)', value: '0.25' },
        { label: '0.5× (slow motion)', value: '0.5' },
        { label: '1.5× (a bit faster)', value: '1.5' },
        { label: '2× (double speed)', value: '2' },
        { label: '4× (very fast)', value: '4' },
      ],
      default: '2',
    },
  ],
  // audio files keep their format; video becomes MP4
  outputName: (name) =>
    fileKind({ name, type: '' }) === 'audio'
      ? `${baseName(name)}-speed.${extOf(name)}`
      : `${baseName(name)}-speed.mp4`,
  buildArgs: (input, output, o) => {
    const x = Number(o.factor)
    return [
      '-i', input,
      '-vf', `setpts=PTS/${x}`, // = (1/x)*PTS
      '-af', atempoChain(x).join(','),
      ...reencodeFlags(output), output,
    ]
  },
}

/** Round down to an even number: H.264 needs even dimensions. */
const even = (n: number) => Math.max(2, Math.floor(n) - (Math.floor(n) % 2))

export const crop: Feature = {
  id: 'crop',
  label: 'Crop',
  group: 'Edit',
  icon: '🔲',
  description: 'Cut away the edges: draw a rectangle on a frame of the video.',
  accepts: 'video',
  reencodes: true,
  picker: 'crop',
  options: [
    { kind: 'number', key: 'x', label: 'Left (pixels)', default: 0, min: 0 },
    { kind: 'number', key: 'y', label: 'Top (pixels)', default: 0, min: 0 },
    { kind: 'number', key: 'w', label: 'Width (pixels)', default: 0, min: 2 },
    { kind: 'number', key: 'h', label: 'Height (pixels)', default: 0, min: 2 },
  ],
  outputName: (name) => `${baseName(name)}-cropped.mp4`,
  buildArgs: (input, output, o) => [
    '-i', input, '-vf', `crop=${even(Number(o.w))}:${even(Number(o.h))}:${Math.floor(Number(o.x))}:${Math.floor(Number(o.y))}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', output,
  ],
}

const WATERMARK_POS: Record<string, string> = {
  tl: '10:10',
  tr: 'W-w-10:10',
  bl: '10:H-h-10',
  br: 'W-w-10:H-h-10',
}

export const watermark: Feature = {
  id: 'watermark',
  label: 'Add watermark',
  group: 'Edit',
  icon: '💧',
  description: 'Put your logo (a PNG picture) in one corner of the video.',
  accepts: 'video',
  reencodes: true,
  needsInfo: true, // the logo is sized from the video's width
  extraInput: { label: 'Your logo (PNG picture)', accept: 'image/png,image/*' },
  options: [
    {
      kind: 'select', key: 'corner', label: 'Corner',
      choices: [
        { label: 'Top left', value: 'tl' },
        { label: 'Top right', value: 'tr' },
        { label: 'Bottom left', value: 'bl' },
        { label: 'Bottom right', value: 'br' },
      ],
      default: 'br',
    },
    {
      kind: 'select', key: 'size', label: 'Logo size',
      choices: [
        { label: 'Small (10% of the width)', value: '0.1' },
        { label: 'Medium (20%)', value: '0.2' },
        { label: 'Large (30%)', value: '0.3' },
      ],
      default: '0.2',
    },
  ],
  outputName: (name) => `${baseName(name)}-watermarked.mp4`,
  buildArgs: (input, output, o, ctx) => {
    if (!ctx?.extra) throw new UserError('Choose your logo picture first.')
    // Logo width = a share of the video width (even number), height follows the logo's own shape.
    // (scale2ref reads main_w as the *logo's* size in this ffmpeg build, so size it explicitly.)
    const videoW = ctx.infos?.[0]?.video[0]?.width ?? 1280
    const logoW = even(videoW * Number(o.size))
    return [
      '-i', input, '-i', ctx.extra,
      '-filter_complex',
      `[1:v]scale=${logoW}:-2[wm];[0:v][wm]overlay=${WATERMARK_POS[String(o.corner)] ?? WATERMARK_POS.br}`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', output,
    ]
  },
}

export const editFeatures: Feature[] = [merge, trim, speed, crop, watermark, rotate]
