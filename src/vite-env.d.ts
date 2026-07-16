/// <reference types="vite/client" />

// Self-hosted fonts (§3) resolve to CSS at build time; declare them for
// TS7's noUncheckedSideEffectImports.
declare module '@fontsource-variable/inter'
declare module '@fontsource/space-grotesk/500.css'
declare module '@fontsource/space-grotesk/700.css'

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
