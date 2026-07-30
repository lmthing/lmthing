# An upload on a team pod has no owner, and `GET /api/uploads/:id` checks nothing

**Found:** 2026-07-31, in the team UX audit (`design/teams-ux-audit.md` B7). Not exploitable today.
**Must be closed before attachments ship**, not with them.

## What is true

`handleServeUpload` (`sdk/org/libs/cli/src/server/routes/uploads.ts:47-62`) resolves an id and
returns the bytes. There is no ownership check, no audience check, and no caller is consulted:

```ts
export const handleServeUpload: RouteHandler = async (_req, res, params, ctx) => {
  const id = params['id']!;
  const found = await ctx.manager.readUpload(id);
  …
  res.end(Buffer.from(found.bytes));
};
```

The `_req` is discarded, so the team caller is not even read. And `guardRequest`
(`server/team-guard.ts:141`) returns `{ok: true}` for **every** read-only method before any
per-resource rule can apply — correctly, since it is a route-shape gate, not a resource gate. The
resource gate is the one that does not exist.

`UploadMeta` (`server/uploads.ts:238-258`) stores `id`, `kind`, `mediaType`, `filename`,
`transcript`, `text`, `pages`. **It has no owner field**, so no check is currently possible without
a storage change.

On a personal pod this is all correct — a single-tenant pod has exactly one principal. A **team**
pod is reached by every member, and a viewer is a member.

## Why it is not a live vulnerability

Ids are `randomUUID()` (`server/uploads.ts:246`) — 122 bits — and `isSafeUploadId` restricts reads
to that exact shape, so the directory cannot be traversed or enumerated. Nothing publishes an id to
anyone but the uploader: the ref goes back to the uploading client and is carried on that member's
own session messages. A member therefore has no way to learn another member's id.

So the current design is an unguessable **capability URL**. That is a legitimate model — but it is
undocumented, unstated, and load-bearing by accident rather than by decision.

## Why it becomes a real hole the moment attachments ship

A channel attachment puts an upload id **into a message body that every member of the channel
reads** — that is the entire point of the feature. The unguessability that is doing all the work
today disappears at exactly that moment, and for DM attachments it disappears in the worst
direction: an id posted in a DM between two members would be fetchable by anyone else on the pod,
including a viewer, because the serve route consults nothing about who may see that DM.

There is no staging where this is safe: the first attachment merged is the first leak.

## The fix

1. Record the uploader on save. `saveUpload` takes an `ownerUserId` (and, once channel attachments
   exist, the channel the ref was posted into) and writes it into `UploadMeta`.
2. Enforce on serve. `handleServeUpload` reads the caller (`team-guard.ts#readCaller`) and serves
   only when the caller is the owner, or is in the audience of the channel the upload was posted to
   — the same `isVisibleTo` predicate a message read already uses, not a weaker one.
3. Personal pods keep today's behaviour exactly: outside team mode `readCaller` returns `null` and
   there is one principal, so the check must be a no-op there rather than a new 403.
4. Uploads written before the owner field existed have no owner. Decide explicitly — serve them
   (they predate teams) or refuse them — and write the decision down; do not let it fall out of a
   `?? undefined`.

A test that fails before the fix: a viewer on a team pod fetching an id uploaded by another member
gets 403, and the owner still gets 200.

## Related

- `design/teams-ux-audit.md` — B7 (attachments: the whitelist shipped, nothing else did). The other
  half of that finding is that `team-guard.ts:84` already whitelists `POST /api/uploads` for a
  viewer with the reason *"attach a file to a message"*, while no message route accepts an
  attachment and `promptFor` (`server/team-channels.ts:524-527`) returns a plain **string** — so a
  channel cannot hand THING an image at all today.
