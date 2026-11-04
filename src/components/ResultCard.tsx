import type { RunResult } from '../ffmpeg/engine'
import { CommandPreview } from './CommandPreview'
import { formatSize } from './DropZone'

interface Props {
  result: RunResult & { blob: Blob }
  url: string
  inputSize: number
  command: string
  showCommand: boolean
  onToggleCommand: () => void
  onReuse: () => void
}

export function sizeChange(outBytes: number, inBytes: number): string {
  if (inBytes <= 0) return ''
  const pct = Math.round((Math.abs(outBytes - inBytes) / inBytes) * 100)
  if (pct === 0) return 'about the same size as the original'
  return `${pct}% ${outBytes < inBytes ? 'smaller' : 'larger'} than the original`
}

export function ResultCard({ result, url, inputSize, command, showCommand, onToggleCommand, onReuse }: Props) {
  const { blob, outputName } = result
  const isZip = blob.type === 'application/zip'
  return (
    <div className="result">
      <div>
        <strong className="filename">{outputName}</strong>
        <div className="muted">{formatSize(blob.size)}{!isZip && ` · ${sizeChange(blob.size, inputSize)}`}</div>
      </div>
      {isZip && <div className="zip">📦 {result.count ?? ''} pictures inside this ZIP file</div>}
      {blob.type.startsWith('audio/') && <audio controls src={url} />}
      {blob.type.startsWith('video/') && <video controls src={url} />}
      {blob.type.startsWith('image/') && <img src={url} alt="Result preview" />}
      <div className="actions">
        <a className="download" href={url} download={outputName}>Download</a>
        {!isZip && <button type="button" className="secondary" onClick={onReuse}>Do something else with this file</button>}
      </div>
      <CommandPreview command={command} open={showCommand} onToggle={onToggleCommand} />
    </div>
  )
}
