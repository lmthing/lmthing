# The live browser

A real browser view, inside the desktop app's own window, driven by both the person and an agent.

This is the second of the two capabilities a desktop build exists for (the first is [local files](./README.md)). Every other client is sandboxed: a web page cannot give an agent a browser that is *logged in as the user*, and a phone cannot either. This can.

---

## One browser, or it is not the feature

The requirement is that an agent acts on the page the person is watching. That rules out the obvious design: **a webview for the person and a headless browser for the agent** has two DOMs, two scroll positions and two sets of state. Sharing a cookie jar does not make "click the button I am looking at" mean the same thing to both, and the disagreement is invisible — each side reports truthfully about a different page.

So the pane is a **second real webview**, placed inside the app's window by the OS (`sdk/org/apps/desktop/src-tauri/src/browser_view.rs:L73-L106`, using `Window::add_child` behind Tauri's `unstable` feature). One browser view, one DOM, one cookie jar, and the person and the agent are both looking at it.

### What this replaced

The first version ran a headless Chromium and streamed `Page.startScreencast` frames into an `<img>`. Every part of it worked, and it was still wrong: **JPEG frames are not a browser**. Scrolling has a texture a stream of images does not reproduce, text is softened by compression, IME never behaves, and an OS file picker cannot appear inside a picture. It is noticeable within seconds of using it.

