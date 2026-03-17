/**
 * Example 4: Weather assistant
 *
 * Custom tools that simulate a weather API.
 * Demonstrates: async functions, stop() for inspection, multi-step reasoning.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/04-weather.ts -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/04-weather.ts -m anthropic:claude-sonnet-4-20250514
 *   npx tsx src/cli/bin.ts examples/04-weather.ts -m openai:gpt-4o-mini -d debug-run.xml
 */

// ── Simulated weather data ──

interface WeatherData {
  city: string
  temp: number
  feelsLike: number
  humidity: number
  condition: string
  wind: { speed: number; direction: string }
}

interface ForecastDay {
  date: string
  high: number
  low: number
  condition: string
  precipitation: number
}

const CITIES: Record<string, WeatherData> = {
  'new york': { city: 'New York', temp: 22, feelsLike: 24, humidity: 65, condition: 'Partly Cloudy', wind: { speed: 15, direction: 'SW' } },
  'london': { city: 'London', temp: 16, feelsLike: 14, humidity: 78, condition: 'Overcast', wind: { speed: 22, direction: 'W' } },
  'tokyo': { city: 'Tokyo', temp: 28, feelsLike: 32, humidity: 80, condition: 'Humid', wind: { speed: 8, direction: 'SE' } },
  'paris': { city: 'Paris', temp: 19, feelsLike: 18, humidity: 55, condition: 'Sunny', wind: { speed: 12, direction: 'NE' } },
  'sydney': { city: 'Sydney', temp: 14, feelsLike: 12, humidity: 70, condition: 'Rainy', wind: { speed: 25, direction: 'S' } },
  'berlin': { city: 'Berlin', temp: 17, feelsLike: 15, humidity: 60, condition: 'Cloudy', wind: { speed: 18, direction: 'NW' } },
  'san francisco': { city: 'San Francisco', temp: 18, feelsLike: 16, humidity: 72, condition: 'Foggy', wind: { speed: 20, direction: 'W' } },
}

// ── Exported functions (injected as globals) ──

/** Get current weather for a city */
export async function getWeather(city: string): Promise<WeatherData | null> {
  const key = city.toLowerCase()
  return CITIES[key] ?? null
}

/** Get 5-day forecast for a city */
export async function getForecast(city: string): Promise<ForecastDay[]> {
  const key = city.toLowerCase()
  const base = CITIES[key]
  if (!base) return []

  const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Thunderstorm']
  const days: ForecastDay[] = []
  const now = new Date()

  for (let i = 1; i <= 5; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)
    days.push({
      date: date.toISOString().split('T')[0],
      high: base.temp + Math.round(Math.random() * 6 - 3),
      low: base.temp - 5 + Math.round(Math.random() * 4 - 2),
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      precipitation: Math.round(Math.random() * 80),
    })
  }
  return days
}

/** List all available cities */
export function listCities(): string[] {
  return Object.values(CITIES).map(c => c.city)
}

/** Compare weather between two cities */
export async function compareWeather(city1: string, city2: string): Promise<{ city1: WeatherData | null; city2: WeatherData | null }> {
  return {
    city1: await getWeather(city1),
    city2: await getWeather(city2),
  }
}

// ── CLI config ──

export const replConfig = {
  instruct: `You are a helpful weather assistant. When the user asks about weather, use the available functions to look up data and present it clearly. Always check which cities are available first if unsure.`,
  functionSignatures: `
  getWeather(city: string): Promise<WeatherData | null> — Get current weather. Returns { city, temp, feelsLike, humidity, condition, wind: { speed, direction } } or null if city not found
  getForecast(city: string): Promise<ForecastDay[]> — Get 5-day forecast. Returns array of { date, high, low, condition, precipitation }
  listCities(): string[] — List all available cities
  compareWeather(city1: string, city2: string): Promise<{ city1: WeatherData | null, city2: WeatherData | null }> — Compare weather between two cities
  `,
  maxTurns: 8,
}
