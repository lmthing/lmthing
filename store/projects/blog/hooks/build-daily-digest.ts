// hooks/build-daily-digest.ts — the scheduled morning curation pass.
// Every day at 07:00 the editorial curator assembles a fresh daily digest from the
// best recent articles (cluster + rank + write items). Declarative trigger.
export default {
  type: 'cron',
  daily: '07:00',
  trigger: 'editorial/curator#digest',
  budget: { maxEpisodes: 20, maxWallClockMs: 600000 },
};
