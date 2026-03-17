/**
 * Example 4: Weather assistant
 *
 * Custom tools that simulate a weather API with React display components.
 * Demonstrates: async functions, stop() for inspection, display() for rich UI, ask() for user input.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/04-weather.tsx -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/04-weather.tsx -m anthropic:claude-sonnet-4-20250514
 *   npx tsx src/cli/bin.ts examples/04-weather.tsx -m openai:gpt-4o-mini -d debug-run.xml
 */

import React from 'react'

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

const CONDITION_ICONS: Record<string, string> = {
  'Sunny': '☀️', 'Partly Cloudy': '⛅', 'Cloudy': '☁️', 'Overcast': '🌥️',
  'Rainy': '🌧️', 'Humid': '💧', 'Foggy': '🌫️', 'Thunderstorm': '⛈️',
}

// ── React Components ──

/** Display card for current weather */
export function WeatherCard({ data }: { data: WeatherData }) {
  const icon = CONDITION_ICONS[data.condition] ?? '🌡️'
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 320, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
        {icon} {data.city}
      </div>
      <div style={{ fontSize: 32, fontWeight: 'bold' }}>{data.temp}°C</div>
      <div style={{ color: '#666', marginBottom: 8 }}>{data.condition} · Feels like {data.feelsLike}°C</div>
      <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#888' }}>
        <span>💨 {data.wind.speed} km/h {data.wind.direction}</span>
        <span>💧 {data.humidity}%</span>
      </div>
    </div>
  )
}

/** Display card for a 5-day forecast */
export function ForecastCard({ city, days }: { city: string; days: ForecastDay[] }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 480, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>📅 5-Day Forecast — {city}</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {days.map((day, i) => {
          const icon = CONDITION_ICONS[day.condition] ?? '🌡️'
          return (
            <div key={i} style={{ minWidth: 80, textAlign: 'center', padding: 8, background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#888' }}>{day.date}</div>
              <div style={{ fontSize: 20, margin: '4px 0' }}>{icon}</div>
              <div style={{ fontWeight: 'bold' }}>{day.high}°</div>
              <div style={{ color: '#888', fontSize: 13 }}>{day.low}°</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>🌧 {day.precipitation}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Side-by-side comparison of two cities */
export function CompareCard({ a, b }: { a: WeatherData; b: WeatherData }) {
  const iconA = CONDITION_ICONS[a.condition] ?? '🌡️'
  const iconB = CONDITION_ICONS[b.condition] ?? '🌡️'
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 480, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>⚖️ Weather Comparison</div>
      <div style={{ display: 'flex', gap: 24 }}>
        {[{ d: a, icon: iconA }, { d: b, icon: iconB }].map(({ d, icon }, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{icon} {d.city}</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', margin: '4px 0' }}>{d.temp}°C</div>
            <div style={{ fontSize: 13, color: '#666' }}>{d.condition}</div>
            <div style={{ fontSize: 12, color: '#888' }}>💨 {d.wind.speed} km/h · 💧 {d.humidity}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Form to ask the user which city they want weather for */
export function CityPickerForm({ cities }: { cities: string[] }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
        Which city would you like weather for?
      </label>
      <select name="city" defaultValue={cities[0]} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }}>
        {cities.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
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
  instruct: `You are a helpful weather assistant with rich display components. When showing weather data, use the React components to render beautiful cards:
- display(<WeatherCard data={weatherData} />) to show current weather
- display(<ForecastCard city="Name" days={forecastDays} />) to show a forecast
- display(<CompareCard a={city1Data} b={city2Data} />) to compare two cities
- var pick = await ask(<CityPickerForm cities={cityList} />) to ask the user to pick a city
Always fetch the data first with stop(), then display it with the appropriate component.`,
  functionSignatures: `
  getWeather(city: string): Promise<WeatherData | null> — Get current weather. Returns { city, temp, feelsLike, humidity, condition, wind: { speed, direction } } or null if city not found
  getForecast(city: string): Promise<ForecastDay[]> — Get 5-day forecast. Returns array of { date, high, low, condition, precipitation }
  listCities(): string[] — List all available cities
  compareWeather(city1: string, city2: string): Promise<{ city1: WeatherData | null, city2: WeatherData | null }> — Compare weather between two cities

  ## React Components (use with display() and ask())
  <WeatherCard data={WeatherData} /> — Displays a weather card with temp, condition, wind, humidity
  <ForecastCard city={string} days={ForecastDay[]} /> — Displays a 5-day forecast in a horizontal layout
  <CompareCard a={WeatherData} b={WeatherData} /> — Side-by-side comparison of two cities
  <CityPickerForm cities={string[]} /> — Form to let the user pick a city (use with ask())
  `,
  maxTurns: 8,
}
