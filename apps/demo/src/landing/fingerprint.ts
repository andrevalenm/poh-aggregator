/**
 * The signature element: a procedural ink fingerprint that draws itself in, then deforms
 * softly under the cursor like a thumb pressed into wet clay.
 *
 * Deterministic on purpose — the same seed renders the same print on every visit, because a
 * fingerprint that changed between loads would be exactly the wrong metaphor for this
 * product. No image asset: ridges are warped concentric loops with seeded gaps (the
 * minutiae), stroked with per-point jitter so the line reads drawn, not plotted.
 */

const SEED = 0x5eed
const RIDGES = 44
const POINTS = 280
const DRAW_MS = 2400

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

interface Ridge {
  /** Unit-space points (relative to print core, before layout scaling). */
  pts: { x: number; y: number; jx: number; jy: number }[]
  /** θ windows to skip — ridge endings and breaks. */
  gaps: [number, number][]
  width: number
  alpha: number
  /** Stagger window for the draw-in animation, both in [0, 1]. */
  delay: number
  speed: number
  thetaOffset: number
}

function buildRidges(): Ridge[] {
  const rand = mulberry32(SEED)
  // Shared warp harmonics: every ridge follows the same flow, as ridges in a print do.
  // Amplitudes stay small relative to ridge spacing so neighbours never cross — parallel
  // lines are what makes it read as a print instead of a scribble.
  const harmonics = [
    { n: 1, amp: 0.05, phase: rand() * Math.PI * 2 },
    { n: 2, amp: 0.09, phase: rand() * Math.PI * 2 },
    { n: 3, amp: 0.038, phase: rand() * Math.PI * 2 },
    { n: 5, amp: 0.016, phase: rand() * Math.PI * 2 },
  ]

  const ridges: Ridge[] = []
  for (let i = 0; i < RIDGES; i++) {
    const t = 0.1 + (i / (RIDGES - 1)) * 0.9
    // Wobble phase drifts slowly ridge-to-ridge, so fine texture stays coherent between
    // neighbours instead of criss-crossing.
    const wobblePhase = i * 0.5
    const wobbleAmp = t * 0.008
    const pts: Ridge['pts'] = []
    for (let p = 0; p <= POINTS; p++) {
      const theta = (p / POINTS) * Math.PI * 2
      let r = t
      for (const h of harmonics) r += t * h.amp * Math.sin(h.n * theta + h.phase + t * 1.3)
      r += wobbleAmp * Math.sin(7 * theta + wobblePhase)
      // Portrait bias: prints are taller than wide, and pinched toward the base.
      const ex = r * Math.cos(theta) * 0.78
      const ey = r * Math.sin(theta) * (theta > Math.PI ? 0.96 : 1.06)
      // A thumb never lands square — bake in a slight roll.
      const tilt = -0.16
      const x = ex * Math.cos(tilt) - ey * Math.sin(tilt)
      const y = ex * Math.sin(tilt) + ey * Math.cos(tilt)
      pts.push({ x, y, jx: (rand() - 0.5) * 0.0025, jy: (rand() - 0.5) * 0.0025 })
    }
    const gaps: [number, number][] = []
    const gapCount = 1 + Math.floor(rand() * 3)
    for (let g = 0; g < gapCount; g++) {
      const at = rand() * Math.PI * 2
      gaps.push([at, at + 0.05 + rand() * 0.18])
    }
    ridges.push({
      pts,
      gaps,
      width: 0.9 + rand() * 0.5,
      alpha: 0.5 + rand() * 0.35,
      delay: (i / RIDGES) * 0.66 + rand() * 0.08,
      speed: 0.3 + rand() * 0.1,
      thetaOffset: rand() * Math.PI * 2,
    })
  }
  return ridges
}

