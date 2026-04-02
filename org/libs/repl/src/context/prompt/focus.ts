/**
 * FocusController — manages section collapse/expand state.
 *
 * When focus is active, only specified sections are expanded;
 * others are collapsed to a one-line summary.
 */

export type SectionName =
  | 'globals'
  | 'scope'
  | 'components'
  | 'functions'
  | 'classes'
  | 'agents'
  | 'knowledge'
  | 'rules';

export class FocusController {
  private focusSections: Set<SectionName> | null = null;

  constructor(focusSections?: Set<SectionName> | Set<string> | null) {
    // Convert Set<string> to Set<SectionName> by filtering valid section names
    if (focusSections) {
      const validSections = Array.from(focusSections).filter(
        (s): s is SectionName =>
          s === 'globals' || s === 'scope' || s === 'components' ||
          s === 'functions' || s === 'classes' || s === 'agents' || s === 'knowledge'
      );
      this.focusSections = validSections.length > 0 ? new Set(validSections) : null;
    } else {
      this.focusSections = null;
    }
  }

  /**
   * Check if a section should be expanded.
   * If no focus is set, all sections are expanded.
   * Otherwise, only focused sections are expanded.
   */
  isExpanded(section: SectionName): boolean {
    if (this.focusSections === null) return true;
    return this.focusSections.has(section);
  }

  /**
   * Collapse a section's content into a one-line summary.
   */
  collapse(sectionName: SectionName, content: string, label: string): string {
    const lineCount = content.split('\n').length;
    return `[${label}] (${lineCount} lines collapsed)`;
  }

  /**
   * Update focus sections and return new instance.
   */
  update(focusSections: Set<SectionName> | null): FocusController {
    return new FocusController(focusSections);
  }

  /**
   * Get current focus sections.
   */
  getSections(): Set<SectionName> | null {
    return this.focusSections;
  }
}
