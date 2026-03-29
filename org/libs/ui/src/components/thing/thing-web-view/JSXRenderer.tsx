import { createElement, useState } from 'react'
import type { SerializedJSX } from './types'

const SAFE_ELEMENTS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'strong', 'em', 'code', 'pre', 'br', 'hr', 'img',
  'section', 'article', 'header', 'footer', 'nav', 'main',
  'details', 'summary', 'blockquote', 'figure', 'figcaption',
  'label', 'input', 'textarea', 'select', 'option', 'button',
  'form', 'fieldset', 'legend',
])

const BLOCKED_PROPS = new Set([
  'dangerouslySetInnerHTML', 'onError', 'onLoad',
])

// ── Built-in component registry ──

function BuiltinTextInput({ name, label, placeholder, defaultValue = '' }: Record<string, unknown>) {
  const [value, setValue] = useState(String(defaultValue))
  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label)),
    createElement('input', { name: String(name), type: 'text', placeholder: String(placeholder ?? ''), value, onChange: (e: any) => setValue(e.target.value), style: { padding: 8, borderRadius: 4, border: '1px solid var(--twv-border-form, #ccc)', width: '100%', boxSizing: 'border-box' } }),
  )
}

function BuiltinTextArea({ name, label, placeholder, rows = 4 }: Record<string, unknown>) {
  const [value, setValue] = useState('')
  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label)),
    createElement('textarea', { name: String(name), placeholder: String(placeholder ?? ''), rows: Number(rows), value, onChange: (e: any) => setValue(e.target.value), style: { padding: 8, borderRadius: 4, border: '1px solid var(--twv-border-form, #ccc)', width: '100%', boxSizing: 'border-box', resize: 'vertical' } }),
  )
}

function BuiltinNumberInput({ name, label, min, max, step, defaultValue = 0 }: Record<string, unknown>) {
  const [value, setValue] = useState(Number(defaultValue))
  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label)),
    createElement('input', { name: String(name), type: 'number', value, min: min != null ? Number(min) : undefined, max: max != null ? Number(max) : undefined, step: step != null ? Number(step) : undefined, onChange: (e: any) => setValue(Number(e.target.value)), style: { padding: 8, borderRadius: 4, border: '1px solid var(--twv-border-form, #ccc)', width: '100%', boxSizing: 'border-box' } }),
  )
}

function BuiltinSlider({ name, label, min, max, step = 1, defaultValue }: Record<string, unknown>) {
  const minVal = Number(min)
  const [value, setValue] = useState(Number(defaultValue ?? minVal))
  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label), `: ${value}`),
    createElement('input', { name: String(name), type: 'range', min: minVal, max: Number(max), step: Number(step), value, onChange: (e: any) => setValue(Number(e.target.value)), style: { width: '100%' } }),
  )
}

function BuiltinCheckbox({ name, label, defaultChecked = false }: Record<string, unknown>) {
  const [checked, setChecked] = useState(Boolean(defaultChecked))
  return createElement('div', { style: { marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 } },
    createElement('input', { name: String(name), type: 'checkbox', checked, onChange: (e: any) => setChecked(e.target.checked), value: 'true' }),
    createElement('label', { style: { fontSize: 13 } }, String(label)),
  )
}

function BuiltinSelect({ name, label, options, defaultValue = '' }: Record<string, unknown>) {
  const opts = Array.isArray(options) ? options.map(String) : []
  const [value, setValue] = useState(String(defaultValue))
  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label)),
    createElement('select', { name: String(name), value, onChange: (e: any) => setValue(e.target.value), style: { padding: 8, borderRadius: 4, border: '1px solid var(--twv-border-form, #ccc)', width: '100%', boxSizing: 'border-box' } },
      createElement('option', { value: '' }, '— Select —'),
      ...opts.map(opt => createElement('option', { key: opt, value: opt }, opt)),
    ),
  )
}

function BuiltinMultiSelect({ name, label, options, defaultValue = [] }: Record<string, unknown>) {
  const opts = Array.isArray(options) ? options.map(String) : []
  const defaults = Array.isArray(defaultValue) ? defaultValue.map(String) : []
  const [selected, setSelected] = useState<Set<string>>(new Set(defaults))

  const toggle = (opt: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(opt)) next.delete(opt); else next.add(opt)
      return next
    })
  }

  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label)),
    ...opts.map(opt =>
      createElement('label', { key: opt, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 13, cursor: 'pointer' } },
        createElement('input', { type: 'checkbox', name: String(name), value: opt, checked: selected.has(opt), onChange: () => toggle(opt) }),
        opt,
      ),
    ),
  )
}

function BuiltinDatePicker({ name, label, defaultValue = '' }: Record<string, unknown>) {
  const [value, setValue] = useState(String(defaultValue))
  return createElement('div', { style: { marginBottom: 8 } },
    createElement('label', { style: { display: 'block', marginBottom: 4, fontSize: 13 } }, String(label)),
    createElement('input', { name: String(name), type: 'date', value, onChange: (e: any) => setValue(e.target.value), style: { padding: 8, borderRadius: 4, border: '1px solid var(--twv-border-form, #ccc)', width: '100%', boxSizing: 'border-box' } }),
  )
}

const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  TextInput: BuiltinTextInput,
  TextArea: BuiltinTextArea,
  NumberInput: BuiltinNumberInput,
  Slider: BuiltinSlider,
  Checkbox: BuiltinCheckbox,
  Select: BuiltinSelect,
  MultiSelect: BuiltinMultiSelect,
  DatePicker: BuiltinDatePicker,
}

// ── Renderer ──

interface JSXRendererProps {
  jsx: SerializedJSX
}

export function JSXRenderer({ jsx }: JSXRendererProps) {
  return renderNode(jsx, 0)
}

function renderNode(node: SerializedJSX, index: number): React.ReactElement {
  const Registered = COMPONENT_REGISTRY[node.component]
  if (Registered) {
    const renderedChildren = node.children?.map((child, i) => {
      if (typeof child === 'string') return child
      return renderNode(child, i)
    })
    return createElement(Registered, { key: index, ...node.props }, ...(renderedChildren ?? []))
  }

  const tag = SAFE_ELEMENTS.has(node.component) ? node.component : 'div'

  const safeProps: Record<string, unknown> = { key: index }
  for (const [key, value] of Object.entries(node.props ?? {})) {
    if (BLOCKED_PROPS.has(key)) continue
    if (key.startsWith('on') && typeof value === 'string') continue
    safeProps[key] = value
  }

  const children = node.children?.map((child, i) => {
    if (typeof child === 'string') return child
    return renderNode(child, i)
  })

  return createElement(tag, safeProps, ...(children ?? []))
}
