import { cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { validateDag } from './dag.ts';
import { loadSpace } from './load.ts';
import { createExtractor } from '../schema/derive.ts';
import { SpaceFormatError, type Problem, type Space, type TaskNode } from './types.ts';

export type WriteResult = { ok: true; space: Space; schema?: unknown } | { ok: false; problems: Problem[] };

function problems(error: unknown): Problem[] {
  if (error instanceof SpaceFormatError) return error.problems;
  return [{ path: '', message: error instanceof Error ? error.message : String(error) }];
}
function inside(root: string, candidate: string): boolean { const rel = relative(root, candidate); return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel); }
function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) throw new Error(`${label} must be a slug containing only letters, numbers, _ or -`);
  return value;
}
async function candidateFor(spaceDir: string): Promise<{ root: string; candidate: string }> {
  const root = await mkdtemp(join(tmpdir(), 'lmthing-mcp-space-'));
  const candidate = join(root, 'space'); await cp(spaceDir, candidate, { recursive: true, dereference: false });
  return { root, candidate };
}
/**
 * Re-parse the space at its REAL location after a successful commit.
 *
 * Every writer validates a private copy under a temp dir and then renames the file into
 * place. Returning that CANDIDATE's `Space` — which is what they all used to do — hands the
 * caller a `dir`, an `id` (the temp dir's basename, so `"space"`) and per-function `file`
 * paths that all point inside a directory deleted moments later in the `finally`. Observed
 * live: `create_space` reported `/tmp/lmthing-mcp-create-…`, and `write_function` reported
 * the space's id as `"space"`. Harmless to the files on disk, actively misleading to a model
 * that reads the path back.
 */
async function committed(spaceDir: string, extract = false): Promise<Space> {
  return validate(spaceDir, extract);
}

async function validate(candidate: string, extract = false): Promise<Space> {
  return loadSpace(candidate, extract ? { extractorFor: createExtractor } : undefined);
}

/** Apply an edit in a private copy, re-parse it, then atomically replace just that file. */
export async function writeSpaceFile(spaceDir: string, path: string, content: string, extract = false): Promise<WriteResult> {
  let temp: { root: string; candidate: string } | undefined;
  try {
    if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error('path must remain inside the space directory');
    temp = await candidateFor(spaceDir);
    const file = resolve(temp.candidate, path);
    if (!inside(temp.candidate, file)) throw new Error('path must remain inside the space directory');
    await mkdir(dirname(file), { recursive: true }); await writeFile(file, content, 'utf8');
    const space = await validate(temp.candidate, extract);
    const target = resolve(spaceDir, path);
    if (!inside(spaceDir, target)) throw new Error('path must remain inside the space directory');
    await mkdir(dirname(target), { recursive: true }); await rename(file, target);
    return { ok: true, space: await committed(spaceDir, extract) };
  } catch (error) { return { ok: false, problems: problems(error) }; }
  finally { if (temp) await rm(temp.root, { recursive: true, force: true }); }
}

export async function createSpace(spacesDir: string, id: string): Promise<WriteResult> {
  let root: string | undefined;
  try {
    safeSegment(id, 'id'); const destination = resolve(spacesDir, id);
    if (!inside(resolve(spacesDir), destination)) throw new Error('id must remain inside spacesDir');
    try { await lstat(destination); throw new Error(`space already exists: ${id}`); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    root = await mkdtemp(join(tmpdir(), 'lmthing-mcp-create-')); const candidate = join(root, id);
    await mkdir(join(candidate, 'agents', 'agent'), { recursive: true });
    await writeFile(join(candidate, 'agents', 'agent', 'instruct.md'), '---\ntitle: Agent\n---\n\nYou are the space agent.\n', 'utf8');
    await validate(candidate); await mkdir(dirname(destination), { recursive: true }); await rename(candidate, destination);
    return { ok: true, space: await committed(destination) };
  } catch (error) { return { ok: false, problems: problems(error) }; }
  finally { if (root) await rm(root, { recursive: true, force: true }); }
}

export async function writeAgent(spaceDir: string, slug: string, frontmatter: unknown, instruct: string, charter?: string): Promise<WriteResult> {
  let temp: { root: string; candidate: string } | undefined;
  try {
    safeSegment(slug, 'slug'); if (typeof instruct !== 'string') throw new Error('instruct must be a string');
    if (frontmatter === null || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) throw new Error('frontmatter must be a mapping');
    if (charter !== undefined && typeof charter !== 'string') throw new Error('charter must be a string');
    temp = await candidateFor(spaceDir);
    const agentDir = join(temp.candidate, 'agents', slug); await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, 'instruct.md'), `---\n${stringify(frontmatter).trimEnd()}\n---\n\n${instruct}`, 'utf8');
    if (charter !== undefined) await writeFile(join(agentDir, 'charter.md'), charter, 'utf8');
    await validate(temp.candidate);
    const targetDir = join(spaceDir, 'agents', slug); await mkdir(targetDir, { recursive: true });
    await rename(join(agentDir, 'instruct.md'), join(targetDir, 'instruct.md'));
    if (charter !== undefined) await rename(join(agentDir, 'charter.md'), join(targetDir, 'charter.md'));
    // extract:true so a caller inspecting the returned agent's functions sees real schemas
    // rather than the 'no extractor' fallback — the two writers disagreed on this before.
    return { ok: true, space: await committed(spaceDir, true) };
  } catch (error) { return { ok: false, problems: problems(error) }; }
  finally { if (temp) await rm(temp.root, { recursive: true, force: true }); }
}

