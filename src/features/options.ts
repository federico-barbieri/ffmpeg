import type { OptionDef, OptionValues } from './types'

export function defaultValues(options: OptionDef[]): OptionValues {
  return Object.fromEntries(options.map((o) => [o.key, o.default]))
}

const TIME_RE = /^(\d+:)?(\d{1,2}:)?\d+(\.\d+)?$/ // 90, 1:30, 00:01:30, 1:30.5

/** null if valid, otherwise a short message for the user. */
export function validateOption(def: OptionDef, value: string | number | undefined): string | null {
  if (def.kind === 'time') {
    return typeof value === 'string' && TIME_RE.test(value.trim()) ? null : 'Use a time like 1:30 or 00:01:30'
  }
  if (def.kind === 'number' || def.kind === 'slider') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number'
    if (def.kind === 'number' && def.min !== undefined && value < def.min) return `Must be at least ${def.min}`
  }
  return null
}

export function firstError(options: OptionDef[], values: OptionValues): string | null {
  for (const o of options) {
    const err = validateOption(o, values[o.key])
    if (err) return err
  }
  return null
}
