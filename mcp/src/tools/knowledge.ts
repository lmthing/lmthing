import { readFile } from 'node:fs/promises';
import { parseFrontmatter } from '../format/frontmatter.ts';
import type { KnowledgeField, KnowledgeOption } from '../format/types.ts';
import type { ToolDef, ToolGroup } from './ctx.ts';

const emptyObject = { type: 'object', properties: {}, additionalProperties: false } as const;

function active(ctx: Parameters<ToolGroup>[0]) {
  const agent = ctx.activeAgent(); const space = ctx.activeSpace();
  if (!agent || !space) throw new Error('No active agent selected');
  return { agent, space };
}

function fieldsForAgent(ctx: Parameters<ToolGroup>[0]): Array<{ field: KnowledgeField; options: KnowledgeOption[] }> {
  const { agent, space } = active(ctx);
  const selected = new Map<string, Set<string> | undefined>();
  for (const ref of agent.knowledge) {
    const [domain, field, option, ...extra] = ref.split('/');
    if (!domain || !field || extra.length) continue;
    const key = `${domain}/${field}`;
    if (!option) selected.set(key, undefined);
    else if (!selected.has(key)) selected.set(key, new Set([option]));
    else selected.get(key)?.add(option);
  }
  return space.knowledge.flatMap((domain) => domain.fields.flatMap((field) => {
    const allowed = selected.get(field.ref);
    if (!selected.has(field.ref)) return [];
    return [{ field, options: allowed === undefined ? field.options : field.options.filter((option) => allowed.has(option.name)) }];
  }));
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function excerpt(body: string, query: string): string {
  const index = body.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, index - 80); const end = Math.min(body.length, index + query.length + 120);
  return `${start ? '…' : ''}${body.slice(start, end).replace(/\s+/g, ' ').trim()}${end < body.length ? '…' : ''}`;
}

export const tools: ToolGroup = (ctx): ToolDef[] => [
  {
    name: 'list_knowledge', description: 'List the active agent’s declared knowledge domain, field, and option tree.', inputSchema: emptyObject,
    async handler() {
      const fields = fieldsForAgent(ctx);
      const domains = new Map<string, { name: string; description?: string; fields: object[] }>();
      const { space } = active(ctx);
      for (const domain of space.knowledge) domains.set(domain.name, { name: domain.name, description: domain.description, fields: [] });
      for (const { field, options } of fields) {
        const domain = domains.get(field.ref.split('/')[0]!);
        domain?.fields.push({ name: field.name, ref: field.ref, description: field.description, options: options.map((option) => ({ name: option.name, ref: option.ref, title: option.title, description: option.description })) });
      }
      return [...domains.values()].filter((domain) => domain.fields.length);
    },
  },
  {
    name: 'load_knowledge', description: 'Load one declared knowledge aspect, or a field overview and its option names.',
    inputSchema: { type: 'object', properties: { domain: { type: 'string' }, field: { type: 'string' }, option: { type: 'string' } }, required: ['domain', 'field'], additionalProperties: false },
    async handler(args) {
      const domain = requiredString(args, 'domain'); const fieldName = requiredString(args, 'field');
      const found = fieldsForAgent(ctx).find(({ field }) => field.ref === `${domain}/${fieldName}`);
      if (!found) throw new Error(`Knowledge field ${domain}/${fieldName} is not declared by the active agent`);
      const optionName = args.option === undefined ? undefined : requiredString(args, 'option');
      if (!optionName) return { ref: found.field.ref, description: found.field.description ?? '', options: found.options.map((option) => option.name) };
      const option = found.options.find((item) => item.name === optionName);
      if (!option) throw new Error(`Unknown knowledge option ${domain}/${fieldName}/${optionName}; available: ${found.options.map((item) => item.name).join(', ') || '(none)'}`);
      return { ref: option.ref, title: option.title, description: option.description, body: parseFrontmatter(await readFile(option.file, 'utf8'), option.file).body };
    },
  },
  {
    name: 'search_knowledge', description: 'Case-insensitively search bodies of knowledge aspects declared by the active agent.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
    async handler(args) {
      const query = requiredString(args, 'query'); const hits: object[] = [];
      for (const { options } of fieldsForAgent(ctx)) for (const option of options) {
        const body = parseFrontmatter(await readFile(option.file, 'utf8'), option.file).body;
        if (body.toLocaleLowerCase().includes(query.toLocaleLowerCase())) hits.push({ ref: option.ref, title: option.title ?? option.name, excerpt: excerpt(body, query) });
      }
      return hits;
    },
  },
];
