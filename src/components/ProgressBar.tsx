interface Props {
  /** 0–1, or null for an indeterminate bar */
  value: number | null
  label?: string
  onCancel?: () => void
}

export function ProgressBar({ value, label, onCancel }: Props) {
  return (
    <div className="progress">
      <div className="progress-row">
        <span>{label ?? (value === null ? 'Working…' : `${Math.round(value * 100)}%`)}</span>
        {onCancel && <button onClick={onCancel}>Cancel</button>}
      </div>
      <div className="bar" role="progressbar" aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
        <div className={value === null ? 'fill indeterminate' : 'fill'} style={value === null ? undefined : { width: `${value * 100}%` }} />
      </div>
    </div>
  )
}
