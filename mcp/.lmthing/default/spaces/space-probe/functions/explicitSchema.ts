/** Echo a value using an explicitly supplied schema.
 * @param value The value to echo.
 */
export function explicitSchema(value: string): string { return value; }
export const schema = { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] };
