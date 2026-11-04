import { useState } from 'react'

interface Props {
  command: string
  open: boolean
  onToggle: () => void
}

/** "Show command" toggle: the equivalent ffmpeg command, so users can learn it. */
export function CommandPreview({ command, open, onToggle }: Props) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked: the text is still selectable */ }
  }
  return (
    <div className="command">
      <button type="button" className="link" aria-expanded={open} onClick={onToggle}>
        {open ? 'Hide command' : 'Show command'}
      </button>
      {open && (
        <div className="command-box">
          <pre>{command}</pre>
          <button type="button" className="link" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}
    </div>
  )
}
