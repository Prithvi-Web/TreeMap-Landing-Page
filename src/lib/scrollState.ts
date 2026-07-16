/**
 * Shared scroll progress (0..1 across the pinned story) held OUTSIDE React
 * state: the R3F scene reads `scrollState.progress` inside useFrame and the
 * DOM overlays subscribe with direct style writes, so per-frame scroll updates
 * never re-render the React tree.
 */
type Listener = (t: number) => void

const listeners = new Set<Listener>()

export const scrollState = {
  progress: 0,
  setProgress(t: number) {
    if (t === this.progress) return
    this.progress = t
    for (const listener of listeners) listener(t)
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    listener(this.progress)
    return () => {
      listeners.delete(listener)
    }
  },
}
