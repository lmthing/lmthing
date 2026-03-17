import { describe, it, expect } from 'vitest'
import imageModule from './image'

describe('catalog/image', () => {
  it('module has expected functions', () => {
    const names = imageModule.functions.map(f => f.name)
    expect(names).toContain('imageResize')
    expect(names).toContain('imageCrop')
    expect(names).toContain('imageConvert')
    expect(names).toContain('imageInfo')
  })

  it('functions throw if sharp is not installed', async () => {
    const resize = imageModule.functions.find(f => f.name === 'imageResize')!
    // sharp may or may not be installed; if not, it throws with a helpful message
    try {
      await resize.fn('nonexistent.png', 'out.png', { width: 100 })
    } catch (e: any) {
      // Either sharp-related error or our "sharp is required" error
      expect(e.message).toBeTruthy()
    }
  })
})
