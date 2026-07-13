# Uploads & documents

Two unrelated file surfaces on the pod, often confused:

| Surface | Endpoints | Lands in | Read by |
|---|---|---|---|
| **Uploads** — chat attachments (images, audio, PDFs, Office docs, …) | `POST /api/uploads`, `GET /api/uploads/:id` | `<lmthingRoot>/uploads/` | the agent, via the universal `readDocument(id)` global |
| **Documents** — a project's reference files | `GET/POST /api/projects/:projectId/documents` | `<lmthingRoot>/<projectId>/documents/` | nothing in the runtime today (see [Project documents](#project-documents)) |

Route index → [`./README.md`](./README.md). The agent-side half of uploads →
[`../../runtime-globals/knowledge-and-docs.md`](../../runtime-globals/knowledge-and-docs.md).

---

## `POST /api/uploads`

Registered at `sdk/org/libs/cli/src/server/serve.ts:197`. Body is JSON — the file is sent
**base64** (a bare base64 string or a full `data:<mime>;base64,…` URL; the `data:` prefix is
stripped before the first comma) `sdk/org/libs/cli/src/server/routes/uploads.ts#decodeBase64,34`.

```bash
curl -X POST http://localhost:8080/api/uploads \
  -H 'content-type: application/json' \
  -d '{"filename":"report.pdf","mediaType":"application/pdf","data":"JVBERi0xLjQK..."}'
# → 201 {"id":"…uuid…","kind":"file","mediaType":"application/pdf",
#         "filename":"report.pdf","text":"…extracted…","url":"/api/uploads/<id>"}
```

Validation, all before anything is written `sdk/org/libs/cli/src/server/routes/uploads.ts#handleUpload`:

| Condition | Response |
|---|---|
| unparseable body | `400 {error:'invalid JSON body'}` |
| missing/non-string `mediaType` | `400 {error:'mediaType is required'}` |
| missing/non-string `data` | `400 {error:'data (base64) is required'}` |
| decodes to 0 bytes | `400 {error:'empty upload'}` |
| > `MAX_UPLOAD_BYTES` = **25 MB** | `413 {error:'upload exceeds 26214400 bytes'}` |
| otherwise | `201` + an `AttachmentRef` |

`filename` is optional; there is **no allow-list on `mediaType`** — the server stores any type
(the chat file-picker's `ATTACH_ACCEPT` list only shapes the browser dialog, it is not a server
rule) `sdk/org/libs/ui/src/chat/app/Composer.tsx:28-46`.

### What the handler does

`ctx.manager.saveUpload({bytes, mediaType, filename?})`
`sdk/org/libs/cli/src/server/session-manager.ts:1255-1283`:

1. `classifyKind(mediaType)` → `image` (`image/*`) · `audio` (`audio/*`) · `file` (everything
   else) `sdk/org/libs/cli/src/server/uploads.ts#classifyKind`.
2. **audio ⇒ transcribe on ingest** — `transcribeAudio(bytes)` via the model spec in
   `LM_TRANSCRIBE_MODEL` (`provider:modelId`; `openai` / `lmthingcloud` / `azure`, default
   `openai:whisper-1`) `sdk/org/libs/cli/src/providers/transcribe.ts:3-5,17-67`. A failure is **non-fatal**: it warns and
   stores the file without a transcript `sdk/org/libs/cli/src/server/session-manager.ts:1262-1270`.
3. **file ⇒ best-effort PDF text extraction** at upload time (`extractDocumentText`, `unpdf`,
   lazily imported) `sdk/org/libs/cli/src/server/uploads.ts#extractDocumentText`,
   `sdk/org/libs/cli/src/server/session-manager.ts:1271-1279`.
4. `saveUpload(uploadsDir, …)` writes **two files** and returns the meta
   `sdk/org/libs/cli/src/server/uploads.ts#saveUpload`.

The response is `AttachmentRef = UploadMeta & { url }`, i.e.
`{ id, kind, mediaType, filename?, transcript?, text?, url }`
`sdk/org/libs/cli/src/server/uploads.ts:11-28`, with `url = /api/uploads/<id>`
`sdk/org/libs/cli/src/server/uploads.ts#uploadUrl`.

