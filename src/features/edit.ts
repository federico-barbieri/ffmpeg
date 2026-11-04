import type { Feature } from './types'
import { baseName, extOf } from './util'

/** Codec flags for a "precise" re-encode, chosen from the output container. */
function reencodeFlags(output: string): string[] {
  const ext = extOf(output)
  if (['mp4', 'mov', 'mkv', 'm4v'].includes(ext)) return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac']
  if (ext === 'webm') return ['-c:v', 'libvpx', '-c:a', 'libvorbis'] // VP8: VP9 is far too slow in wasm
  return [] // audio containers etc.: ffmpeg's default encoder for the format
}

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

export const editFeatures: Feature[] = [trim, rotate]
