import { GROUP_ORDER } from '../features/registry'
import { unavailableReason } from '../features/accepts'
import type { Feature } from '../features/types'

interface Props {
  features: Feature[]
  file: File | null
  selectedId: string | null
  disabled?: boolean
  onSelect: (feature: Feature) => void
}

export function ButtonGrid({ features, file, selectedId, disabled, onSelect }: Props) {
  return (
    <div className="groups">
      {GROUP_ORDER.map((group) => {
        const items = features.filter((f) => f.group === group)
        if (!items.length) return null
        return (
          <section key={group}>
            <h2>{group}</h2>
            <div className="grid">
              {items.map((f) => {
                const reason = unavailableReason(f, file)
                return (
                  <button
                    key={f.id}
                    className={`tile${f.id === selectedId ? ' selected' : ''}${reason ? ' unavailable' : ''}`}
                    // aria-disabled (not disabled) so the tooltip explaining why still shows on hover
                    aria-disabled={reason !== null || disabled}
                    title={reason ?? f.description}
                    onClick={() => !reason && !disabled && onSelect(f)}
                  >
                    <span className="icon">{f.icon}</span>
                    {f.label}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
