/** HTTP push to the cluster app's ingest API. Zero-dep (Node 24 global fetch). */

export function makePush(appUrl, token) {
  const base = appUrl.replace(/\/$/, '') + '/scenario-dash/api/ingest'
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  async function post(path, body) {
    const url = base + path
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        console.warn(`[push] POST ${path} → ${res.status} ${t.slice(0, 120)}`)
        return false
      }
      return true
    } catch (e) {
      console.warn(`[push] POST ${path} error: ${e.message}`)
      return false
    }
  }

  return { post }
}
