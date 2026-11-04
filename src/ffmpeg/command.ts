import type { Feature, OptionValues } from '../features/types'

/** Quote an argument the way a Unix shell would, only when needed. */
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`
}

/** The equivalent command line, using the user's real file names (for learning / copy-paste). */
export function commandString(feature: Feature, inputName: string, opts: OptionValues): string {
  const output = feature.noOutput ? '' : feature.outputName(inputName)
  return ['ffmpeg', ...feature.buildArgs(inputName, output, opts)].map(shellQuote).join(' ')
}
