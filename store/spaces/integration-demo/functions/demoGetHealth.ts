/**
 * Health-check the demo echo endpoint (GET /health). Useful to confirm the
 * `DEMO_BASE_URL` + `DEMO_API_TOKEN` are configured and reachable.
 *
 * @returns Whatever the echo endpoint returns for `/health`.
 */
export async function demoGetHealth(): Promise<any> {
  const r = await callConnection('demo', { method: 'GET', path: '/health' });
  return r.data;
}
