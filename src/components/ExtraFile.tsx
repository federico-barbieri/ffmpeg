import { useRef } from 'react'

interface Props {
  label: string
  accept: string
  file: File | null
  disabled?: boolean
  onFile: (f: File) => void
}

/** A second, separate input file (for example the watermark logo). */
export function ExtraFile({ label, accept, file, disabled, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <div className="extra-row">
        <button type="button" className="secondary" disabled={disabled} onClick={() => input.current?.click()}>
          {file ? 'Choose another…' : 'Choose a file…'}
        </button>
        <span className="filename muted">{file ? file.name : 'Nothing chosen yet'}</span>
      </div>
    </div>
  )
}
