/**
 * Gateway JWT minting + pod lifecycle (wake/status). Mirrors the harness's
 * sdk/org/scenarios/harness/lib/jwt.mjs HS256 shape (cloud/gateway/src/lib/tokens.ts)
 * and the wake-wait/status routes (cloud/gateway/src/routes/compute.ts).
 */
import { createHmac } from 'node:crypto'
import { config } from '../config.js'

let cachedKey: Buffer | null = null
function signingKey(): Buffer {
  if (cachedKey) return cachedKey
  // GATEWAY_JWT_SECRET is the base64 of the signing key (the gateway does Buffer.from(secret,'base64')).
  cachedKey = Buffer.from(config.GATEWAY_JWT_SECRET, 'base64')
  return cachedKey
}

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url').replace(/=+$/, '')

function sign(payload: Record<string, unknown>): string {
  const head = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}`
  const sig = createHmac('sha256', signingKey()).update(head).digest('base64url').replace(/=+$/, '')
  return `${head}.${sig}`
}

/** Mint a gateway access token for a user (sub=userId). 12h TTL. */
export function mintGatewayJwt(userId: string, ttlSec = 43_200): string {
  const now = Math.floor(Date.now() / 1000)
  return sign({ sub: userId, iat: now, exp: now + ttlSec })
}

async function gwReq<T = unknown>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${config.GATEWAY_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    /* raw */
  }
  if (!res.ok) {
    const err = new Error(`gateway ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`) as Error & {
      status: number
    }
    err.status = res.status
    throw err
  }
  return parsed as T
}

export interface PodStatus {
  pod?: { ready?: boolean; stage?: string; replicas?: number }
  [k: string]: unknown
}

export async function wakeAndWait(userId: string): Promise<PodStatus> {
  return gwReq('POST', '/api/compute/wake-wait', mintGatewayJwt(userId))
}

export async function podStatus(userId: string): Promise<PodStatus> {
  return gwReq('GET', '/api/compute/status', mintGatewayJwt(userId))
}
