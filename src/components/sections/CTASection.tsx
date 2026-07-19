import { useLayoutEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import { gsap, SplitText } from '../../lib/gsapSetup'
import GlassCard from '../ui/GlassCard'
import PlatformButton from '../ui/PlatformButton'
import NotifyForm from '../ui/NotifyForm'
import { AppleIcon, WindowsIcon, LinuxIcon, GitHubIcon } from '../ui/BrandIcons'
import { RELEASES_URL, RUN_FROM_SOURCE_URL, REPO_URL, useStarCount } from '../../lib/github'

/**
 * The closer (§Kinetic 4): the card scales up out of the settled treemap,
 * "Get TreeMap." flips in character by character, the platform buttons
 * cascade, and the star count ticks up from zero.
 */
export default function CTASection({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const starRef = useRef<HTMLSpanElement>(null)
  const stars = useStarCount()

  useLayoutEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    if (!section) return
    let split: SplitText | null = null
    const ctx = gsap.context(() => {
      // Card entrance: scale + rise, scrubbed so it rewinds.
      gsap.fromTo(
        '[data-cta-card]',
        { scale: 0.94, y: 56, autoAlpha: 0 },
        {
          scale: 1,
          y: 0,
          autoAlpha: 1,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 95%', end: 'top 55%', scrub: true },
        },
      )

      // Headline chars flip up out of a mask.
      const h2 = section.querySelector('h2')
      if (h2) {
        split = new SplitText(h2, { type: 'chars', mask: 'chars' })
        gsap.fromTo(
          split.chars,
          { yPercent: 120, rotationX: -60, transformOrigin: '50% 100% -14px' },
          {
            yPercent: 0,
            rotationX: 0,
            stagger: 0.035,
            ease: 'power3.out',
            scrollTrigger: { trigger: section, start: 'top 88%', end: 'top 52%', scrub: true },
          },
        )
      }

      // Buttons + links: quick one-shot cascade once the card is readable.
      gsap.from('[data-cta-cascade] > *', {
        y: 22,
        autoAlpha: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 62%',
          toggleActions: 'play none none reverse',
        },
      })
    }, section)
    return () => {
      split?.revert()
      ctx.revert()
    }
  }, [reduced])

  // Star count-up: 0 → live count the first time it scrolls into view.
  useLayoutEffect(() => {
    if (reduced || stars === null || !starRef.current) return
    const counter = { value: 0 }
    const tween = gsap.to(counter, {
      value: stars,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => {
        if (starRef.current) starRef.current.textContent = Math.round(counter.value).toLocaleString()
      },
      scrollTrigger: {
        trigger: starRef.current,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [reduced, stars])

  return (
    <section
      ref={sectionRef}
      id="get"
      aria-labelledby="cta-heading"
      className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 pb-32"
    >
      <GlassCard
        data-cta-card
        className="mx-auto flex max-w-3xl flex-col items-center px-6 py-12 text-center sm:px-12 sm:py-14"
      >
        <h2 id="cta-heading" className="h2-section">
          Get TreeMap.
        </h2>
        <p className="body-lg mt-4 max-w-md">Free. Open source. No account, no telemetry, no catch.</p>

        <div data-cta-cascade className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
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
              <span ref={starRef}>{stars.toLocaleString()}</span>
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
