import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseFrontmatter } from './frontmatter.ts';
import type { KnowledgeTree } from './types.ts';

async function directories(dir: string): Promise<string[]> {
  try { return (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

/** Read structured knowledge metadata; aspect bodies remain in their own files. */
export async function loadKnowledge(dir: string): Promise<KnowledgeTree> {
  const tree: KnowledgeTree = [];
  for (const domainName of await directories(dir)) {
    const domainDir = join(dir, domainName);
    let description: string | undefined;
    try { description = parseFrontmatter(await readFile(join(domainDir, 'index.md'), 'utf8'), relative(dir, join(domainDir, 'index.md'))).body || undefined; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const fields = [];
    for (const fieldName of await directories(domainDir)) {
      const fieldDir = join(domainDir, fieldName);
      let fieldDescription: string | undefined;
      try { fieldDescription = parseFrontmatter(await readFile(join(fieldDir, 'index.md'), 'utf8'), relative(dir, join(fieldDir, 'index.md'))).body || undefined; }
      catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const options = [];
      for (const entry of await readdir(fieldDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'index.md') continue;
        const file = join(fieldDir, entry.name);
        const parsed = parseFrontmatter(await readFile(file, 'utf8'), relative(dir, file));
        const keys = Object.keys(parsed.data);
        if (keys.length > 0) {
          const allowed = new Set(['description', 'icon', 'color', 'label']);
          const bad = keys.filter((key) => !allowed.has(key));
          if (bad.length || typeof parsed.data.description !== 'string' || !parsed.data.description.trim()) {
            throw new Error(`${relative(dir, file)}: aspect frontmatter requires a non-empty description and only permits description, icon, color, label`);
          }
        }
        const name = entry.name.slice(0, -3);
        options.push({ name, ref: `${domainName}/${fieldName}/${name}`, title: typeof parsed.data.label === 'string' ? parsed.data.label : undefined, description: typeof parsed.data.description === 'string' ? parsed.data.description : undefined, file });
      }
      options.sort((a, b) => a.name.localeCompare(b.name));
      fields.push({ name: fieldName, ref: `${domainName}/${fieldName}`, description: fieldDescription, options });
    }
    tree.push({ name: domainName, description, fields });
  }
  return tree;
}
