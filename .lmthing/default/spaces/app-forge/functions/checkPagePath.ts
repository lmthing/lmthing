/**
 * Validate a page route for a project app's clean-URL routing.
 *
 * A page route is the AUTHORING form the view-spec format takes (`recipes/[id]`, `index`,
 * `feed/[articleId]`) — the same grammar `sdk/org/libs/cli/src/app/view-spec/schema.ts#ROUTE_PATTERN`
 * enforces and the SAME vocabulary a shell nav target, a `{ navigate }` action and the file
 * `views/<route>.view.json` all use. Ground rules from the docs
 * (org/docs/format/project/pages/view-spec.md, org/docs/app/routes.md):
 *
 *   - no leading slash, no trailing slash, no extension — `recipes/[id]`, never `/recipes/:id`
 *     or `recipes/[id].tsx` (the `.view.json` extension is added by the writer, never authored)
 *   - a static segment is kebab-case: lowercase letters, digits, hyphens, starting with a letter
 *     or digit (`feed`, `briefings`, `tag-cloud`)
 *   - a dynamic segment is `[param]` with a camelCase name starting lowercase (`[id]`, `[articleId]`)
 *   - `index` names a directory root
 *   - a first segment that is one of the pod's RESERVED_ROOT_SEGMENTS would be shadowed at the
 *     bare `/<project>/*` clean-URL mount (the server answers `api`, `app`, `assets`,
 *     `favicon.ico`, `install`, `chat`, `studio`, `computer` itself) — reported as a problem
 *
 * `route` is the cleaned candidate (surrounding whitespace and slashes stripped, nothing else
 * rewritten); `problems` is a finding list, never a verdict-with-reasons: every violation is
 * reported, not just the first. Note a route carrying a `[param]` is a drill-in, never a nav
 * destination — only a static route may appear in a shell nav.
 */
export function checkPagePath(path: string): { ok: boolean; route: string; problems: string[] } {
  const problems: string[] = [];
  const route = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');

  if (path.trim() === '') problems.push('route is empty — a page needs a route ("index" names the app root)');
  if (/^\//.test(path)) problems.push('leading "/" — routes are authored without one ("recipes/[id]", not "/recipes/:id")');
  if (/\/$/.test(path)) problems.push('trailing "/" — routes end on a segment');
  if (path !== path.trim()) problems.push('leading or trailing whitespace');
  if (/\.+[A-Za-z0-9]+$/.test(route)) problems.push('an extension — the route is bare ("recipes/[id]"); the writer adds ".view.json" itself');

  const RESERVED = ['api', 'app', 'assets', 'favicon.ico', 'install', 'chat', 'studio', 'computer'];
  const segments = route.split('/').filter((segment) => segment !== '');
  if (route !== '' && segments.length === 0) problems.push('empty segment — "//" is not a route');
  segments.forEach((segment, index) => {
    if (segment === '') { problems.push(`segment ${index + 1} is empty — "//" is not a route`); return; }
    if (index === 0 && RESERVED.includes(segment)) {
      problems.push(`"${segment}" is a reserved root segment — the pod serves it itself, so the clean URL "/<project>/${segment}" would never reach this page`);
    }
    if (/^\[[^\]]*\]$/.test(segment)) {
      const param = segment.slice(1, -1);
      if (param === '') problems.push(`"${segment}" — a dynamic segment needs a name ("[id]")`);
      else if (!/^[a-z][A-Za-z0-9]*$/.test(param)) problems.push(`"${segment}" — the parameter must be camelCase starting lowercase ("[id]", "[articleId]")`);
    } else if (!/^[a-z0-9][a-z0-9-]*$/.test(segment)) {
      problems.push(`"${segment}" — a static segment is kebab-case: lowercase letters, digits and hyphens, starting with a letter or digit`);
    }
  });

  // The whole grammar, as one check: anything still failing is caught here even where the
  // per-segment messages above could not name the offence.
  const ROUTE_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\/(?:[a-z0-9-]+|\[[a-z][A-Za-z0-9]*\]))*$/;
  if (route !== '' && problems.length === 0 && !ROUTE_PATTERN.test(route)) {
    problems.push(`"${route}" is not an authoring route — kebab-case segments, "[param]" for a dynamic one, no slashes at the ends`);
  }

  return { ok: problems.length === 0, route, problems };
}