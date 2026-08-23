// Phase 1 stand-in for LMThing's mergeSystemInto (not ported — see
// dsh/packages/README.md roadmap): a thin re-export so this space's own
// loadSpace validation sees the function physically in ITS functions/, while
// the real implementation stays single-sourced in system-global.
export * from '../../system-global/functions/remember.js'
