import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseFrontmatter } from './frontmatter.ts';
import type { TasklistDag, Unsupported } from './types.ts';

function stringList(value: unknown, path: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${path}: must be a list of strings`);
  return value;
}
function stringMap(value: unknown, path: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: must be a mapping`);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item)]));
}

/** Load markdown task nodes and surface retired code nodes as unsupported. */
export async function loadTasklists(dir: string, spaceDir: string, unsupported: Unsupported[]): Promise<Record<string, TasklistDag>> {
  let tasklistEntries;
  try { tasklistEntries = await readdir(dir, { withFileTypes: true }); }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
  const result: Record<string, TasklistDag> = {};
  for (const entry of tasklistEntries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const slug = entry.name; const taskDir = join(dir, slug);
    let goal: string | undefined; let input: Record<string, string> | undefined;
    try {
      const index = parseFrontmatter(await readFile(join(taskDir, 'index.md'), 'utf8'), relative(spaceDir, join(taskDir, 'index.md')));
      goal = index.body || undefined; input = stringMap(index.data.input, `${relative(spaceDir, taskDir)}/index.md input`);
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const nodes = [];
    const files = (await readdir(taskDir, { withFileTypes: true })).filter((item) => item.isFile()).map((item) => item.name).sort();
    for (const name of files) {
      if (!/^\d+-.*\.([a-z]+)$/.test(name) || name === 'index.md') continue;
      const file = join(taskDir, name);
      if (name.endsWith('.ts')) { unsupported.push({ path: relative(spaceDir, file), reason: 'tasklist code nodes are Unsupported' }); continue; }
      if (!name.endsWith('.md')) continue;
      const parsed = parseFrontmatter(await readFile(file, 'utf8'), relative(spaceDir, file));
      const fallback = name.replace(/^\d+-/, '').replace(/\.md$/, '');
      const id = typeof parsed.data.id === 'string' ? parsed.data.id : fallback;
      const role = parsed.data.role;
      if (role !== undefined && typeof role !== 'string') throw new Error(`${relative(spaceDir, file)}: role must be a string`);
      nodes.push({ id, file, title: typeof parsed.data.title === 'string' ? parsed.data.title : undefined, body: parsed.body, dependsOn: stringList(parsed.data.dependsOn, `${relative(spaceDir, file)} dependsOn`), condition: typeof parsed.data.condition === 'string' ? parsed.data.condition : undefined, forEach: typeof parsed.data.forEach === 'string' ? parsed.data.forEach : undefined, output: stringMap(parsed.data.output, `${relative(spaceDir, file)} output`), role });
    }
    result[slug] = { slug, dir: taskDir, goal, input, nodes };
  }
  return result;
}
