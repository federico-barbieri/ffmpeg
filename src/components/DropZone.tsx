import { useRef, useState } from 'react'

interface Props {
  file: File | null
  onFile: (file: File) => void
  disabled?: boolean
  summary?: string // e.g. "0:03 · 1280×720"
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function DropZone({ file, onFile, disabled, summary }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const pick = (f?: File) => f && !disabled && onFile(f)

  return (
    <div
      className={`dropzone${over ? ' over' : ''}${disabled ? ' disabled' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]) }}
    >
      <input ref={input} type="file" hidden accept="video/*,audio/*,image/*" onChange={(e) => pick(e.target.files?.[0])} />
      {file ? (
        <>
          <strong>{file.name}</strong>
          <span>{[formatSize(file.size), summary].filter(Boolean).join(' · ')} · click or drop to choose another file</span>
        </>
      ) : (
        <>
          <strong>Drop a video, audio or image file here</strong>
          <span>or click to choose one. It never leaves your computer.</span>
        </>
      )}
    </div>
  )
}
