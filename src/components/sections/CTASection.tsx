import { useLayoutEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import { gsap } from '../../lib/gsapSetup'
import GlassCard from '../ui/GlassCard'
import PlatformButton from '../ui/PlatformButton'
import NotifyForm from '../ui/NotifyForm'
import { AppleIcon, WindowsIcon, LinuxIcon, GitHubIcon } from '../ui/BrandIcons'
import { RELEASES_URL, RUN_FROM_SOURCE_URL, REPO_URL, useStarCount } from '../../lib/github'

export default function CTASection({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const stars = useStarCount()

  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 72%',
          toggleActions: 'play none none reverse',
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="get"
      aria-labelledby="cta-heading"
      className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 pb-32"
    >
      <GlassCard data-reveal className="mx-auto flex max-w-3xl flex-col items-center px-6 py-12 text-center sm:px-12 sm:py-14">
        <h2 id="cta-heading" className="h2-section">
          Get TreeMap.
        </h2>
        <p className="body-lg mt-4 max-w-md">
          Free. Open source. No account, no telemetry, no catch.
        </p>

        <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <PlatformButton
            platform="macos"
            href={RELEASES_URL}
            label="macOS"
            hint=".dmg — latest release"
            icon={AppleIcon}
            primary
          />
          <PlatformButton
            platform="windows"
            href={RELEASES_URL}
            label="Windows"
            hint=".exe — latest release"
            icon={WindowsIcon}
            primary
          />
          <PlatformButton
            platform="linux"
            href={RUN_FROM_SOURCE_URL}
            label="Linux"
            hint="run from source"
            icon={LinuxIcon}
          />
        </div>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
        >
          <GitHubIcon className="h-4 w-4" />
          <span>Star it on GitHub</span>
          {stars !== null && (
            <span className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 fill-amber text-amber" aria-hidden="true" />
              {stars.toLocaleString()}
            </span>
          )}
        </a>

        <NotifyForm />

        <p className="mt-8 text-xs leading-relaxed text-muted/70">
          MIT licensed · Deletes always go to your system Trash · Works fully offline
        </p>
      </GlassCard>
    </section>
  )
}
