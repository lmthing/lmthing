/** Join tag labels into one readable string.
 * @param tags The tag labels to join.
 * @param sep The optional separator.
 */
export function joinTags(tags: string[], sep = ', '): string { return tags.join(sep); }
