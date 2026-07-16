import { useEffect, useState } from 'react'

const REPO = 'Prithvi-Web/TreeMap-Disk-Visualizer'

export const REPO_URL = `https://github.com/${REPO}`
export const RELEASES_URL = `${REPO_URL}/releases/latest`
export const ISSUES_URL = `${REPO_URL}/issues`
/** Verified anchor of the README's "Run from source / web mode" section. */
export const RUN_FROM_SOURCE_URL = `${REPO_URL}#-run-from-source--web-mode-3-commands`

const CACHE_KEY = 'treemap-stars'

async function fetchStarCount(): Promise<number | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached !== null) {
      const n = Number(cached)
      return Number.isFinite(n) ? n : null
    }
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { stargazers_count?: unknown }
    if (typeof data.stargazers_count !== 'number') return null
    sessionStorage.setItem(CACHE_KEY, String(data.stargazers_count))
    return data.stargazers_count
  } catch {
    return null // Offline or rate-limited: the star pill just doesn't render.
  }
}

/** Live star count, silently absent on any failure. */
export function useStarCount(): number | null {
  const [stars, setStars] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    void fetchStarCount().then((n) => {
      if (active && n !== null) setStars(n)
    })
    return () => {
      active = false
    }
  }, [])
  return stars
}
