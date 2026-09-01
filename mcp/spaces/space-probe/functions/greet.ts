/** Produce a friendly greeting for one name.
 * @param name The person to greet.
 * @param greeting The optional greeting word.
 */
export function greet(name: string, greeting = 'Hello'): string { return `${greeting}, ${name}!`; }
