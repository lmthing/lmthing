import nodePath from 'node:path'
import type { CatalogModule } from './types'

const pathModule: CatalogModule = {
  id: 'path',
  description: 'Path manipulation utilities',
  functions: [
    {
      name: 'joinPath',
      description: 'Join path segments',
      signature: '(...segments: string[]) => string',
      fn: (...segments: unknown[]) => nodePath.join(...(segments as string[])),
    },
    {
      name: 'resolvePath',
      description: 'Resolve to absolute path',
      signature: '(...segments: string[]) => string',
      fn: (...segments: unknown[]) => nodePath.resolve(...(segments as string[])),
    },
    {
      name: 'relativePath',
      description: 'Relative path between two paths',
      signature: '(from: string, to: string) => string',
      fn: (from: unknown, to: unknown) => nodePath.relative(from as string, to as string),
    },
    {
      name: 'parsePath',
      description: 'Parse path components',
      signature: '(p: string) => { dir: string, base: string, ext: string, name: string }',
      fn: (p: unknown) => nodePath.parse(p as string),
    },
    {
      name: 'dirname',
      description: 'Directory name',
      signature: '(p: string) => string',
      fn: (p: unknown) => nodePath.dirname(p as string),
    },
    {
      name: 'basename',
      description: 'Base name',
      signature: '(p: string, ext?: string) => string',
      fn: (p: unknown, ext?: unknown) => nodePath.basename(p as string, ext as string | undefined),
    },
    {
      name: 'extname',
      description: 'Extension',
      signature: '(p: string) => string',
      fn: (p: unknown) => nodePath.extname(p as string),
    },
  ],
}

export default pathModule
