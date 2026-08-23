import { defineTool, parameterSchemaSpecToJsonSchema, validateArgs } from '@deepseek-ai/dsh-tools'
import { resolveComponents } from './resolve.js'
import { extractPropsSchema } from './props-schema.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md):
 * given `{ spaceDir, agentSlug }`, loads the space itself and exposes every
 * component the agent declares in its `components:` frontmatter
 * (`components/view/*.tsx` + `components/form/*.tsx`) as ONE `display` tool —
 * matching LMThing's own `display()` global 1:1 (a single call site taking the
 * component name plus its props), not one tool per component.
 *
 * ## Scope boundary: this does NOT render real UI
 *
 * Inherited from the roadmap entry that separates this from the further-out
 * `client-space-components` item (real `ConversationNodeDefinition` mounting in
 * the dsh Web Client). A `display` call here is a structured, named
 * DECLARATION — "I am responding with component X and these props" — carried
 * back as the canonical tool value and shown as a generic acknowledgment card.
 * That is the same fidelity LMThing's own shipped product has today: its own
 * docs note space-authored `view` components are never actually rendered as
 * real React in the current product either, only carried as prompt/typecheck
 * metadata. The only change is the call path: a dsh tool call instead of a
 * `display()` statement inside QuickJS.
 *
 * ## Why the props parameter is open `json`
 *
 * dsh's schema DSL has `string/number/integer/boolean/null/array/object/json/oneOf`
 * and no conditional "if component === X then props has shape Y", so a
 * per-component prop shape is not expressible in one static tool declaration.
 * The tool therefore declares `props: { type: 'json' }` and, where
 * `extractPropsSchema` managed to read a component's inline prop types, applies
 * that schema as SOFT, in-body validation: mismatches come back as visible
 * `warnings` on the result (useful authoring feedback) and NEVER as a tool
 * error. See `props-schema.js`'s doc comment for the fail-soft rationale.
 *
 * ## Mounts nothing when the agent declares no components
 *
 * Same reasoning as `space-knowledge`'s zero-refs case: an always-visible tool
 * with an empty `component` enum is dead weight in every tool-schema snapshot.
 *
 * Note for anyone extending this: `apply()` is `async` and does real async work
 * (`resolveComponents` -> `loadSpace`) before the synchronous
 * `ctx.tools.register`. If a nested `ctx.plugin()` is ever added here it MUST be
 * `await`ed — an unawaited one lets `apply()` return before the child
 * registered, silently missing the first request's tool-schema snapshot (see
 * dsh/packages/README.md, Phase 2 `await` bug).
 *
 * config: { spaceDir: string, agentSlug: string }
 */
export const name = 'lmthing-space-components'
export const inject = ['tools']

/** Longest prop-mismatch warning list echoed back before truncating. */
const MAX_WARNINGS = 10

export async function apply(ctx, config) {
  const components = await resolveComponents(config.spaceDir, config.agentSlug)
  if (components.length === 0) return

  /** @type {Map<string, { kind: string, schema: Record<string, object> | null }>} */
  const byName = new Map()
  for (const component of components) {
    byName.set(component.name, {
      kind: component.kind,
      schema: compileableSchema(component.source, component.name),
    })
  }

  const names = components.map((c) => c.name)
  const catalog = components
    .map((c) => {
      const schema = byName.get(c.name)?.schema
      return `- ${c.name} (${c.kind}): ${schema ? describeProps(schema) : 'props not statically typed — pass whatever the component needs'}`
    })
    .join('\n')

  ctx.tools.register(defineTool({
    name: 'display',
    description: [
      'Respond with one of this space\'s catalog components instead of (or alongside) plain prose.',
      'Pick the component by name and pass its props as a JSON object.',
      '',
      'Available components:',
      catalog,
    ].join('\n'),
    parameters: {
      component: {
        type: 'string',
        enum: names,
        required: true,
        description: 'Name of the catalog component to respond with.',
      },
      props: {
        type: 'json',
        description: 'The component\'s props, as a JSON object. See the per-component prop list in this tool\'s description.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          component: { type: 'string', required: true },
          kind: { type: 'string', required: true },
          props: { type: 'json', required: true },
          warnings: { type: 'array', items: { type: 'string' }, required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `Displaying ${value.kind} component "${value.component}" with props:`,
          JSON.stringify(value.props, null, 2),
          ...(value.warnings.length > 0 ? ['', 'Prop warnings:', ...value.warnings.map((w) => `- ${w}`)] : []),
        ].join('\n'),
      }],
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `display ${args.component}`,
      kind: 'other',
      rawInput: args.props ?? {},
    }),
    presentResult: (args, result) => ({
      card: 'generic',
      title: `display ${args.component}`,
      content: result.content,
    }),
    async execute(args) {
      const entry = byName.get(args.component)
      // Unreachable via the model: the `component` enum is enforced by
      // defineTool's own argument validation before execute runs.
      if (!entry) {
        throw new Error(`@lmthing/dsh-space-components: unknown component "${args.component}"`)
      }

      // `props` is optional and `type: 'json'` accepts null; the canonical
      // value must be lossless JSON, which rejects `undefined`.
      const props = args.props ?? {}

      return {
        component: args.component,
        kind: entry.kind,
        props,
        warnings: entry.schema ? softValidateProps(entry.schema, props, args.component) : [],
      }
    },
  }))
}

/**
 * Extract a component's prop schema and confirm dsh can actually compile it.
 * Both halves are fail-soft: anything unexpected yields `null`, i.e. "no
 * per-component typing for this one", which the open `props: json` parameter
 * already covers.
 * @returns {Record<string, object> | null}
 */
function compileableSchema(source, componentName) {
  const schema = extractPropsSchema(source, componentName)
  if (!schema) return null
  try {
    parameterSchemaSpecToJsonSchema(schema)
    return schema
  } catch {
    return null
  }
}

/**
 * Soft-validate a `display` call's props against a statically-extracted schema.
 * Returns human-readable warnings — never throws, never fails the call.
 * @param {Record<string, object>} schema
 * @param {unknown} props
 * @param {string} componentName
 * @returns {string[]}
 */
function softValidateProps(schema, props, componentName) {
  let violations
  try {
    violations = validateArgs(schema, props)
  } catch {
    return []
  }
  if (violations.length === 0) return []

  const shown = violations.slice(0, MAX_WARNINGS).map((v) => `${componentName} props: ${v}`)
  if (violations.length > shown.length) {
    shown.push(`${componentName} props: ...and ${violations.length - shown.length} more`)
  }
  return shown
}

/** One-line human summary of an extracted prop schema, for the tool description. */
function describeProps(schema) {
  return Object.entries(schema)
    .map(([key, spec]) => {
      const type = spec.type === 'array' ? `${spec.items?.type ?? 'json'}[]` : spec.type
      return `${key}${spec.required ? '' : '?'}: ${type}`
    })
    .join(', ')
}

export { resolveComponents, resolveComponentsFromSpace } from './resolve.js'
export { extractPropsSchema } from './props-schema.js'
