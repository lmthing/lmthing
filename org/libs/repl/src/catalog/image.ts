import type { CatalogModule } from './types'

// Sharp is optional — functions throw helpful errors if not installed
async function getSharp(): Promise<any> {
  try {
    return (await import('sharp')).default
  } catch {
    throw new Error('sharp is required for image operations. Install with: pnpm add sharp')
  }
}

const imageModule: CatalogModule = {
  id: 'image',
  description: 'Image operations (requires sharp)',
  functions: [
    {
      name: 'imageResize',
      description: 'Resize image',
      signature: '(src: string, dest: string, options: { width?: number, height?: number }) => Promise<void>',
      fn: async (src: unknown, dest: unknown, options: unknown) => {
        const sharp = await getSharp()
        const opts = options as { width?: number; height?: number }
        await sharp(src as string).resize(opts.width, opts.height).toFile(dest as string)
      },
    },
    {
      name: 'imageCrop',
      description: 'Crop image',
      signature: '(src: string, dest: string, region: { left: number, top: number, width: number, height: number }) => Promise<void>',
      fn: async (src: unknown, dest: unknown, region: unknown) => {
        const sharp = await getSharp()
        await sharp(src as string).extract(region as any).toFile(dest as string)
      },
    },
    {
      name: 'imageConvert',
      description: 'Convert image format',
      signature: "(src: string, dest: string, format: 'png' | 'jpg' | 'webp') => Promise<void>",
      fn: async (src: unknown, dest: unknown, format: unknown) => {
        const sharp = await getSharp()
        await sharp(src as string).toFormat(format as string).toFile(dest as string)
      },
    },
    {
      name: 'imageInfo',
      description: 'Image metadata',
      signature: '(src: string) => Promise<{ width: number, height: number, format: string, size: number }>',
      fn: async (src: unknown) => {
        const sharp = await getSharp()
        const meta = await sharp(src as string).metadata()
        return { width: meta.width, height: meta.height, format: meta.format, size: meta.size }
      },
    },
  ],
}

export default imageModule
