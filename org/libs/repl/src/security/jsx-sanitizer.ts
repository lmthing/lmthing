import type { SerializedJSX } from '../session/types'

const BLOCKED_TAGS = new Set(['script', 'iframe', 'object', 'embed'])
const DANGEROUS_PROPS = new Set(['dangerouslySetInnerHTML'])
const JAVASCRIPT_URL_PATTERN = /^\s*javascript:/i

export interface SanitizationError {
  path: string
  message: string
}

/**
 * Validate a serialized JSX tree for security concerns.
 * Returns an array of errors (empty if safe).
 */
export function sanitizeJSX(jsx: SerializedJSX, path = 'root'): SanitizationError[] {
  const errors: SanitizationError[] = []

  // Check for blocked tags
  if (BLOCKED_TAGS.has(jsx.component.toLowerCase())) {
    errors.push({
      path,
      message: `Blocked element: <${jsx.component}> is not allowed`,
    })
  }

  // Check props for dangerous attributes
  for (const [key, value] of Object.entries(jsx.props)) {
    if (DANGEROUS_PROPS.has(key)) {
      errors.push({
        path: `${path}.props.${key}`,
        message: `Dangerous prop: ${key} is not allowed`,
      })
    }

    // Check for javascript: URLs in href/src/action
    if (
      (key === 'href' || key === 'src' || key === 'action') &&
      typeof value === 'string' &&
      JAVASCRIPT_URL_PATTERN.test(value)
    ) {
      errors.push({
        path: `${path}.props.${key}`,
        message: `javascript: URLs are not allowed in ${key}`,
      })
    }

    // Check for event handlers (onClick, onLoad, etc.)
    if (key.startsWith('on') && key.length > 2 && key[2] === key[2].toUpperCase()) {
      if (typeof value === 'string') {
        errors.push({
          path: `${path}.props.${key}`,
          message: `String event handler: ${key} must be a function, not a string`,
        })
      }
    }
  }

  // Recursively validate children
  if (jsx.children) {
    for (let i = 0; i < jsx.children.length; i++) {
      const child = jsx.children[i]
      if (typeof child === 'string') continue
      const childErrors = sanitizeJSX(child, `${path}.children[${i}]`)
      errors.push(...childErrors)
    }
  }

  return errors
}

/**
 * Check if a JSX tree is safe to render.
 */
export function isJSXSafe(jsx: SerializedJSX): boolean {
  return sanitizeJSX(jsx).length === 0
}

/**
 * Validate that an ask() form only contains registered input components.
 */
export function validateFormComponents(
  jsx: SerializedJSX,
  allowedComponents: Set<string>,
  path = 'root',
): SanitizationError[] {
  const errors: SanitizationError[] = []

  // The root should be a Form
  if (path === 'root' && jsx.component !== 'Form' && jsx.component !== 'form') {
    errors.push({
      path,
      message: 'ask() root must be a <Form> component',
    })
  }

  // Check children are registered components
  if (jsx.children) {
    for (let i = 0; i < jsx.children.length; i++) {
      const child = jsx.children[i]
      if (typeof child === 'string') continue
      if (!allowedComponents.has(child.component) && child.component !== 'Form' && child.component !== 'form') {
        errors.push({
          path: `${path}.children[${i}]`,
          message: `Unknown form component: <${child.component}>. Only registered input components are allowed.`,
        })
      }
      // Recurse into children
      const childErrors = validateFormComponents(child, allowedComponents, `${path}.children[${i}]`)
      errors.push(...childErrors)
    }
  }

  return errors
}
