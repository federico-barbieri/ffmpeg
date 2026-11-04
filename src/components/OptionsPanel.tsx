import type { ReactNode } from 'react'
import { firstError, validateOption } from '../features/options'
import type { Feature, OptionDef, OptionValues } from '../features/types'
import { CommandPreview } from './CommandPreview'

interface Props {
  feature: Feature
  values: OptionValues
  disabled?: boolean
  onChange: (values: OptionValues) => void
  onRun: () => void
  command: string
  showCommand: boolean
  onToggleCommand: () => void
  estimate?: string // shown for slow re-encoding features
  children?: ReactNode // extra inputs (file list, picker, logo) shown above the options
  blocker?: string | null // why Run is disabled, if something besides the options is missing
}

function Field({ def, value, onChange }: { def: OptionDef; value: string | number; onChange: (v: string | number) => void }) {
  const id = `opt-${def.key}`
  const error = validateOption(def, value)
  return (
    <div className="field">
      <label htmlFor={id}>
        {def.label}
        {def.kind === 'slider' && <strong> {value}</strong>}
      </label>
      {def.kind === 'time' && (
        <input id={id} type="text" inputMode="numeric" value={String(value)} aria-invalid={error !== null}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {def.kind === 'number' && (
        <input id={id} type="number" step="any" value={Number.isFinite(value as number) ? value : ''} aria-invalid={error !== null}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      )}
      {def.kind === 'select' && (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {def.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      )}
      {def.kind === 'slider' && (
        <>
          <input id={id} type="range" min={def.min} max={def.max} step={def.step} value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))} />
          {def.hint && <div className="hint"><span>{def.hint[0]}</span><span>{def.hint[1]}</span></div>}
        </>
      )}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

export function OptionsPanel({ feature, values, disabled, onChange, onRun, command, showCommand, onToggleCommand, estimate, children, blocker }: Props) {
  const error = firstError(feature.options, values)
  return (
    <form className="options" onSubmit={(e) => { e.preventDefault(); if (!error && !blocker && !disabled) onRun() }}>
      <h2>{feature.icon} {feature.label}</h2>
      <p>{feature.description}</p>
      {children}
      {feature.options.map((def) => (
        <Field key={def.key} def={def} value={values[def.key]} onChange={(v) => onChange({ ...values, [def.key]: v })} />
      ))}
      {blocker && <div className="field-error">{blocker}</div>}
      {estimate && <div className="muted">Estimated time: {estimate}. This runs inside your browser, so it is slower than the FFmpeg app.</div>}
      <button type="submit" className="run" disabled={disabled || error !== null || !!blocker}>Run</button>
      {!error && !blocker && command && <CommandPreview command={command} open={showCommand} onToggle={onToggleCommand} />}
    </form>
  )
}
