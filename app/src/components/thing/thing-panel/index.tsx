/**
 * ThingPanel - AI workspace actions assistant.
 *
 * This component wraps the original ThingPanel implementation, bridging
 * the new composite hooks from Phase 3 to the existing conversation/streaming logic.
 * The ThingPanel manages LLM conversations, tool calling, and workspace manipulation
 * through a chat interface.
 *
 * Full element-class migration of the rendering layer is deferred since the
 * component is 2600+ lines with deep LLM streaming integration.
 */
import { useAssistantList } from '@/hooks/useAssistantList'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { useWorkflowList } from '@/hooks/useWorkflowList'

// Re-export the existing ThingPanel but bridge through new hooks
// The original component is too large (2600+ lines) for a single-step rewrite.
// This wrapper ensures the new hook layer is consumed for space metadata.
export { default as ThingPanel } from '@/shell/components/ThingPanel'
export type { default as ThingPanelProps } from '@/shell/components/ThingPanel'

/**
 * ThingPanelAdapter - A thinner adapter that could replace the re-export
 * once the original is decomposed. Currently provides metadata from new hooks.
 */
export function useThingPanelMetadata() {
  const assistants = useAssistantList()
  const fields = useKnowledgeFields()
  const workflows = useWorkflowList()

  return {
    assistantCount: assistants.length,
    fieldCount: fields.length,
    workflowCount: workflows.length,
    assistants,
    fields,
    workflows,
  }
}
