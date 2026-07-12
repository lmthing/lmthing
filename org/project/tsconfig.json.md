# `tsconfig.json` — app typecheck config

Standard strict TypeScript config for the app's authored source. Its `include` list is what makes
the four pillars typecheck together.

## Format

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": []
  },
  "include": ["pages", "components", "lib", "api", "hooks", "types"]
}
```

## Notes

- **`include`** covers `pages`, `components`, `lib`, `api`, `hooks`, and the generated `types/`
  (DB-derived types imported as `@app/types`). `database/` is JSON schema, not TS, so it isn't
  listed.
- **`jsx: "react-jsx"`** for the page/component tier; **`strict: true`** throughout.
- **`noEmit`** — this config typechecks only; the pod runtime is what executes each file.

Real example: `store/projects/blog/tsconfig.json`.
