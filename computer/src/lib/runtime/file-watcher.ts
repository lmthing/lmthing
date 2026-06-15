// File tree node type — used by the IDE store and UI components.
// File watching against the pod filesystem is not implemented client-side;
// the pod exposes its own file API over HTTP/WS.

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}
