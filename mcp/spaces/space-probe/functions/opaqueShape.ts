/** Preserve an intentionally opaque callback value.
 * @param callback A callback whose schema cannot be represented.
 */
export function opaqueShape(callback: (value: string) => string): string { return callback('probe'); }
