/**
 * Example 6: Unit converter
 *
 * A comprehensive unit conversion toolkit with React display components.
 * Demonstrates: pure functions, display() for results, ask() for input, domain-specific tools.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/06-converter.tsx -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/06-converter.tsx -m openai:gpt-4o-mini -d debug-run.xml
 */

import React from 'react'

// ── Conversion tables ──

const LENGTH: Record<string, number> = {
  mm: 0.001, cm: 0.01, m: 1, km: 1000,
  inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344,
}

const WEIGHT: Record<string, number> = {
  mg: 0.001, g: 1, kg: 1000,
  oz: 28.3495, lb: 453.592, ton: 907185,
}

const TEMPERATURE_NAMES: Record<string, string> = {
  c: 'Celsius', f: 'Fahrenheit', k: 'Kelvin',
  celsius: 'Celsius', fahrenheit: 'Fahrenheit', kelvin: 'Kelvin',
}

const VOLUME: Record<string, number> = {
  ml: 0.001, l: 1, gal: 3.78541, qt: 0.946353, cup: 0.236588,
  floz: 0.0295735, tbsp: 0.0147868, tsp: 0.00492892,
}

const SPEED: Record<string, number> = {
  'km/h': 1, 'mph': 1.60934, 'm/s': 3.6, knot: 1.852,
}

const CATEGORY_ICONS: Record<string, string> = {
  length: '📏', weight: '⚖️', temperature: '🌡️', volume: '🧪', speed: '🏎️',
}

// ── React Components ──

/** Display a conversion result */
export function ConversionResult({ value, from, to, result, formatted, category }: {
  value: number; from: string; to: string; result: number; formatted: string; category: string
}) {
  const icon = CATEGORY_ICONS[category] ?? '🔄'
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 400, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>{icon} {category}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', margin: '12px 0' }}>
        {formatted}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, color: '#666', fontSize: 13 }}>
        <span>{value} {from}</span>
        <span>→</span>
        <span>{result} {to}</span>
      </div>
    </div>
  )
}

/** Display available units for a category */
export function UnitTable({ category, units }: { category: string; units: string[] }) {
  const icon = CATEGORY_ICONS[category] ?? '🔄'
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 320, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{icon} {category} units</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {units.map(u => (
          <span key={u} style={{ padding: '4px 10px', background: '#f0f0f0', borderRadius: 12, fontSize: 13 }}>{u}</span>
        ))}
      </div>
    </div>
  )
}

/** Display all categories as a grid */
export function CategoryGrid({ categories }: { categories: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: 'sans-serif' }}>
      {categories.map(cat => {
        const icon = CATEGORY_ICONS[cat] ?? '🔄'
        return (
          <div key={cat} style={{ border: '1px solid #ccc', borderRadius: 8, padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{icon}</div>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>{cat}</div>
          </div>
        )
      })}
    </div>
  )
}

/** Form to ask the user for a conversion */
export function ConversionForm({ categories }: { categories: string[] }) {
  return (
    <div>
      <div style={{ marginBottom: 12, fontWeight: 'bold' }}>🔄 Convert units</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Value</label>
        <input name="value" type="number" placeholder="Enter a number" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>From</label>
          <input name="from" type="text" placeholder="e.g. km" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>To</label>
          <input name="to" type="text" placeholder="e.g. mile" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Category</label>
        <select name="category" defaultValue="" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }}>
          <option value="">Auto-detect</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] ?? '🔄'} {c}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Exported functions ──

/** Convert between length units */
export function convertLength(value: number, from: string, to: string): { result: number; formatted: string } | null {
  const fromFactor = LENGTH[from.toLowerCase()]
  const toFactor = LENGTH[to.toLowerCase()]
  if (!fromFactor || !toFactor) return null
  const result = (value * fromFactor) / toFactor
  return { result: Math.round(result * 10000) / 10000, formatted: `${value} ${from} = ${Math.round(result * 10000) / 10000} ${to}` }
}

/** Convert between weight/mass units */
export function convertWeight(value: number, from: string, to: string): { result: number; formatted: string } | null {
  const fromFactor = WEIGHT[from.toLowerCase()]
  const toFactor = WEIGHT[to.toLowerCase()]
  if (!fromFactor || !toFactor) return null
  const result = (value * fromFactor) / toFactor
  return { result: Math.round(result * 10000) / 10000, formatted: `${value} ${from} = ${Math.round(result * 10000) / 10000} ${to}` }
}

