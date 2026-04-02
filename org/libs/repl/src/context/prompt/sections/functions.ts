/**
 * Functions section — function signatures and class signatures.
 */

import type { FocusController } from '../focus';

const AVAILABLE_CLASSES_HEADER = 'Available Classes';

export function buildFunctionsSection(
  functionSignatures?: string,
  classSignatures?: string,
  focus?: FocusController,
): string {
  const isExpanded = focus ? focus.isExpanded('functions') : true;
  const classesExpanded = focus ? focus.isExpanded('classes') : true;

  let content = '<functions>\n';

  // Function signatures
  if (functionSignatures && functionSignatures !== '(none)') {
    if (isExpanded) {
      content += functionSignatures;
    } else {
      const lineCount = functionSignatures.split('\n').length;
      content += `(${lineCount} functions available — use focus("functions") to expand)`;
    }
  } else {
    content += '(none)';
  }

  content += '\n\n';

  // Class signatures
  content += AVAILABLE_CLASSES_HEADER + '\n';
  if (classSignatures && classSignatures !== '(none)') {
    if (classesExpanded) {
      content += classSignatures;
    } else {
      const lineCount = classSignatures.split('\n').length;
      content += `(${lineCount} classes available — use focus("classes") to expand)`;
    }
  } else {
    content += '(none)';
  }

  content += '\n</functions>';
  return content;
}
