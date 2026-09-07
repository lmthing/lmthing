import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { Space } from './types.ts';

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/**
 * Load `components/{view,form}` under `dir`. Ported from
 * `sdk/org/libs/core/src/spaces/load.ts#loadComponents` — the fuller of the prior two
 * implementations (Part A1 design decision #4): the previous
 * `dsh/packages/space-format/src/load.js` version dropped the legacy `<Name>/{web,ink}.tsx`
 * directory-split fallback for `form/` components, so a not-yet-migrated on-disk space with that
 * layout silently produced no entry. Restored here.
 *
 * `mcp/src/format` never parses `components/` at all (the whole tree is reported `Unsupported`) —
 * it contributes nothing to this loader.
 */
export async function loadComponents(dir: string): Promise<Space['components']> {
  const componentsDir = join(dir, 'components');
  const view: Record<string, string> = {};
  const form: Record<string, string> = {};

  if (!(await dirExists(componentsDir))) return { view, form };

  const viewDir = join(componentsDir, 'view');
  if (await dirExists(viewDir)) {
    for (const file of (await listDir(viewDir)).sort()) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        view[basename(file, extname(file))] = await readFile(join(viewDir, file), 'utf8');
      }
    }
  }

  // Form components: one `<Name>.tsx`/`.ts` file each. A directory entry that still holds the
  // legacy `<Name>/{web,ink}.tsx` split is read defensively (prefer web.tsx) so a not-yet-migrated
  // on-disk space keeps loading.
  const formDir = join(componentsDir, 'form');
  if (await dirExists(formDir)) {
    for (const entry of (await listDir(formDir)).sort()) {
      const entryPath = join(formDir, entry);
      if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        form[basename(entry, extname(entry))] = await readFile(entryPath, 'utf8');
      } else if (await dirExists(entryPath)) {
        const webPath = join(entryPath, 'web.tsx');
        const inkPath = join(entryPath, 'ink.tsx');
        if (await fileExists(webPath)) form[entry] = await readFile(webPath, 'utf8');
        else if (await fileExists(inkPath)) form[entry] = await readFile(inkPath, 'utf8');
      }
    }
  }

  return { view, form };
}
