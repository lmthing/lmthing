import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { PassThrough } from 'node:stream'
import { captureLaunchToken, exchangeLaunchToken } from '../src/dsh-auth.js'

test('captureLaunchToken: extracts the token from the printed launch URL and mirrors output untouched', async () => {
  const passthrough = new PassThrough()
  let mirrored = ''
  passthrough.on('data', (chunk) => {
    mirrored += chunk.toString('utf8')
  })

  const stdout = new PassThrough()
  const tokenPromise = captureLaunchToken(stdout, passthrough)
  stdout.write('dsh web: http://127.0.0.1:38199/?token=HyEurA8T_YvbBk53trWxsoQRRemmZMfYwqe61z5oZfQ\n')
  stdout.write('some later line the caller must still see\n')

  const token = await tokenPromise
  assert.equal(token, 'HyEurA8T_YvbBk53trWxsoQRRemmZMfYwqe61z5oZfQ')
  assert.match(mirrored, /dsh web: http/)
  assert.match(mirrored, /some later line the caller must still see/)
})

test('captureLaunchToken: only resolves once, even if a later chunk also matches', async () => {
  const passthrough = new PassThrough()
  passthrough.resume()
  const stdout = new PassThrough()
  const tokenPromise = captureLaunchToken(stdout, passthrough)
  stdout.write('dsh web: http://127.0.0.1:1/?token=first\n')
  stdout.write('dsh web: http://127.0.0.1:1/?token=second\n')
  assert.equal(await tokenPromise, 'first')
})

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
}

test('exchangeLaunchToken: returns the name=value pair from the Set-Cookie header, dropping attributes', async () => {
  const backend = http.createServer((req, res) => {
    assert.match(req.url, /\?token=the-token$/)
    res.writeHead(303, {
      'set-cookie': 'dsh-auth-abc=xyz; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict',
    })
    res.end()
  })
  const port = await listen(backend)
  try {
    const cookie = await exchangeLaunchToken({ host: '127.0.0.1', port, token: 'the-token' })
    assert.equal(cookie, 'dsh-auth-abc=xyz')
  } finally {
    backend.close()
  }
})

test('exchangeLaunchToken: retries while the backend refuses connections, then succeeds', async () => {
  const backend = http.createServer((_req, res) => {
    res.writeHead(303, { 'set-cookie': 'dsh-auth-x=y; Path=/' })
    res.end()
  })
  const port = await listen(backend)
  backend.close() // free the port so the first attempt(s) hit ECONNREFUSED
  await new Promise((resolve) => setTimeout(resolve, 10))

  let relistened = false
  setTimeout(() => {
    backend.listen(port, '127.0.0.1', () => {
      relistened = true
    })
  }, 40)

  try {
    const cookie = await exchangeLaunchToken({ host: '127.0.0.1', port, token: 't', retryDelayMs: 20, maxAttempts: 20 })
    assert.equal(cookie, 'dsh-auth-x=y')
    assert.ok(relistened)
  } finally {
    backend.close()
  }
})

test('exchangeLaunchToken: throws after exhausting retries against a dead backend', async () => {
  await assert.rejects(() => exchangeLaunchToken({ host: '127.0.0.1', port: 1, token: 't', retryDelayMs: 1, maxAttempts: 2 }))
})