## `GET /api/uploads/:id`

Registered at `sdk/org/libs/cli/src/server/serve.ts:198`. Serves the raw bytes with the stored
`Content-Type`, `Content-Length`, and `Cache-Control: private, max-age=31536000, immutable`
(ids are random, so the content is immutable); an unknown/unsafe id is
`404 {error:'upload not found'}` `sdk/org/libs/cli/src/server/routes/uploads.ts#handleServeUpload`,
`sdk/org/libs/cli/src/server/session-manager.ts:1285-1292`.

This is the URL `<img>` / `<audio>` / `<a>` elements in the chat transcript point at. Because
those elements cannot send an `Authorization` header, the client appends the JWT as a query
param — `withAuthToken(att.url)` → `/api/uploads/<id>?access_token=…`
`sdk/org/libs/ui/src/chat/app/Message.tsx:147-153,164,175`,
`sdk/org/libs/ui/src/chat/app/auth.ts#withAuthToken`. The pod itself performs **no** auth check on this
route; the token is what routes the request to the right pod at the edge.

---

## Where files land

```
<lmthingRoot>/            # LMTHING_ROOT, else <cwd>/.lmthing (prod: /data/.lmthing)
  uploads/                # resolveUploadsDir(root) = join(root ?? cwd, 'uploads')
    <uuid>                # raw bytes, exactly as uploaded
    <uuid>.json           # UploadMeta sidecar {id,kind,mediaType,filename?,transcript?,text?}
  <projectId>/
    documents/            # project documents (a different surface — see below)
```

`sdk/org/libs/cli/src/server/uploads.ts:126-130,144-161` · the uploads dir is **pod-global, not
per-project** — `SessionManager.uploadsDir` is derived from `lmthingRoot` alone
`sdk/org/libs/cli/src/server/session-manager.ts:1250-1253`. The directory is created lazily
(`mkdir -p`) on the first upload `sdk/org/libs/cli/src/server/uploads.ts#saveUpload`.

Ids are `randomUUID()` and every read re-validates the id against the UUID regex before touching
the filesystem — that (not path normalization) is the traversal guard
`sdk/org/libs/cli/src/server/uploads.ts:132-137,163-179`.

---

## How an attachment reaches the agent

The chat client uploads first, then sends the ids with the message: the WS `sendMessage` frame
carries `attachments: ChatAttachmentRef[]`, and the server **takes only the ids** —
`msg.attachments?.map(a => a.id)` `sdk/org/libs/cli/src/server/ws/agent.ts:91`,
`sdk/org/libs/cli/src/rpc/events.ts:33-45`. Everything else (bytes, mediaType, transcript) is
re-read from disk server-side, so a client cannot lie about an attachment
`sdk/org/libs/cli/src/server/session-manager.ts:1294-1317`.

`assembleAttachments` → `assembleParts` then splits by kind
`sdk/org/libs/cli/src/server/uploads.ts#assembleParts`:

| Kind | What the model gets |
|---|---|
| **audio** | its **transcript folded into the user text** (`[Transcript of <name>]:\n…`) — no bytes, no attachment entry `sdk/org/libs/cli/src/server/uploads.ts:292-296`, `sdk/org/libs/cli/src/server/session-manager.ts:1311-1315` |
| **image** | a `MediaPart` (`data:` URL) on a `UserAttachment` — delegatable to a vision agent `sdk/org/libs/cli/src/server/uploads.ts:299-302` |
| **file** | **only the id + metadata** — no bytes, no inlined text, no file part `sdk/org/libs/cli/src/server/uploads.ts:303-309` |

Core keeps this turn's image/file attachments in `Session.pendingAttachments` (keyed by id) and
appends an **attachment note** to the text agent's message telling it to delegate each by id
`sdk/org/libs/core/src/session/session.ts:46-79,97-102`:

```
[The user attached the following. You cannot read them yourself — delegate each by its id:
an image to `system-vision/vision`, a file to `system-files/dispatch`, passing
{ query, attachmentIds: ["<id>"] }.
  - file: report.pdf — attachmentId "…"]
```

