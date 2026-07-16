import { useId, useState, type FormEvent } from 'react'
import { addWaitlistEmail, isFirebaseConfigured } from '../../lib/firebase'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Status = 'idle' | 'sending' | 'done' | 'error'

/**
 * "Notify me about new releases" → Firestore `waitlist` (§11). Renders
 * nothing when Firebase isn't configured; fails inline and gracefully when it
 * is. Never gates the download buttons on anything here working.
 */
export default function NotifyForm() {
  const inputId = useId()
  const messageId = useId()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  if (!isFirebaseConfigured) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setStatus('error')
      setMessage('That doesn’t look like an email address — check it and try again.')
      return
    }
    setStatus('sending')
    setMessage('')
    try {
      await addWaitlistEmail(trimmed)
      setStatus('done')
      setMessage('You’re on the list — we’ll email you when a new release ships.')
      setEmail('')
    } catch {
      setStatus('error')
      setMessage('Couldn’t save your email right now. The downloads above still work — try again in a minute.')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 w-full max-w-md">
      <label htmlFor={inputId} className="sr-only">
        Email address for release updates
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id={inputId}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          aria-describedby={message ? messageId : undefined}
          aria-invalid={status === 'error' || undefined}
          className="min-w-0 flex-1 rounded-[14px] border border-white/10 bg-void/60 px-4 py-3 text-[0.95rem] text-white placeholder:text-muted/60 focus:border-teal/60"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="btn-brand shrink-0 px-5 py-3 font-display text-sm font-medium text-white disabled:opacity-60"
        >
          {status === 'sending' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted/70">New-release emails only. No newsletter, ever.</p>
      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-[1.25rem] text-sm ${status === 'error' ? 'text-rose' : 'text-teal'}`}
      >
        {message}
      </p>
    </form>
  )
}
