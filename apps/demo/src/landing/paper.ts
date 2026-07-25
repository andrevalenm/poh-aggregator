/**
 * The ground of the whole page: a sheet of flecked cotton paper, generated.
 *
 * The reference sites that feel "human" get there by using *scanned photographs* of real
 * paper as their backgrounds. We can't ship a scan, so we synthesize what a scan actually
 * contains: uneven pulp luminance (large soft blotches), embedded fibre flecks (short
 * dark hairs at random angles), round specks, and a faint edge vignette. Drawn once per
 * resize onto a fixed canvas that sits under everything; seeded, so the sheet is the same
 * sheet on every visit.
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

export function mountPaper(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const draw = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = innerWidth
    const h = innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const rand = mulberry32(0x9a9e12)

    // Base sheet.
    ctx.fillStyle = '#ede7da'
    ctx.fillRect(0, 0, w, h)

    // Uneven pulp: large, very soft blotches a couple of percent lighter and darker.
    for (let i = 0; i < 14; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = (0.2 + rand() * 0.35) * Math.max(w, h)
      const lighter = rand() > 0.5
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, lighter ? 'rgb(255 252 242 / 0.05)' : 'rgb(160 140 110 / 0.045)')
      g.addColorStop(1, 'rgb(0 0 0 / 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    // Fibre flecks: short hairs at random angles, the signature of recycled cotton.
    const flecks = Math.round((w * h) / 900)
    for (let i = 0; i < flecks; i++) {
      const x = rand() * w
      const y = rand() * h
      const len = 0.6 + rand() * 3.4
      const ang = rand() * Math.PI
      const dark = rand()
      ctx.strokeStyle =
        dark > 0.92
          ? `rgb(70 58 44 / ${0.18 + rand() * 0.2})`
          : dark > 0.55
            ? `rgb(138 122 98 / ${0.1 + rand() * 0.16})`
            : `rgb(170 152 120 / ${0.08 + rand() * 0.1})`
      ctx.lineWidth = 0.5 + rand() * 0.7
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
      ctx.stroke()
    }

    // Round specks.
    const specks = Math.round((w * h) / 6000)
    for (let i = 0; i < specks; i++) {
      const x = rand() * w
      const y = rand() * h
      ctx.fillStyle = `rgb(112 96 74 / ${0.08 + rand() * 0.14})`
      ctx.beginPath()
      ctx.arc(x, y, 0.4 + rand() * 0.9, 0, Math.PI * 2)
      ctx.fill()
    }

    // Faint vignette — a sheet is always a touch darker at its edges.
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72)
    v.addColorStop(0, 'rgb(0 0 0 / 0)')
    v.addColorStop(1, 'rgb(96 80 60 / 0.05)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, w, h)
  }

  draw()
  let t: ReturnType<typeof setTimeout> | undefined
  addEventListener('resize', () => {
    clearTimeout(t)
    t = setTimeout(draw, 150)
  })
}
