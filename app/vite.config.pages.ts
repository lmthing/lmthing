import { mergeConfig } from 'vite'
import { githubPagesSpa } from '@sctg/vite-plugin-github-pages-spa'
import baseConfig from './vite.config'

// Extends the base Vite config with settings required for GitHub Pages hosting.
export default mergeConfig(baseConfig, {
  base: '/domainsmith/',
  plugins: [githubPagesSpa()],
})
