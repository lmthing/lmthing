import { describe, it, expect } from 'vitest'
import { detectGlobalCall } from './global-detector'

describe('parser/global-detector', () => {
  it('detects stop call', () => {
    expect(detectGlobalCall('stop(x, y)')).toBe('stop')
  })

  it('detects await stop call', () => {
    expect(detectGlobalCall('await stop(x, y)')).toBe('stop')
  })

  it('detects display call', () => {
    expect(detectGlobalCall('display(<Component />)')).toBe('display')
  })

  it('detects ask call', () => {
    expect(detectGlobalCall('await ask(<Form />)')).toBe('ask')
  })

  it('detects async call', () => {
    expect(detectGlobalCall('async(() => fetchData())')).toBe('async')
  })

  it('detects assignment with await ask', () => {
    expect(detectGlobalCall('const result = await ask(<Form />)')).toBe('ask')
  })

  it('detects assignment with stop', () => {
    expect(detectGlobalCall('const val = stop(x)')).toBe('stop')
  })

  it('detects let assignment', () => {
    expect(detectGlobalCall('let data = await ask(<Form />)')).toBe('ask')
  })

  it('returns null for non-global calls', () => {
    expect(detectGlobalCall('console.log("hello")')).toBeNull()
    expect(detectGlobalCall('fetchData()')).toBeNull()
  })

  it('returns null for variable declaration with same name', () => {
    expect(detectGlobalCall('const stop = 5')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(detectGlobalCall('')).toBeNull()
  })

  it('handles whitespace', () => {
    expect(detectGlobalCall('  stop(x)  ')).toBe('stop')
    expect(detectGlobalCall('  await stop(x)  ')).toBe('stop')
  })

  it('detects checkpoints call', () => {
    expect(detectGlobalCall('checkpoints({ description: "test", tasks: [] })')).toBe('checkpoints')
  })

  it('detects checkpoint call', () => {
    expect(detectGlobalCall('checkpoint("step1", { result: "done" })')).toBe('checkpoint')
  })

  it('detects checkpoints with leading whitespace', () => {
    expect(detectGlobalCall('  checkpoints({})  ')).toBe('checkpoints')
  })

  it('does not confuse checkpoint with checkpoints', () => {
    expect(detectGlobalCall('checkpoint("id", {})')).toBe('checkpoint')
    expect(detectGlobalCall('checkpoints({})')).toBe('checkpoints')
  })
})
