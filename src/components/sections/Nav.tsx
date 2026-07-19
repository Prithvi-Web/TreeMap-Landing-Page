import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { GitHubIcon } from '../ui/BrandIcons'
import { REPO_URL, useStarCount } from '../../lib/github'
import iconUrl from '../../assets/treemap-icon.svg'

export default function Nav({ reduced = false }: { reduced?: boolean }) {
  const stars = useStarCount()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let ticking = false
    let lastY = window.scrollY
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setScrolled(y > 32)
        // Duck out of the way going down, glide back the moment you reverse
        // (§Kinetic 4). Never while the hero is on screen; calm tier keeps
        // the nav pinned in place.
        if (!reduced) {
          const delta = y - lastY
          if (delta > 8 && y > 200) setHidden(true)
          else if (delta < -4 || y <= 200) setHidden(false)
        }
        lastY = y
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  return (
    <header
      // Ducked links stay tabbable (transform ≠ display:none), so the first
      // Tab while hidden must bring the bar back — WCAG 2.4.7 (review finding).
      onFocus={() => setHidden(false)}
      className={`fixed inset-x-0 top-0 z-40 px-4 pt-3 transition-transform duration-300 ease-out sm:px-6 ${
        hidden ? '-translate-y-[115%]' : 'translate-y-0'
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 sm:px-5 ${
          scrolled ? 'glass-soft' : 'border border-transparent'
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5" aria-label="TreeMap — back to top">
          <img src={iconUrl} alt="" width="24" height="24" className="rounded-md" />
          <span className="font-display text-lg font-bold tracking-tight text-white">TreeMap</span>
          <span className="mt-0.5 hidden text-[0.7rem] uppercase tracking-[0.18em] text-muted/70 sm:inline">
            disk visualizer
          </span>
        </a>

        <nav className="flex items-center gap-2.5 sm:gap-3" aria-label="Primary">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-quiet flex items-center gap-2 px-3 py-2 text-sm text-white/90"
          >
            <GitHubIcon className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">GitHub</span>
            {stars !== null && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Star className="h-3 w-3 fill-amber text-amber" aria-hidden="true" />
                {stars.toLocaleString()}
              </span>
            )}
          </a>
          <a href="#get" className="btn-brand px-4 py-2 font-display text-sm font-medium text-white">
            Download
          </a>
        </nav>
      </div>
    </header>
  )
}
