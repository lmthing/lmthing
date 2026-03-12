import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'

function NewWorkflowPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '64rem', margin: '0 auto' }}>
      <Heading level={2}>New Workflow</Heading>
      <Caption muted style={{ marginBottom: '2rem' }}>
        Create a new workflow by defining its steps and configuration.
      </Caption>
      <div className="panel">
        <div className="panel__header">Workflow Details</div>
        <div className="panel__body">
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  marginBottom: '0.25rem',
                }}
              >
                Name
              </label>
              <input className="input" placeholder="Workflow name" />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  marginBottom: '0.25rem',
                }}
              >
                Description
              </label>
              <input
                className="input"
                placeholder="What does this workflow do?"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '1.5rem',
          gap: '0.5rem',
        }}
      >
        <button className="btn btn--primary">Create Workflow</button>
      </div>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/new/',
)({
  component: NewWorkflowPage,
})
