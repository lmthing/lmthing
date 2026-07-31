# The live browser

A real Chromium, running on the person's own computer, shown inside the desktop app and driven by both them and an agent.

This is the second of the two capabilities a desktop build exists for (the first is [local files](./README.md)). Every other client is sandboxed: a web page cannot give an agent a browser that is *logged in as the user*, and a phone cannot either. This can.

---

## One browser, or it is not the feature

The requirement is that an agent acts on the page the person is watching. That rules out the obvious designs:

- **A webview for the person and a headless browser for the agent** has two DOMs, two scroll positions and two sets of state. Sharing a cookie jar does not make "click the button I am looking at" mean the same thing to both, and the disagreement is invisible — each side reports truthfully about a different page.
- **The Tauri webview itself** cannot be driven at all on two of three platforms. WKWebView and WebKitGTK speak the WebKit Remote Inspector protocol, not CDP; only WebView2 speaks CDP. `Webview::eval` in Tauri v2 also returns no value, so every read would need a `postMessage` bridge and a content script surviving each navigation.

So there is exactly one browser process, and the pane is a picture of it: Chromium streams frames over `Page.startScreencast`, and the pane sends the person's mouse and keys back as `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` (`sdk/org/apps/desktop/src/BrowserPane.tsx#BrowserPane`).

Both parties share one `CdpClient` through a process-wide session (`sdk/org/apps/desktop/src/browser-session.ts#BrowserSession`), which is also what lets the pane show *that the agent is driving*, and which operation it is running (`sdk/org/apps/desktop/src/browser-session.ts#BrowserSession.noteAgentActivity`).

The honest costs: JPEG frames are not native-feeling scrolling, and an OS file picker cannot appear inside a picture. `browser_relaunch` is the escape hatch — the same browser, same profile, in a window of its own (`sdk/org/apps/desktop/src-tauri/src/commands.rs:L88-L120`).

---

## Launch

`--headless=new`, deliberately: the pane *is* the window, and a second one outside the app — and outside the activity log — would be showing the same thing in a place nobody chose (`sdk/org/apps/desktop/src-tauri/src/browser.rs:L100-L140`).

Two flags are load-bearing rather than cosmetic:

- **`--remote-allow-origins=*`** — without it Chromium rejects the CDP WebSocket handshake outright, because the renderer's origin is `tauri://localhost`. It fails as a handshake rejection with no useful message.
- **`--disable-blink-features=AutomationControlled`** — drops `navigator.webdriver`. Not evasion: a person is at the keyboard watching this browser, and the flag stops sites degrading a real session into a bot check they then have to solve inside a streamed pane. For the same reason the client corrects `HeadlessChrome` to `Chrome` in the user-agent (`sdk/org/apps/desktop/src/cdp.ts#CdpClient.honestUserAgent`).

The browser gets **its own profile directory**, never the person's everyday one, so the cookie jar an agent can reach is something they opted into and can throw away (`sdk/org/apps/desktop/src-tauri/src/commands.rs:L48-L62`).

**A snap is used only as a last resort**, and that ordering is a security property rather than a preference (`sdk/org/apps/desktop/src-tauri/src/browser.rs:L143-L163`). Snap confinement grants the sandbox only non-hidden paths under `$HOME`, and this app's profile is a dotted directory — so `--user-data-dir` is refused, and the browser falls back to the snap's own shared profile. The separate-cookie-jar guarantee above is then simply untrue: an agent would be driving a browser signed into everything the person has ever signed into. The same shared profile also makes a second instance abort on the profile's `SingletonLock`, which is how this surfaces in practice — the browser exits before printing anything and the launch reports no debugging port.

Detecting one takes three checks, and missing any of them silently hands over the snap (`sdk/org/apps/desktop/src-tauri/src/browser.rs:L117-L136`). `/snap/bin/chromium` must be recognised **before** its symlink is resolved, because it points at `/usr/bin/snap` — the launcher, whose path names no snap and whose 21MB puts it well past any wrapper-script check. `/usr/bin/chromium-browser` is a shell script that execs the snap and looks like an ordinary binary until it is read. `LMTHING_BROWSER` overrides all of it.

**The WebSocket URL is resolved in Rust**, not by the renderer. Chromium's `/json/version` sends no `Access-Control-Allow-Origin`, so fetching it from the webview is blocked by CORS — in the packaged app as much as in a browser.

It is read from **stderr** — `DevTools listening on ws://127.0.0.1:<port>/devtools/browser/<uuid>`, printed by every Chromium build before it is ready for anything else (`sdk/org/apps/desktop/src-tauri/src/browser.rs:L326-L331`). The `DevToolsActivePort` file in the profile directory is only a fallback, and that order is the opposite of the obvious one for the reason above: under a snap the file is written somewhere this app never looks, so polling for it times out with a message about a debugging port that describes the wrong thing entirely.

