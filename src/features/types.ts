import type { MediaInfo } from '../ffmpeg/probe'

export type OptionDef =
  | { kind: 'time'; key: string; label: string; default: string } // "00:01:23"
  | { kind: 'select'; key: string; label: string; choices: { label: string; value: string }[]; default: string }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number; default: number; hint?: [string, string] }
  | { kind: 'number'; key: string; label: string; default: number; min?: number }

export type OptionValues = Record<string, string | number>

/** Extra information for features that take more than one input file. */
export interface BuildContext {
  inputs: string[] // every input file name (first = the main file)
  extra?: string // the second, single input (e.g. a watermark image)
  infos?: (MediaInfo | null)[] // probe results per input, present when the feature sets needsInfo
}

export interface Feature {
  id: string // 'extract-audio'
  label: string // 'Extract audio'
  group: 'Convert' | 'Audio' | 'Edit' | 'Size & quality' | 'Images' | 'Info'
  icon: string // emoji or icon name
  description: string // one plain-English sentence
  accepts: 'video' | 'audio' | 'media' | 'images'
  multiFile?: boolean // several input files, reorderable (Merge, Slideshow)
  minFiles?: number // with multiFile: how many files are needed (default 1)
  extraInput?: { label: string; accept: string } // one more, separate input file (Watermark logo)
  picker?: 'crop' // shows a frame of the video to draw a rectangle on
  needsInfo?: boolean // probe every input first and pass the results in ctx.infos
  zipOutput?: { ext: string } // output is a numbered image sequence (out_%03d.ext), returned as one zip
  sideFiles?: (opts: OptionValues, ctx: BuildContext) => { name: string; text: string }[] // helper text files (concat list)
  reencodes?: boolean | ((opts: OptionValues) => boolean) // true if it decodes+encodes video (slow in wasm): drives the time estimate
  noOutput?: boolean // 'info': runs ffmpeg for its log only, produces no file
  options: OptionDef[]
  outputName: (inputName: string) => string // 'holiday.mp4' -> 'holiday.mp3'
  buildArgs: (input: string, output: string, opts: OptionValues, ctx?: BuildContext) => string[]
}

export function willReencode(feature: Feature, opts: OptionValues): boolean {
  return typeof feature.reencodes === 'function' ? feature.reencodes(opts) : feature.reencodes === true
}
