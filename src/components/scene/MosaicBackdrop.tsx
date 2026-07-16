import { useMemo } from 'react'
import { squarify } from '../../lib/squarify'
import { buildDemoData, assignTiers } from '../../lib/demoData'

const TIER_COLOR = { teal: '#2dd4bf', amber: '#fbbf24', rose: '#f43f5e' } as const

/**
 * No-WebGL fallback backdrop: the same squarified layout the 3D scene
 * assembles, drawn as a quiet SVG mosaic. Purely decorative.
 */
export default function MosaicBackdrop() {
  const tiles = useMemo(() => {
    const items = buildDemoData(48)
    const tiers = assignTiers(items)
    return squarify(items, 0, 0, 160, 100).map((r) => ({
      x: r.x,
      y: r.y,
      w: Math.max(r.w - 1.1, 0.8),
      h: Math.max(r.h - 1.1, 0.8),
      color: TIER_COLOR[tiers.get(r.id) ?? 'teal'],
    }))
  }, [])

  return (
    <svg
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-[62%] w-full opacity-[0.16]"
      style={{
        maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
      }}
      aria-hidden="true"
    >
      {tiles.map((t, i) => (
        <rect key={i} x={t.x + 0.55} y={t.y + 0.55} width={t.w} height={t.h} rx="0.7" fill={t.color} />
      ))}
    </svg>
  )
}
