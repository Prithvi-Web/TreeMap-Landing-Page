import { mulberry32 } from './random.ts'

export type DemoItem = {
  id: string
  name: string
  /** "File size" in GB — drives both treemap area and color tier. */
  value: number
}

/**
 * A fake "scanned disk" that reads like a real, cluttered Mac/PC. The big
 * hand-authored offenders anchor the treemap; deterministic filler rounds the
 * set out to MAX_ITEMS so the chaos cloud has satisfying density.
 */
const HEADLINE_ITEMS: Array<[string, number]> = [
  ['Steam/steamapps', 40.2],
  ['Photos Library.photoslibrary', 31.0],
  ['Docker Desktop.vmdk', 22.4],
  ['System Data', 18.3],
  ['Movies/render_final_v3.mov', 14.8],
  ['dev/monorepo/node_modules', 14.2],
  ['Xcode DerivedData', 9.8],
  ['VMs/Windows11.utm', 9.1],
  ['iOS Backups/iPhone 14', 7.6],
  ['Downloads', 6.1],
  ['Adobe Media Cache', 5.7],
  ['Library/Application Support', 5.2],
  ['Music/Ableton/Samples', 4.8],
  ['Final Cut Render Files', 4.4],
  ['~/Library/Caches', 3.4],
  ['Downloads/Xcode_15.4.xip', 3.2],
  ['dev/side-project/node_modules', 2.9],
  ['Spotify Cache', 2.7],
  ['Google Drive (local copies)', 2.6],
  ['Desktop/old-desktop-backup', 2.4],
  ['Documents', 2.1],
  ['Homebrew Cellar', 2.0],
  ['Movies/screen-recordings', 1.9],
  ['Mail Attachments', 1.8],
  ['Pictures/screenshots-2019-2026', 1.7],
  ['dev/client-work/node_modules', 1.6],
  ['CocoaPods Cache', 1.5],
  ['Slack Cache', 1.4],
  ['Chrome Profile', 1.3],
  ['npm cache (_cacache)', 1.25],
  ['Zoom Recordings', 1.2],
  ['Android/sdk/system-images', 1.15],
  ['Books/audiobooks', 1.1],
  ['pip cache', 1.05],
  ['dev/legacy-app/.git', 1.0],
  ['Notion Cache', 0.95],
  ['Downloads/ubuntu-24.04.iso', 0.92],
  ['Telegram Media', 0.88],
  ['Logs/DiagnosticReports', 0.85],
  ['Discord Cache', 0.8],
  ['WhatsApp Backups', 0.76],
  ['Fonts (unused foundry pack)', 0.72],
  ['Podcasts/downloaded', 0.68],
  ['dev/experiments/target (rust)', 0.65],
  ['VS Code extensions', 0.6],
  ['Keynote decks 2022-2026', 0.56],
  ['Time Machine local snapshots', 0.53],
  ['Downloads/fonts.zip', 0.5],
  ['Old Firefox Profile', 0.47],
  ['Sketch autosaves', 0.44],
  ['Trash', 0.4],
  ['Screensaver videos', 0.37],
  ['Printer drivers (2014)', 0.34],
  ['Sample packs/808s', 0.31],
  ['Saved Application State', 0.28],
  ['Language packs', 0.25],
]

const FILLER_PREFIXES = [
  'Caches/com.apple.',
  'Caches/com.adobe.',
  'Downloads/',
  'Documents/archive/',
  'Pictures/imports/',
  'Movies/clips/',
  'Library/Logs/',
  'dev/scratch/',
  'Music/bounces/',
  'Desktop/misc/',
]

const FILLER_STEMS = [
  'installer.dmg',
  'backup.zip',
  'IMG_4402.HEIC',
  'clip-export.mp4',
  'dataset.csv',
  'debug.log',
  'texture-pack',
  'voice-memo.m4a',
  'invoice-scan.pdf',
  'build-artifacts',
  'session.aif',
  'wireframes.fig',
  'raw-photos',
  'update.pkg',
  'notes-export.html',
  'recording.mov',
]

export const MAX_ITEMS = 320

function buildFullSet(): DemoItem[] {
  const items: DemoItem[] = HEADLINE_ITEMS.map(([name, value], i) => ({
    id: `h${i}`,
    name,
    value,
  }))

  const rng = mulberry32(0x7eee_a201)
  for (let i = items.length; i < MAX_ITEMS; i++) {
    const prefix = FILLER_PREFIXES[Math.floor(rng() * FILLER_PREFIXES.length)]
    const stem = FILLER_STEMS[Math.floor(rng() * FILLER_STEMS.length)]
    // Log-ish distribution, mostly 0.05–0.25 GB with a tail up to ~0.9 GB:
    // enough variance that the small-file mosaic reads organic, never
    // competing with the headline offenders.
    const value = 0.03 + Math.pow(rng(), 2.8) * 0.9
    items.push({ id: `f${i}`, name: `${prefix}${stem}-${i}`, value })
  }
  return items
}

const FULL_SET = buildFullSet()

/** Top `count` items by size — headline offenders always survive the cut. */
export function buildDemoData(count: number): DemoItem[] {
  const n = Math.max(1, Math.min(count, FULL_SET.length))
  return [...FULL_SET].sort((a, b) => b.value - a.value).slice(0, n)
}

export type ColorTier = 'teal' | 'amber' | 'rose'

/**
 * Size-tier coloring, matching the real app: the biggest offenders are rose
 * ("reclaim this"), mid-weights amber, the long tail teal. Tiers are weighted
 * by cumulative AREA share, not item count — a head-heavy dataset would
 * otherwise paint nearly the whole map rose.
 */
export function assignTiers(items: DemoItem[]): Map<string, ColorTier> {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, i) => s + i.value, 0)
  const tiers = new Map<string, ColorTier>()
  let cum = 0
  for (const item of sorted) {
    cum += item.value
    tiers.set(item.id, cum <= total * 0.3 ? 'rose' : cum <= total * 0.62 ? 'amber' : 'teal')
  }
  return tiers
}
