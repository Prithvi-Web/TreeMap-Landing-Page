import { useLayoutEffect, useRef } from 'react'
import { GitHubIcon } from '../ui/BrandIcons'
import { gsap } from '../../lib/gsapSetup'
import { REPO_URL, ISSUES_URL, RELEASES_URL } from '../../lib/github'
import iconUrl from '../../assets/treemap-icon.svg'

export default function Footer({ reduced }: { reduced: boolean }) {
  const footerRef = useRef<HTMLElement>(null)

  // Curtain reveal (§Kinetic 4): the brand rule draws across, then the row
  // eases up into place — both scrubbed to the footer's entry.
  useLayoutEffect(() => {
    if (reduced) return
    const footer = footerRef.current
    if (!footer) return
    const ctx = gsap.context(() => {
      // End at 'bottom bottom' — the last scrollable pixel — because the
      // footer is short: a 'top NN%' end below ~88% of the viewport is
      // physically unreachable and would freeze the reveal mid-way.
      gsap.fromTo(
        '.hr-brand',
        { scaleX: 0, transformOrigin: '0 50%' },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: true },
        },
      )
      gsap.fromTo(
        '[data-footer-row]',
        { y: 34, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          ease: 'power2.out',
          scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: true },
        },
      )
    }, footer)
    return () => ctx.revert()
  }, [reduced])

  return (
    <footer ref={footerRef} className="relative z-10 border-t border-white/[0.06] bg-void/60 backdrop-blur-sm">
      <div className="hr-brand" aria-hidden="true" />
      <div
        data-footer-row
        className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left"
      >
        <div className="flex items-center gap-2.5">
          <img src={iconUrl} alt="" width="20" height="20" className="rounded" />
          <span className="font-display text-sm font-bold text-white">TreeMap</span>
          <span className="text-xs text-muted/70">MIT © 2026 Prithvi Vinay</span>
        </div>

        <p className="max-w-xs text-xs leading-relaxed text-muted/70 sm:max-w-none">
          Every delete goes to the OS Trash. Zero telemetry, no account, works offline.
        </p>

        <nav aria-label="Footer" className="flex items-center gap-5 text-sm text-muted">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
            Releases
          </a>
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
            Report an issue
          </a>
        </nav>
      </div>
    </footer>
  )
}
