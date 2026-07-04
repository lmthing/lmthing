export interface ParsedLab {
  analyte: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export interface ParsedLabReport {
  panel: string;
  takenAt?: string;
  labs: ParsedLab[];
}

/**
 * Deterministically parse a free-text lab report into structured analyte rows, so lab extraction
 * does not depend on the model reading free text. Handles the common line shape:
 *
 *   "LDL cholesterol: 190 mg/dL (reference range: 0-130)"
 *   "HDL cholesterol: 38 mg/dL (ref: 40-999)"
 *   "Triglycerides: 210 mg/dL (0-150)"
 *
 * Extracts the panel name (a header line containing "panel"/"test" or the first non-analyte line),
 * a specimen date (first ISO yyyy-mm-dd found), and one row per analyte line with value/unit and an
 * optional low-high reference range. Lines it cannot confidently read are skipped (never guessed).
 */
export function parseLabReport(text: string): ParsedLabReport {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let panel = 'Lab panel';
  let takenAt: string | undefined;
  const labs: ParsedLab[] = [];

  // First ISO date anywhere in the document = specimen/collection date.
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) takenAt = dateMatch[1];

  for (const line of lines) {
    // An analyte line has the shape "<name>: <value> <unit?> (<...low-high...>)?".
    const m = line.match(/^([A-Za-z][A-Za-z0-9 /()%,\-]*?):\s*(-?\d+(?:\.\d+)?)\s*([A-Za-z%/µ]+(?:\/[A-Za-z%]+)?)?\s*(.*)$/);
    if (!m) {
      // A header line naming the panel (e.g. "LIPID PANEL — ...").
      if (/panel|profile|test/i.test(line) && labs.length === 0 && !/:/.test(line.split('—')[1] ?? '')) {
        panel = line.split(/[—\-–|(]/)[0].trim() || panel;
      }
      continue;
    }
    const analyte = m[1].trim();
    const value = Number(m[2]);
    const unit = (m[3] ?? '').trim();
    const rest = m[4] ?? '';
    if (Number.isNaN(value) || !analyte) continue;

    let refLow: number | undefined;
    let refHigh: number | undefined;
    const range = rest.match(/(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)/);
    if (range) {
      refLow = Number(range[1]);
      refHigh = Number(range[2]);
      if (Number.isNaN(refLow)) refLow = undefined;
      if (Number.isNaN(refHigh)) refHigh = undefined;
    }
    labs.push({ analyte, value, unit, refLow, refHigh });
  }

  return { panel, takenAt, labs };
}
