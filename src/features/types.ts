export type OptionDef =
  | { kind: 'time'; key: string; label: string; default: string } // "00:01:23"
  | { kind: 'select'; key: string; label: string; choices: { label: string; value: string }[]; default: string }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number; default: number; hint?: [string, string] }
  | { kind: 'number'; key: string; label: string; default: number }

export type OptionValues = Record<string, string | number>

export interface Feature {
  id: string // 'extract-audio'
  label: string // 'Extract audio'
  group: 'Convert' | 'Audio' | 'Edit' | 'Size & quality' | 'Images' | 'Info'
  icon: string // emoji or icon name
  description: string // one plain-English sentence
  accepts: 'video' | 'audio' | 'media' | 'images'
  multiFile?: boolean
  reencodes?: boolean | ((opts: OptionValues) => boolean) // true if it decodes+encodes video (slow in wasm): drives the time estimate
  noOutput?: boolean // 'info': runs ffmpeg for its log only, produces no file
  options: OptionDef[]
  outputName: (inputName: string) => string // 'holiday.mp4' -> 'holiday.mp3'
  buildArgs: (input: string, output: string, opts: OptionValues) => string[]
}

export function willReencode(feature: Feature, opts: OptionValues): boolean {
  return typeof feature.reencodes === 'function' ? feature.reencodes(opts) : feature.reencodes === true
}
