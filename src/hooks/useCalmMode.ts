import { useMemo } from 'react'
import { useReducedMotion } from './useReducedMotion'
import { hasHardwareWebGL } from '../lib/gpu'

export type CalmMode = {
  /** Present the pre-assembled story: no pin, no scrub, no animation. */
  calm: boolean
  /** Whether to mount the WebGL scene at all. */
  webgl: boolean
}

/**
 * One decision point for the page's two rendering tiers (§8.6):
 * - prefers-reduced-motion → calm layout, static WebGL treemap
 * - software-only WebGL    → calm layout, CSS/SVG backdrop, no canvas
 */
export function useCalmMode(): CalmMode {
  const reducedMotion = useReducedMotion()
  const hardware = useMemo(() => hasHardwareWebGL(), [])
  return { calm: reducedMotion || !hardware, webgl: hardware }
}
