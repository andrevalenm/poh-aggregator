import './style.css'
import { DEFAULT_REGISTRY, makeClient } from './client.ts'
import { mountPaper } from './landing/paper.ts'
import { renderComparison } from './compare.ts'
import { wireLookup } from './lookup.ts'
import { h, shortAddr } from './ui.ts'

async function paintRegistryLine(): Promise<void> {
  const el = document.getElementById('registry-line')
  if (!el) return
  try {
    const { adapters, revision } = await makeClient().ontology()
    const roots = new Set([...adapters.values()].map((a) => a.trustRoot))
    el.textContent = ''
    el.append(
      `${adapters.size} adapters collapsing to ${roots.size} trust roots · registry `,
      h('code', {}, shortAddr(DEFAULT_REGISTRY)),
      ` on Sepolia · revision ${revision}`,
    )
  } catch (err) {
    el.textContent = `Registry unreachable (${err instanceof Error ? err.message : String(err)}). The panels below will say so rather than guess.`
    el.classList.add('is-error')
  }
}

const paper = document.getElementById('paper')
if (paper instanceof HTMLCanvasElement) mountPaper(paper)

const columns = document.getElementById('compare-columns')
if (columns) void renderComparison(columns)
void paintRegistryLine()
wireLookup()
