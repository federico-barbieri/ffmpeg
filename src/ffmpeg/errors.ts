/** Turn ffmpeg's technical failure into one plain-English sentence for the user. */
export function friendlyError(message: string, log: string[]): string {
  const text = `${message}\n${log.join('\n')}`
  const has = (re: RegExp) => re.test(text)

  if (has(/moov atom not found|Invalid data found when processing input|Error opening input/i))
    return "This file seems damaged or isn't a video, audio or image file."
  if (has(/out of memory|Cannot allocate memory|memory access out of bounds|RangeError|Array buffer allocation failed/i))
    return 'The file is too big for your browser to handle. Try a smaller file, or a shorter clip.'
  if (has(/Output file is empty/i))
    return 'Nothing came out. Check that your start and end times are inside the file.'
  if (has(/does not contain any stream|matches no streams|Stream map .* matches no streams/i))
    return "This file doesn't have the kind of content this button needs (for example no sound to extract)."
  if (has(/Unknown encoder|Encoder .* not found|Unsupported codec|Decoder .* not found/i))
    return "FFmpeg in the browser can't handle this file's format."
  if (has(/Aborted\(\)|ffmpeg was terminated|terminated/i))
    return 'FFmpeg stopped unexpectedly. Try again, or try a smaller file.'
  return 'Something went wrong while processing this file.'
}
