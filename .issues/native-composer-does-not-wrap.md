# The chat composer does not wrap on native — it scrolls sideways

Found 2026-07-30 on a 360dp Android device (API 33 emulator), while fixing the
composer's control spacing (`sdk/org e7e15f2b`, `862bf23c`).

Type a message longer than the input is wide. On web it wraps and the box grows
to `maxHeight: 180`. On a phone it stays **one line** and scrolls horizontally,
so you can only ever see the tail of what you typed — the beginning of your own
message is unreachable without moving the caret.

## What is already ruled out

- **Not the alignment change.** Reproduced identically with the row at both
  `alignItems: flex-end` (the old value) and `center` (the new one). Cross-axis
  alignment does not stretch an auto-height item either way, and the box height
  was unchanged between the two.
- **`multiline` IS passed.** `sdk/org/libs/ui/src/elements/primitives/controls.native.tsx#TextArea`
  renders `<NativeTextInput multiline {...controlProps(props)} />`, and
  `controlProps` never returns a `multiline` key, so the later spread cannot be
  overwriting it.
- **The height is not pinned.** The composer sets `minHeight={24}`
  `maxHeight={180}`, not a fixed `height`
  (`sdk/org/libs/ui/src/chat/app/Composer.tsx`).

## Where to look next

`NativeTextInput` is `styled(TextInput, …, { isInput: true })`. The open question
is whether Tamagui forwards a non-style boolean like `multiline` through a
styled+`isInput` component to the underlying RN `TextInput`, or filters it. The
cheap experiment is a native render assertion in
`sdk/org/libs/ui/metro/suites/primitives.tsx` that mounts `Prim.TextArea` and
checks the host node's `multiline` prop is `true` — the same shape as the
assertion that already pins `isInput` there. If it comes back undefined, the fix
belongs in `controls.native.tsx` (put `multiline` in the styled config, or pass
it via `style`/`defaultProps` rather than as a bare prop).

Also worth checking: `flexBasis="0%"` as a percentage STRING. If Yoga does not
resolve it, the input sizes to its content instead of the remaining row width,
which would produce this symptom even with `multiline` set correctly.

A jsdom test cannot see any of this — `isWeb` is always true there. It needs
`pnpm test:native`.
