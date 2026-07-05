export default {
  type: 'cron',
  daily: '09:00',
  // Each morning the pharmacy/pharmacist surveys the user's medications and their adherence_logs,
  // computes today's adherence, and surfaces any missed or still-due doses as a plain-language
  // reminder. It writes nothing that any insert hook watches (it may only update dose status), so the
  // pass is bounded to one morning reconcile.
  trigger: 'pharmacy/pharmacist#reminders',
  budget: { maxEpisodes: 4, maxWallClockMs: 300000 },
};
