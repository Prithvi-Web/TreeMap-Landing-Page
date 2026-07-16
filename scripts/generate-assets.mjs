/**
 * Generates the favicon assets (§12) from the real app icon:
 *   public/favicon.ico          32+16 multi-size
 *   public/apple-touch-icon.png 180×180
 *
 * Note: public/og-image.png is authored separately (browser-canvas render of
 * the same brand design — see the design constants below; opentype.js parses
 * a couple of Space Grotesk glyphs incorrectly, so the committed PNG is the
 * source of truth). Passing --og regenerates the fallback vector version.
 *
 * Run: npm run assets   (Node 22.18+ — imports the .ts modules directly)
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import opentype from 'opentype.js'
import { squarify } from '../src/lib/squarify.ts'
import { buildDemoData, assignTiers } from '../src/lib/demoData.ts'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pub = (...p) => path.join(root, 'public', ...p)

const COLORS = {
  void: '#0a0f1c',
  base: '#0b1220',
  teal: '#2dd4bf',
  amber: '#fbbf24',
  rose: '#f43f5e',
  muted: '#cbd5e1',
}

function loadFont(file) {
  return readFile(
    path.join(root, 'node_modules', '@fontsource', 'space-grotesk', 'files', file),
  ).then((buf) => opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
}

function textPath(font, text, x, y, size, fill) {
  // Per-character paths: opentype.js's shaping pass mangles one of Space
  // Grotesk's substitution glyphs, so skip GSUB entirely and hand-advance.
  const scale = size / font.unitsPerEm
  let cursor = x
  let d = ''
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    d += glyph.getPath(cursor, y, size).toPathData(2)
    cursor += (glyph.advanceWidth ?? font.unitsPerEm * 0.28) * scale
  }
  return `<path d="${d}" fill="${fill}"/>`
}

async function generateOg() {
  const bold = await loadFont('space-grotesk-latin-700-normal.woff')
  const medium = await loadFont('space-grotesk-latin-500-normal.woff')

  // Real squarified mini-treemap for the right side.
  const items = buildDemoData(48)
  const tiers = assignTiers(items)
  const rects = squarify(items, 0, 0, 440, 470)
  const tiles = rects
    .map((r) => {
      const pad = 2.5
      const w = Math.max(r.w - pad * 2, 2)
      const h = Math.max(r.h - pad * 2, 2)
      const color = COLORS[tiers.get(r.id) ?? 'teal']
      return `<rect x="${(700 + r.x + pad).toFixed(1)}" y="${(80 + r.y + pad).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${color}"/>`
    })
    .join('\n    ')

  const icon = await readFile(path.join(root, 'src', 'assets', 'treemap-icon.svg'), 'utf8')
  const iconB64 = Buffer.from(icon).toString('base64')

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glowTeal" cx="0.12" cy="0.0" r="0.75">
      <stop offset="0%" stop-color="${COLORS.teal}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${COLORS.teal}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowRose" cx="0.95" cy="1.05" r="0.8">
      <stop offset="0%" stop-color="${COLORS.rose}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${COLORS.rose}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="divider" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${COLORS.teal}" stop-opacity="0"/>
      <stop offset="0.18" stop-color="${COLORS.teal}"/>
      <stop offset="0.5" stop-color="${COLORS.amber}"/>
      <stop offset="0.82" stop-color="${COLORS.rose}"/>
      <stop offset="1" stop-color="${COLORS.rose}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M 72 0 L 0 0 0 72" fill="none" stroke="#1c2740" stroke-width="1" opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${COLORS.void}"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glowTeal)"/>
  <rect width="1200" height="630" fill="url(#glowRose)"/>

  <image x="72" y="96" width="84" height="84" href="data:image/svg+xml;base64,${iconB64}"/>
  ${textPath(bold, 'TreeMap', 180, 162, 76, '#ffffff')}

  ${textPath(bold, 'See exactly where your', 72, 300, 56, '#ffffff')}
  ${textPath(bold, 'disk space went.', 72, 368, 56, '#ffffff')}

  ${textPath(medium, 'Every file, sized and colored by what it costs you.', 72, 432, 24, COLORS.muted)}

  <rect x="72" y="486" width="420" height="3" fill="url(#divider)"/>
  ${textPath(medium, 'FREE  ·  OPEN SOURCE  ·  MACOS  ·  WINDOWS  ·  LINUX', 72, 540, 22, COLORS.muted)}

  ${tiles}
</svg>`

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pub('og-image.png'))
  console.log('✓ public/og-image.png')
}

async function generateIcons() {
  const iconSvg = await readFile(pub('favicon.svg'))
  const png = (size) => sharp(iconSvg, { density: 300 }).resize(size, size).png().toBuffer()

  await writeFile(pub('favicon.ico'), await pngToIco([await png(32), await png(16)]))
  console.log('✓ public/favicon.ico')

  await sharp(iconSvg, { density: 300 }).resize(180, 180).png().toFile(pub('apple-touch-icon.png'))
  console.log('✓ public/apple-touch-icon.png')
}

if (process.argv.includes('--og')) {
  await generateOg()
}
await generateIcons()
