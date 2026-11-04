import { useRef } from 'react'
import type { Feature } from '../features/types'
import { formatSize } from './DropZone'

interface Props {
  files: File[]
  accepts: Feature['accepts']
  minFiles: number
  disabled?: boolean
  onChange: (files: File[]) => void
  onAdd: (files: File[]) => void
}

const ACCEPT: Record<Feature['accepts'], string> = {
  video: 'video/*', audio: 'audio/*', media: 'video/*,audio/*', images: 'image/*',
}

/** Reorderable list of the files a multi-file button will use (Merge, Slideshow). */
export function FileList({ files, accepts, minFiles, disabled, onChange, onAdd }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const move = (i: number, d: -1 | 1) => {
    const next = [...files]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="filelist">
      <div className="field-label">
        Files, in order{files.length < minFiles && <span className="field-error"> · add at least {minFiles}</span>}
      </div>
      <ol>
        {files.map((f, i) => (
          <li key={`${f.name}-${f.size}-${i}`}>
            <span className="filename">{f.name}</span>
            <span className="muted">{formatSize(f.size)}</span>
            <span className="row-buttons">
              <button type="button" aria-label={`Move ${f.name} up`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label={`Move ${f.name} down`} disabled={disabled || i === files.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label={`Remove ${f.name}`} disabled={disabled || files.length === 1} onClick={() => onChange(files.filter((_, j) => j !== i))}>✕</button>
            </span>
          </li>
        ))}
      </ol>
      <input ref={input} type="file" hidden multiple accept={ACCEPT[accepts]} onChange={(e) => { onAdd([...(e.target.files ?? [])]); e.target.value = '' }} />
      <button type="button" className="secondary" disabled={disabled} onClick={() => input.current?.click()}>Add more files…</button>
    </div>
  )
}
