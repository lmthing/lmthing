/**
 * Example 6: Unit converter
 *
 * A comprehensive unit conversion toolkit.
 * Demonstrates: pure functions, stop() for chained lookups, domain-specific tools.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/06-converter.ts -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/06-converter.ts -m openai:gpt-4o-mini -d debug-run.xml
 */

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
  instruct: `You are a unit conversion assistant. Convert between any supported units. If the user's request is ambiguous, use stop() to check available units first. Present results clearly.`,
  functionSignatures: `
  convertLength(value: number, from: string, to: string): { result, formatted } | null — Convert length (mm, cm, m, km, inch, foot, yard, mile)
  convertWeight(value: number, from: string, to: string): { result, formatted } | null — Convert weight (mg, g, kg, oz, lb, ton)
  convertTemperature(value: number, from: string, to: string): { result, formatted } | null — Convert temperature (C, F, K)
  convertVolume(value: number, from: string, to: string): { result, formatted } | null — Convert volume (ml, l, gal, qt, cup, floz, tbsp, tsp)
  convertSpeed(value: number, from: string, to: string): { result, formatted } | null — Convert speed (km/h, mph, m/s, knot)
  listUnits(category): string[] — List available units for a category
  listCategories(): string[] — List all categories
  `,
  maxTurns: 8,
}
