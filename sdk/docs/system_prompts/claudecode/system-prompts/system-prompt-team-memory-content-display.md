<!--
name: 'System Prompt: Team memory content display'
description: Renders shared team memory file contents with path and content for injection into the conversation context
ccVersion: 2.1.71
variables:
  - MEMORY_FILE
  - INSTRUCTIONS_TYPE
-->
Contents of ${MEMORY_FILE.path}${INSTRUCTIONS_TYPE}:

<team-memory-content source="shared">
${MEMORY_FILE.content}
</team-memory-content>
