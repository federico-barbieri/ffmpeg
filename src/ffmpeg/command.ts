import type { Feature, OptionValues } from '../features/types'

/** Quote an argument the way a Unix shell would, only when needed. */
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`
}

/**
 * The equivalent command line, using the user's real file names (for learning / copy-paste).
 * Features that probe their inputs first (Merge) are shown without that knowledge: the preview
 * assumes the simplest path.
 */
export function commandString(feature: Feature, inputs: string | string[], opts: OptionValues, extra?: string): string {
  const names = Array.isArray(inputs) ? inputs : [inputs]
  const output = feature.noOutput ? '' : feature.zipOutput ? `out_%03d.${feature.zipOutput.ext}` : feature.outputName(names[0])
  return ['ffmpeg', ...feature.buildArgs(names[0], output, opts, { inputs: names, extra })].map(shellQuote).join(' ')
}