When neither yields an endpoint, the failure carries **Chromium's own stderr** rather than a timeout (`sdk/org/apps/desktop/src-tauri/src/browser.rs:L304-L323`). "Started but never reported a debugging port" is a symptom shared by a snap losing its profile lock, a browser too old for `--headless=new`, a sandbox denial and a binary that is not Chromium-family at all — and the person reading it cannot tell them apart, while Chromium names its own cause in plain words. The child is killed on that path too: without it every failed launch leaves another browser running, and the next attempt then fails for a *new* reason that hides the original.

---

## The client

`CdpClient` connects to the **browser** target and attaches to pages underneath it with `Target.attachToTarget({ flatten: true })`, multiplexing every session down one socket (`sdk/org/apps/desktop/src/cdp.ts#CdpClient`). A page-level connection can read a document; it cannot enumerate tabs, open one, or notice that the person closed the one it was holding.

`send` decides per method whether a command belongs to the browser or to the current page, so no caller has to know (`sdk/org/apps/desktop/src/cdp.ts#CdpClient.send`). Getting it wrong is silent in the worse direction: `Target.*` sent with a page session id is answered by the page, which does not implement it, and comes back as a flat "not found" that reads like the tab is gone.

Three things about the protocol that are load-bearing and easy to get wrong:

| | |
|---|---|
| **Frames must be acknowledged** | Chromium keeps a few frames in flight and stops sending once they go unacknowledged. A client that renders but never acks shows two or three frames and then a still image forever, with no error anywhere — it looks exactly like a page that stopped changing (`sdk/org/apps/desktop/src/cdp.ts#CdpClient.onScreencastFrame`). |
| **A headless page is never focused, and drops key events** | The mouse still works, so this presents as "clicking is fine but typing does nothing". `Page.bringToFront` alone is not enough; the page must be told it holds focus with `Emulation.setFocusEmulationEnabled` (`sdk/org/apps/desktop/src/cdp.ts#CdpClient.attachTo`). |
| **Tab titles cannot come from target events** | `Target.targetInfoChanged` fires only on navigation and reports the URL in its `title` field, and it does not fire at all when a page sets `document.title` from script. `Target.getTargets` is the only source of a real title, so the strip polls it while the pane is visible (`sdk/org/apps/desktop/src/browser-session.ts#BrowserSession.startTabPoll`). |

The viewport is pinned to the pane's size with `Emulation.setDeviceMetricsOverride` (`sdk/org/apps/desktop/src/cdp.ts#CdpClient.setViewport`). Without it the page lays out for whatever window Chromium created and the pane shows a scaled picture of a differently-shaped document — every click then lands somewhere other than where the person pointed, with nothing raised.

---

## Input

Every translation from a pane event to a page event is a pure function, because each one fails **silently** when it is wrong — the wrong element is clicked, or a character nobody pressed is typed (`sdk/org/apps/desktop/src/browser-input.ts`, tested in `sdk/org/apps/desktop/src/browser-input.test.ts`).

- `paneToPage` maps a click through the letterbox and scale, and returns `null` for a point in the margin rather than clamping it to the edge — clamping turns "clicked the grey border" into "clicked the first pixel of the page" (`sdk/org/apps/desktop/src/browser-input.ts#paneToPage`).
- `cdpKeyEvent` sets `text` **only** for keys that produce a character. Setting it for `ArrowDown` types the literal string "ArrowDown" into the focused field; omitting it for `a` moves focus and types nothing. `Enter` gets `\r`, without which a form does not submit (`sdk/org/apps/desktop/src/browser-input.ts#cdpKeyEvent`).
- `wheelDeltas` normalises the DOM's three `deltaMode`s, which CDP does not understand. A line-mode mouse reports `deltaY: 3`; forwarded raw, one notch scrolls three pixels (`sdk/org/apps/desktop/src/browser-input.ts#wheelDeltas`).
- `addressBarUrl` requires a scheme to be followed by `//`. Testing for a bare `word:` treats `localhost:3000` as the scheme "localhost" (`sdk/org/apps/desktop/src/browser-input.ts#addressBarUrl`).

---

## The agent surface

Two catalogues arrive over the same loopback endpoint and are dispatched by name in `sdk/org/apps/desktop/src/browser-tools.ts#callTool`.

**`system-desktop-browser`'s 17 functions**, written for this browser, driving the tab the person is watching:

| | |
|---|---|
| Read | `open` · `page` · `readText` · `readHtml` · `elements` |
| Act | `clickAt` · `typeText` · `pressKey` · `scrollBy` · `waitFor` |
| Navigate | `back` · `forward` · `reloadPage` |
| Tabs | `listTabs` · `openTab` · `useTab` · `closeTab` |

They are driven by the `browse` agent (`sdk/org/libs/core/system-spaces/system-desktop-browser/agents/browse/instruct.md`), with `sdk/org/libs/core/system-spaces/system-desktop-browser/knowledge/browser/live/index.md` as its knowledge.

