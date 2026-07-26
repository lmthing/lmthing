# Channels — refs, hints, and the test-before-activate contract

## `channelRef` format

`<space>/<agent>` — the delegation target. Each shipped messaging integration's agent slug equals
its provider name:

| Integration space | channelRef |
|---|---|
| `integration-telegram` | `integration-telegram/telegram` |
| `integration-slack` | `integration-slack/slack` |
| `integration-discord` | `integration-discord/discord` |
| `integration-whatsapp` | `integration-whatsapp/whatsapp` |
| `integration-line` | `integration-line/line` |
| `integration-sms` | `integration-sms/sms` |
| `integration-mattermost` | `integration-mattermost/mattermost` |
| `integration-synology-chat` | `integration-synology-chat/synology-chat` |
| `integration-nextcloud-talk` | `integration-nextcloud-talk/nextcloud-talk` |

The database cannot tell you which of these are installed — **ask the user**, then build the ref
from this table. A delegation to a space that is not installed fails; that failure is exactly what
the activation test is for.

## `channelHint`

Free text the user supplies — a chat id, a channel name, a phone number. It is passed through to
the channel agent **verbatim**, inside the delivery instruction. The dispatcher never parses,
validates, normalizes or stores anything derived from it: destination semantics belong to the
integration that owns them.

## Test before activate — mandatory

A rule goes `active` only after:

1. a test digest was delegated to the proposed `channelRef`, and
2. the **user confirmed it actually arrived**.

A test that errored, or that the user did not confirm, leaves the rule `proposed`. Record the
attempted `channelRef` so the next attempt starts from it, but never set `active` — an unproven
channel silently swallowing every alert is worse than no dispatcher at all.

Pausing is a status update to `disabled`; a rule with an empty `channelRef` can never be resumed
directly — it has to go back through `rules`.
