import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = join(__dirname, '..')
const demosDir = join(rootDir, 'src', 'demos')
const publicDir = join(rootDir, 'public', 'demos')

// Create output directory
mkdirSync(publicDir, { recursive: true })

// Get all demo directories
const demos = readdirSync(demosDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)

console.log(`Found ${demos.length} demos: ${demos.join(', ')}`)

for (const demo of demos) {
  const demoPath = join(demosDir, demo)
  const globResult = {}

  // Recursively read all files in the demo directory
  function walkDir(dir, prefix = '') {
    const files = readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const filePath = join(dir, file.name)
      const relativePath = prefix ? `${prefix}/${file.name}` : file.name

      if (file.isDirectory()) {
        walkDir(filePath, relativePath)
      } else {
        globResult[relativePath] = readFileSync(filePath, 'utf-8')
      }
    }
  }

  walkDir(demoPath)

  // Dynamically import and use extractWorkspaceData
  const { extractWorkspaceData } = await import(
    join(rootDir, 'src', 'lib', 'extractWorkspaceData.ts')
  )

  const workspaceData = extractWorkspaceData(demo, globResult)
  const outputPath = join(publicDir, `${demo}.json`)

  writeFileSync(outputPath, JSON.stringify(workspaceData, null, 2))
  console.log(`✓ Generated ${outputPath}`)
}

// Generate index file with metadata
const index = demos.map((demo) => {
  const workspaceDataPath = join(publicDir, `${demo}.json`)
  const workspaceData = JSON.parse(readFileSync(workspaceDataPath, 'utf-8'))
  return {
    name: demo,
    description: workspaceData.description || '',
    workspace_id: demo,
  }
})

writeFileSync(
  join(publicDir, 'index.json'),
  JSON.stringify(index, null, 2),
)
console.log(`✓ Generated ${join(publicDir, 'index.json')}`)

console.log('Done!')