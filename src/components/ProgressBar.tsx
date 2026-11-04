interface Props {
  /** 0–1, or null for an indeterminate bar (progress unknown or unreliable) */
  value: number | null
  label?: string
  /** e.g. "about 2 minutes": shown as an honest up-front guess */
  estimate?: string
  /** Date.now() when the job started: enables a "time left" once progress is meaningful */
  startedAt?: number
  onCancel?: () => void
}

function timeLeft(value: number, startedAt: number): string | null {
  if (value < 0.05 || value >= 1) return null
  const left = ((Date.now() - startedAt) * (1 - value)) / value / 1000
  if (left < 5) return 'almost done'
  if (left < 90) return `about ${Math.round(left / 5) * 5} seconds left`
  return `about ${Math.round(left / 60)} minutes left`
}

export function ProgressBar({ value, label, estimate, startedAt, onCancel }: Props) {
  const left = value !== null && startedAt ? timeLeft(value, startedAt) : null
  const note = left ?? (estimate && (value === null || value < 0.05) ? `Estimated time: ${estimate}` : null)
  return (
    <div className="progress">
      <div className="progress-row">
        <span>{label ?? (value === null ? 'Working…' : `${Math.round(value * 100)}%`)}{left && value !== null ? ` · ${left}` : ''}</span>
        {onCancel && <button onClick={onCancel}>Cancel</button>}
      </div>
      <div className="bar" role="progressbar" aria-label="Progress" aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
        <div className={value === null ? 'fill indeterminate' : 'fill'} style={value === null ? undefined : { width: `${value * 100}%` }} />
      </div>
      {note && !left && <div className="muted">{note}. This runs inside your browser, so it is slower than the FFmpeg app.</div>}
    </div>
  )
}
