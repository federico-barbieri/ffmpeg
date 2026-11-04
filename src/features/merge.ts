import type { MediaInfo } from '../ffmpeg/probe'
import type { BuildContext, Feature } from './types'
import { UserError, baseName, extOf, reencodeFlags } from './util'

type Infos = (MediaInfo | null)[] | undefined

/** True if the clips can be joined without re-encoding (same codecs, size, frame rate, sound format). */
export function canCopyConcat(infos: Infos): boolean {
  if (!infos) return true // no probe results (command preview): assume the simple path
  if (infos.some((i) => i === null)) return false
  const list = infos as MediaInfo[]
  const first = list[0]
  return list.every((i) => {
    const v = i.video[0], v0 = first.video[0], a = i.audio[0], a0 = first.audio[0]
    if (i.video.length !== first.video.length || i.audio.length !== first.audio.length) return false
    if (v && (v.codec !== v0.codec || v.width !== v0.width || v.height !== v0.height || v.fps !== v0.fps)) return false
    if (a && (a.codec !== a0.codec || a.sampleRate !== a0.sampleRate || a.channels !== a0.channels)) return false
    return true
  })
}

/** Filter graph that scales/pads every clip to one size and joins them. */
function concatFilter(infos: MediaInfo[], hasVideo: boolean, hasAudio: boolean): string {
  const v0 = infos[0].video[0]
  const W = v0 ? (v0.width ?? 1280) - ((v0.width ?? 1280) % 2) : 0
  const H = v0 ? (v0.height ?? 720) - ((v0.height ?? 720) % 2) : 0
  const fps = v0?.fps ?? 30
  const parts: string[] = []
  const joined: string[] = []
  infos.forEach((_, i) => {
    if (hasVideo) {
      parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`)
      joined.push(`[v${i}]`)
    }
    if (hasAudio) {
      parts.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`)
      joined.push(`[a${i}]`)
    }
  })
  const outs = `${hasVideo ? '[v]' : ''}${hasAudio ? '[a]' : ''}`
  parts.push(`${joined.join('')}concat=n=${infos.length}:v=${hasVideo ? 1 : 0}:a=${hasAudio ? 1 : 0}${outs}`)
  return parts.join(';')
}

export const merge: Feature = {
  id: 'merge',
  label: 'Merge clips',
  group: 'Edit',
  icon: '🔗',
  description: 'Join several videos (or audio files) into one, in the order you choose.',
  accepts: 'media',
  multiFile: true,
  minFiles: 2,
  needsInfo: true,
  options: [],
  outputName: (name) => `${baseName(name)}-merged.${extOf(name) || 'mp4'}`,
  // Same format → fast stream copy through a concat list; otherwise re-encode and match sizes.
  sideFiles: (_o, ctx) =>
    canCopyConcat(ctx.infos) ? [{ name: 'list.txt', text: ctx.inputs.map((n) => `file '${n}'`).join('\n') }] : [],
  buildArgs: (_input, output, _o, ctx?: BuildContext) => {
    const inputs = ctx?.inputs ?? []
    if (canCopyConcat(ctx?.infos)) return ['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', output]
    const infos = ctx!.infos as (MediaInfo | null)[]
    if (infos.some((i) => i === null)) throw new UserError("One of the files couldn't be read. Remove it and try again.")
    const list = infos as MediaInfo[]
    const hasVideo = list.some((i) => i.video.length > 0)
    if (hasVideo && !list.every((i) => i.video.length > 0))
      throw new UserError('Choose files of the same kind: all videos, or all audio files.')
    const hasAudio = list.every((i) => i.audio.length > 0)
    const maps = [...(hasVideo ? ['-map', '[v]'] : []), ...(hasAudio ? ['-map', '[a]'] : [])]
    return [
      ...inputs.flatMap((n) => ['-i', n]),
      '-filter_complex', concatFilter(list, hasVideo, hasAudio),
      ...maps, ...reencodeFlags(output), output,
    ]
  },
}
