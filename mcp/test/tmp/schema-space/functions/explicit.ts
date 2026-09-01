export const schema = { type: 'object', properties: { count: { type: 'integer', minimum: 1 } }, required: ['count'], additionalProperties: false };
export function explicit(count: unknown) { return count; }
