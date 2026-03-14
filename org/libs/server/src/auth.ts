import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_SECRET = process.env.TOKEN_SECRET ?? ''

interface TokenPayload {
  user_id: string
  space_id?: string
  iat: number
  exp: number
}

/**
 * Verify an HMAC-signed token from issue-space-token / issue-computer-token.
 * Token format: base64(jsonPayload).hexSignature
 */
export function verifyToken(token: string): TokenPayload {
  if (!TOKEN_SECRET) {
    throw new Error('TOKEN_SECRET not configured')
  }

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) {
    throw new Error('Invalid token format')
  }

  const payloadB64 = token.slice(0, dotIndex)
  const sigHex = token.slice(dotIndex + 1)

  // Decode payload
  const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8')
  let payload: TokenPayload
  try {
    payload = JSON.parse(payloadStr)
  } catch {
    throw new Error('Invalid token payload')
  }

  // Verify signature
  const expected = createHmac('sha256', TOKEN_SECRET)
    .update(payloadStr)
    .digest('hex')

  const sigBuf = Buffer.from(sigHex, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid token signature')
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired')
  }

  return payload
}
