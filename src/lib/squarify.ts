export type TreemapItem = { id: string; value: number }
export type TreemapRect = { id: string; value: number; x: number; y: number; w: number; h: number }

/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk) — the same layout
 * concept the real TreeMap app uses. Greedily grows each row while the worst
 * aspect ratio keeps improving, then recurses into the remaining space.
 */
export function squarify(
  items: TreemapItem[],
  x: number,
  y: number,
  w: number,
  h: number,
): TreemapRect[] {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, i) => s + i.value, 0)
  if (total <= 0 || w <= 0 || h <= 0) return []
  const results: TreemapRect[] = []
  layoutRow(sorted, total, x, y, w, h, results)
  return results
}

function layoutRow(
  items: TreemapItem[],
  total: number,
  x: number,
  y: number,
  w: number,
  h: number,
  out: TreemapRect[],
) {
  if (items.length === 0 || total <= 0) return
  const horizontal = w >= h
  const length = horizontal ? h : w
  let row: TreemapItem[] = []
  let rowValue = 0
  let bestWorst = Infinity
  let i = 0

  while (i < items.length) {
    const item = items[i]
    const testRow = [...row, item]
    const testValue = rowValue + item.value
    const worst = worstAspect(testRow, testValue, total, length)
    if (row.length === 0 || worst <= bestWorst) {
      row = testRow
      rowValue = testValue
      bestWorst = worst
      i++
    } else {
      break
    }
  }

  const rowSize = (rowValue / total) * (horizontal ? w : h)
  let offset = 0
  for (const item of row) {
    const itemLength = (item.value / rowValue) * length
    if (horizontal) {
      out.push({ id: item.id, value: item.value, x, y: y + offset, w: rowSize, h: itemLength })
    } else {
      out.push({ id: item.id, value: item.value, x: x + offset, y, w: itemLength, h: rowSize })
    }
    offset += itemLength
  }

  const remaining = items.slice(row.length)
  if (horizontal) layoutRow(remaining, total - rowValue, x + rowSize, y, w - rowSize, h, out)
  else layoutRow(remaining, total - rowValue, x, y + rowSize, w, h - rowSize, out)
}

function worstAspect(row: TreemapItem[], rowValue: number, total: number, length: number): number {
  const rowSize = (rowValue / total) * length
  let worst = 0
  for (const item of row) {
    const itemLength = (item.value / rowValue) * length
    const aspect = Math.max(rowSize / itemLength, itemLength / rowSize)
    worst = Math.max(worst, aspect)
  }
  return worst
}