**Clicks are real input.** `clickAt` scrolls the element into view and presses the mouse at its centre rather than calling `element.click()` — pages distinguish the two and many login flows do, hover and focus states change on the way (which is what makes menus and comboboxes work), and the person watching sees the pointer move to what is about to be clicked. An element with no size is refused rather than clicked into the void, where the click would land on whatever is behind it and report success (`sdk/org/apps/desktop/src/browser-tools.ts#callTool`).

**Typing is real keys.** `Input.insertText` is one call and produces no `keydown`, so search suggestions, live validation and anything driven by a key handler never fire.

**`elements` and `clickAt` share one selector string.** `elements` hands the model an index and `clickAt` resolves it by running the same query again; two strings that drifted apart would produce an off-by-one that clicks a neighbouring control — which reads as the model choosing wrong.

### The endpoint variable

The functions read `LMTHING_DESKTOP_BROWSER_URL`, not `LIGHTPANDA_MCP_URL` (`sdk/org/libs/cli/src/host/browser-endpoint.ts#DESKTOP_BROWSER_ENV`). Both point at the same loopback server today, but they answer different questions. The Lightpanda variable means "there is a browser somewhere" — a pod-side headless browser would set it too. These functions need "the browser on the person's machine, the one they are watching". Reading the wrong variable would, on a pod with no desktop attached, silently drive a different browser and report tabs nobody can see, while every layer worked exactly as designed.

With its own variable, the absence of a desktop is unambiguous and the function says so.

**The 27 `system-browser` wrappers** are unchanged and unaware of any of this; the pod forwards their body verbatim. Where a tool has no faithful expression against Chromium it is **refused** — `tree`, `nodeDetails` and `findElement` are `backendNodeId`-shaped, and a selector-based approximation would hand the model ids that do not mean what it thinks they do.

### The DevTools agent

`sdk/org/libs/core/system-spaces/system-desktop-browser/agents/devtools/instruct.md` holds raw CDP behind the `browser:cdp` capability, which is consent-marked and therefore **fails closed wherever there is no prompter** — every headless, fork, delegate and hook context (`sdk/org/libs/core/src/globals/consent.ts`). It is the last resort, not the first: ordinary browsing belongs to `browse`, which needs no per-call approval.

---

## Security

The browser is a sharper edge than the filesystem, and for one reason: it is signed into the person's real accounts. `getCookies` is among the 27, and raw `cdp()` is strictly worse — `Runtime.evaluate` on an arbitrary target is account takeover of every site they are logged into.

What that buys in mitigation:

- **A separate profile**, so the reachable cookie jar is a deliberate, disposable thing.
- **Visibility.** The page is on screen while the agent acts on it, and the pane names the operation the agent is running.
- **Consent, host-enforced**, for raw CDP only — the curated functions are gated the same way `system-browser`'s always were.
- **Instructions in the agent, not just in prose.** `browse` is told to treat page content as data and never as instructions, not to sign in or read credentials, and to stop and report at a login wall or CAPTCHA rather than work around it.

The last of those is the weakest link and worth stating plainly: prompt injection is the realistic attack, and an instruction file is a mitigation, not a boundary. The boundary that does exist is `grants.rs` for the filesystem; there is no equivalent for "which pages an agent may act on".

---

## What is proven

| Proven | How |
|---|---|
| Frames arrive, and keep arriving | A Playwright spec launches a real Chromium, points `browser_start` at it, and requires the picture to CHANGE after navigating — which is what distinguishes a live stream from a frozen one (`sdk/org/apps/desktop/tests/e2e/browser-pane.spec.ts`) |
| A click in the pane reaches the page | The test page is one full-viewport button that renames the document; the assertion is made on the app's own tab strip |
| Typing in the pane reaches the page | Same shape, through an `oninput` handler |
| The browser is not started until the pane is opened | Asserted directly — a browser signed into someone's accounts must not appear because an app was launched |
| The tool translation sends what it claims | 16 tests on the wire: which protocol commands went out, in what order (`sdk/org/apps/desktop/src/browser-tools.test.ts`) |
| The input arithmetic | 19 tests (`sdk/org/apps/desktop/src/browser-input.test.ts`) |
| The launch flags and the port file | `cargo test` (`sdk/org/apps/desktop/src-tauri/src/browser.rs`) |

| Not proven | Why |
|---|---|
| Any of it against a real pod | The bridge, and therefore the agent path end to end, has only ever spoken to a stub |
| The pane under WKWebView or WebKitGTK | The app runs in Playwright's Chromium here; a Tauri webview is not scriptable |
| The 27 wrappers against real sites | Their translation is unit-tested; no live site has been driven through them |
| Whether streamed scrolling is acceptable to use | Nobody has used it for real work yet. If it is not, the fallback is an embedded Chromium child window, which means platform-specific reparenting on all three platforms |
