/**
 * Components section — form and view component signatures.
 */

import type { FocusController } from '../focus';

const FORM_COMPONENTS_HEADER = `Form Components — use ONLY inside ask()
Render these inside \`var data = await ask(<Component />)\`. Always follow with \`await stop(data)\` to read the values.
Each input must have a \`name\` attribute — the returned object maps name → submitted value.
Prefer to use MultiSelect, Select for better user experience.
Do NOT add a \`<form>\` tag — the host wraps automatically with Submit/Cancel buttons.`;

const DISPLAY_COMPONENTS_HEADER = `Display Components — use with display()
These components show output to the user. Use them with \`display(<Component ... />)\`. Non-blocking.`;

export function buildComponentsSection(
  formSignatures?: string,
  viewSignatures?: string,
  focus?: FocusController,
): string {
  const isExpanded = focus ? focus.isExpanded('components') : true;

  let content = '<components>\n';

  // Form components
  content += FORM_COMPONENTS_HEADER + '\n';
  if (formSignatures && formSignatures !== '(none)') {
    if (isExpanded) {
      content += formSignatures;
    } else {
      const lineCount = formSignatures.split('\n').length;
      content += `(${lineCount} form components available — use focus("components") to expand)`;
    }
  } else {
    content += '(none)';
  }

  content += '\n\n';

  // Display components
  content += DISPLAY_COMPONENTS_HEADER + '\n';
  if (viewSignatures && viewSignatures !== '(none)') {
    if (isExpanded) {
      content += viewSignatures;
    } else {
      const lineCount = viewSignatures.split('\n').length;
      content += `(${lineCount} display components available — use focus("components") to expand)`;
    }
  } else {
    content += '(none)';
  }

  content += '\n</components>';
  return content;
}
