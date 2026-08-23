export const description = 'Echo a message back, stamped so it is obvious the echo specialist (not THING) produced it.'

export const schema = {
  message: { type: 'string', required: true, description: 'The message to echo back.' },
}

export const outputSchema = { type: 'string' }

/** @param {{ message: string }} args */
export function echoBack(args) {
  return `[echo specialist] ${args.message}`
}
