import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * True when the OS asks for reduced motion (§8.6). `?rm` in the URL forces it
 * on so the calm fallback can be exercised without changing OS settings.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia(QUERY).matches || hasOverride(),
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setReduced(mq.matches || hasOverride())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}

function hasOverride(): boolean {
  return new URLSearchParams(window.location.search).has('rm')
}
