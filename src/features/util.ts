/** 'holiday.final.mp4' -> 'holiday.final' */
export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** 'holiday.mp4' -> 'mp4' (lowercase, '' if none) */
export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}
