// Thin re-export so this space's own loadSpace validation sees the function physically in ITS
// functions/, while the real implementation stays single-sourced in system-global (matches
// dsh/system-spaces/user-thing/functions/remember.js's established pattern).
export * from '../../system-global/functions/remember.js'
