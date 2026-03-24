/**
 * Extract form data from a form element by reading all named inputs.
 * Used when an ask() form is submitted.
 */
export function extractFormData(formElement: HTMLFormElement): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const formData = new FormData(formElement)

  for (const [key, value] of formData.entries()) {
    if (data[key] !== undefined) {
      // Multiple values with same name → array (MultiSelect)
      const existing = data[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        data[key] = [existing, value]
      }
    } else {
      data[key] = value
    }
  }

  // Coerce types based on input element types
  const inputs = formElement.querySelectorAll('input, select, textarea')
  for (const input of inputs) {
    const el = input as HTMLInputElement
    const name = el.getAttribute('name')
    if (!name || !(name in data)) continue

    if (el.type === 'number' || el.type === 'range') {
      data[name] = Number(data[name])
    } else if (el.type === 'checkbox') {
      data[name] = el.checked
    } else if (el.type === 'file') {
      // File inputs handled separately via FileReader
      // FormData already contains File objects
    }
  }

  return data
}

/**
 * Extract form data from a plain Record (used in RPC context where
 * we don't have a DOM form element, just serialized data).
 */
export function normalizeFormData(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === '' || value === undefined) continue
    result[key] = value
  }
  return result
}