That design also implied a download. Driving a browser meant *shipping* one — ~185MB of Chrome for Testing per platform, fetched on first use, because whatever the person already had installed was the wrong thing to launch (an agent's activity in their process list and crash reports, and under a snap, in their everyday profile, because [snap confinement ignores `--user-data-dir`](#snap)). A real webview needs none of that: WebView2, WKWebView and WebKitGTK are already installed. **The cost went from ~185MB to zero.**

---

## What it gives up, honestly

**The Chrome DevTools Protocol.** Only WebView2 speaks it; WKWebView and WebKitGTK expose the WebKit Inspector Protocol, which is a cousin rather than a dialect — different domains, different ids, and no `backendNodeId`. A browser surface that behaves differently on one platform is worse than one that behaves the same everywhere, so CDP is not used even on Windows.

Everything is therefore JavaScript evaluated in the page. That is possible at all because of `Webview::eval_with_callback`, which serialises an expression's value to JSON and hands it back to Rust (`sdk/org/apps/desktop/src-tauri/src/commands.rs:L375-L390`) — plain `eval` in Tauri returns nothing, which is precisely why the earlier design needed a protocol.

**Reading is unaffected.** `innerText`, `querySelectorAll` and `location` are the same facts however they are reached.

**Acting is genuinely weaker**, and the list is short enough to state in full (`sdk/org/apps/desktop/src/page-tools.ts#callTool`):

- A dispatched `click()` is not an OS-level mouse press. Most pages cannot tell; some payment and login flows can, and bot checks are built to.
- There is no pointer moving across the page, so the person sees the result rather than the intent.
- `KeyboardEvent` is not a real key press — which is why the injected helper special-cases submitting a form, since a synthetic `keydown` alone does not.

Each of those is a case where the person is sitting in front of the page and can do it themselves. That is the argument for the trade, not an excuse for it.

**Cookies are partial.** `document.cookie` cannot see HttpOnly, and those are exactly the session ones. The shortfall is stated *in the answer* rather than left implicit: an agent handed a partial list with no note reports it as the whole one.

<a id="snap"></a>
**Note on snaps**, kept because it cost a day: under snap confinement `--user-data-dir` is refused outright and the everyday profile is used instead, and because every snap Chromium shares that one profile, a second instance aborts on its `SingletonLock` before printing anything. This is why launching an installed browser was never a safe default. It no longer applies — nothing is launched.

---

## The pane

The toolbar is ordinary React in the app's document. The area below it is **empty**: a `<div>` that renders nothing and exists only to be measured, with the real webview placed over that rectangle (`sdk/org/apps/desktop/src/WebviewPane.tsx#WebviewPane`).

The rectangle is measured by the renderer and sent to Rust, rather than computed in Rust, because the split divider is draggable and the toolbar is laid out by the same CSS as everything else — deriving it twice means keeping two derivations agreeing.

### Linux positions it by hand

`Window::add_child` takes a position and a size, and **on Linux it discards both**. `tauri-runtime-wry` builds a child webview into `window.default_vbox()` — a `GtkBox` — and wry, handed a `GtkBox`, calls `pack_start(webview, true, true, 0)`: the child is stacked, expanded to full width, and the position is dropped. It also records `is_in_fixed_parent = false`, which makes wry's own `set_bounds` a no-op. There is no combination of arguments that positions a child webview there, on Wayland or X11.

So the widgets are rearranged once, into a `GtkFixed` (`sdk/org/apps/desktop/src-tauri/src/gtk_pane.rs:L53-L110`): the app's webview at the origin, the browser placed over it with `Fixed::move_`. A `GtkFixed` gives its children no size at all, so the app's webview is told the container's size on every allocation — which is also what keeps the app **full height** rather than sharing vertical space with the pane the way the original box did.

`GtkOverlay` was tried first and rejected on evidence, not taste: given a full rectangle through its `get-child-position` hook, GTK used the size and allocated the child at `0,0` anyway.

Two things about this were only found by measuring, and both are worth keeping written down:

- **The vbox holds three children** — `["GtkMenuBar", "WebKitWebView", "WebKitWebView"]`. Selecting "the one that is not the browser" picks the **menu bar**. That version stretched the menu bar to fill the window and left the real app webview behind, which presented as an app rendering black with `Edit View Window` floating in the middle of it — a symptom that looks nothing like a mis-selection. The app surface is selected by type.
- **A widget's allocation cannot answer "where is it"** — it is relative to whichever `GdkWindow` the widget sits in, and GTK stacks wrapper windows. `0,0` reads identically whether the pane is correctly placed inside a wrapper or not placed at all. Two rounds of diagnosis were lost to that.

Windows and macOS take `build_as_child`, where a child webview is a real child view and Tauri's `set_position`/`set_size` work as documented. One rectangle, one meaning, two mechanisms — the renderer measures the same pane and sends the same numbers, so the layout is identical and only the plumbing differs (`sdk/org/apps/desktop/src-tauri/src/browser_view.rs:L114-L140`).

`LMTHING_OPEN_BROWSER=1` opens the pane on launch, retrying until it takes. Developing a layout that only exists after someone clicks a menu item is a click-per-iteration loop, and the emit is fire-and-forget — one sent before the page mounts its listener is silently lost, which made a fixed delay work most times and not all.

### The one rule that follows

**The app cannot draw on top of it.** A child webview is an OS rectangle, not an element in the document, so a drawer, a dialog or a menu over that area is painted *underneath* and is simply invisible. Anything that must cover the pane has to hide it first, which is why visibility drives `browserview_hide`/`show` rather than a CSS property (`sdk/org/apps/desktop/src-tauri/src/browser_view.rs:L122-L127`).

Two cases follow from it and are handled explicitly: the nav drawer hides the pane while it is open, and the pane hides itself on unmount — switching to a project app or to Local access renders a different tree entirely, which would otherwise leave a page floating over the app with no way to reach it.

### Address bar

Three kinds of input, only one of which is a URL (`sdk/org/apps/desktop/src-tauri/src/browser_view.rs:L164-L185`). `example.com` must not become a search, `athens weather` must not become a failed navigation, and `localhost:3000` must not be read as the scheme `localhost` — which is what splitting on `:` instead of `://` does, silently.

---

## The agent surface

Two catalogues arrive over the same loopback endpoint and are dispatched by name in `sdk/org/apps/desktop/src/page-tools.ts#callTool`.

**`system-desktop-browser`'s functions**, written for this browser, driving the page the person is watching:

| | |
|---|---|
| Read | `open` · `page` · `readText` · `readHtml` · `elements` |
| Act | `clickAt` · `typeText` · `pressKey` · `scrollBy` · `waitFor` |
| Navigate | `back` · `forward` · `reloadPage` |

**`elements` and the action tools share one definition.** `elements` hands the model an index and `clickAt` resolves that index by asking for the list again — so the list lives in the injected script (`sdk/org/apps/desktop/src-tauri/src/agent.js`), in one place. Two definitions of "the elements on this page" that drifted apart would produce an off-by-one that clicks a neighbouring control, a failure that looks like the model choosing wrong.

**Tabs are refused, truthfully.** The pane shows one page; `listTabs` answers with that one and `openTab`/`useTab`/`closeTab` say what to use instead. Inventing tabs would have the model plan around something that does not exist, and the plan would fail somewhere else entirely.

**The 27 `system-browser` wrappers** are unchanged and unaware of any of this; the pod forwards their body verbatim. `tree`, `nodeDetails` and `findElement` are `backendNodeId`-shaped and are **refused** — a selector-based approximation would hand the model ids that do not mean what it thinks they do.

### Opening the pane is what connects it

The browser and the bridge are one feature, not two. Opening the pane attaches this desktop to the workspace (`sdk/org/apps/desktop/src/HomeShell.tsx#HomeShell`); without the bridge the pod has nowhere to send a browser operation and the agent can only answer that no desktop is connected.

It does not widen what can be read from disk — the grant list is the filesystem boundary and is empty until the person names a folder — and it is an *implied* start, which can never undo a deliberate Disconnect (`sdk/org/apps/desktop/src/host-bridge.ts#DesktopHostBridge.start`).

When an agent reaches for the browser and the person never opened one, **the pane opens visibly, in the split** (`sdk/org/apps/desktop/src/page-driver.ts#ensurePaneOpen`). Giving an agent a page it was asked for is right; giving it one in a view nobody can see is the single thing this design exists to prevent, so the request goes through the shell rather than an offscreen webview being created behind everyone's back.

### Telling an agent the desktop is not there

The refusal names the remedy, and names the wrong remedy so it will not be offered (`sdk/org/libs/cli/src/rpc/host-bridge.ts#NOT_ATTACHED`).

That is not defensive writing. The message was once a bare statement of fact, and a model handed a problem with no remedy supplies one: it told the person to start a Lightpanda server, with a command line, an operator and a port. The inference was reasonable — the wrappers describe themselves as Lightpanda wrappers, and on a desktop-attached pod `LIGHTPANDA_MCP_URL` genuinely does point at a local endpoint. Nothing was missing; someone had to open a window.

For the same reason the `browser` agent's charter no longer names a product (`sdk/org/libs/core/system-spaces/system-browser/agents/browser/charter.md`).

---

## The CDP interface, kept

`cdp()` still exists and is answered with JavaScript (`sdk/org/apps/desktop/src/cdp-over-eval.ts#cdpViaEval`).

Refusing the whole surface would have been easier, and would have taken the devtools agent, its knowledge and its capability down with it for the sake of methods most callers never send. `Runtime.evaluate` *is* evaluation; `Page.navigate` *is* a navigation; `Input.dispatchMouseEvent` at a point is a hit-test and a dispatched event. Those are translated, and a caller written against CDP needs no special case.

**The refusals are the load-bearing part.** Anything built on `backendNodeId` — `DOM.*`, `Accessibility.*` — is refused by name and by domain prefix, because that id space is a property of the protocol's own view of the document and does not exist here. A synthesised id would let a model build a plan on ids that mean nothing, and every failure after that would be attributed to the wrong thing. A prefix rather than a method list, so a `DOM.*` method added tomorrow is refused with a reason instead of falling through to "unknown method".

Two details worth stating because getting them wrong is silent:

- Only `mousePressed` acts. CDP callers send moved/pressed/released as three calls, and acting on each would click three times — which on a "Buy" button is not cosmetic.
- `Emulation.*` is accepted and ignored. The pane is a real view sized by the window and focused by the person, so those calls describe things already true; failing them would break the call that follows for no gain.

---

## What is proven

| Claim | By |
|---|---|
| The catalogue asks the page to do what the tool says | 19 tests (`sdk/org/apps/desktop/src/page-tools.test.ts`) — assertions are on the expressions evaluated, not the answers, because a tool that returns something plausible while doing the wrong thing is invisible from its result |
| The CDP shim translates what it claims and refuses the rest by name | 14 tests (`sdk/org/apps/desktop/src/cdp-over-eval.test.ts`) |
| The address bar tells a host from a search from a port | `cargo test` (`sdk/org/apps/desktop/src-tauri/src/browser_view.rs`) |

**Not proven, and worth stating:** nobody has yet driven a real login flow end to end through the injected-JS path, so how often a dispatched click is rejected in practice is unmeasured. The pane has been exercised on Linux/WebKitGTK only — WebView2 and WKWebView are untested.
