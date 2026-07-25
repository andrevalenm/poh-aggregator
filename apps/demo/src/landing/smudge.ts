/**
 * Cursor trail v2 — a tapered ink ribbon that follows the pointer across the whole page,
 * not just the hero. The canvas is fixed to the viewport and redrawn from a rolling point
 * buffer each frame, so the trail dissolves continuously by age — no periodic wipe, no
 * hard restart. CSS gives the canvas `mix-blend-mode: exclusion`, which makes one bone
 * colour read as pale dust on the kiln sections and as pressed-in ink on the paper ones.
 *
 * Absent under prefers-reduced-motion and on touch devices, where there is no hover to
 * trail.
 */

const TRAIL_MS = 1100
const MAX_POINTS = 220

interface TrailPt {
  x: number
  y: number
  t: number
}

export function mountSmudge(canvas: HTMLCanvasElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (matchMedia('(hover: none)').matches) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let dpr = 1
  const layout = () => {
    dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
  }
  layout()
  addEventListener('resize', layout)

  const pts: TrailPt[] = []
  let raf = 0

  const frame = () => {
    const now = performance.now()
    while (pts.length && now - pts[0]!.t > TRAIL_MS) pts.shift()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)

    if (pts.length > 1) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!
        const b = pts[i]!
        // Segments longer than a flick are teleports (scroll, tab-back) — skip them.
        if (Math.hypot(b.x - a.x, b.y - a.y) > 160) continue
        const age = (now - b.t) / TRAIL_MS
        const life = 1 - age
        if (life <= 0) continue
        ctx.strokeStyle = `rgb(232 224 210 / ${(0.5 * life * life).toFixed(3)})`
        ctx.lineWidth = 1 + 13 * life ** 1.6
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }

    if (pts.length) raf = requestAnimationFrame(frame)
    else raf = 0
  }

  addEventListener(
    'pointermove',
    (e) => {
      const last = pts[pts.length - 1]
      // Densify fast strokes so the ribbon stays a ribbon, not beads.
      if (last && performance.now() - last.t < 90) {
        const d = Math.hypot(e.clientX - last.x, e.clientY - last.y)
        const steps = Math.min(Math.floor(d / 14), 6)
        for (let i = 1; i <= steps; i++) {
          pts.push({
            x: last.x + ((e.clientX - last.x) * i) / (steps + 1),
            y: last.y + ((e.clientY - last.y) * i) / (steps + 1),
            t: performance.now(),
          })
        }
      }
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (pts.length > MAX_POINTS) pts.splice(0, pts.length - MAX_POINTS)
      if (!raf) raf = requestAnimationFrame(frame)
    },
    { passive: true },
  )
}
