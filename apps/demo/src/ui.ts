/** Tiny DOM helpers. No framework — the app is two panels and a form. */

type Child = Node | string | null | undefined | false
type Props = Record<string, string | number | boolean | EventListener | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    } else if (k === 'class') {
      node.className = String(v)
    } else if (k === 'text') {
      node.textContent = String(v)
    } else {
      node.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    node.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return node
}

export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export const fmtScore = (n: number) => n.toFixed(2)

/**
 * Adapter costs are denominated in cents; show them as money, since that is the point.
 * Never round a decayed cost to a whole dollar — $2.50 displayed as "$3" would overstate a
 * credential we deliberately discounted.
 */
export function fmtCents(cents: number): string {
  if (cents === 0) return '$0'
  const dollars = cents / 100
  const whole = Math.abs(dollars % 1) < 0.005
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/**
 * Stable colour per trust root. The saturation story is visual: credentials sharing a colour
 * are one piece of evidence seen more than once.
 */
const ROOT_HUES = new Map<string, number>()
let nextHue = 0
export function rootHue(root: string): number {
  let hue = ROOT_HUES.get(root)
  if (hue === undefined) {
    hue = [212, 22, 152, 288, 44, 328, 178][nextHue % 7]!
    nextHue += 1
    ROOT_HUES.set(root, hue)
  }
  return hue
}

export function rootChip(root: string, extra = ''): HTMLElement {
  const hue = rootHue(root)
  const chip = h('span', { class: `root-chip ${extra}`.trim(), title: root }, root)
  chip.style.setProperty('--hue', String(hue))
  return chip
}

export function freshnessLabel(freshness: number, issuedAt?: number): string {
  if (issuedAt === undefined) return 'age unknown — no decay applied'
  const days = Math.round((Date.now() / 1000 - issuedAt) / 86_400)
  return `issued ${days}d ago · freshness ×${freshness.toFixed(2)}`
}
