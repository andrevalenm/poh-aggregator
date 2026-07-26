/**
 * Style entry for the research section.
 *
 * This module used to carry two playable instruments — a credential-pricing simulator and
 * an age-curve plot. The page has been narrowed to the binary "is a real person there"
 * story, so the pricing/scoring apparatus is gone and nothing in the section is
 * interactive any more. What remains is the section's stylesheet, still loaded here rather
 * than from landing.css: it sits four sections below the fold, so main.ts pulls this in at
 * idle instead of letting it compete with first paint.
 */

import './research.css'
