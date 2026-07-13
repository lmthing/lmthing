# `tsconfig.json` — app typecheck config

Standard strict TypeScript config for a project-app's authored source; its `include` list is what makes the authored tiers typecheck together `store/projects/blog/tsconfig.json:1-24`. The same file ships verbatim across every catalog project (`blog`, `demo-feed`, `health`, `homes`, `kitchen`, `trips` are byte-identical) `store/projects/blog/tsconfig.json`.

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

Taken verbatim from `store/projects/blog/tsconfig.json:1-24`.

## Notes

- **`include`** lists `pages`, `components`, `lib`, `api`, `hooks`, and `types` `store/projects/blog/tsconfig.json:23`.
- The generated `types/` directory holds `types/generated.d.ts` (DB-derived row types + endpoint contracts), the artifact imported as `@app/types` `sdk/org/libs/cli/src/app/build/schema.ts#generateAppTypes`.
- **`database/` is JSON, not TS**, so it is not in `include` — each table is a `.json` schema file (e.g. `store/projects/blog/database/articles.json`) `store/projects/blog/database/`.
- **`jsx: "react-jsx"`** compiles the page/component tier without an explicit React import `store/projects/blog/tsconfig.json:6`.
- **`strict: true`** enables the full strict family for all included tiers `store/projects/blog/tsconfig.json:7`.
- **`noEmit: true`** — this config typechecks only and emits nothing; the pod runtime is what transpiles and executes each file `store/projects/blog/tsconfig.json:8`.
- **`moduleResolution: "Bundler"`** with `module: "ESNext"` matches the esbuild-based page/handler build `store/projects/blog/tsconfig.json:4-5`.
- **`types: []`** disables auto-inclusion of ambient `@types/*` packages, keeping the global surface to what the sandbox declares `store/projects/blog/tsconfig.json:12`.
