/**
 * One flagged lab result to summarize, as read from the `lab_results` table.
 */
export interface CareSummaryLab {
  analyte: string;
  value: number;
  unit: string;
  flag: string;
}

/**
 * One active medication to summarize. `adherencePct` is left `undefined` when the caller doesn't
 * have enough scored `adherence_logs` history yet to compute one — never a guessed number.
 */
export interface CareSummaryMedication {
  name: string;
  dose?: string;
  schedule?: string;
  adherencePct?: number;
}

/**
 * One recent observation from `insights`, already framed in plain language by the clinic
 * interpreter's digest.
 */
export interface CareSummaryInsight {
  body: string;
}

/**
 * One upcoming appointment from `appointments`.
 */
export interface CareSummaryAppointment {
  title: string;
  provider?: string;
  scheduledAt: string;
}

/**
 * One member of the user's care team from `care_contacts`.
 */
export interface CareSummaryContact {
  name: string;
  role: string;
  organization?: string;
  phone?: string;
}

export interface CareSummaryInput {
  scope: string;
  labs: CareSummaryLab[];
  medications: CareSummaryMedication[];
  insights: CareSummaryInsight[];
  appointments: CareSummaryAppointment[];
  contacts: CareSummaryContact[];
}

/**
 * Assemble the printable care-summary markdown the care/coordinator writes onto a `care_shares`
 * row. `scope` decides which sections appear and how much of each:
 *
 * - `'summary'` — a short version of every section (top 3 of each).
 * - `'labs'`    — labs only.
 * - `'meds'`    — medications only.
 * - `'full'`    — every section, in full.
 *
 * Pure string building — no db access, no side effects. The caller has already gathered the rows
 * (and, for medications, computed each `adherencePct`) before calling this; this function only
 * ever formats what it's given.
 */
export function buildCareSummary(input: CareSummaryInput): string {
  const { scope } = input;
  const short = scope === 'summary';
  const sections: string[] = [];

  const wantLabs = scope === 'full' || scope === 'summary' || scope === 'labs';
  const wantMeds = scope === 'full' || scope === 'summary' || scope === 'meds';
  const wantInsights = scope === 'full' || scope === 'summary';
  const wantAppointments = scope === 'full' || scope === 'summary';
  const wantContacts = scope === 'full' || scope === 'summary';

  if (wantLabs) {
    const labs = short ? input.labs.slice(0, 3) : input.labs;
    const lines = labs.map((l) => `- **${l.analyte}**: ${l.value} ${l.unit} (${l.flag})`);
    sections.push(`## Labs\n${lines.length > 0 ? lines.join('\n') : '_None flagged._'}`);
  }

  if (wantMeds) {
    const meds = short ? input.medications.slice(0, 3) : input.medications;
    const lines = meds.map((m) => {
      const parts = [m.name, m.dose, m.schedule].filter(Boolean).join(' — ');
      const adherence = m.adherencePct != null ? ` (${m.adherencePct}% adherence, recent)` : '';
      return `- ${parts}${adherence}`;
    });
    sections.push(`## Medications\n${lines.length > 0 ? lines.join('\n') : '_None on file._'}`);
  }

  if (wantInsights) {
    const insights = short ? input.insights.slice(0, 3) : input.insights;
    const lines = insights.map((i) => `- ${i.body}`);
    sections.push(`## Insights\n${lines.length > 0 ? lines.join('\n') : '_None yet._'}`);
  }

  if (wantAppointments) {
    const appointments = short ? input.appointments.slice(0, 3) : input.appointments;
    const lines = appointments.map(
      (a) => `- **${a.title}**${a.provider ? ` with ${a.provider}` : ''} — ${a.scheduledAt}`,
    );
    sections.push(`## Upcoming appointments\n${lines.length > 0 ? lines.join('\n') : '_None scheduled._'}`);
  }

  if (wantContacts) {
    const contacts = short ? input.contacts.slice(0, 3) : input.contacts;
    const lines = contacts.map(
      (c) => `- **${c.name}** (${c.role})${c.organization ? `, ${c.organization}` : ''}${c.phone ? ` — ${c.phone}` : ''}`,
    );
    sections.push(`## Care team\n${lines.length > 0 ? lines.join('\n') : '_None on file._'}`);
  }

  sections.push(
    '_This is a summary compiled from your own records, not medical advice — for you and your clinician to review together._',
  );

  return `# Care summary\n\n${sections.join('\n\n')}`;
}
