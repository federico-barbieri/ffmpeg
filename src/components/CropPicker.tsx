import { useRef } from 'react'

export interface CropRect { x: number; y: number; w: number; h: number } // in source pixels

interface Props {
  src: string // a frame of the video
  rect: CropRect
  onChange: (rect: CropRect) => void
}

type Drag =
  | { kind: 'new'; x0: number; y0: number }
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'resize'; ax: number; ay: number } // ax/ay: the fixed opposite corner

const HANDLE = 18 // px, in screen space

/** Draw, move and resize a crop rectangle on a still frame. Values are in source pixels. */
export function CropPicker({ src, rect, onChange }: Props) {
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<Drag | null>(null)

  /** pointer → source pixels (clamped to the picture) */
  function toSource(e: React.PointerEvent): { x: number; y: number; k: number } {
    const el = img.current!
    const b = el.getBoundingClientRect()
    const k = el.naturalWidth / b.width // source pixels per screen pixel
    const x = Math.min(Math.max((e.clientX - b.left) * k, 0), el.naturalWidth)
    const y = Math.min(Math.max((e.clientY - b.top) * k, 0), el.naturalHeight)
    return { x, y, k }
  }

  function down(e: React.PointerEvent) {
    const p = toSource(e)
    const h = HANDLE * p.k
    const near = (cx: number, cy: number) => Math.abs(p.x - cx) < h && Math.abs(p.y - cy) < h
    const corners: [number, number, number, number][] = [
      [rect.x, rect.y, rect.x + rect.w, rect.y + rect.h],
      [rect.x + rect.w, rect.y, rect.x, rect.y + rect.h],
      [rect.x, rect.y + rect.h, rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y],
    ]
    const hit = corners.find(([cx, cy]) => near(cx, cy))
    if (hit) drag.current = { kind: 'resize', ax: hit[2], ay: hit[3] }
    else if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h)
      drag.current = { kind: 'move', dx: p.x - rect.x, dy: p.y - rect.y }
    else drag.current = { kind: 'new', x0: p.x, y0: p.y }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) // keep receiving moves outside the picture
    } catch { /* not supported for this pointer: dragging still works inside the picture */ }
  }

  function move(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const p = toSource(e)
    const W = img.current!.naturalWidth, H = img.current!.naturalHeight
    const round = (r: CropRect): CropRect => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) })
    if (d.kind === 'move') {
      const x = Math.min(Math.max(p.x - d.dx, 0), W - rect.w)
      const y = Math.min(Math.max(p.y - d.dy, 0), H - rect.h)
      onChange(round({ ...rect, x, y }))
    } else {
      const [ax, ay] = d.kind === 'new' ? [d.x0, d.y0] : [d.ax, d.ay]
      onChange(round({ x: Math.min(ax, p.x), y: Math.min(ay, p.y), w: Math.abs(p.x - ax), h: Math.abs(p.y - ay) }))
    }
  }

  const el = img.current
  const pct = (v: number, total: number | undefined) => (total ? `${(v / total) * 100}%` : '0%')
  return (
    <div className="crop">
      <div className="field-label">Drag on the picture to choose what to keep</div>
      <div className="crop-stage" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        <img ref={img} src={src} alt="A frame of the video" draggable={false} />
        {el && rect.w > 0 && rect.h > 0 && (
          <div
            className="crop-rect"
            style={{ left: pct(rect.x, el.naturalWidth), top: pct(rect.y, el.naturalHeight), width: pct(rect.w, el.naturalWidth), height: pct(rect.h, el.naturalHeight) }}
          />
        )}
      </div>
    </div>
  )
}
