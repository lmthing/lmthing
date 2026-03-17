import { describe, it, expect } from 'vitest'
import { sanitizeJSX, isJSXSafe, validateFormComponents } from './jsx-sanitizer'
import type { SerializedJSX } from '../session/types'

describe('security/jsx-sanitizer', () => {
  describe('sanitizeJSX', () => {
    it('accepts safe JSX', () => {
      const jsx: SerializedJSX = {
        component: 'div',
        props: { style: { color: 'red' } },
        children: [{ component: 'span', props: { children: 'hello' } }],
      }
      expect(sanitizeJSX(jsx)).toEqual([])
    })

    it('blocks <script> tags', () => {
      const jsx: SerializedJSX = { component: 'script', props: { src: 'evil.js' } }
      const errors = sanitizeJSX(jsx)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('Blocked element')
    })

    it('blocks <iframe> tags', () => {
      const jsx: SerializedJSX = { component: 'iframe', props: { src: 'http://evil.com' } }
      expect(sanitizeJSX(jsx)).toHaveLength(1)
    })

    it('blocks dangerouslySetInnerHTML', () => {
      const jsx: SerializedJSX = {
        component: 'div',
        props: { dangerouslySetInnerHTML: { __html: '<script>alert(1)</script>' } },
      }
      const errors = sanitizeJSX(jsx)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('dangerouslySetInnerHTML')
    })

    it('blocks javascript: URLs in href', () => {
      const jsx: SerializedJSX = {
        component: 'a',
        props: { href: 'javascript:alert(1)' },
      }
      const errors = sanitizeJSX(jsx)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('javascript:')
    })

    it('blocks javascript: URLs in src', () => {
      const jsx: SerializedJSX = {
        component: 'img',
        props: { src: ' JavaScript:void(0)' },
      }
      expect(sanitizeJSX(jsx).length).toBeGreaterThan(0)
    })

    it('detects string event handlers', () => {
      const jsx: SerializedJSX = {
        component: 'button',
        props: { onClick: 'alert(1)' },
      }
      const errors = sanitizeJSX(jsx)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('String event handler')
    })

    it('allows function event handlers', () => {
      const jsx: SerializedJSX = {
        component: 'button',
        props: { onClick: '() => {}' },
      }
      // String that looks like function is still flagged
      // In practice, serialized JSX won't have actual function values
      const errors = sanitizeJSX(jsx)
      expect(errors).toHaveLength(1) // it's still a string
    })

    it('recursively validates children', () => {
      const jsx: SerializedJSX = {
        component: 'div',
        props: {},
        children: [
          { component: 'script', props: {} },
          {
            component: 'div',
            props: {},
            children: [{ component: 'iframe', props: {} }],
          },
        ],
      }
      const errors = sanitizeJSX(jsx)
      expect(errors).toHaveLength(2)
    })
  })

  describe('isJSXSafe', () => {
    it('returns true for safe JSX', () => {
      expect(isJSXSafe({ component: 'div', props: {} })).toBe(true)
    })

    it('returns false for unsafe JSX', () => {
      expect(isJSXSafe({ component: 'script', props: {} })).toBe(false)
    })
  })

  describe('validateFormComponents', () => {
    const allowed = new Set(['TextInput', 'Select', 'Checkbox', 'NumberInput'])

    it('accepts valid form with allowed components', () => {
      const jsx: SerializedJSX = {
        component: 'Form',
        props: {},
        children: [
          { component: 'TextInput', props: { name: 'email' } },
          { component: 'Select', props: { name: 'country' } },
        ],
      }
      expect(validateFormComponents(jsx, allowed)).toEqual([])
    })

    it('rejects non-Form root', () => {
      const jsx: SerializedJSX = {
        component: 'div',
        props: {},
        children: [{ component: 'TextInput', props: { name: 'x' } }],
      }
      const errors = validateFormComponents(jsx, allowed)
      expect(errors.some(e => e.message.includes('must be a <Form>'))).toBe(true)
    })

    it('rejects unknown form components', () => {
      const jsx: SerializedJSX = {
        component: 'Form',
        props: {},
        children: [
          { component: 'TextInput', props: { name: 'x' } },
          { component: 'MaliciousWidget', props: {} },
        ],
      }
      const errors = validateFormComponents(jsx, allowed)
      expect(errors.some(e => e.message.includes('MaliciousWidget'))).toBe(true)
    })
  })
})
