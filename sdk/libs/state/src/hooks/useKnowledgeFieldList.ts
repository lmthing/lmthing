// src/hooks/useKnowledgeFieldList.ts

import { useMemo } from 'react'
import { useGlob } from './fs/useGlob'
import { P } from '../lib/fs/paths'

export interface KnowledgeFieldMeta {
  /** domain slug (knowledge/<domain>/...) */
  domain: string
  /** field slug (knowledge/<domain>/<field>/...) */
  field: string
  /** id used by the field-detail route, encoded as `<domain>---<field>` */
  fieldId: string
  /** path to the field's index.md */
  path: string
}

/**
 * Discover every knowledge FIELD in the space via its required manifest
 * `knowledge/<domain>/<field>/index.md`. Unlike domain discovery, this does
 * NOT depend on the optional `knowledge/<domain>/index.md` descriptor — so it
 * finds knowledge even when a domain has no index.md (matching how the core
 * runtime derives domains from subdirectories). Sorted by domain then field.
 */
export function useKnowledgeFieldList(): KnowledgeFieldMeta[] {
  const matches = useGlob(P.globs.allKnowledgeIndexes) // knowledge/*/*/index.md

  return useMemo(() => {
    return matches
      .map((path): KnowledgeFieldMeta | null => {
        const parts = path.split('/')
        // knowledge/<domain>/<field>/index.md
        if (parts.length < 4) return null
        const domain = parts[1]
        const field = parts[2]
        return { domain, field, fieldId: `${domain}---${field}`, path }
      })
      .filter((m): m is KnowledgeFieldMeta => m !== null)
      .sort((a, b) =>
        a.domain === b.domain ? a.field.localeCompare(b.field) : a.domain.localeCompare(b.domain),
      )
  }, [matches])
}
