export interface TextState {
  text: string
  selectionStart: number
  selectionEnd: number
}

export function wrapSelection(state: TextState, before: string, after: string): TextState {
  const { text, selectionStart, selectionEnd } = state
  const selected = text.slice(selectionStart, selectionEnd)

  // Toggle: if already wrapped, unwrap
  const beforeText = text.slice(Math.max(0, selectionStart - before.length), selectionStart)
  const afterText = text.slice(selectionEnd, selectionEnd + after.length)
  if (beforeText === before && afterText === after) {
    return {
      text: text.slice(0, selectionStart - before.length) + selected + text.slice(selectionEnd + after.length),
      selectionStart: selectionStart - before.length,
      selectionEnd: selectionEnd - before.length,
    }
  }

  const wrapped = `${before}${selected || 'text'}${after}`
  return {
    text: text.slice(0, selectionStart) + wrapped + text.slice(selectionEnd),
    selectionStart: selectionStart + before.length,
    selectionEnd: selectionStart + before.length + (selected || 'text').length,
  }
}

export function insertLinePrefix(state: TextState, prefix: string): TextState {
  const { text, selectionStart } = state
  const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1
  const currentLine = text.slice(lineStart, text.indexOf('\n', selectionStart) === -1 ? undefined : text.indexOf('\n', selectionStart))

  // Toggle: if line already starts with prefix, remove it
  if (currentLine.startsWith(prefix)) {
    return {
      text: text.slice(0, lineStart) + currentLine.slice(prefix.length) + text.slice(lineStart + currentLine.length),
      selectionStart: selectionStart - prefix.length,
      selectionEnd: selectionStart - prefix.length,
    }
  }

  return {
    text: text.slice(0, lineStart) + prefix + text.slice(lineStart),
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionStart + prefix.length,
  }
}

export function insertCodeBlock(state: TextState): TextState {
  const { text, selectionStart, selectionEnd } = state
  const selected = text.slice(selectionStart, selectionEnd)
  const block = `\`\`\`\n${selected || 'code'}\n\`\`\``
  return {
    text: text.slice(0, selectionStart) + block + text.slice(selectionEnd),
    selectionStart: selectionStart + 4,
    selectionEnd: selectionStart + 4 + (selected || 'code').length,
  }
}

export function insertLink(state: TextState): TextState {
  const { text, selectionStart, selectionEnd } = state
  const selected = text.slice(selectionStart, selectionEnd)
  const link = `[${selected || 'text'}](url)`
  return {
    text: text.slice(0, selectionStart) + link + text.slice(selectionEnd),
    selectionStart: selected ? selectionStart + selected.length + 3 : selectionStart + 1,
    selectionEnd: selected ? selectionStart + selected.length + 6 : selectionStart + 5,
  }
}

export function insertHR(state: TextState): TextState {
  const { text, selectionStart } = state
  const hr = '\n---\n'
  return {
    text: text.slice(0, selectionStart) + hr + text.slice(selectionStart),
    selectionStart: selectionStart + hr.length,
    selectionEnd: selectionStart + hr.length,
  }
}

export function insertTab(state: TextState): TextState {
  const { text, selectionStart } = state
  const tab = '  '
  return {
    text: text.slice(0, selectionStart) + tab + text.slice(selectionStart),
    selectionStart: selectionStart + tab.length,
    selectionEnd: selectionStart + tab.length,
  }
}
