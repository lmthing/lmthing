/**
 * useFieldSchema — Extracts schema fields from knowledge directory structure.
 *
 * Reads config.json files in knowledge subdirectories to find entries with
 * renderAs: "field" and builds SchemaField[] with options from .md files.
 */
import { useMemo } from 'react'
import { useGlobRead } from '../../../org/state/src'
import { parseFrontmatter } from '../../../org/state/src'

export type SchemaFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'toggle'

export interface FieldOption {
  id: string
  label: string
  description?: string
  order?: number
}

export interface SchemaField {
  id: string
  fieldId: string
  label: string
  description?: string
  fieldType: SchemaFieldType
  required: boolean
  default: string | string[] | boolean
  variableName?: string
  options: FieldOption[]
  sectionLabel?: string
  sectionId?: string
}

export interface FieldSchema {
  fieldId: string
  fieldLabel: string
  category?: string
  sections: SchemaField[]
}

export function useFieldSchema(selectedFieldIds: string[]): FieldSchema[] {
  // Glob all files under selected knowledge fields
  const patterns = selectedFieldIds.map(id => `knowledge/${id}/**`)
  const allFiles = useGlobRead(patterns.length === 1 ? patterns[0] : patterns.length > 0 ? `knowledge/{${selectedFieldIds.join(',')}}/**` : '')

  return useMemo(() => {
    if (selectedFieldIds.length === 0 || !allFiles) return []

    const schemas: FieldSchema[] = []

    for (const fieldId of selectedFieldIds) {
      const prefix = `knowledge/${fieldId}/`

      // Find the top-level config for the field label
      const topConfig = allFiles[`${prefix}config.json`]
      let fieldLabel = fieldId
      let category: string | undefined
      if (topConfig) {
        try {
          const parsed = JSON.parse(topConfig)
          fieldLabel = parsed.label || parsed.title || fieldId
          if (parsed.category) category = parsed.category as string
        } catch { /* ignore */ }
      }

      // Find all config.json files under this field
      const configPaths = Object.keys(allFiles)
        .filter(p => p.startsWith(prefix) && p.endsWith('/config.json') && p !== `${prefix}config.json`)
        .sort()

      const fields: SchemaField[] = []

      for (const configPath of configPaths) {
        const raw = allFiles[configPath]
        if (!raw) continue

        let config: Record<string, unknown>
        try {
          config = JSON.parse(raw)
        } catch {
          continue
        }

        if (config.renderAs !== 'field') continue

        const dirPath = configPath.replace('/config.json', '')
        const relPath = dirPath.slice(prefix.length)
        const id = `${fieldId}/${relPath}`

        // Find parent section label
        const parts = relPath.split('/')
        let sectionLabel: string | undefined
        let sectionId: string | undefined
        if (parts.length > 1) {
          const parentDir = parts.slice(0, -1).join('/')
          const parentConfigPath = `${prefix}${parentDir}/config.json`
          const parentRaw = allFiles[parentConfigPath]
          if (parentRaw) {
            try {
              const parentConfig = JSON.parse(parentRaw)
              if (parentConfig.renderAs === 'section') {
                sectionLabel = parentConfig.label || parentDir
                sectionId = `${fieldId}/${parentDir}`
              }
            } catch { /* ignore */ }
          }
        }

        // Collect options from .md files in this directory
        const options: FieldOption[] = []
        const optionPrefix = `${dirPath}/`
        for (const [filePath, content] of Object.entries(allFiles)) {
          if (!filePath.startsWith(optionPrefix) || !filePath.endsWith('.md')) continue
          // Only direct children, not nested
          const remainder = filePath.slice(optionPrefix.length)
          if (remainder.includes('/')) continue

          const optionId = remainder.replace(/\.md$/, '')
          let label = optionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          let description: string | undefined
          let order: number | undefined

          if (content) {
            try {
              const fm = parseFrontmatter(content)
              if (fm.frontmatter.title) label = fm.frontmatter.title as string
              if (fm.frontmatter.description) description = fm.frontmatter.description as string
              if (fm.frontmatter.order != null) order = Number(fm.frontmatter.order)
            } catch { /* ignore */ }
          }

          options.push({ id: optionId, label, description, order })
        }

        options.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

        const ft = (config.fieldType as string) || 'select'

        fields.push({
          id,
          fieldId,
          label: (config.label as string) || relPath,
          description: config.description as string | undefined,
          fieldType: ft as SchemaFieldType,
          required: Boolean(config.required),
          default: (config.default ?? (ft === 'multiselect' ? [] : ft === 'toggle' ? false : '')) as string | string[] | boolean,
          variableName: config.variableName as string | undefined,
          options,
          sectionLabel,
          sectionId,
        })
      }

      if (fields.length > 0) {
        schemas.push({ fieldId, fieldLabel, category, sections: fields })
      }
    }

    return schemas
  }, [selectedFieldIds, allFiles])
}
