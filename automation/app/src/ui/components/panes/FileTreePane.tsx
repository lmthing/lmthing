import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

interface Node {
  name: string
  path: string
  dir: boolean
  children?: Node[]
}

function buildTree(paths: string[]): Node[] {
  const root: Node = { name: '', path: '', dir: true, children: [] }
  for (const p of paths) {
    const parts = p.split('/')
    let cur = root
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      acc = acc ? `${acc}/${part}` : part
      const isLeaf = i === parts.length - 1
      let child = cur.children!.find((c) => c.name === part)
      if (!child) {
        child = { name: part, path: acc, dir: !isLeaf, children: isLeaf ? undefined : [] }
        cur.children!.push(child)
      }
      if (isLeaf) child.dir = false
      cur = child
    }
  }
  // sort: dirs first, then alpha
  const sort = (n: Node) => {
    if (!n.children) return
    n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
    n.children.forEach(sort)
  }
  sort(root)
  return root.children ?? []
}

export function FileTreePane({ userId }: { userId: string }) {
  const [tree, setTree] = useState<Node[] | null>(null)
  const [error, setError] = useState<string>('')
  const [selPath, setSelPath] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [loadingFile, setLoadingFile] = useState(false)

  const loadTree = () => {
    api<string[]>(`/pod/${userId}/fs/tree`)
      .then((t) => {
        setTree(buildTree(t))
        setError('')
      })
      .catch((e) => setError(e.message))
  }
  useEffect(loadTree, [userId])

  const openFile = (path: string) => {
    setSelPath(path)
    setLoadingFile(true)
    setContent('')
    api<{ content: string }>(`/pod/${userId}/fs/read?path=${encodeURIComponent(path)}`)
      .then((r) => setContent(typeof r === 'string' ? r : r.content))
      .catch((e) => setContent(`[error] ${e.message}`))
      .finally(() => setLoadingFile(false))
  }

  if (error) {
    return (
      <div className="text-sm">
        <p className="text-destructive mb-2">pod file tree: {error}</p>
        <p className="text-muted-foreground">The pod may be scaled to zero — wake it, then retry.</p>
        <button className="mt-2 bg-secondary text-secondary-foreground rounded px-3 py-1.5 text-xs" onClick={loadTree}>
          retry
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-3" style={{ height: '60vh' }}>
      <div className="border border-border rounded-lg bg-card overflow-auto">
        <div className="text-xs text-muted-foreground px-2 py-1 border-b border-border bg-muted sticky top-0">
          PVC /data/.lmthing
        </div>
        {tree ? (
          <div className="text-xs font-mono p-1">
            {tree.map((n) => (
              <TreeNode key={n.path} node={n} depth={0} selPath={selPath} onOpen={openFile} />
            ))}
          </div>
        ) : (
          <div className="p-3 text-muted-foreground">loading…</div>
        )}
      </div>
      <div className="border border-border rounded-lg bg-card overflow-auto">
        <div className="text-xs text-muted-foreground px-2 py-1 border-b border-border bg-muted sticky top-0 break-all">
          {selPath || 'select a file'}
        </div>
        <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-words">
          {loadingFile ? <span className="text-muted-foreground">loading…</span> : content}
        </pre>
      </div>
    </div>
  )
}

function TreeNode({
  node,
  depth,
  selPath,
  onOpen,
}: {
  node: Node
  depth: number
  selPath: string
  onOpen: (p: string) => void
}) {
  const [open, setOpen] = useState(depth < 1)
  if (node.dir) {
    return (
      <div>
        <div
          className="cursor-pointer hover:bg-muted px-1 py-0.5"
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▾' : '▸'} {node.name}/
        </div>
        {open &&
          node.children?.map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} selPath={selPath} onOpen={onOpen} />
          ))}
      </div>
    )
  }
  return (
    <div
      className={`cursor-pointer hover:bg-muted px-1 py-0.5 ${selPath === node.path ? 'bg-muted' : ''}`}
      style={{ paddingLeft: depth * 12 + 4 }}
      onClick={() => onOpen(node.path)}
    >
      {node.name}
    </div>
  )
}