export async function writeFunction(spaceDir: string, name: string, source: string): Promise<WriteResult> {
  try {
    safeSegment(name, 'name'); if (typeof source !== 'string') throw new Error('source must be a string');
    const result = await writeSpaceFile(spaceDir, join('functions', `${name}.ts`), source, true);
    if (!result.ok) return result;
    const fn = result.space.functions.find((item) => item.name === name);
    if (!fn) return { ok: false, problems: [{ path: `functions/${name}.ts`, message: 'function extraction produced no matching export' }] };
    return { ...result, schema: fn.schema };
  } catch (error) { return { ok: false, problems: problems(error) }; }
}
export async function writeKnowledge(spaceDir: string, domain: string, field: string, option: string, body: string): Promise<WriteResult> {
  try { safeSegment(domain, 'domain'); safeSegment(field, 'field'); safeSegment(option, 'option'); if (typeof body !== 'string') throw new Error('body must be a string'); return writeSpaceFile(spaceDir, join('knowledge', domain, field, `${option}.md`), body); }
  catch (error) { return { ok: false, problems: problems(error) }; }
}

function nodeContent(node: Omit<TaskNode, 'file'>): string {
  const data: Record<string, unknown> = { id: node.id };
  if (node.title !== undefined) data.title = node.title;
  if (node.dependsOn.length) data.dependsOn = node.dependsOn;
  if (node.condition !== undefined) data.condition = node.condition;
  if (node.forEach !== undefined) data.forEach = node.forEach;
  if (node.output !== undefined) data.output = node.output;
  if (node.role !== undefined) data.role = node.role;
  return `---\n${stringify(data).trimEnd()}\n---\n\n${node.body}`;
}
export async function writeTasklistNode(spaceDir: string, slug: string, id: string, node: Omit<TaskNode, 'file' | 'id'>): Promise<WriteResult> {
  let temp: { root: string; candidate: string } | undefined;
  try {
    safeSegment(slug, 'slug'); safeSegment(id, 'id');
    temp = await candidateFor(spaceDir); const loaded = await validate(temp.candidate);
    const dag = loaded.tasklists[slug] ?? { slug, dir: join(temp.candidate, 'tasklists', slug), nodes: [] };
    const existing = dag.nodes.find((item) => item.id === id);
    const filename = existing ? basename(existing.file) : `${String(dag.nodes.length + 1).padStart(2, '0')}-${id}.md`;
    const relativePath = join('tasklists', slug, filename); const candidateFile = join(temp.candidate, relativePath);
    await mkdir(dirname(candidateFile), { recursive: true }); await writeFile(candidateFile, nodeContent({ ...node, id }), 'utf8');
    const parsed = await validate(temp.candidate); const issues = validateDag(parsed.tasklists[slug]!);
    if (issues.length) return { ok: false, problems: issues };
    const target = join(spaceDir, relativePath); await mkdir(dirname(target), { recursive: true }); await rename(candidateFile, target);
    return { ok: true, space: await committed(spaceDir) };
  } catch (error) { return { ok: false, problems: problems(error) }; }
  finally { if (temp) await rm(temp.root, { recursive: true, force: true }); }
}

export async function deleteSpaceFile(spaceDir: string, path: string): Promise<WriteResult> {
  let temp: { root: string; candidate: string } | undefined;
  try {
    if (!path || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error('path must remain inside the space directory');
    const target = resolve(spaceDir, path); if (!inside(resolve(spaceDir), target)) throw new Error('path must remain inside the space directory');
    const stat = await lstat(target); if (stat.isSymbolicLink()) throw new Error('refusing to delete a symlink'); if (!stat.isFile()) throw new Error('path must name one regular file');
    temp = await candidateFor(spaceDir); const candidateFile = resolve(temp.candidate, path); if (!inside(temp.candidate, candidateFile)) throw new Error('path must remain inside the space directory');
    const candidateStat = await lstat(candidateFile); if (candidateStat.isSymbolicLink()) throw new Error('refusing to delete a symlink');
    await rm(candidateFile); await validate(temp.candidate); await rm(target);
    return { ok: true, space: await committed(spaceDir) };
  } catch (error) { return { ok: false, problems: problems(error) }; }
  finally { if (temp) await rm(temp.root, { recursive: true, force: true }); }
}

export async function validateSpace(spaceDir: string): Promise<WriteResult> {
  try { return { ok: true, space: await validate(spaceDir) }; } catch (error) { return { ok: false, problems: problems(error) }; }
}