export function mountFingerprint(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const ridges = buildRidges()

  let w = 0
  let h = 0
  let dpr = 1
  // The print sits right of the copy on wide screens, behind it (faint) on narrow ones.
  let cx = 0
  let cy = 0
  let scale = 1
  let baseAlpha = 1

  const layout = () => {
    dpr = Math.min(devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const narrow = w < 760
    cx = narrow ? w * 0.5 : w * 0.74
    cy = h * 0.52
    scale = narrow ? Math.min(w, h) * 0.52 : Math.min(w * 0.34, h * 0.46)
    baseAlpha = narrow ? 0.3 : 0.85
  }

  const start = performance.now()
  // Lerped pointer state; -1e4 keeps the press-field off-canvas until the pointer arrives.
  let px = -1e4
  let py = -1e4
  let tx = -1e4
  let ty = -1e4
  let pointerIn = false

  const PRESS_RADIUS = 150
  const PRESS_DEPTH = 20

  const draw = (now: number) => {
    const p = reduced ? 1 : Math.min((now - start) / DRAW_MS, 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const pressActive = px > -1e3
    for (const ridge of ridges) {
      const f = Math.min(Math.max((p - ridge.delay) / ridge.speed, 0), 1)
      if (f === 0) continue
      ctx.strokeStyle = `rgb(232 224 210 / ${ridge.alpha * baseAlpha})`
      ctx.lineWidth = ridge.width
      ctx.beginPath()
      let penDown = false
      const visible = Math.floor(ridge.pts.length * f)
      // Each ridge inks from its own start angle; gap checks use the point's true angle.
      const startIdx = Math.floor((ridge.thetaOffset / (Math.PI * 2)) * POINTS)
      for (let i = 0; i < visible; i++) {
        // pts[0] and pts[POINTS] coincide, so drawing straight through the wrap leaves no
        // seam — lifting the pen there would put an identical break in every ridge, which
        // reads as a radial scar across the whole print.
        const idx = (i + startIdx) % ridge.pts.length
        const theta = (idx / POINTS) * Math.PI * 2
        const inGap = ridge.gaps.some(([a, b]) => theta > a && theta < b)
        if (inGap) {
          penDown = false
          continue
        }
        const pt = ridge.pts[idx]!
        let x = cx + (pt.x + pt.jx) * scale
        let y = cy + (pt.y + pt.jy) * scale
        if (pressActive) {
          const dx = x - px
          const dy = y - py
          const d2 = dx * dx + dy * dy
          if (d2 < PRESS_RADIUS * PRESS_RADIUS) {
            const d = Math.sqrt(d2) || 1
            const fall = 1 - d / PRESS_RADIUS
            const push = PRESS_DEPTH * fall * fall
            x += (dx / d) * push
            y += (dy / d) * push
          }
        }
        if (penDown) ctx.lineTo(x, y)
        else {
          ctx.moveTo(x, y)
          penDown = true
        }
      }
      ctx.stroke()
    }
  }

  let raf = 0
  const settled = () => Math.abs(px - tx) < 0.5 && Math.abs(py - ty) < 0.5
  const loop = (now: number) => {
    // Ease the press toward the pointer so the clay feels soft, not magnetic.
    px += (tx - px) * 0.14
    py += (ty - py) * 0.14
    draw(now)
    const animating = now - start < DRAW_MS + 200
    if (animating || pointerIn || !settled()) raf = requestAnimationFrame(loop)
    else raf = 0
  }
  const wake = () => {
    if (!raf && !reduced) raf = requestAnimationFrame(loop)
  }

  const hero = canvas.parentElement!
  hero.addEventListener('pointermove', (e) => {
    if (reduced) return
    const rect = canvas.getBoundingClientRect()
    tx = e.clientX - rect.left
    ty = e.clientY - rect.top
    if (px < -1e3) {
      px = tx
      py = ty
    }
    pointerIn = true
    wake()
  })
  hero.addEventListener('pointerleave', () => {
    pointerIn = false
    tx = -1e4
    ty = -1e4
    wake()
  })

  addEventListener('resize', () => {
    layout()
    if (reduced) draw(performance.now())
    else wake()
  })

  layout()
  if (reduced) draw(performance.now())
  else raf = requestAnimationFrame(loop)
}
