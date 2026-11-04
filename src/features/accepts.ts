import type { Feature } from './types'
import { extOf } from './util'

export type FileKind = 'video' | 'audio' | 'images' | 'unknown'

const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'flv', 'wmv', 'mpg', 'mpeg', '3gp', 'ts']
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma']
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']

/** Best guess at what a file is: MIME type first, extension as a fallback. */
export function fileKind(file: { name: string; type: string }): FileKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'images'
  const ext = extOf(file.name)
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (AUDIO_EXT.includes(ext)) return 'audio'
  if (IMAGE_EXT.includes(ext)) return 'images'
  return 'unknown'
}

const NEEDS: Record<Feature['accepts'], string> = {
  video: 'a video file',
  audio: 'an audio file',
  media: 'a video or audio file',
  images: 'an image file',
}

/** null if the feature can run on this file, otherwise a plain-English reason. */
export function unavailableReason(feature: Feature, file: { name: string; type: string } | null): string | null {
  if (!file) return 'Choose a file first.'
  const kind = fileKind(file)
  if (kind === 'unknown') return null // can't tell: let ffmpeg decide
  const ok =
    feature.accepts === 'media' ? kind === 'video' || kind === 'audio' : feature.accepts === kind
  return ok ? null : `This needs ${NEEDS[feature.accepts]}.`
}
