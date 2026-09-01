/** Summarize a titled piece of input as a single line.
 * @param input The titled content to summarize.
 */
export function summarize(input: { title: string; body: string }): string { return `${input.title}: ${input.body}`; }
