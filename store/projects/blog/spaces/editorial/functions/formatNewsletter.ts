/**
 * Render a list of digest items into a send-ready markdown newsletter body: an H1 title, a short
 * rule, and one section per item (its own title as an H2, the blurb as body text, and a "Read
 * more" link when a `url` is available). Items with no `blurb` still get a section — a bare
 * headline is better than silently dropping a slot the curator chose to include.
 */
export function formatNewsletter(
  title: string,
  items: { title: string; blurb?: string; url?: string }[],
): string {
  const sections = items.map((item) => {
    const lines = [`## ${item.title}`];
    if (item.blurb) lines.push('', item.blurb);
    if (item.url) lines.push('', `[Read more](${item.url})`);
    return lines.join('\n');
  });

  return [`# ${title}`, '', ...sections.join('\n\n---\n\n').split('\n')].join('\n');
}
