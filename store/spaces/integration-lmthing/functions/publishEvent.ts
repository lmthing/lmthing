/**
 * Publish a CUSTOM `integration-lmthing/*` event that this project's hooks can
 * subscribe to. A thin wrapper over the `emitEvent` global (capability
 * `events:emit`) — the agent that exposes this function declares that capability.
 *
 * The event is addressed to subscribers as `integration-lmthing/<name>`; the
 * payload is validated by the host against the emitting scope's declared events
 * (drop-with-warn on a mismatch). Use it to fan your own signals into the same
 * event pipeline lmthing's runtime events flow through — e.g. after finishing a
 * batch, `publishEvent('batch.done', { count })`.
 *
 * @param name    The event name (local part; subscribers match `integration-lmthing/<name>`).
 * @param payload The event payload object.
 */
export async function publishEvent(name: string, payload: Record<string, unknown>): Promise<void> {
  await emitEvent(name, payload);
}
