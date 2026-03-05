// src/hooks/fs/useStreamWrite.ts

import { useCallback, useState } from 'react'
import { useSpaceFS } from './useSpaceFS'

export function useStreamWrite(path: string) {
  const fs = useSpaceFS()
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const write = useCallback(async (stream: AsyncIterable<string>) => {
    setIsStreaming(true)
    setError(null)
    try {
      await fs.streamWriteFile(path, stream)
    } catch (e) {
      setError(e as Error)
    } finally {
      setIsStreaming(false)
    }
  }, [fs, path])

  return { write, isStreaming, error }
}

export function useStreamAppend(path: string) {
  const fs = useSpaceFS()
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const append = useCallback(async (stream: AsyncIterable<string>) => {
    setIsStreaming(true)
    setError(null)
    try {
      await fs.streamAppendFile(path, stream)
    } catch (e) {
      setError(e as Error)
    } finally {
      setIsStreaming(false)
    }
  }, [fs, path])

  return { append, isStreaming, error }
}
