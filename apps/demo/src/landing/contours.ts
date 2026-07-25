/**
 * Topographic contour field — the page's second drawing, and the idea that ties the print
 * to the natural world: a fingerprint IS a contour map of a person; terrain is the same
 * drawing of land. Level sets of a seeded sum-of-sines height field, extracted with
 * marching squares and drawn as faded-ink polylines.
 *
 * The field flows: each wave's phase drifts at its own very slow rate, so the terrain
 * morphs like weather on a decades-long clock — alive if you rest on it, invisible if you
 * are reading. Redrawn at ~24fps, and only while the canvas is actually in the viewport
 * and the tab visible; narrow screens and prefers-reduced-motion get the still drawing.
 * The scroll parallax on top of this is applied by the main loop as a transform.
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
  // A smooth organic height field: a handful of incommensurate plane waves. `drift` is
  // radians per second — full character change on the order of minutes, not seconds.
  const waves = Array.from({ length: 5 }, () => ({
    ax: (rand() - 0.5) * 4.4,
    ay: (rand() - 0.5) * 4.4,
    ph: rand() * Math.PI * 2,
    amp: 0.55 + rand() * 0.45,
    drift: (0.012 + rand() * 0.02) * (rand() > 0.5 ? 1 : -1),
  }))
  const height = (x: number, y: number, t: number): number => {
    let v = 0
    for (const wv of waves) v += wv.amp * Math.sin(wv.ax * x + wv.ay * y + wv.ph + wv.drift * t)
    return v
  }

  const draw = (t: number) => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const COLS = 110
    const ROWS = Math.max(Math.round((COLS * h) / w), 24)
    const cw = w / COLS
    const ch = h / ROWS
    const aspect = w / h

    // Sample the field once per frame.
    const grid: number[][] = []
    for (let j = 0; j <= ROWS; j++) {
      const row: number[] = []
      for (let i = 0; i <= COLS; i++) row.push(height((i / COLS) * aspect * 1.6, (j / ROWS) * 1.6, t))
      grid.push(row)
    }

    const LEVELS = 14
    ctx.lineWidth = 0.85
    ctx.lineCap = 'round'
    for (let l = 0; l < LEVELS; l++) {
      const iso = -2.1 + (l / (LEVELS - 1)) * 4.2
      // Index contours (every 4th) run slightly heavier, like a real topo sheet.
      ctx.strokeStyle = l % 4 === 0 ? 'rgb(74 60 44 / 0.62)' : 'rgb(74 60 44 / 0.38)'
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

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const still = () => reduced || innerWidth < 1100

  // Static path: draw once, redraw on resize.
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => draw(performance.now() / 1000), 150)
  })
  draw(0)
  if (still()) return

  // Flowing path: ~24fps, only while on-screen and the tab is visible.
  let visible = false
  let raf = 0
  let last = 0
  const loop = (now: number) => {
    raf = 0
    if (!visible || document.visibilityState !== 'visible' || still()) return
    if (now - last >= 42) {
      last = now
      draw(now / 1000)
    }
    raf = requestAnimationFrame(loop)
  }
  const wake = () => {
    if (!raf && visible && document.visibilityState === 'visible' && !still()) {
      raf = requestAnimationFrame(loop)
    }
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible = e.isIntersecting
      wake()
    },
    { rootMargin: '10% 0px' },
  )
  io.observe(canvas)
  document.addEventListener('visibilitychange', wake)
}
