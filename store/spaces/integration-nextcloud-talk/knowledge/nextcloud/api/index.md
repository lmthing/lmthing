---
variable: nextcloudApi
description: The Nextcloud Talk (Spreed) bot API surface reached via callConnection('nextcloud', ...) — base URL, the bot methods the wrapper functions use, their parameters, the OCS envelope, and the pod-managed bot-secret/signing auth model.
---

# Nextcloud Talk (Spreed) bot API cheat-sheet

The agent talks to the Nextcloud Talk **bot API** through `callConnection('nextcloud', req)`. The pod
pins the base URL to **`<NEXTCLOUD_BASE_URL>/ocs/v2.php/apps/spreed/api/v1`** and signs each request
with the user's own bot secret — the agent passes only a RELATIVE `path` (a leading-slash method like
`/bot/{roomToken}/message`), the required headers, and a body. The agent never handles the secret and
never signs anything.

**Every request MUST include the headers** `OCS-APIRequest: true` and `Accept: application/json`. The
wrapper functions already set these.

Wrapped methods (all target a **room token** — the opaque conversation id):

- **`POST /bot/{roomToken}/message`** — send a message (`nextcloudSendMessage`), or reply to a specific
  message with a `replyTo` body field (`nextcloudReplyMessage`).
- **`POST /bot/{roomToken}/reaction/{messageId}`** — add an emoji reaction (`nextcloudAddReaction`).
- **`DELETE /bot/{roomToken}/reaction/{messageId}`** — remove an emoji reaction (`nextcloudRemoveReaction`).

Nextcloud's OCS API wraps every response as
`{ ocs: { meta: { status, statuscode, message }, data } }`. Check **`ocs.meta.statuscode`**: `200`/`201`
mean success; anything else is an error whose reason is in `ocs.meta.message`. See the `endpoints`
aspect for exact params and response shapes, and the `auth` aspect for the bot-secret/signing model.
