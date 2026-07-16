import type { HTMLAttributes } from 'react'

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Marks the card for the section's scroll-reveal animation. */
  'data-reveal'?: boolean
}

/** Glassmorphic surface per §10 — dark translucent panel with a top-edge highlight. */
export default function GlassCard({ className = '', children, ...rest }: GlassCardProps) {
  return (
    <div className={`glass ${className}`} {...rest}>
      {children}
    </div>
  )
}
