import { spacesSnapshot } from './spaces-snapshot'

export interface FileSystemTree {
  [key: string]: {
    file?: { contents: string }
    directory?: FileSystemTree
  }
}

export const defaultTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'my-project',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'lmthing --space spaces/knowledge --port 3010',
        },
        dependencies: {
          lmthing: '^1.0.0',
        },
      }, null, 2),
    },
  },
  '.npmrc': {
    file: { contents: 'shamefully-hoist=true\nstrict-peer-dependencies=false\n' },
  },
  spaces: {
    directory: spacesSnapshot as unknown as FileSystemTree,
  },
}
