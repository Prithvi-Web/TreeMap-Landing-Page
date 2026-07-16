import type { Firestore } from 'firebase/firestore'

/**
 * Firebase (§11) — Firestore-only, Spark plan, entirely optional. Every value
 * comes from env; when they're absent the site simply hides the notify form
 * and skips click tracking. The SDK is imported lazily on first interaction
 * so it never weighs down the initial bundle.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(config).every(
  (v) => typeof v === 'string' && v.length > 0,
)

let dbPromise: Promise<Firestore> | null = null

function getDb(): Promise<Firestore> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ initializeApp }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ])
      return getFirestore(initializeApp(config))
    })()
  }
  return dbPromise
}

/** Writes to the locked-down `waitlist` collection. Throws on failure so the form can show an inline error. */
export async function addWaitlistEmail(email: string): Promise<void> {
  const db = await getDb()
  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')
  await addDoc(collection(db, 'waitlist'), { email, createdAt: serverTimestamp() })
}

export type Platform = 'windows' | 'macos' | 'linux'

/** Best-effort download counter — never blocks or breaks the actual download link. */
export function trackDownloadClick(platform: Platform): void {
  if (!isFirebaseConfigured) return
  void (async () => {
    try {
      const db = await getDb()
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')
      await addDoc(collection(db, 'downloadClicks'), { platform, createdAt: serverTimestamp() })
    } catch {
      // Analytics are decorative; downloads must never depend on them.
    }
  })()
}
