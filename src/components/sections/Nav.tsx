import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { GitHubIcon } from '../ui/BrandIcons'
import { REPO_URL, useStarCount } from '../../lib/github'
import iconUrl from '../../assets/treemap-icon.svg'

export default function Nav() {
  const stars = useStarCount()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 32)
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 pt-3 sm:px-6">
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