/** Convert between temperature scales */
export function convertTemperature(value: number, from: string, to: string): { result: number; formatted: string } | null {
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  let celsius: number

  if (f === 'c' || f === 'celsius') celsius = value
  else if (f === 'f' || f === 'fahrenheit') celsius = (value - 32) * 5 / 9
  else if (f === 'k' || f === 'kelvin') celsius = value - 273.15
  else return null

  let result: number
  if (t === 'c' || t === 'celsius') result = celsius
  else if (t === 'f' || t === 'fahrenheit') result = celsius * 9 / 5 + 32
  else if (t === 'k' || t === 'kelvin') result = celsius + 273.15
  else return null

  result = Math.round(result * 100) / 100
  const fromName = TEMPERATURE_NAMES[f] ?? from
  const toName = TEMPERATURE_NAMES[t] ?? to
  return { result, formatted: `${value}° ${fromName} = ${result}° ${toName}` }
}

/** Convert between volume units */
export function convertVolume(value: number, from: string, to: string): { result: number; formatted: string } | null {
  const fromFactor = VOLUME[from.toLowerCase()]
  const toFactor = VOLUME[to.toLowerCase()]
  if (!fromFactor || !toFactor) return null
  const result = (value * fromFactor) / toFactor
  return { result: Math.round(result * 10000) / 10000, formatted: `${value} ${from} = ${Math.round(result * 10000) / 10000} ${to}` }
}

/** Convert between speed units */
export function convertSpeed(value: number, from: string, to: string): { result: number; formatted: string } | null {
  const fromFactor = SPEED[from.toLowerCase()]
  const toFactor = SPEED[to.toLowerCase()]
  if (!fromFactor || !toFactor) return null
  const result = (value * fromFactor) / toFactor
  return { result: Math.round(result * 10000) / 10000, formatted: `${value} ${from} = ${Math.round(result * 10000) / 10000} ${to}` }
}

/** List available units for a category */
export function listUnits(category: 'length' | 'weight' | 'temperature' | 'volume' | 'speed'): string[] {
  switch (category) {
    case 'length': return Object.keys(LENGTH)
    case 'weight': return Object.keys(WEIGHT)
    case 'temperature': return ['C', 'F', 'K']
    case 'volume': return Object.keys(VOLUME)
    case 'speed': return Object.keys(SPEED)
  }
}

/** List all supported categories */
export function listCategories(): string[] {
  return ['length', 'weight', 'temperature', 'volume', 'speed']
}

// ── CLI config ──

export const replConfig = {
  instruct: `You are a unit conversion assistant with rich display components. Convert between any supported units and present results visually:
- display(<ConversionResult value={n} from="unit" to="unit" result={r} formatted="..." category="..." />) to show a conversion
- display(<UnitTable category="length" units={unitList} />) to show available units
- display(<CategoryGrid categories={cats} />) to show all categories
- var input = await ask(<ConversionForm categories={cats} />) to ask the user for a conversion (returns { value, from, to, category })
If the user's request is ambiguous, use stop() to check available units first.`,
  functionSignatures: `
  convertLength(value: number, from: string, to: string): { result, formatted } | null — Convert length (mm, cm, m, km, inch, foot, yard, mile)
  convertWeight(value: number, from: string, to: string): { result, formatted } | null — Convert weight (mg, g, kg, oz, lb, ton)
  convertTemperature(value: number, from: string, to: string): { result, formatted } | null — Convert temperature (C, F, K)
  convertVolume(value: number, from: string, to: string): { result, formatted } | null — Convert volume (ml, l, gal, qt, cup, floz, tbsp, tsp)
  convertSpeed(value: number, from: string, to: string): { result, formatted } | null — Convert speed (km/h, mph, m/s, knot)
  listUnits(category): string[] — List available units for a category
  listCategories(): string[] — List all categories

  ## React Components (use with display() and ask())
  <ConversionResult value={number} from={string} to={string} result={number} formatted={string} category={string} /> — Displays a conversion result card
  <UnitTable category={string} units={string[]} /> — Shows available units for a category as tags
  <CategoryGrid categories={string[]} /> — Shows all categories as icon cards
  <ConversionForm categories={string[]} /> — Form to capture a conversion request (use with ask(), returns { value, from, to, category })
  `,
  maxTurns: 8,
}
