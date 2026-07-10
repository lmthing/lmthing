# Methods used by the wrappers

Base URL (pinned by the pod): `<INTEGRATION_NEXTCLOUD_TALK_BASE_URL>/ocs/v2.php/apps/spreed/api/v1`. All paths below
are the RELATIVE `path` you pass to
`callConnection('nextcloud', { method, path, headers, body })`. **Always send the headers**
`OCS-APIRequest: true` and `Accept: application/json`. Every response is the OCS envelope
`{ ocs: { meta: { status, statuscode, message }, data } }` — check `ocs.meta.statuscode`
(`200`/`201` = success).

Every method targets a **room token** (`roomToken`): the opaque conversation id (e.g. `a1b2c3d4`). The
bot must have been enabled in that conversation via `occ talk:bot:setup` or calls return `404`.

### Send a message — `nextcloudSendMessage(roomToken, message)`
- `POST /bot/{roomToken}/message`
- Body: `{ message }` — the text to post (Talk markdown is supported).
- Success: `ocs.meta.statuscode` `201`; `ocs.data` holds the created chat message.

### Reply to a message — `nextcloudReplyMessage(roomToken, message, replyToMessageId)`
- `POST /bot/{roomToken}/message`
- Body: `{ message, replyTo }` — `replyTo` is the id of the message being answered, so the reply is
  threaded under it. Use the inbound event's `object.id` as `replyTo`.
- Success: `ocs.meta.statuscode` `201`.

### Add a reaction — `nextcloudAddReaction(roomToken, messageId, reaction)`
- `POST /bot/{roomToken}/reaction/{messageId}`
- Body: `{ reaction }` — a single emoji (e.g. `👍`).
- Success: `ocs.meta.statuscode` `201`.

### Remove a reaction — `nextcloudRemoveReaction(roomToken, messageId, reaction)`
- `DELETE /bot/{roomToken}/reaction/{messageId}`
- Body: `{ reaction }` — the single emoji to remove.
- Success: `ocs.meta.statuscode` `200`.

## Inbound webhook event shape (ActivityStreams)

Nextcloud posts bot events to your inbound URL as an ActivityStreams 2.0 object. The handler agent
parses these fields:

- `type` — activity type. `"Create"` = a new chat message; `"Like"` = a reaction; `"Join"`/`"Leave"` =
  bot lifecycle. **Only handle `"Create"`.**
- `object.type` — `"Note"` for a chat message. **Only handle `"Note"`.**
- `object.id` — the message id (use as `replyTo`).
- `object.content` — the message content, usually a **JSON string** like
  `{"message":"hello","parameters":{}}`; parse it and read `.message` for the human text.
- `target.id` — the conversation **room token** (your reply target).
- `target.type` — `"Collection"` (the conversation).
- `actor.id` / `actor.name` — the sender's id and display name.

Example inbound `Create`/`Note` event:

```json
{
  "type": "Create",
  "actor": { "type": "Person", "id": "users/alice", "name": "Alice" },
  "object": {
    "type": "Note",
    "id": "4242",
    "name": "message",
    "content": "{\"message\":\"what's on my calendar?\",\"parameters\":{}}",
    "mediaType": "text/markdown"
  },
  "target": { "type": "Collection", "id": "a1b2c3d4", "name": "Project room" }
}
```
