/**
 * Topographic contour field — the page's second drawing, and the idea that ties the print
 * to the natural world: a fingerprint IS a contour map of a person; terrain is the same
 * drawing of land. Level sets of a seeded sum-of-sines height field, extracted with
 * marching squares and drawn as faded-ink polylines. Rendered once per resize (static),
 * then parallax-translated by the scroll loop — cheap, organic, ours.
 */

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mountContours(canvas: HTMLCanvasElement, seed = 0x7e44a1): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rand = mulberry32(seed)
  // A smooth organic height field: a handful of incommensurate plane waves.
  const waves = Array.from({ length: 5 }, () => ({
    ax: (rand() - 0.5) * 4.4,
    ay: (rand() - 0.5) * 4.4,
    ph: rand() * Math.PI * 2,
    amp: 0.55 + rand() * 0.45,
  }))
  const height = (x: number, y: number): number => {
    let v = 0
    for (const wv of waves) v += wv.amp * Math.sin(wv.ax * x + wv.ay * y + wv.ph)
    return v
  }

  const draw = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const COLS = 110
    const ROWS = Math.max(Math.round((COLS * h) / w), 24)
    const cw = w / COLS
    const ch = h / ROWS
    const aspect = w / h

    // Sample the field once.
    const grid: number[][] = []
    for (let j = 0; j <= ROWS; j++) {
      const row: number[] = []
      for (let i = 0; i <= COLS; i++) row.push(height((i / COLS) * aspect * 1.6, (j / ROWS) * 1.6))
      grid.push(row)
    }

    const LEVELS = 14
    ctx.lineWidth = 0.7
    ctx.lineCap = 'round'
    for (let l = 0; l < LEVELS; l++) {
      const iso = -2.1 + (l / (LEVELS - 1)) * 4.2
      // Index contours (every 4th) run slightly heavier, like a real topo sheet.
      ctx.strokeStyle = l % 4 === 0 ? 'rgb(74 60 44 / 0.5)' : 'rgb(74 60 44 / 0.3)'
      ctx.beginPath()
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const tl = grid[j]![i]! - iso
          const tr = grid[j]![i + 1]! - iso
          const br = grid[j + 1]![i + 1]! - iso
          const bl = grid[j + 1]![i]! - iso
          const x0 = i * cw
          const y0 = j * ch
          // Edge crossings, linearly interpolated.
          const pts: [number, number][] = []
          if (tl * tr < 0) pts.push([x0 + (tl / (tl - tr)) * cw, y0])
          if (tr * br < 0) pts.push([x0 + cw, y0 + (tr / (tr - br)) * ch])
          if (bl * br < 0) pts.push([x0 + (bl / (bl - br)) * cw, y0 + ch])
          if (tl * bl < 0) pts.push([x0, y0 + (tl / (tl - bl)) * ch])
          if (pts.length >= 2) {
            ctx.moveTo(pts[0]![0], pts[0]![1])
            ctx.lineTo(pts[1]![0], pts[1]![1])
            if (pts.length === 4) {
              ctx.moveTo(pts[2]![0], pts[2]![1])
              ctx.lineTo(pts[3]![0], pts[3]![1])
            }
          }
        }
      }
      ctx.stroke()
    }
  }

  draw()
  let t: ReturnType<typeof setTimeout> | undefined
  addEventListener('resize', () => {
    clearTimeout(t)
    t = setTimeout(draw, 150)
  })
}
