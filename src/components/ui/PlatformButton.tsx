import type { ComponentType, SVGProps } from 'react'
import { trackDownloadClick, type Platform } from '../../lib/firebase'

type PlatformButtonProps = {
  platform: Platform
  href: string
  label: string
  hint: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  primary?: boolean
}

/**
 * Windows / macOS / Linux download buttons (§10). Windows & macOS point at
 * the GitHub releases page (filenames change per version — never hardcode
 * one); Linux is honestly labeled "run from source" and links to the README
 * section, since prebuilt Linux binaries aren't guaranteed today.
 */
export default function PlatformButton({
  platform,
  href,
  label,
  hint,
  icon: Icon,
  primary = false,
}: PlatformButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackDownloadClick(platform)}
      className={`${primary ? 'btn-brand' : 'btn-quiet'} flex w-full items-center gap-3.5 px-5 py-3.5 sm:w-auto`}
    >
      <Icon className="h-6 w-6 shrink-0 text-white/90" />
      <span className="flex flex-col text-left">
        <span className="font-display text-[0.95rem] font-medium leading-tight text-white">{label}</span>
        <span className="text-xs leading-tight text-muted">{hint}</span>
      </span>
    </a>
  )
}