When the agent calls `delegate(pkg, agent, { attachmentIds })`, the session resolves those ids
against `pendingAttachments`: images ride as `MediaPart`s, files become an id-anchored note —
``[Attached file id="…" type="…" name="…" — call `await readDocument("…")` to read it.]``
`sdk/org/libs/core/src/session/session.ts:940-963`. That is exactly the note
`system-files/dispatch` and `system-files/reader` are written against
`sdk/org/libs/core/system-spaces/system-files/agents/dispatch/instruct.md:11-16`,
`sdk/org/libs/core/system-spaces/system-files/agents/reader/instruct.md:13-18`.

## `readDocument(id)` — the agent's read path

`readDocument(attachmentId, opts?: { maxChars })` is a **value-yielding** global, injected into
**every** VM (session, fork, delegate) and deliberately **never capability-gated** — same regime
as `fetch` `sdk/org/libs/core/src/globals/read-document.ts:38-67`,
`sdk/org/libs/core/src/exec/bootstrap.ts:160-163`. Its declaration lives in `COMMON_DTS`
`sdk/org/libs/core/src/typecheck/library-dts.ts:97`:

```ts
declare function readDocument(attachmentId: string, opts?: { maxChars?: number }): Promise<{
  ok: boolean; attachmentId: string; mediaType: string; filename?: string;
  kind: 'text' | 'unsupported'; text?: string; truncated?: boolean; error?: string;
}>;
```

**The bytes never enter the sandbox.** The sandbox supplies only the id; the yield router calls
the host `documentResolver`, which reads the file from the uploads dir and returns extracted
text `sdk/org/libs/core/src/globals/read-document.ts:38-49`. If no resolver is wired (a bare
in-memory session — no pod, no uploads dir) the yield **rejects** with a retryable error rather
than binding `undefined`: `readDocument is not available here: no document resolver configured`
`sdk/org/libs/core/src/eval/yield-router.ts:225-235`. The pod always wires it, on **every**
session (project-independent) `sdk/org/libs/cli/src/server/session-manager.ts:385-390,447,1772`.

### Extraction table (`resolveUploadDocument`)

`sdk/org/libs/cli/src/server/uploads.ts#resolveUploadDocument` — server-authoritative (only the id is trusted),
never throws, and caps text at `opts.maxChars` (default **100 000** chars, `truncated: true` when
cut) `sdk/org/libs/cli/src/server/uploads.ts:181-182,224-225`:

| Input | Result |
|---|---|
| id not a UUID | `{ok:false, kind:'unsupported', error:'invalid attachment id'}` |
| no sidecar meta | `{ok:false, kind:'unsupported', error:'attachment not found'}` |
| `kind:'audio'` | `{ok:true, kind:'text', text: meta.transcript ?? ''}` (transcribed at upload) |
| `kind:'image'` | `{ok:false, kind:'unsupported', error:'image — use system-vision instead'}` |
| spreadsheet (xlsx/xls/xlsm/ods/csv/tsv, by media type **or** filename) | SheetJS renders every sheet to CSV (`# Sheet: <name>` headers when >1) → `kind:'text'`; else `'spreadsheet could not be parsed or is empty'` |
| plain text (`text/*`, json/xml/yaml/csv/js/ts/markdown/x-sh/toml) — but **not** the OOXML container family | utf8 decode → `kind:'text'` |
| `application/pdf` | `unpdf` extract → `kind:'text'`; empty ⇒ `'no extractable text (likely a scanned/image-only PDF)'` |
| Word/PowerPoint/OpenDocument (docx/doc/pptx/ppt/odt/odp) | `officeparser` → `kind:'text'`; else `'office document could not be parsed or has no text'` |
| anything else | `{ok:false, kind:'unsupported', error:'file type not yet supported: <mediaType>'}` |

Two ordering subtleties worth knowing: spreadsheets are checked **before** the text branch (so a
`.csv` sent as `application/octet-stream` is still parsed, and a binary `.xlsx` is not utf8-garbled)
`sdk/org/libs/cli/src/server/uploads.ts:218-228`; and the OOXML/OpenDocument types are explicitly
excluded from the "looks like text" check, because their media types contain the substring `xml`
even though they are binary zips `sdk/org/libs/cli/src/server/uploads.ts:229-233`.

