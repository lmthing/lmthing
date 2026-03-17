import type { CatalogModule } from './types'

function formatDateStr(date: Date, format: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return format
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
}

const dateModule: CatalogModule = {
  id: 'date',
  description: 'Date/time utilities',
  functions: [
    {
      name: 'now',
      description: 'Current ISO 8601 timestamp',
      signature: '() => string',
      fn: () => new Date().toISOString(),
    },
    {
      name: 'parseDate',
      description: 'Parse date string',
      signature: '(input: string) => Date',
      fn: (input: unknown) => new Date(input as string),
    },
    {
      name: 'formatDate',
      description: 'Format date (e.g., "YYYY-MM-DD")',
      signature: '(date: Date | string, format: string) => string',
      fn: (date: unknown, format: unknown) => {
        const d = date instanceof Date ? date : new Date(date as string)
        return formatDateStr(d, format as string)
      },
    },
    {
      name: 'addDays',
      description: 'Date arithmetic — add days',
      signature: '(date: Date | string, days: number) => Date',
      fn: (date: unknown, days: unknown) => {
        const d = date instanceof Date ? new Date(date) : new Date(date as string)
        d.setDate(d.getDate() + (days as number))
        return d
      },
    },
    {
      name: 'diffDays',
      description: 'Days between two dates',
      signature: '(a: Date | string, b: Date | string) => number',
      fn: (a: unknown, b: unknown) => {
        const da = a instanceof Date ? a : new Date(a as string)
        const db = b instanceof Date ? b : new Date(b as string)
        return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
      },
    },
  ],
}

export default dateModule
