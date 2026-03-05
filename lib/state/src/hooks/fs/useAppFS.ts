// src/hooks/fs/useAppFS.ts

import { useSyncExternalStore } from 'react'
import { useApp } from '@/lib/contexts/AppContext'
import type { AppFS } from '@/lib/fs/AppFS'

export function useAppFS(): AppFS {
  const { appFS } = useApp()
  return appFS
}