Agent-side usage (from the shipped `system-files/reader` agent
`sdk/org/libs/core/system-spaces/system-files/agents/reader/instruct.md:34-40`):

````md
The contents are NOT inlined — fetch each with `readDocument(id)`. When several files
are attached, read them ALL (in one turn if you can) and answer across the whole set:

```ts
const docs = await Promise.all([
```
````

---

## Project documents

A separate, much simpler surface: named text files under a project.

| Route | Handler | Behaviour |
|---|---|---|
| `GET /api/projects/:projectId/documents` | `handleListDocuments` `sdk/org/libs/cli/src/server/routes/projects.ts#handleListDocuments` | `{ documents: string[] }` — the **file names** in `<root>/<id>/documents/`, sorted; a missing dir yields `[]` `sdk/org/libs/cli/src/server/projects.ts:362-368` |
| `POST /api/projects/:projectId/documents` | `handleCreateDocument` `sdk/org/libs/cli/src/server/routes/projects.ts#handleCreateDocument` | body `{ name, content? }` → `201 {ok:true}`; a non-empty string `name` is required, `content` defaults to `''` |

Registered at `sdk/org/libs/cli/src/server/serve.ts:176-177`. The name must be a single safe
segment — ≤200 chars, no `/`, `\`, NUL, `.` or `..` (`safeDocumentName`)
`sdk/org/libs/cli/src/server/projects.ts#safeDocumentName`, re-checked against a resolved-under-dir test in
`addDocument` `sdk/org/libs/cli/src/server/projects.ts:370-381`. Both handlers answer `400` with
the thrown message on an invalid project/document id
`sdk/org/libs/cli/src/server/session-manager.ts:1922-1945`. Content is written as UTF-8 text —
there is no base64 path, so binary "documents" are not supported here (the chat Documents tab
reads the picked file as text before POSTing) `sdk/org/libs/ui/src/chat/app/ProjectSettings.tsx:116-127`.

The directory is scaffolded with the project (`<root>/<id>/documents/`)
`sdk/org/libs/cli/src/server/projects.ts#documentsDir,263`, `sdk/org/libs/cli/src/cli/runtime-init.ts:115`.
A write also emits the internal signal `document.written` `{projectId, path}` — the project-document
write choke point (generic `PUT /api/fs/write` writes are deliberately **not** classified as
documents) `sdk/org/libs/cli/src/server/session-manager.ts:1934-1945`.

> **Nothing in the runtime reads these files.** They are stored and listed, but no code path
> injects `<root>/<id>/documents/` into an agent's context, and no global reads them by name
> (`rg -n "'documents'|\"documents\"|/documents" sdk/org/libs/cli/src sdk/org/libs/core/src` hits
> only the scaffold at `runtime-init.ts:115` and the two routes at `serve.ts:176-177`). An agent
> can still reach them like any other file — `readFileRaw` / `execShell` (see
> [`../../runtime-globals/session-and-utils.md`](../../runtime-globals/session-and-utils.md)) — but
> that is manual, not a documents feature. Contrast **uploads**, which have a first-class
> `readDocument` path.

---

## Callers

| Caller | Endpoint |
|---|---|
| Chat composer — attach / voice record (`MediaRecorder` → data URL) | `POST /api/uploads` `sdk/org/libs/ui/src/chat/app/Composer.tsx:108-127` |
| Chat transcript — render image/audio/file attachments | `GET /api/uploads/:id?access_token=…` `sdk/org/libs/ui/src/chat/app/Message.tsx#UserAttachment` |
| Chat project-settings → Documents tab | `GET`/`POST /api/projects/:id/documents` `sdk/org/libs/ui/src/chat/app/ProjectSettings.tsx#DocumentsTab` |
| Agent (any VM) | the `readDocument` yield → `documentResolver` → the uploads dir |

Related: [`../../runtime-globals/knowledge-and-docs.md`](../../runtime-globals/knowledge-and-docs.md)
(`readDocument`, `loadKnowledge`) · [`./sessions.md`](./sessions.md) (the WS `sendMessage` frame
that carries attachment ids) · [`./fs.md`](./fs.md) (raw workspace file access) ·
[`./README.md`](./README.md).
