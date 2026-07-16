import { useEffect, useState } from 'react'

export type SceneProfile = {
  /** One cube per treemap rect, so cube identity is stable across all states. */
  cubeCount: number
  dprCap: number
  /** Pinned scroll driver length in px (§7.1, shortened on mobile per §9). */
  scrollLen: number
  fov: number
  layout: { w: number; h: number }
  fogDensity: number
  isMobile: boolean
}

const PROFILES: Array<{ min: number; profile: SceneProfile }> = [
  {
    min: 1280,
    profile: {
      cubeCount: 320,
      dprCap: 2,
      scrollLen: 4500,
      fov: 50,
      layout: { w: 16, h: 10 },
      fogDensity: 0.016,
      isMobile: false,
    },
  },
  {
    min: 768,
    profile: {
      cubeCount: 180,
      dprCap: 1.75,
      scrollLen: 4000,
      fov: 52,
      layout: { w: 14, h: 10 },
      fogDensity: 0.018,
      isMobile: false,
    },
  },
  {
    min: 0,
    profile: {
      cubeCount: 90,
      dprCap: 1.5,
      scrollLen: 3200,
      fov: 58,
      layout: { w: 10, h: 12.5 },
      fogDensity: 0.024,
      isMobile: true,
    },
  },
]

function profileFor(width: number): SceneProfile {
  return PROFILES.find((p) => width >= p.min)!.profile
}

/** Responsive cube count + DPR cap + scroll length (§9). */
export function useSceneProfile(): SceneProfile {
  const [profile, setProfile] = useState(() => profileFor(window.innerWidth))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        // Profiles are shared frozen objects, so this is a no-op re-render
        // unless the breakpoint bucket actually changed.
        setProfile(profileFor(window.innerWidth))
      }, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return profile
}
