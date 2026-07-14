import { Hono } from 'hono'
import { wakeAndWait, podStatus } from '../lib/gateway.js'

export const podLifeRouter = new Hono()

podLifeRouter.get('/:userId/status', async (c) => {
  try {
    return c.json(await podStatus(c.req.param('userId')))
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502)
  }
})

podLifeRouter.post('/:userId/wake', async (c) => {
  try {
    return c.json(await wakeAndWait(c.req.param('userId')))
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502)
  }
})
