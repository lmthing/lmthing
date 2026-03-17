import { createHash, randomBytes as nodeRandomBytes, randomUUID } from 'node:crypto'
import type { CatalogModule } from './types'

const cryptoModule: CatalogModule = {
  id: 'crypto',
  description: 'Cryptographic utilities',
  functions: [
    {
      name: 'hash',
      description: 'Hash a string',
      signature: "(data: string, algorithm?: 'sha256' | 'sha512' | 'md5') => string",
      fn: (data: unknown, algorithm?: unknown) => {
        const algo = (algorithm as string) || 'sha256'
        return createHash(algo).update(data as string).digest('hex')
      },
    },
    {
      name: 'randomBytes',
      description: 'Random hex string',
      signature: '(length: number) => string',
      fn: (length: unknown) => nodeRandomBytes(length as number).toString('hex'),
    },
    {
      name: 'uuid',
      description: 'Generate UUID v4',
      signature: '() => string',
      fn: () => randomUUID(),
    },
    {
      name: 'base64Encode',
      description: 'Encode to base64',
      signature: '(data: string) => string',
      fn: (data: unknown) => Buffer.from(data as string).toString('base64'),
    },
    {
      name: 'base64Decode',
      description: 'Decode from base64',
      signature: '(data: string) => string',
      fn: (data: unknown) => Buffer.from(data as string, 'base64').toString('utf-8'),
    },
  ],
}

export default cryptoModule
