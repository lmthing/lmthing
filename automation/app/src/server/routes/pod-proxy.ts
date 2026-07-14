import { Hono } from 'hono'
import { Pod, PodWaking, type PodError } from '../lib/pod-client.js'
import { config, appBaseUrl, podNeedsToken } from '../config.js'
import { mintGatewayJwt } from '../lib/gateway.js'

export const podProxyRouter = new Hono<{ Variables: { userId: string } }>()

function podFor(c: { req: { param: (k: string) => string } }) {
  return new Pod(c.req.param('userId'))
}

function podError(c: unknown, userId: string) {
  const e = c as PodError
  if (c instanceof PodWaking) return new Response(JSON.stringify({ error: 'waking', userId }), { status: 503, headers: { 'content-type': 'application/json' } })
  const status = e?.status ?? 500
  return new Response(JSON.stringify({ error: e?.message ?? String(c) }), { status, headers: { 'content-type': 'application/json' } })
}

podProxyRouter.get('/:userId/fs/tree', async (c) => {
  try {
    const t = await podFor(c).fsTree()
    return c.json(t.files ?? [])
  } catch (e) {
    return podError(e, c.req.param('userId'))
  }
})

podProxyRouter.get('/:userId/fs/read', async (c) => {
  try {
    const path = c.req.query('path') ?? ''
    const r = await podFor(c).readFile(path)
    return c.json(r)
  } catch (e) {
    return podError(e, c.req.param('userId'))
  }
})

podProxyRouter.get('/:userId/sessions/:sid/events', async (c) => {
  try {
    const since = Number(c.req.query('since') ?? 0)
    return c.json(await podFor(c).sessionEvents(c.req.param('sid'), since))
  } catch (e) {
    return podError(e, c.req.param('userId'))
  }
})

podProxyRouter.get('/:userId/sessions/:sid/state', async (c) => {
  try {
    return c.json(await podFor(c).sessionState(c.req.param('sid')))
  } catch (e) {
    return podError(e, c.req.param('userId'))
  }
})

podProxyRouter.get('/:userId/projects/:projectId/app', async (c) => {
  try {
    return c.json(await podFor(c).appManifest(c.req.param('projectId')))
  } catch (e) {
    return podError(e, c.req.param('userId'))
  }
})

podProxyRouter.get('/:userId/projects/:projectId/app/data/:table', async (c) => {
  try {
    return c.json(await podFor(c).appData(c.req.param('projectId'), c.req.param('table')))
  } catch (e) {
    return podError(e, c.req.param('userId'))
  }
})

/** Mint a short-lived gateway JWT so the browser can open the real served app on lmthing.app. */
podProxyRouter.get('/:userId/app-token/:projectId', (c) => {
  return c.json({ url: `${appBaseUrl(c.req.param('userId'))}/${c.req.param('projectId')}/`, token: mintGatewayJwt(c.req.param('userId')) })
})

/**
 * Same-origin proxy of the served app for an embedded iframe. Fetches the pod's
 * root-mounted app HTML/assets and rewrites absolute asset URLs to the proxy prefix
 * so they resolve through this service. Strips framing/CSP headers so the iframe renders.
 */
podProxyRouter.get('/:userId/app/:projectId/*', async (c) => {
  const userId = c.req.param('userId')
  const projectId = c.req.param('projectId')
  const rest = c.req.path.split(`/app/${projectId}/`)[1] ?? ''
  const query = c.req.url.includes('?') ? `?${c.req.url.split('?')[1]}` : ''
  const podPath = `/${projectId}/${rest ? `${rest}${query}` : query || ''}`
  try {
    const base = appBaseUrl(userId)
    const headers: Record<string, string> = {}
    if (podNeedsToken()) headers.authorization = `Bearer ${mintGatewayJwt(userId)}`

    // A scaled-to-zero pod answers the first hit with 503/504 {waking:true} while
    // the activator boots it. Retry (bounded) until warm — same logic as the Pod class.
    let res: Response | null = null
    for (let attempt = 0; attempt < 40; attempt++) {
      res = await fetch(`${base}${podPath}`, { headers })
      const ct = res.headers.get('content-type') ?? ''
      if (res.status === 504) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      if (res.status === 503 && ct.includes('application/json')) {
        const peek = (await res.clone().json().catch(() => null)) as { waking?: boolean } | null
        if (peek && peek.waking === true) {
          await new Promise((r) => setTimeout(r, 1500))
          continue
        }
      }
      break
    }
    if (!res) return podError(new Error('pod never woke'), userId)
    const isHtml = (res.headers.get('content-type') ?? '').includes('text/html')
    const text = await res.text()
    const prefix = `${config.PREFIX}/api/pod/${userId}/app/${projectId}`
    let body = text
    if (isHtml) {
      // The served app is root-mounted at /<projectId>/* on the pod, so its HTML
      // uses root-relative URLs like /<projectId>/assets/x (and often a
      // <base href="/<projectId>/">). Rewrite those to the proxy prefix, STRIPPING
      // the projectId so the proxy's /:userId/app/:projectId/* handler re-adds it.
      // Relative refs (./assets/...) resolve against the iframe base (the prefix).
      const escPid = projectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      body = text
        .replace(new RegExp(`(href|src)=(["'])/${escPid}/`, 'g'), `$1=$2${prefix}/`)
        .replace(new RegExp(`(href|src)=(["'])/${escPid}"`, 'g'), `$1=$2${prefix}"`)
    }
    const outHeaders = new Headers()
    const passThrough = ['content-type', 'content-length']
    for (const h of passThrough) {
      const v = res.headers.get(h)
      if (v) outHeaders.set(h, v)
    }
    outHeaders.delete('content-security-policy')
    outHeaders.delete('x-frame-options')
    return new Response(body, { status: res.status, headers: outHeaders })
  } catch (e) {
    return podError(e, userId)
  }
})
