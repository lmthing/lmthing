/**
 * Scope section — workspace variables, pinned memory, and agent memos.
 */

import type { FocusController } from '../focus';

const FILE_BLOCK_DOCS = `### File Blocks — Write or patch files
Write files or apply diff patches using four-backtick blocks. These are NOT function calls — they are special syntax processed directly by the host before the next statement runs.

**Create / overwrite a file:**
\`\`\`\`path/to/output.ts
// full file content goes here
export function greet(name: string) { return \`Hello, \${name}!\` }
\`\`\`\`

**Patch an existing file** (requires a prior \`readFile('path')\` call this session):
\`\`\`\`diff path/to/output.ts
--- a/path/to/output.ts
+++ b/path/to/output.ts
@@ -1,3 +1,3 @@
 // full file content goes here
-export function greet(name: string) { return \`Hello, \${name}!\` }
+export function greet(name: string) { return \`Hello \${name}!\` }
\`\`\`\`

Rules:
- The closing line must be exactly four backticks on its own line.
- Diff patches require a prior \`await readFile('path')\` call on the same path this session.
- If a patch fails (context mismatch or unread file), you will receive a \`← error [FileError]\` — adjust and retry.
- Prefer diff patches for targeted edits to large files; use write blocks for new files or full rewrites.
- After a file block, continue writing TypeScript as normal — no \`await\` needed.`;

export function buildScopeSection(
  scope: string,
  pinnedBlock?: string,
  memoBlock?: string,
  focus?: FocusController,
): string {
  const isExpanded = focus ? focus.isExpanded('scope') : true;

  let content = '<scope>\n';

  // Workspace scope
  content += 'Workspace — Current Scope\n';
  content += scope || '(no variables declared)';

  // Pinned memory
  if (pinnedBlock) {
    content += '\n\nPinned Memory (survives decay — use unpin() to free)\n';
    content += pinnedBlock;
  }

  // Agent memos
  if (memoBlock) {
    content += '\n\nAgent Memos (your compressed notes — use memo(key, null) to delete)\n';
    content += memoBlock;
  }

  // File blocks documentation
  content += '\n\n' + FILE_BLOCK_DOCS;

  content += '\n</scope>';
  return content;
}
