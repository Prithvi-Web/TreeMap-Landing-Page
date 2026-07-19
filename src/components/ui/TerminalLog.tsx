import { useLayoutEffect, useRef } from 'react'
import { gsap } from '../../lib/gsapSetup'

/**
 * A terminal strip that "types" a scan session as it scrolls into view —
 * scrubbed, so scrolling back untypes it. Lines reveal whole (clip-path over
 * real text nodes, never per-character DOM), which keeps screen readers on
 * full sentences while sighted users get the teletype.
 *
 * The numbers are the page's own telemetry: the 412,806-file scan the story
 * section counts up, the app's staged hashing, its 58-day forecast.
 */

type Line = { parts: Array<{ text: string; tone?: 'teal' | 'amber' | 'rose' }> }

const LINES: Line[] = [
  { parts: [{ text: '$ ', tone: 'teal' }, { text: 'treemap scan ~/ --threads 8' }] },
  { parts: [{ text: 'walk    ' }, { text: '412,806', tone: 'amber' }, { text: ' files · ' }, { text: '292 GB', tone: 'amber' }, { text: ' read' }] },
  { parts: [{ text: 'hash    stage-2 sample × ' }, { text: '1,204', tone: 'amber' }, { text: ' · stage-3 full × ' }, { text: '87', tone: 'amber' }] },
  { parts: [{ text: 'dupes   ' }, { text: '37 groups', tone: 'rose' }, { text: ' · ' }, { text: '11.2 GB', tone: 'rose' }, { text: ' reclaimable' }] },
  { parts: [{ text: 'trend   disk full in ' }, { text: '~58 days', tone: 'amber' }, { text: ' at current growth' }] },
  { parts: [{ text: 'done    ' }, { text: '42.7s', tone: 'teal' }, { text: ' — map ready' }] },
]

const TONE: Record<string, string> = {
  teal: 'text-teal',
  amber: 'text-amber',
  rose: 'text-rose',
}

export default function TerminalLog({ reduced }: { reduced: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reduced) return
    const root = rootRef.current
    if (!root) return
    const ctx = gsap.context(() => {
      const lines = root.querySelectorAll<HTMLElement>('[data-log-line]')
      lines.forEach((line, i) => {
        gsap.fromTo(
          line,
          { clipPath: 'inset(0 100% 0 0)' },
          {
            clipPath: 'inset(0 0% 0 0)',
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              // Lines type one after another across the strip's entry.
              start: `top ${88 - i * 5}%`,
              end: `top ${74 - i * 5}%`,
              scrub: true,
            },
          },
        )
      })
    }, root)
    return () => ctx.revert()
  }, [reduced])

  return (
    <div
      ref={rootRef}
      className="glass-soft hud-mono rounded-2xl px-6 py-5 text-[0.72rem] leading-[1.9] text-white/80"
      aria-label="Example scan session"
    >
      {LINES.map((line, i) => (
        <p key={i} data-log-line={reduced ? undefined : ''} className="whitespace-nowrap">
          {line.parts.map((part, k) => (
            <span key={k} className={part.tone ? TONE[part.tone] : undefined}>
              {part.text}
            </span>
          ))}
          {i === LINES.length - 1 && (
            <span className="hud-cursor text-teal" aria-hidden="true">
              {' '}
              ▮
            </span>
          )}
        </p>
      ))}
    </div>
  )
}
